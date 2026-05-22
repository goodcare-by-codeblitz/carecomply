import {
	getPlanFromStripePriceId,
	isKnownBillingPlan,
	normalizeBillingPlan,
	type BillingInterval,
	type BillingPlan,
	type BillingStatus,
} from '@/lib/billing';
import { createUserAuditLog } from '@/lib/audit-server';
import { PERMISSIONS } from '@/lib/permissions';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { getStripe } from '@/lib/stripe';
import { NextResponse } from 'next/server';
import type Stripe from 'stripe';

type SyncCheckoutRequest = {
	orgId?: string;
	orgSlug?: string;
	sessionId?: string;
};

export async function POST(request: Request) {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		return NextResponse.json(
			{ ok: false, message: 'Sign in before syncing checkout.' },
			{ status: 401 },
		);
	}

	const payload = (await request.json().catch(() => null)) as SyncCheckoutRequest | null;
	if (!payload?.sessionId) {
		return NextResponse.json(
			{ ok: false, message: 'Missing checkout session.' },
			{ status: 400 },
		);
	}

	const organization = await resolveOrganization(
		supabase,
		user.id,
		payload.orgId,
		payload.orgSlug,
	);

	if (!organization) {
		return NextResponse.json(
			{ ok: false, message: 'Organization was not found.' },
			{ status: 404 },
		);
	}

	const { data: canManageBilling } = await supabase.rpc('has_org_permission', {
		p_org_id: organization.id,
		p_permission_code: PERMISSIONS.BILLING_MANAGE,
	});

	if (!canManageBilling) {
		return NextResponse.json(
			{ ok: false, message: 'You do not have permission to manage billing.' },
			{ status: 403 },
		);
	}

	const stripe = getStripe();
	const session = await stripe.checkout.sessions.retrieve(payload.sessionId, {
		expand: ['subscription'],
	});

	if (session.metadata?.organization_id !== organization.id) {
		return NextResponse.json(
			{ ok: false, message: 'Checkout session does not belong to this organization.' },
			{ status: 403 },
		);
	}

	const subscription =
		typeof session.subscription === 'string'
			? await stripe.subscriptions.retrieve(session.subscription)
			: session.subscription;

	if (!subscription) {
		return NextResponse.json(
			{ ok: false, message: 'Checkout has not created a subscription yet.' },
			{ status: 409 },
		);
	}

	const sub = subscription as Stripe.Subscription & {
		current_period_start?: number;
		current_period_end?: number;
		trial_start?: number | null;
	};
	const priceId = subscription.items.data[0]?.price.id ?? null;
	const planFromPrice = getPlanFromStripePriceId(priceId);
	const plan = planFromPrice?.plan ?? getBillingPlan(session.metadata?.plan);
	const interval =
		planFromPrice?.interval ?? getBillingInterval(session.metadata?.interval);

	if (!plan || !interval) {
		return NextResponse.json(
			{ ok: false, message: 'Checkout package could not be resolved.' },
			{ status: 409 },
		);
	}

	const admin = createAdminClient();
	const { error } = await admin.from('organization_billing').upsert(
		{
			organization_id: organization.id,
			plan,
			interval,
			status: mapSubscriptionStatus(subscription.status),
			stripe_customer_id: getStripeId(subscription.customer) ?? getStripeId(session.customer),
			stripe_subscription_id: subscription.id,
			stripe_price_id: priceId,
			current_period_start: fromStripeTimestamp(sub.current_period_start),
			current_period_end: fromStripeTimestamp(sub.current_period_end),
			trial_start: fromStripeTimestamp(sub.trial_start),
			trial_end: fromStripeTimestamp(subscription.trial_end),
			cancel_at_period_end: subscription.cancel_at_period_end,
		},
		{ onConflict: 'organization_id' },
	);

	if (error) {
		console.error('[billing-checkout-sync] failed to sync checkout', {
			organizationId: organization.id,
			sessionId: session.id,
			error,
		});
		return NextResponse.json(
			{ ok: false, message: 'Checkout completed, but billing could not be synced.' },
			{ status: 500 },
		);
	}

	await createUserAuditLog({
		action: 'billing.checkout_completed',
		entityType: 'billing',
		organizationId: organization.id,
		entityId: organization.id,
		entityName: session.id,
		details: {
			plan,
			interval,
			stripe_checkout_session_id: session.id,
			stripe_subscription_id: subscription.id,
			stripe_customer_id: getStripeId(subscription.customer) ?? getStripeId(session.customer),
			stripe_price_id: priceId,
			permission_checked: PERMISSIONS.BILLING_MANAGE,
			outcome: 'checkout_synced_from_success_return',
		},
		request,
	});

	return NextResponse.json({
		ok: true,
		plan,
		interval,
		status: mapSubscriptionStatus(subscription.status),
		message: `${plan === 'pro' ? 'Pro' : 'Starter'} package is now active.`,
	});
}

async function resolveOrganization(
	supabase: Awaited<ReturnType<typeof createClient>>,
	userId: string,
	orgId?: string,
	orgSlug?: string,
) {
	let query = supabase
		.from('organizations')
		.select('id, slug, organization_memberships!inner(user_id, deleted_at)')
		.eq('organization_memberships.user_id', userId)
		.is('organization_memberships.deleted_at', null);

	if (orgId) {
		query = query.eq('id', orgId);
	} else if (orgSlug) {
		query = query.eq('slug', orgSlug);
	} else {
		return null;
	}

	const { data, error } = await query.maybeSingle();
	if (error || !data) return null;
	return { id: data.id as string, slug: data.slug as string };
}

function getBillingPlan(value: string | null | undefined): BillingPlan | null {
	return isKnownBillingPlan(value) ? normalizeBillingPlan(value) : null;
}

function getBillingInterval(value: string | null | undefined): BillingInterval | null {
	if (value === 'monthly' || value === 'yearly') return value;
	return null;
}

function mapSubscriptionStatus(status: Stripe.Subscription.Status): BillingStatus {
	switch (status) {
		case 'trialing':
			return 'trialing';
		case 'active':
			return 'active';
		case 'past_due':
			return 'past_due';
		case 'canceled':
		case 'unpaid':
			return 'canceled';
		default:
			return 'past_due';
	}
}

function fromStripeTimestamp(timestamp: number | null | undefined) {
	return timestamp ? new Date(timestamp * 1000).toISOString() : null;
}

function getStripeId(value: string | { id: string } | null | undefined) {
	if (!value) return null;
	return typeof value === 'string' ? value : value.id;
}

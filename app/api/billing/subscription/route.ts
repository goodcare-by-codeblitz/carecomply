import {
	getPricingPlan,
	getStripePriceEnvKey,
	getStripePriceId,
	type BillingInterval,
	type BillingPlan,
} from '@/lib/billing';
import { createUserAuditLog } from '@/lib/audit-server';
import { PERMISSIONS } from '@/lib/permissions';
import { getStripe } from '@/lib/stripe';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import type Stripe from 'stripe';

type SubscriptionChangeRequest = {
	planId?: BillingPlan;
	interval?: BillingInterval;
	orgSlug?: string;
	orgId?: string;
};

export async function POST(request: Request) {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		return NextResponse.json(
			{ ok: false, message: 'Sign in before changing a subscription.' },
			{ status: 401 },
		);
	}

	let payload: SubscriptionChangeRequest;

	try {
		payload = (await request.json()) as SubscriptionChangeRequest;
	} catch {
		return NextResponse.json(
			{ ok: false, message: 'Invalid subscription change request.' },
			{ status: 400 },
		);
	}

	const plan = payload.planId ? getPricingPlan(payload.planId) : null;
	const interval = payload.interval ?? 'monthly';

	if (!plan) {
		return NextResponse.json(
			{ ok: false, message: 'Invalid billing plan.' },
			{ status: 400 },
		);
	}

	if (plan.isEnterprise) {
		return NextResponse.json(
			{ ok: false, message: 'Contact sales for Guardian+ pricing.' },
			{ status: 400 },
		);
	}

	if (interval !== 'monthly' && interval !== 'yearly') {
		return NextResponse.json(
			{ ok: false, message: 'Invalid billing interval.' },
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

	const { data: billing } = await supabase
		.from('organization_billing')
		.select('stripe_subscription_id')
		.eq('organization_id', organization.id)
		.maybeSingle();

	if (!billing?.stripe_subscription_id) {
		return NextResponse.json(
			{
				ok: false,
				message: 'No existing subscription was found. Start checkout first.',
				useCheckout: true,
			},
			{ status: 404 },
		);
	}

	const priceId = getStripePriceId(plan.id, interval);
	const priceEnvKey = getStripePriceEnvKey(plan.id, interval);

	if (!priceId) {
		return NextResponse.json(
			{
				ok: false,
				message: `Stripe price is not configured for ${plan.name} ${interval}.`,
				stripePriceEnvKey: priceEnvKey,
			},
			{ status: 501 },
		);
	}

	const stripe = getStripe();
	const [price, subscription] = await Promise.all([
		getStripePrice(stripe, priceId),
		stripe.subscriptions.retrieve(billing.stripe_subscription_id),
	]);

	if (!price) {
		return NextResponse.json(
			{ ok: false, message: `Stripe price ${priceId} could not be verified.` },
			{ status: 501 },
		);
	}

	if (!price.active || price.type !== 'recurring') {
		return NextResponse.json(
			{ ok: false, message: `Stripe price ${priceId} must be an active recurring price.` },
			{ status: 501 },
		);
	}

	if (subscription.status === 'canceled') {
		return NextResponse.json(
			{
				ok: false,
				message: 'This subscription is canceled. Start checkout to subscribe again.',
				useCheckout: true,
			},
			{ status: 409 },
		);
	}

	const item = subscription.items.data[0];

	if (!item) {
		return NextResponse.json(
			{ ok: false, message: 'No subscription item was found to update.' },
			{ status: 409 },
		);
	}

	if (item.price.id === priceId) {
		return NextResponse.json({
			ok: true,
			unchanged: true,
			message: 'This subscription is already on the selected package.',
		});
	}

	await stripe.subscriptions.update(subscription.id, {
		cancel_at_period_end: false,
		proration_behavior: 'always_invoice',
		payment_behavior: 'pending_if_incomplete',
		items: [
			{
				id: item.id,
				price: priceId,
			},
		],
		metadata: {
			...subscription.metadata,
			organization_id: organization.id,
			user_id: user.id,
			plan: plan.id,
			interval,
		},
	});

	await createUserAuditLog({
		action: 'billing.subscription_change_requested',
		entityType: 'billing',
		organizationId: organization.id,
		entityId: organization.id,
		entityName: `${plan.name} ${interval}`,
		details: {
			before: {
				stripe_price_id: item.price.id,
				stripe_subscription_status: subscription.status,
			},
			after: {
				plan: plan.id,
				plan_name: plan.name,
				interval,
				stripe_price_id: priceId,
			},
			stripe_subscription_id: subscription.id,
			permission_checked: PERMISSIONS.BILLING_MANAGE,
			outcome: 'subscription_update_submitted_to_stripe',
		},
		request,
	});

	return NextResponse.json({
		ok: true,
		message: 'Subscription change submitted. Billing will update after Stripe confirms it.',
	});
}

async function getStripePrice(stripe: Stripe, priceId: string) {
	try {
		return await stripe.prices.retrieve(priceId);
	} catch {
		return null;
	}
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

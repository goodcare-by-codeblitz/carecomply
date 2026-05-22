import {
	getPricingPlan,
	getStripePriceEnvKey,
	getStripePriceId,
	normalizeBillingPlan,
	type BillingInterval,
	type BillingPlan,
	type BillingStatus,
} from '@/lib/billing';
import { createUserAuditLog } from '@/lib/audit-server';
import { PERMISSIONS } from '@/lib/permissions';
import { createAdminClient } from '@/lib/supabase/admin';
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
			{ ok: false, message: 'Contact sales for custom pricing.' },
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
		.select('plan, status, stripe_subscription_id')
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
		const reconciliation = await applyImmediateUpgrade({
			organizationId: organization.id,
			currentPlan: billing.plan,
			currentStatus: billing.status,
			targetPlan: plan.id,
			interval,
			priceId,
			subscription,
		});

		if (reconciliation.error) {
			return reconciliation.error;
		}

		return NextResponse.json({
			ok: true,
			unchanged: true,
			localAccessUpdated: reconciliation.localAccessUpdated,
			message: reconciliation.localAccessUpdated
				? 'Plan upgraded. Pro features are now available.'
				: 'This subscription is already on the selected package.',
		});
	}

	const updatedSubscription = await stripe.subscriptions.update(subscription.id, {
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
	const immediateUpgrade = await applyImmediateUpgrade({
		organizationId: organization.id,
		currentPlan: billing.plan,
		currentStatus: billing.status,
		targetPlan: plan.id,
		interval,
		priceId,
		subscription: updatedSubscription,
	});

	if (immediateUpgrade.error) {
		return immediateUpgrade.error;
	}

	await createUserAuditLog({
		action: 'billing.subscription_change_requested',
		entityType: 'billing',
		organizationId: organization.id,
		entityId: organization.id,
		entityName: `${plan.name} ${interval}`,
		details: {
			before: {
				plan: normalizeBillingPlan(billing.plan),
				stripe_price_id: item.price.id,
				stripe_subscription_status: subscription.status,
			},
			after: {
				plan: plan.id,
				plan_name: plan.name,
				interval,
				stripe_price_id: priceId,
			},
			stripe_subscription_id: updatedSubscription.id,
			local_access_updated: immediateUpgrade.localAccessUpdated,
			permission_checked: PERMISSIONS.BILLING_MANAGE,
			outcome: immediateUpgrade.localAccessUpdated
				? 'subscription_upgrade_applied_locally'
				: 'subscription_update_submitted_to_stripe',
		},
		request,
	});

	return NextResponse.json({
		ok: true,
		localAccessUpdated: immediateUpgrade.localAccessUpdated,
		message: immediateUpgrade.localAccessUpdated
			? 'Plan upgraded. Pro features are now available.'
			: 'Subscription change submitted. Billing will update after Stripe confirms it.',
	});
}

async function getStripePrice(stripe: Stripe, priceId: string) {
	try {
		return await stripe.prices.retrieve(priceId);
	} catch {
		return null;
	}
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

function mapLocalBillingStatus(status: string | null | undefined): BillingStatus {
	switch (status) {
		case 'trialing':
		case 'active':
		case 'past_due':
		case 'canceled':
			return status;
		default:
			return 'not_configured';
	}
}

async function applyImmediateUpgrade({
	organizationId,
	currentPlan,
	currentStatus,
	targetPlan,
	interval,
	priceId,
	subscription,
}: {
	organizationId: string;
	currentPlan: string | null;
	currentStatus: string | null;
	targetPlan: BillingPlan;
	interval: BillingInterval;
	priceId: string;
	subscription: Stripe.Subscription;
}) {
	const subscriptionStatus = mapSubscriptionStatus(subscription.status);
	const currentBillingStatus = mapLocalBillingStatus(currentStatus);
	const shouldApply =
		normalizeBillingPlan(currentPlan) === 'starter' && targetPlan === 'pro';
	const entitlementStatus =
		subscriptionStatus === 'active' || subscriptionStatus === 'trialing'
			? subscriptionStatus
			: currentBillingStatus === 'active' || currentBillingStatus === 'trialing'
				? currentBillingStatus
				: subscriptionStatus;
	const localAccessUpdated =
		shouldApply &&
		(entitlementStatus === 'active' || entitlementStatus === 'trialing');

	if (!shouldApply) {
		return { localAccessUpdated: false };
	}

	const admin = createAdminClient();
	const { error: updateError } = await admin
		.from('organization_billing')
		.update({
			plan: targetPlan,
			interval,
			status: entitlementStatus,
			stripe_subscription_id: subscription.id,
			stripe_price_id: priceId,
			cancel_at_period_end: subscription.cancel_at_period_end,
		})
		.eq('organization_id', organizationId);

	if (updateError) {
		console.error('[billing-subscription] failed to apply upgrade locally', {
			organizationId,
			stripeSubscriptionId: subscription.id,
			error: updateError,
		});
		return {
			localAccessUpdated: false,
			error: NextResponse.json(
				{
					ok: false,
					message:
						'Stripe accepted the upgrade, but billing could not be updated locally. Please refresh shortly.',
				},
				{ status: 500 },
			),
		};
	}

	return { localAccessUpdated };
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

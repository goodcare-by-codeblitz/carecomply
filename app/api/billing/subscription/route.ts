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
import { getSubscriptionChangeMode } from '@/lib/billing-subscription-change';
import { captureBillingException } from '@/lib/billing-monitoring';
import { billingStripeErrorResponse } from '@/lib/billing-stripe-errors';
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

	let stripe: Stripe;
	let price: Stripe.Price | null;
	let subscription: Stripe.Subscription;
	try {
		stripe = getStripe();
		[price, subscription] = await Promise.all([
			getStripePrice(stripe, priceId),
			stripe.subscriptions.retrieve(billing.stripe_subscription_id),
		]);
	} catch (error) {
		captureBillingException(error, {
			operation: 'subscription_stripe_retrieve',
			organizationId: organization.id,
			stripeSubscriptionId: billing.stripe_subscription_id,
			extra: { plan: plan.id, interval, stripe_price_id: priceId },
		});
		return billingStripeErrorResponse(error, {
			code: 'stripe_subscription_update_failed',
			message: 'Subscription change could not be submitted.',
		});
	}

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

	const changeMode = getSubscriptionChangeMode({
		currentPlan: billing.plan,
		targetPlan: plan.id,
	});

	if (changeMode === 'scheduled_downgrade') {
		const periodEnd = getSubscriptionPeriodEnd(subscription);
		if (!periodEnd) {
			return NextResponse.json(
				{
					ok: false,
					message:
						'This downgrade could not be scheduled because Stripe did not provide a current period end.',
				},
				{ status: 409 },
			);
		}

		let schedule: Stripe.SubscriptionSchedule;
		try {
			schedule = await createOrUpdateDowngradeSchedule({
				stripe,
				subscription,
				item,
				targetPriceId: priceId,
				periodEnd,
				metadata: {
					organization_id: organization.id,
					user_id: user.id,
					plan: plan.id,
					interval,
				},
			});
		} catch (error) {
			captureBillingException(error, {
				operation: 'subscription_schedule_downgrade',
				organizationId: organization.id,
				stripeSubscriptionId: subscription.id,
				extra: { plan: plan.id, interval, stripe_price_id: priceId },
			});
			return billingStripeErrorResponse(error, {
				code: 'stripe_subscription_update_failed',
				message: 'Subscription downgrade could not be scheduled.',
			});
		}

		const effectiveAt = fromStripeTimestamp(periodEnd);
		const admin = createAdminClient();
		const { error: scheduleUpdateError } = await admin
			.from('organization_billing')
			.update({
				scheduled_plan: plan.id,
				scheduled_interval: interval,
				scheduled_effective_at: effectiveAt,
				stripe_subscription_schedule_id: schedule.id,
				last_billing_state_change_at: new Date().toISOString(),
			})
			.eq('organization_id', organization.id);

		if (scheduleUpdateError) {
			console.error('[billing-subscription] failed to save scheduled downgrade', {
				organizationId: organization.id,
				stripeSubscriptionScheduleId: schedule.id,
				error: scheduleUpdateError,
			});
			return NextResponse.json(
				{
					ok: false,
					message:
						'Stripe scheduled the downgrade, but billing could not be updated locally. Please refresh shortly.',
				},
				{ status: 500 },
			);
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
				stripe_subscription_id: subscription.id,
				stripe_subscription_schedule_id: schedule.id,
				scheduled_effective_at: effectiveAt,
				local_access_updated: false,
				permission_checked: PERMISSIONS.BILLING_MANAGE,
				outcome: 'subscription_downgrade_scheduled',
			},
			request,
		});

		return NextResponse.json({
			ok: true,
			scheduled: true,
			localAccessUpdated: false,
			scheduledChange: {
				plan: plan.id,
				interval,
				effectiveAt,
				stripeSubscriptionScheduleId: schedule.id,
			},
			message: `Downgrade scheduled. Pro access remains available until ${new Intl.DateTimeFormat(
				'en-GB',
				{
					day: 'numeric',
					month: 'short',
					year: 'numeric',
				},
			).format(new Date(effectiveAt))}.`,
		});
	}

	let updatedSubscription: Stripe.Subscription;
	try {
		updatedSubscription = await stripe.subscriptions.update(subscription.id, {
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
	} catch (error) {
		captureBillingException(error, {
			operation: 'subscription_update',
			organizationId: organization.id,
			stripeSubscriptionId: subscription.id,
			extra: { plan: plan.id, interval, stripe_price_id: priceId },
		});
		return billingStripeErrorResponse(error, {
			code: 'stripe_subscription_update_failed',
			message: 'Subscription change could not be submitted.',
		});
	}
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

function getSubscriptionPeriodEnd(subscription: Stripe.Subscription) {
	return (
		subscription as Stripe.Subscription & { current_period_end?: number | null }
	).current_period_end ?? null;
}

function getSubscriptionPeriodStart(subscription: Stripe.Subscription) {
	return (
		subscription as Stripe.Subscription & { current_period_start?: number | null }
	).current_period_start ?? Math.floor(Date.now() / 1000);
}

function fromStripeTimestamp(timestamp: number) {
	return new Date(timestamp * 1000).toISOString();
}

async function createOrUpdateDowngradeSchedule({
	stripe,
	subscription,
	item,
	targetPriceId,
	periodEnd,
	metadata,
}: {
	stripe: Stripe;
	subscription: Stripe.Subscription;
	item: Stripe.SubscriptionItem;
	targetPriceId: string;
	periodEnd: number;
	metadata: Record<string, string>;
}) {
	const existingScheduleId = getStripeId(subscription.schedule);
	const schedule = existingScheduleId
		? await stripe.subscriptionSchedules.retrieve(existingScheduleId)
		: await stripe.subscriptionSchedules.create({
				from_subscription: subscription.id,
			});
	const phaseStart =
		schedule.current_phase?.start_date ?? getSubscriptionPeriodStart(subscription);

	return await stripe.subscriptionSchedules.update(schedule.id, {
		end_behavior: 'release',
		metadata,
		phases: [
			{
				start_date: phaseStart,
				end_date: periodEnd,
				items: [
					{
						price: item.price.id,
						quantity: item.quantity ?? 1,
					},
				],
				metadata: {
					...subscription.metadata,
					organization_id: metadata.organization_id,
					plan: normalizeBillingPlan(subscription.metadata?.plan),
					interval: subscription.metadata?.interval ?? 'monthly',
				},
			},
			{
				items: [
					{
						price: targetPriceId,
						quantity: item.quantity ?? 1,
					},
				],
				metadata,
			},
		],
	});
}

function getStripeId(value: string | { id: string } | null | undefined) {
	if (!value) return null;
	return typeof value === 'string' ? value : value.id;
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
		case 'unpaid':
		case 'incomplete':
			return 'past_due';
		case 'canceled':
		case 'incomplete_expired':
			return 'canceled';
		case 'paused':
			return 'not_configured';
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
			grace_period_ends_at:
				entitlementStatus === 'active' || entitlementStatus === 'trialing'
					? null
					: undefined,
			cancel_at_period_end: subscription.cancel_at_period_end,
			scheduled_plan: null,
			scheduled_interval: null,
			scheduled_effective_at: null,
			stripe_subscription_schedule_id: null,
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

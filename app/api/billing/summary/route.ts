import {
	DEFAULT_BILLING_SUMMARY,
	calculateBillingPriceEstimate,
	getBillingEntitlements,
	normalizeBillingPlan,
	normalizeBillingStatus,
	type BillingInterval,
} from '@/lib/billing';
import { evaluateBillingState } from '@/lib/billing-state';
import { calculateActiveCarers } from '@/lib/billing-usage';
import { PERMISSIONS } from '@/lib/permissions';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		return json({ error: 'Unauthorized' }, 401);
	}

	const { searchParams } = new URL(request.url);
	const orgId = searchParams.get('orgId');
	const orgSlug = searchParams.get('orgSlug');

	const organization = await resolveOrganization(
		supabase,
		user.id,
		orgId ?? undefined,
		orgSlug ?? undefined,
	);

	if (!organization) {
		return json({ error: 'Organization not found.' }, 404);
	}

	const { data: canViewBilling } = await supabase.rpc('has_org_permission', {
		p_org_id: organization.id,
		p_permission_code: PERMISSIONS.BILLING_VIEW,
	});

	if (!canViewBilling) {
		return json(
			{ error: 'You do not have permission to view billing.' },
			403,
		);
	}

	const admin = createAdminClient();
	const [{ data: billing }, activeCarersResult] =
		await Promise.all([
			admin
				.from('organization_billing')
				.select(
					'plan, interval, status, stripe_customer_id, stripe_subscription_id, stripe_price_id, current_period_start, current_period_end, trial_start, trial_end, grace_period_ends_at, cancel_at_period_end, scheduled_plan, scheduled_interval, scheduled_effective_at, stripe_subscription_schedule_id',
				)
				.eq('organization_id', organization.id)
				.maybeSingle(),
			calculateActiveCarers(admin, organization.id)
				.then((count) => ({ count, error: null }))
				.catch((error) => ({ count: 0, error })),
		]);

	if (activeCarersResult.error) {
		console.error('[billing-summary] active carer count failed', activeCarersResult.error);
		return json({ error: 'Billing usage could not be loaded.' }, 500);
	}

	const normalizedPlan = normalizeBillingPlan(billing?.plan);
	const normalizedStatus = normalizeBillingStatus(billing?.status);
	const interval = normalizeBillingInterval(billing?.interval);
	const billingAccess = evaluateBillingState({
		plan: billing?.plan,
		status: billing?.status,
		grace_period_ends_at: billing?.grace_period_ends_at,
	});
	const entitlements = getBillingEntitlements(normalizedPlan, normalizedStatus);
	const scheduledPlan = normalizeScheduledBillingPlan(billing?.scheduled_plan);
	const scheduledInterval = normalizeScheduledBillingInterval(
		billing?.scheduled_interval,
	);
	const scheduledChange =
		scheduledPlan && scheduledInterval && billing?.scheduled_effective_at
			? {
					plan: scheduledPlan,
					interval: scheduledInterval,
					effectiveAt: billing.scheduled_effective_at,
					stripeSubscriptionScheduleId:
						billing.stripe_subscription_schedule_id ?? null,
				}
			: null;
	const summary = billing
		? {
				...billing,
				plan: normalizedPlan,
				status: normalizedStatus,
				interval,
				billingAccess,
				entitlements,
				scheduledChange,
				cancel_at_period_end: Boolean(billing.cancel_at_period_end),
				isConfigured: Boolean(
					billing.stripe_customer_id ||
						billing.stripe_subscription_id ||
						billing.stripe_price_id,
				),
		}
		: {
				...DEFAULT_BILLING_SUMMARY,
				entitlements,
				scheduledChange: null,
			};

	return json({
		billing: summary,
		usage: {
			activeCarers: activeCarersResult.count,
		},
		priceEstimate: calculateBillingPriceEstimate({
			plan: normalizedPlan,
			interval,
			activeCarers: activeCarersResult.count,
		}),
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

function normalizeBillingInterval(
	interval: string | null | undefined,
): BillingInterval {
	return interval === 'yearly' ? 'yearly' : 'monthly';
}

function normalizeScheduledBillingPlan(plan: string | null | undefined) {
	if (plan === 'starter' || plan === 'pro') return plan;
	return null;
}

function normalizeScheduledBillingInterval(
	interval: string | null | undefined,
) {
	if (interval === 'monthly' || interval === 'yearly') return interval;
	return null;
}

function json(body: unknown, status = 200) {
	return NextResponse.json(body, {
		status,
		headers: { 'Cache-Control': 'no-store' },
	});
}

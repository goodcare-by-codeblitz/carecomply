import {
	DEFAULT_BILLING_SUMMARY,
	calculateBillingPriceEstimate,
	normalizeBillingPlan,
	normalizeBillingStatus,
	type BillingInterval,
} from '@/lib/billing';
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
	const [{ data: billing }, { count: activeCarers, error: countError }] =
		await Promise.all([
			admin
				.from('organization_billing')
				.select(
					'plan, interval, status, stripe_customer_id, stripe_subscription_id, stripe_price_id, current_period_start, current_period_end, trial_start, trial_end, cancel_at_period_end',
				)
				.eq('organization_id', organization.id)
				.maybeSingle(),
			admin
				.from('carers')
				.select('id', { count: 'exact', head: true })
				.eq('organization_id', organization.id)
				.eq('status', 'active'),
		]);

	if (countError) {
		console.error('[billing-summary] active carer count failed', countError);
		return json({ error: 'Billing usage could not be loaded.' }, 500);
	}

	const normalizedPlan = normalizeBillingPlan(billing?.plan);
	const normalizedStatus = normalizeBillingStatus(billing?.status);
	const interval = normalizeBillingInterval(billing?.interval);
	const summary = billing
		? {
				...billing,
				plan: normalizedPlan,
				status: normalizedStatus,
				interval,
				cancel_at_period_end: Boolean(billing.cancel_at_period_end),
				isConfigured: Boolean(
					billing.stripe_customer_id ||
						billing.stripe_subscription_id ||
						billing.stripe_price_id,
				),
			}
		: DEFAULT_BILLING_SUMMARY;

	return json({
		billing: summary,
		usage: {
			activeCarers: activeCarers ?? 0,
		},
		priceEstimate: calculateBillingPriceEstimate({
			plan: normalizedPlan,
			interval,
			activeCarers: activeCarers ?? 0,
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

function json(body: unknown, status = 200) {
	return NextResponse.json(body, {
		status,
		headers: { 'Cache-Control': 'no-store' },
	});
}

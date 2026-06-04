import {
	getPlanFromStripePriceId,
	normalizeBillingPlan,
	normalizeBillingStatus,
} from '@/lib/billing';
import { createSystemAuditLog } from '@/lib/audit-server';
import { captureBillingException } from '@/lib/billing-monitoring';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { getStripe } from '@/lib/stripe';
import { NextResponse } from 'next/server';
import type Stripe from 'stripe';

type BillingRow = {
	organization_id: string;
	plan: string;
	interval: string;
	status: string;
	stripe_customer_id: string | null;
	stripe_subscription_id: string | null;
	stripe_price_id: string | null;
};

type ReconciliationIssue = {
	organizationId: string;
	severity: 'warning' | 'critical';
	code: string;
	message: string;
};

export async function GET(request: Request) {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
	}

	const { data: platformMembership } = await supabase
		.from('platform_memberships')
		.select('id')
		.eq('user_id', user.id)
		.maybeSingle();

	if (!platformMembership) {
		return NextResponse.json(
			{ error: 'Platform admin access is required.' },
			{ status: 403 },
		);
	}

	const admin = createAdminClient();
	const { data, error } = await admin
		.from('organization_billing')
		.select(
			'organization_id, plan, interval, status, stripe_customer_id, stripe_subscription_id, stripe_price_id',
		)
		.order('organization_id');

	if (error) {
		captureBillingException(error, { operation: 'billing_reconcile_load_rows' });
		return NextResponse.json(
			{ error: 'Billing rows could not be loaded.' },
			{ status: 500 },
		);
	}

	const stripe = getStripe();
	const issues: ReconciliationIssue[] = [];
	const rows = (data ?? []) as BillingRow[];
	const checked = await Promise.all(
		rows.map((row) => reconcileBillingRow(stripe, row, issues)),
	);

	const report = {
		generatedAt: new Date().toISOString(),
		checked: checked.length,
		issueCount: issues.length,
		issues,
	};

	if (rows[0]?.organization_id) {
		await createSystemAuditLog({
			action: 'billing.subscription_updated',
			entityType: 'billing',
			organizationId: rows[0].organization_id,
			entityId: rows[0].organization_id,
			entityName: 'Billing reconciliation',
			source: 'system',
			details: {
				outcome: 'billing_reconciliation_report_generated',
				checked: report.checked,
				issue_count: report.issueCount,
				note: 'Platform-wide report logged against first checked organization.',
			},
			request,
		});
	}

	return NextResponse.json(report, {
		headers: { 'Cache-Control': 'no-store' },
	});
}

async function reconcileBillingRow(
	stripe: Stripe,
	row: BillingRow,
	issues: ReconciliationIssue[],
) {
	if (!row.stripe_customer_id && row.stripe_subscription_id) {
		issues.push({
			organizationId: row.organization_id,
			severity: 'critical',
			code: 'missing_customer_id',
			message: 'A Stripe subscription exists locally without a Stripe customer id.',
		});
	}

	if (!row.stripe_subscription_id) {
		if (row.status === 'active' || row.status === 'past_due') {
			issues.push({
				organizationId: row.organization_id,
				severity: 'critical',
				code: 'active_without_subscription',
				message: 'Local billing status requires a Stripe subscription but none is stored.',
			});
		}
		return row;
	}

	try {
		const subscription = await stripe.subscriptions.retrieve(
			row.stripe_subscription_id,
		);
		const priceId = subscription.items.data[0]?.price.id ?? null;
		const planFromPrice = getPlanFromStripePriceId(priceId);
		const stripeStatus = normalizeBillingStatus(mapSubscriptionStatus(subscription.status));

		if (stripeStatus !== normalizeBillingStatus(row.status)) {
			issues.push({
				organizationId: row.organization_id,
				severity: 'warning',
				code: 'status_mismatch',
				message: `Local status ${row.status} differs from Stripe status ${subscription.status}.`,
			});
		}

		if (priceId && row.stripe_price_id && priceId !== row.stripe_price_id) {
			issues.push({
				organizationId: row.organization_id,
				severity: 'warning',
				code: 'price_mismatch',
				message: 'Local Stripe price id differs from the current Stripe subscription item price.',
			});
		}

		if (planFromPrice && planFromPrice.plan !== normalizeBillingPlan(row.plan)) {
			issues.push({
				organizationId: row.organization_id,
				severity: 'warning',
				code: 'plan_mismatch',
				message: 'Local plan differs from the plan mapped from the Stripe price.',
			});
		}
	} catch (error) {
		captureBillingException(error, {
			operation: 'billing_reconcile_subscription_retrieve',
			organizationId: row.organization_id,
			stripeSubscriptionId: row.stripe_subscription_id,
		});
		issues.push({
			organizationId: row.organization_id,
			severity: 'critical',
			code: 'subscription_retrieve_failed',
			message: 'Stripe subscription could not be retrieved.',
		});
	}

	return row;
}

function mapSubscriptionStatus(status: Stripe.Subscription.Status) {
	switch (status) {
		case 'trialing':
		case 'active':
		case 'past_due':
		case 'canceled':
			return status;
		case 'unpaid':
		case 'incomplete':
			return 'past_due';
		case 'incomplete_expired':
			return 'canceled';
		case 'paused':
			return 'not_configured';
	}
}

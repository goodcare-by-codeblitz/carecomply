import {
	isMissingColumnOrBucketError,
	isMissingRelationError,
} from '@/lib/orgs';

export type BillingPlan = 'starter' | 'pro';

export type LegacyBillingPlan =
	| BillingPlan
	| 'carecore'
	| 'safetrack'
	| 'complipro'
	| 'guardian_plus';

export type BillingInterval = 'monthly' | 'yearly';

export type BillingStatus =
	| 'not_configured'
	| 'trialing'
	| 'active'
	| 'past_due'
	| 'canceled';

export type OrganizationBillingSummary = {
	plan: BillingPlan;
	interval: BillingInterval;
	status: BillingStatus;
	stripe_customer_id?: string | null;
	stripe_subscription_id?: string | null;
	stripe_price_id?: string | null;
	current_period_start?: string | null;
	current_period_end?: string | null;
	trial_start?: string | null;
	trial_end?: string | null;
	cancel_at_period_end?: boolean;
	isConfigured: boolean;
};

export type BillingEntitlements = {
	plan: BillingPlan;
	status: BillingStatus;
	isPro: boolean;
	advancedAudit: boolean;
	customAutomations: boolean;
	customRoles: boolean;
	excelAuditExport: boolean;
	fullAuditHistory: boolean;
};

export type BillingPriceEstimate = {
	plan: BillingPlan;
	interval: BillingInterval;
	activeCarers: number;
	includedActiveCarers: number;
	extraActiveCarers: number;
	extraActiveCarerPrice: number;
	baseMonthlyPrice: number;
	baseYearlyPrice: number;
	monthlyOverageAmount: number;
	yearlyOverageAmount: number;
	totalMonthlyAmount: number;
	totalYearlyAmount: number;
};

export type PricingPlan = {
	id: BillingPlan;
	name: string;
	tagline: string;
	description: string;
	monthlyPrice: number | null;
	yearlyPrice: number | null;
	priceSuffix: string;
	includedActiveCarers: number;
	extraActiveCarerPrice: number;
	badges: string[];
	features: string[];
	featureSections: {
		title: string;
		items: string[];
	}[];
	highlight?: boolean;
	isEnterprise?: boolean;
	stripeMonthlyPriceEnvKey: string;
	stripeYearlyPriceEnvKey: string;
};

export const PRICING_PLANS: PricingPlan[] = [
	{
		id: 'starter',
		name: 'Starter',
		tagline: 'Run compliant onboarding',
		description:
			'Core onboarding, document collection, reminders, and reference review for care teams.',
		monthlyPrice: 29,
		yearlyPrice: 290,
		priceSuffix: 'per month',
		includedActiveCarers: 25,
		extraActiveCarerPrice: 5,
		badges: ['CSV export', '90-day audit history', 'Read-only files'],
		features: [
			'Carer onboarding',
			'Document uploads',
			'Fixed expiry reminders',
			'Manual reference requests',
			'Reference review dashboard',
			'Basic compliance tracking',
			'Basic audit logs and CSV export',
			'Read-only document storage',
		],
		featureSections: [
			{
				title: 'Included',
				items: [
					'Carer onboarding',
					'Document uploads',
					'Manual reference requests',
					'Reference review dashboard',
					'Basic compliance tracking',
				],
			},
			{
				title: 'Reminders and audit',
				items: [
					'Fixed expiry reminders: 30 days, 7 days, expiry day',
					'Basic audit logs',
					'CSV audit export',
					'Recent audit history: last 90 days',
					'Core activity filters: search and activity type',
				],
			},
			{
				title: 'Limits and evidence',
				items: [
					'Up to 25 active carers included',
					'GBP 5 per extra active carer',
					'Read-only document storage',
				],
			},
		],
		stripeMonthlyPriceEnvKey: 'STRIPE_PRICE_STARTER_MONTHLY',
		stripeYearlyPriceEnvKey: 'STRIPE_PRICE_STARTER_YEARLY',
	},
	{
		id: 'pro',
		name: 'Pro',
		tagline: 'Automate compliance operations',
		description:
			'Automation, escalation, advanced audit history, and custom controls for growing providers.',
		monthlyPrice: 59,
		yearlyPrice: 590,
		priceSuffix: 'per month',
		includedActiveCarers: 40,
		extraActiveCarerPrice: 4,
		badges: ['CQC-ready Excel export', 'Full audit history', 'Full evidence trail'],
		features: [
			'Everything in Starter',
			'Automatic reference chasing',
			'Scheduled reminder sequences',
			'Escalation workflows',
			'Overdue alerts',
			'Compliance automations',
			'Advanced audit history',
			'Custom roles and permissions',
			'Custom automations',
			'Read-only document storage with full evidence trail',
		],
		featureSections: [
			{
				title: 'Included',
				items: [
					'Everything in Starter',
					'Automatic reference chasing',
					'Scheduled reminder sequences',
					'Escalation workflows',
					'Overdue alerts',
					'Compliance automations',
				],
			},
			{
				title: 'Audit and evidence',
				items: [
					'Advanced CQC audit history',
					'CSV and formatted Excel evidence export',
					'Full audit history',
					'CQC coverage summary: safe, effective, caring, responsive, well-led',
					'Advanced filters: category, severity, CQC key question, date range',
					'Full event metadata including source, IP, user agent, and raw details',
				],
			},
			{
				title: 'Limits and controls',
				items: [
					'Up to 40 active carers included',
					'GBP 4 per extra active carer',
					'Per-document-type reminder rules',
					'Custom roles and permissions',
					'Custom automations',
					'Read-only document storage with full evidence trail',
				],
			},
		],
		highlight: true,
		stripeMonthlyPriceEnvKey: 'STRIPE_PRICE_PRO_MONTHLY',
		stripeYearlyPriceEnvKey: 'STRIPE_PRICE_PRO_YEARLY',
	},
];

export const DEFAULT_BILLING_SUMMARY: OrganizationBillingSummary = {
	plan: 'starter',
	interval: 'monthly',
	status: 'not_configured',
	stripe_customer_id: null,
	stripe_subscription_id: null,
	stripe_price_id: null,
	current_period_start: null,
	current_period_end: null,
	trial_start: null,
	trial_end: null,
	cancel_at_period_end: false,
	isConfigured: false,
};

export function getPricingPlan(planId: string) {
	if (!isKnownBillingPlan(planId)) return null;
	const normalizedPlanId = normalizeBillingPlan(planId);
	return PRICING_PLANS.find((plan) => plan.id === normalizedPlanId) ?? null;
}

export function isKnownBillingPlan(
	plan: string | null | undefined,
): plan is LegacyBillingPlan {
	return (
		plan === 'starter' ||
		plan === 'pro' ||
		plan === 'carecore' ||
		plan === 'safetrack' ||
		plan === 'complipro' ||
		plan === 'guardian_plus'
	);
}

export function normalizeBillingPlan(
	plan: string | null | undefined,
): BillingPlan {
	switch (plan) {
		case 'pro':
		case 'complipro':
		case 'guardian_plus':
			return 'pro';
		case 'starter':
		case 'carecore':
		case 'safetrack':
		default:
			return 'starter';
	}
}

export function normalizeBillingStatus(
	status: string | null | undefined,
): BillingStatus {
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

export function isEntitledBillingStatus(status: BillingStatus) {
	return status === 'trialing' || status === 'active';
}

export function getBillingEntitlements(
	plan: string | null | undefined,
	status: string | null | undefined,
): BillingEntitlements {
	const normalizedPlan = normalizeBillingPlan(plan);
	const normalizedStatus = normalizeBillingStatus(status);
	const isPro =
		normalizedPlan === 'pro' && isEntitledBillingStatus(normalizedStatus);

	return {
		plan: normalizedPlan,
		status: normalizedStatus,
		isPro,
		advancedAudit: isPro,
		customAutomations: isPro,
		customRoles: isPro,
		excelAuditExport: isPro,
		fullAuditHistory: isPro,
	};
}

export function calculateBillingPriceEstimate({
	plan,
	interval,
	activeCarers,
}: {
	plan: string | null | undefined;
	interval: BillingInterval;
	activeCarers: number;
}): BillingPriceEstimate {
	const normalizedPlan = normalizeBillingPlan(plan);
	const pricingPlan = getPricingPlan(normalizedPlan) ?? PRICING_PLANS[0];
	const includedActiveCarers = pricingPlan.includedActiveCarers;
	const extraActiveCarers = Math.max(0, activeCarers - includedActiveCarers);
	const baseMonthlyPrice = pricingPlan.monthlyPrice ?? 0;
	const baseYearlyPrice = pricingPlan.yearlyPrice ?? baseMonthlyPrice * 10;
	const monthlyOverageAmount =
		extraActiveCarers * pricingPlan.extraActiveCarerPrice;
	const yearlyOverageAmount = monthlyOverageAmount * 12;

	return {
		plan: normalizedPlan,
		interval,
		activeCarers,
		includedActiveCarers,
		extraActiveCarers,
		extraActiveCarerPrice: pricingPlan.extraActiveCarerPrice,
		baseMonthlyPrice,
		baseYearlyPrice,
		monthlyOverageAmount,
		yearlyOverageAmount,
		totalMonthlyAmount: baseMonthlyPrice + monthlyOverageAmount,
		totalYearlyAmount: baseYearlyPrice + yearlyOverageAmount,
	};
}

export function getStripePriceEnvKey(
	planId: BillingPlan,
	interval: BillingInterval,
) {
	const plan = getPricingPlan(planId);
	if (!plan) return null;
	return interval === 'monthly'
		? plan.stripeMonthlyPriceEnvKey
		: plan.stripeYearlyPriceEnvKey;
}

export function getStripePriceId(
	planId: BillingPlan,
	interval: BillingInterval,
) {
	const envKey = getStripePriceEnvKey(planId, interval);
	return envKey ? process.env[envKey] : undefined;
}

export function getPlanFromStripePriceId(priceId: string | null | undefined) {
	if (!priceId) return null;

	for (const plan of PRICING_PLANS) {
		if (process.env[plan.stripeMonthlyPriceEnvKey] === priceId) {
			return { plan: plan.id, interval: 'monthly' as const };
		}

		if (process.env[plan.stripeYearlyPriceEnvKey] === priceId) {
			return { plan: plan.id, interval: 'yearly' as const };
		}
	}

	return null;
}

export function isBillingSetupMissing(error: unknown) {
	return isMissingRelationError(error) || isMissingColumnOrBucketError(error);
}

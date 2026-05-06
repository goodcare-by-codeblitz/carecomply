import {
	isMissingColumnOrBucketError,
	isMissingRelationError,
} from '@/lib/orgs';

export type BillingPlan = 'carecore' | 'safetrack' | 'complipro' | 'guardian_plus';

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

export type PricingPlan = {
	id: BillingPlan;
	name: string;
	tagline: string;
	description: string;
	monthlyPrice: number | null;
	yearlyPrice: number | null;
	priceSuffix: string;
	features: string[];
	highlight?: boolean;
	isEnterprise?: boolean;
	stripeMonthlyPriceEnvKey: string;
	stripeYearlyPriceEnvKey: string;
};

export const PRICING_PLANS: PricingPlan[] = [
	{
		id: 'carecore',
		name: 'CareCore',
		tagline: 'Start compliant',
		description: 'Core compliance tracking for small care teams.',
		monthlyPrice: 29,
		yearlyPrice: 290,
		priceSuffix: 'per month',
		features: [
			'Carer compliance profiles',
			'Document expiry tracking',
			'Basic dashboard insights',
			'Organization branding',
		],
		stripeMonthlyPriceEnvKey: 'STRIPE_PRICE_CARECORE_MONTHLY',
		stripeYearlyPriceEnvKey: 'STRIPE_PRICE_CARECORE_YEARLY',
	},
	{
		id: 'safetrack',
		name: 'SafeTrack',
		tagline: 'Stay ahead',
		description: 'Reminders, document tracking, and team workflows.',
		monthlyPrice: 59,
		yearlyPrice: 590,
		priceSuffix: 'per month',
		features: [
			'Everything in CareCore',
			'Smart expiry reminders',
			'Team roles and invitations',
			'Review queues for documents',
		],
		highlight: true,
		stripeMonthlyPriceEnvKey: 'STRIPE_PRICE_SAFETRACK_MONTHLY',
		stripeYearlyPriceEnvKey: 'STRIPE_PRICE_SAFETRACK_YEARLY',
	},
	{
		id: 'complipro',
		name: 'CompliPro',
		tagline: 'Scale operations',
		description: 'Advanced compliance operations, reviews, audit visibility, and automations.',
		monthlyPrice: 99,
		yearlyPrice: 990,
		priceSuffix: 'per month',
		features: [
			'Everything in SafeTrack',
			'Automation management',
			'Audit log visibility',
			'Advanced compliance reporting',
		],
		stripeMonthlyPriceEnvKey: 'STRIPE_PRICE_COMPLIPRO_MONTHLY',
		stripeYearlyPriceEnvKey: 'STRIPE_PRICE_COMPLIPRO_YEARLY',
	},
	{
		id: 'guardian_plus',
		name: 'Guardian+',
		tagline: 'Enterprise support',
		description: 'Custom governance, priority onboarding, and hands-on support.',
		monthlyPrice: null,
		yearlyPrice: null,
		priceSuffix: 'custom pricing',
		features: [
			'Everything in CompliPro',
			'Priority onboarding',
			'Advanced governance support',
			'Custom success planning',
		],
		isEnterprise: true,
		stripeMonthlyPriceEnvKey: 'STRIPE_PRICE_GUARDIAN_PLUS_MONTHLY',
		stripeYearlyPriceEnvKey: 'STRIPE_PRICE_GUARDIAN_PLUS_YEARLY',
	},
];

export const DEFAULT_BILLING_SUMMARY: OrganizationBillingSummary = {
	plan: 'carecore',
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
	return PRICING_PLANS.find((plan) => plan.id === planId) ?? null;
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

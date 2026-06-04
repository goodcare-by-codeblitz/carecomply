import { normalizeBillingPlan, type BillingPlan } from '@/lib/billing';

export type SubscriptionChangeMode = 'immediate' | 'scheduled_downgrade';

export function getSubscriptionChangeMode({
	currentPlan,
	targetPlan,
}: {
	currentPlan: string | null | undefined;
	targetPlan: BillingPlan;
}): SubscriptionChangeMode {
	const normalizedCurrentPlan = normalizeBillingPlan(currentPlan);

	if (normalizedCurrentPlan === 'pro' && targetPlan === 'starter') {
		return 'scheduled_downgrade';
	}

	return 'immediate';
}

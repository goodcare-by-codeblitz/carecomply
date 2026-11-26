import { getSubscriptionChangeMode } from '@/lib/billing-subscription-change';
import { describe, expect, it } from 'vitest';

describe('getSubscriptionChangeMode', () => {
	it('applies starter to pro immediately', () => {
		expect(
			getSubscriptionChangeMode({
				currentPlan: 'starter',
				targetPlan: 'pro',
			}),
		).toBe('immediate');
	});

	it('schedules pro to starter for period end', () => {
		expect(
			getSubscriptionChangeMode({
				currentPlan: 'pro',
				targetPlan: 'starter',
			}),
		).toBe('scheduled_downgrade');
	});

	it('keeps same-plan interval changes immediate', () => {
		expect(
			getSubscriptionChangeMode({
				currentPlan: 'pro',
				targetPlan: 'pro',
			}),
		).toBe('immediate');
	});
});

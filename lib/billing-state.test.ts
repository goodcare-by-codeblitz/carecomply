import { describe, expect, it } from 'vitest';
import {
	canAccessApp,
	canModifyData,
	canUseProFeatures,
	evaluateBillingState,
	getPastDueGracePeriodEnd,
	isReadOnly,
} from './billing-state';

const now = new Date('2026-05-30T12:00:00.000Z');

describe('billing state', () => {
	it('allows active and trialing organizations to access and modify data', () => {
		for (const status of ['active', 'trialing']) {
			const state = evaluateBillingState({ plan: 'starter', status }, now);

			expect(state.canAccessApp).toBe(true);
			expect(state.canModifyData).toBe(true);
			expect(state.isReadOnly).toBe(false);
			expect(canAccessApp({ status })).toBe(true);
			expect(canModifyData({ status })).toBe(true);
		}
	});

	it('blocks not configured and canceled organizations', () => {
		for (const status of ['not_configured', 'canceled']) {
			const state = evaluateBillingState({ plan: 'pro', status }, now);

			expect(state.canAccessApp).toBe(false);
			expect(state.canModifyData).toBe(false);
			expect(state.canUseProFeatures).toBe(false);
			expect(isReadOnly({ status })).toBe(false);
		}
	});

	it('allows full access during the past due grace period', () => {
		const state = evaluateBillingState(
			{
				plan: 'pro',
				status: 'past_due',
				grace_period_ends_at: '2026-06-01T12:00:00.000Z',
			},
			now,
		);

		expect(state.reason).toBe('past_due_grace');
		expect(state.canAccessApp).toBe(true);
		expect(state.canModifyData).toBe(true);
		expect(state.canUseProFeatures).toBe(true);
	});

	it('makes past due organizations read-only after grace expires', () => {
		const state = evaluateBillingState(
			{
				plan: 'pro',
				status: 'past_due',
				grace_period_ends_at: '2026-05-29T12:00:00.000Z',
			},
			now,
		);

		expect(state.reason).toBe('past_due_read_only');
		expect(state.canAccessApp).toBe(true);
		expect(state.canModifyData).toBe(false);
		expect(state.isReadOnly).toBe(true);
		expect(canUseProFeatures(state)).toBe(true);
	});

	it('calculates a seven-day grace period end', () => {
		expect(getPastDueGracePeriodEnd(now)).toBe('2026-06-06T12:00:00.000Z');
	});
});

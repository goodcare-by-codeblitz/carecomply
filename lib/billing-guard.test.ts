import { describe, expect, it } from 'vitest';
import { evaluateBillingState } from './billing-state';
import { billingBlockedResponse } from './billing-guard';

describe('billing guard responses', () => {
	it('returns payment required style response for read-only workspaces', async () => {
		const state = evaluateBillingState(
			{
				plan: 'starter',
				status: 'past_due',
				grace_period_ends_at: '2026-05-29T12:00:00.000Z',
			},
			new Date('2026-05-30T12:00:00.000Z'),
		);
		const response = billingBlockedResponse(state);
		const payload = await response.json();

		expect(response.status).toBe(402);
		expect(payload.billing.isReadOnly).toBe(true);
	});

	it('returns forbidden style response for blocked workspaces', async () => {
		const state = evaluateBillingState({ plan: 'starter', status: 'canceled' });
		const response = billingBlockedResponse(state);
		const payload = await response.json();

		expect(response.status).toBe(403);
		expect(payload.billing.reason).toBe('canceled');
	});
});

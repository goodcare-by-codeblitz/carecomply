import { describe, expect, it } from 'vitest';
import {
	blocksNewCheckout,
	canReusePendingCheckout,
	getCheckoutCustomerParams,
	getCheckoutIdempotencyKey,
} from './billing-checkout';

const now = new Date('2026-05-30T12:00:00.000Z');

describe('billing checkout helpers', () => {
	it('reuses matching unexpired pending checkout sessions', () => {
		expect(
			canReusePendingCheckout(
				{
					sessionId: 'cs_test_123',
					sessionUrl: 'https://checkout.stripe.com/c/pay/cs_test_123',
					plan: 'pro',
					interval: 'monthly',
					expiresAt: '2026-05-30T13:00:00.000Z',
				},
				{ plan: 'pro', interval: 'monthly' },
				now,
			),
		).toBe(true);
	});

	it('does not reuse expired pending checkout sessions', () => {
		expect(
			canReusePendingCheckout(
				{
					sessionId: 'cs_test_123',
					sessionUrl: 'https://checkout.stripe.com/c/pay/cs_test_123',
					plan: 'pro',
					interval: 'monthly',
					expiresAt: '2026-05-30T11:00:00.000Z',
				},
				{ plan: 'pro', interval: 'monthly' },
				now,
			),
		).toBe(false);
	});

	it('blocks new checkout when an uncanceled subscription exists', () => {
		expect(
			blocksNewCheckout({
				status: 'active',
				stripeSubscriptionId: 'sub_123',
			}),
		).toBe(true);
		expect(
			blocksNewCheckout({
				status: 'canceled',
				stripeSubscriptionId: 'sub_123',
			}),
		).toBe(false);
	});

	it('builds stable Stripe idempotency keys', () => {
		expect(
			getCheckoutIdempotencyKey({
				organizationId: 'org_123',
				plan: 'starter',
				interval: 'yearly',
			}),
		).toBe('checkout:v2:org_123:starter:yearly');
	});

	it('omits customer_update when checkout creates a new Stripe customer', () => {
		const params = getCheckoutCustomerParams({
			stripeCustomerId: null,
			customerEmail: 'manager@example.com',
		});

		expect(params).toEqual({ customer_email: 'manager@example.com' });
		expect(params).not.toHaveProperty('customer_update');
		expect(params).not.toHaveProperty('customer');
	});

	it('includes customer_update when checkout reuses an existing Stripe customer', () => {
		const params = getCheckoutCustomerParams({
			stripeCustomerId: 'cus_123',
			customerEmail: 'manager@example.com',
		});

		expect(params).toEqual({
			customer: 'cus_123',
			customer_update: { address: 'auto' },
		});
		expect(params).not.toHaveProperty('customer_email');
	});
});

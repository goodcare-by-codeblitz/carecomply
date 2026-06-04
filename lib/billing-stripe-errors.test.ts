import { describe, expect, it } from 'vitest';
import {
	getBillingStripeFailure,
	getSafeStripeErrorDebug,
} from './billing-stripe-errors';

describe('billing Stripe error responses', () => {
	it('maps missing Stripe configuration to a 501 setup response', () => {
		const failure = getBillingStripeFailure(
			new Error('STRIPE_SECRET_KEY is not configured.'),
			{
				code: 'stripe_portal_session_failed',
				message: 'Billing portal could not be opened.',
			},
		);

		expect(failure.status).toBe(501);
		expect(failure.body).toEqual({
			ok: false,
			code: 'stripe_not_configured',
			message:
				'Stripe billing is not configured. Set STRIPE_SECRET_KEY before using billing actions.',
		});
	});

	it('maps Stripe API failures to a 502 user-safe response', () => {
		const failure = getBillingStripeFailure(
			new Error('No such configuration: bpc_secret_internal_detail'),
			{
				code: 'stripe_portal_session_failed',
				message: 'Billing portal could not be opened.',
			},
		);

		expect(failure.status).toBe(502);
		expect(failure.body).toEqual({
			ok: false,
			code: 'stripe_portal_session_failed',
			message: 'Billing portal could not be opened.',
		});
	});

	it('does not leak raw exception details in API failure messages', () => {
		const failure = getBillingStripeFailure(
			new Error('Request failed with sk_test_secret and internal Stripe data'),
			{
				code: 'stripe_checkout_session_failed',
				message: 'Checkout could not be started.',
			},
		);

		expect(failure.body.message).toBe('Checkout could not be started.');
		expect(failure.body.message).not.toContain('sk_test_secret');
		expect(failure.body.message).not.toContain('internal Stripe data');
	});

	it('extracts only safe Stripe diagnostic fields', () => {
		const debug = getSafeStripeErrorDebug({
			type: 'StripeInvalidRequestError',
			code: 'parameter_unknown',
			param: 'customer_update',
			decline_code: 'generic_decline',
			requestId: 'req_123',
			message: 'Raw message with sk_test_secret',
			raw: {
				message: 'Nested raw message with internal detail',
			},
		});

		expect(debug).toEqual({
			type: 'StripeInvalidRequestError',
			code: 'parameter_unknown',
			param: 'customer_update',
			decline_code: 'generic_decline',
			requestId: 'req_123',
		});
		expect(debug).not.toHaveProperty('message');
		expect(JSON.stringify(debug)).not.toContain('sk_test_secret');
		expect(JSON.stringify(debug)).not.toContain('internal detail');
	});

	it('includes debug details only outside production when requested', () => {
		const error = {
			type: 'StripeInvalidRequestError',
			code: 'parameter_unknown',
			param: 'automatic_tax',
			requestId: 'req_456',
		};

		const developmentFailure = getBillingStripeFailure(
			error,
			{
				code: 'stripe_checkout_session_failed',
				message: 'Checkout could not be started.',
			},
			{ includeDebug: true, environment: 'development' },
		);
		const productionFailure = getBillingStripeFailure(
			error,
			{
				code: 'stripe_checkout_session_failed',
				message: 'Checkout could not be started.',
			},
			{ includeDebug: true, environment: 'production' },
		);

		expect(developmentFailure.body).toMatchObject({
			debug: {
				type: 'StripeInvalidRequestError',
				code: 'parameter_unknown',
				param: 'automatic_tax',
				requestId: 'req_456',
			},
		});
		expect(productionFailure.body).not.toHaveProperty('debug');
	});
});

import { describe, expect, it } from 'vitest';
import {
	addNotificationKey,
	isProcessedDuplicate,
	shouldProcessStripeEvent,
} from './billing-webhook-state';

describe('billing webhook state helpers', () => {
	it('skips processed duplicate events', () => {
		expect(isProcessedDuplicate('processed')).toBe(true);
		expect(shouldProcessStripeEvent('processed')).toBe(false);
	});

	it('allows pending and failed events to be processed', () => {
		expect(shouldProcessStripeEvent('pending')).toBe(true);
		expect(shouldProcessStripeEvent('failed')).toBe(true);
		expect(shouldProcessStripeEvent('processing')).toBe(false);
	});

	it('suppresses duplicate notification keys', () => {
		const first = addNotificationKey([], 'invoice.paid:in_123');
		expect(first).toEqual({
			added: true,
			keys: ['invoice.paid:in_123'],
		});

		const second = addNotificationKey(first.keys, 'invoice.paid:in_123');
		expect(second).toEqual({
			added: false,
			keys: ['invoice.paid:in_123'],
		});
	});
});

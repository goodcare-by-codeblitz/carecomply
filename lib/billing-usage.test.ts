import { describe, expect, it } from 'vitest';
import {
	countActiveCarersFromStatuses,
	isBillableCarerStatus,
} from './billing-usage';

describe('billing usage', () => {
	it('counts active and on_leave carers only', () => {
		expect(
			countActiveCarersFromStatuses([
				'active',
				'on_leave',
				'pending',
				'incomplete',
				'suspended',
				'former',
				null,
			]),
		).toBe(2);
	});

	it('identifies billable carer statuses', () => {
		expect(isBillableCarerStatus('active')).toBe(true);
		expect(isBillableCarerStatus('on_leave')).toBe(true);
		expect(isBillableCarerStatus('pending')).toBe(false);
	});
});

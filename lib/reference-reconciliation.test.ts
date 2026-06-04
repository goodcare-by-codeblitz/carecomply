import { describe, expect, it } from 'vitest';
import {
	buildReferenceReconciliation,
	type ExistingReferenceLifecycle,
} from './reference-reconciliation';

const now = '2026-06-02T10:00:00.000Z';

function existingReference(
	overrides: Partial<ExistingReferenceLifecycle> = {},
): ExistingReferenceLifecycle {
	return {
		id: '11111111-1111-4111-8111-111111111111',
		email: 'referee@example.com',
		status: 'requested',
		reference_token: 'existing-token',
		token_expires_at: '2026-07-02T10:00:00.000Z',
		request_sent_at: '2026-06-01T10:00:00.000Z',
		request_attempted_at: '2026-06-01T09:59:00.000Z',
		request_error: null,
		response_received_at: null,
		response_payload: null,
		response_url: null,
		reviewed_at: null,
		reviewed_by: null,
		review_notes: null,
		last_chased_at: null,
		chase_count: 0,
		...overrides,
	};
}

describe('reference reconciliation', () => {
	it('updates a requested reference without rerequesting when email is unchanged', () => {
		const existing = existingReference();
		const [operation] = buildReferenceReconciliation({
			carerId: 'carer-1',
			now,
			existingById: new Map([[existing.id, existing]]),
			submitted: [
				{
					id: existing.id,
					fullName: 'Updated Name',
					organization: 'Updated Org',
					email: 'REFEREE@example.com',
					phone: '+441234567890',
					relationship: 'Manager',
					notes: 'Updated notes',
					referenceType: 'work',
				},
			],
		});

		expect(operation.kind).toBe('update');
		expect(operation.shouldRequest).toBe(false);
		expect(operation.values).not.toHaveProperty('status');
		expect(operation.values).not.toHaveProperty('request_sent_at');
		expect(operation.values.email).toBe('referee@example.com');
	});

	it('preserves approved lifecycle fields when email is unchanged', () => {
		const existing = existingReference({
			status: 'approved',
			response_received_at: '2026-06-01T11:00:00.000Z',
			response_payload: { eligible: true },
			reviewed_at: '2026-06-01T12:00:00.000Z',
			reviewed_by: '22222222-2222-4222-8222-222222222222',
			review_notes: 'Looks good',
		});

		const [operation] = buildReferenceReconciliation({
			carerId: 'carer-1',
			now,
			existingById: new Map([[existing.id, existing]]),
			submitted: [
				{
					id: existing.id,
					fullName: 'Approved Referee',
					email: existing.email,
					phone: '+441234567890',
					relationship: 'Manager',
					notes: 'New display note',
					referenceType: 'work',
				},
			],
		});

		expect(operation.kind).toBe('update');
		expect(operation.shouldRequest).toBe(false);
		expect(operation.values).not.toHaveProperty('status');
		expect(operation.values).not.toHaveProperty('response_payload');
		expect(operation.values).not.toHaveProperty('reviewed_at');
	});

	it('resets an approved reference and rerequests when email changes', () => {
		const existing = existingReference({
			status: 'approved',
			response_received_at: '2026-06-01T11:00:00.000Z',
			response_payload: { eligible: true },
			reviewed_at: '2026-06-01T12:00:00.000Z',
			reviewed_by: '22222222-2222-4222-8222-222222222222',
			review_notes: 'Looks good',
			chase_count: 2,
		});

		const [operation] = buildReferenceReconciliation({
			carerId: 'carer-1',
			now,
			existingById: new Map([[existing.id, existing]]),
			submitted: [
				{
					id: existing.id,
					fullName: 'Approved Referee',
					email: 'new-referee@example.com',
					phone: '+441234567890',
					relationship: 'Manager',
					notes: 'New contact',
					referenceType: 'work',
				},
			],
		});

		expect(operation.kind).toBe('update');
		expect(operation.shouldRequest).toBe(true);
		expect(operation.values).toMatchObject({
			email: 'new-referee@example.com',
			status: 'pending',
			reference_token: null,
			request_sent_at: null,
			response_received_at: null,
			response_payload: null,
			reviewed_at: null,
			reviewed_by: null,
			review_notes: null,
			chase_count: 0,
		});
	});

	it('creates and requests a new reference', () => {
		const [operation] = buildReferenceReconciliation({
			carerId: 'carer-1',
			now,
			existingById: new Map(),
			submitted: [
				{
					fullName: 'New Referee',
					email: 'new@example.com',
					phone: '+441234567890',
					relationship: 'Colleague',
					notes: '',
					referenceType: 'character',
				},
			],
		});

		expect(operation.kind).toBe('create');
		expect(operation.shouldRequest).toBe(true);
		expect(operation.values).toMatchObject({
			carer_id: 'carer-1',
			email: 'new@example.com',
			status: 'pending',
			created_at: now,
		});
	});
});

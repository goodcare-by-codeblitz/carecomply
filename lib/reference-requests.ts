import { randomBytes } from 'crypto';
import type { createAdminClient } from '@/lib/supabase/admin';

export type ReferenceRequestResult = {
	referenceId: string;
	ok: boolean;
	error: string | null;
};

export const REFERENCE_SELECT_FIELDS =
	'id, full_name, organization, email, phone, relationship, notes, reference_type, status, request_sent_at, request_attempted_at, request_error, response_received_at, response_payload, response_url, reviewed_at, review_notes';

export function createReferenceToken() {
	return randomBytes(32).toString('hex');
}

export function getReferenceTokenExpiry(days = 30) {
	const expiresAt = new Date();
	expiresAt.setDate(expiresAt.getDate() + days);
	return expiresAt.toISOString();
}

export function getReferenceFormLink(token: string, origin?: string) {
	const appUrl = (origin || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/+$/, '');
	return `${appUrl}/reference/${token}`;
}

export async function ensureReferenceToken(
	admin: ReturnType<typeof createAdminClient>,
	referenceId: string,
) {
	const token = createReferenceToken();
	const tokenExpiresAt = getReferenceTokenExpiry();
	const { data, error } = await admin
		.from('carer_references')
		.update({
			reference_token: token,
			token_expires_at: tokenExpiresAt,
			updated_at: new Date().toISOString(),
		})
		.eq('id', referenceId)
		.select('reference_token, token_expires_at')
		.single();

	if (error || !data?.reference_token) {
		throw new Error(error?.message ?? 'Reference token could not be created.');
	}

	return {
		token: data.reference_token as string,
		tokenExpiresAt: data.token_expires_at as string | null,
	};
}

export async function enqueueReferenceRequestJob({
	admin,
	referenceId,
	organizationId,
	carerId,
	jobType = 'initial_request',
	requestedBy,
}: {
	admin: ReturnType<typeof createAdminClient>;
	referenceId: string;
	organizationId: string;
	carerId: string;
	jobType?: 'initial_request' | 'chase';
	requestedBy?: string | null;
}): Promise<ReferenceRequestResult> {
	const attemptedAt = new Date().toISOString();
	const { error: referenceError } = await admin
		.from('carer_references')
		.update({
			request_attempted_at: attemptedAt,
			request_error: null,
			updated_at: attemptedAt,
		})
		.eq('id', referenceId);

	if (referenceError) {
		return { referenceId, ok: false, error: referenceError.message };
	}

	const { error } = await admin.from('reference_jobs').upsert(
		{
			organization_id: organizationId,
			reference_id: referenceId,
			carer_id: carerId,
			job_type: jobType,
			status: 'queued',
			due_at: attemptedAt,
			idempotency_key: `${jobType}:${referenceId}:${attemptedAt}`,
			payload: { requested_by: requestedBy ?? null },
			attempts: 0,
			last_error: null,
			processed_at: null,
			updated_at: attemptedAt,
		},
		{ onConflict: 'idempotency_key' },
	);

	if (error) {
		await admin
			.from('carer_references')
			.update({
				request_error: error.message,
				updated_at: attemptedAt,
			})
			.eq('id', referenceId);

		return { referenceId, ok: false, error: error.message };
	}

	return { referenceId, ok: true, error: null };
}

export async function enqueueManagerNotificationJob({
	admin,
	referenceId,
	organizationId,
	carerId,
}: {
	admin: ReturnType<typeof createAdminClient>;
	referenceId: string;
	organizationId: string;
	carerId: string;
}) {
	return admin.from('reference_jobs').upsert(
		{
			organization_id: organizationId,
			reference_id: referenceId,
			carer_id: carerId,
			job_type: 'manager_notification',
			status: 'queued',
			due_at: new Date().toISOString(),
			idempotency_key: `manager_notification:${referenceId}`,
			payload: {},
		},
		{ onConflict: 'idempotency_key' },
	);
}

export type SubmittedReferenceInput = {
	id?: string;
	fullName: string;
	organization?: string;
	email: string;
	phone: string;
	relationship: string;
	notes?: string;
	referenceType: 'work' | 'character';
};

export type ExistingReferenceLifecycle = {
	id: string;
	email: string;
	status: string;
	reference_token: string | null;
	token_expires_at: string | null;
	request_sent_at: string | null;
	request_attempted_at: string | null;
	request_error: string | null;
	response_received_at: string | null;
	response_payload: Record<string, unknown> | null;
	response_url: string | null;
	reviewed_at: string | null;
	reviewed_by: string | null;
	review_notes: string | null;
	last_chased_at: string | null;
	chase_count: number | null;
};

export type ReferencePersistenceValues = {
	full_name: string;
	organization: string | null;
	email: string;
	phone: string;
	relationship: string;
	notes: string | null;
	reference_type: 'work' | 'character';
	updated_at: string;
	status?: 'pending';
	reference_token?: null;
	token_expires_at?: null;
	request_sent_at?: null;
	request_attempted_at?: null;
	request_error?: null;
	response_received_at?: null;
	response_payload?: null;
	response_url?: null;
	reviewed_at?: null;
	reviewed_by?: null;
	review_notes?: null;
	last_chased_at?: null;
	chase_count?: 0;
};

export type ReferenceReconciliationOperation =
	| {
			kind: 'create';
			submitted: SubmittedReferenceInput;
			values: ReferencePersistenceValues & {
				carer_id: string;
				status: 'pending';
				created_at: string;
			};
			shouldRequest: true;
	  }
	| {
			kind: 'update';
			referenceId: string;
			submitted: SubmittedReferenceInput;
			emailChanged: boolean;
			values: ReferencePersistenceValues;
			shouldRequest: boolean;
	  };

export function buildReferenceReconciliation({
	carerId,
	submitted,
	existingById,
	now,
}: {
	carerId: string;
	submitted: SubmittedReferenceInput[];
	existingById: Map<string, ExistingReferenceLifecycle>;
	now: string;
}): ReferenceReconciliationOperation[] {
	return submitted.map((reference) => {
		const values = referenceEditableValues(reference, now);
		const existing = reference.id ? existingById.get(reference.id) : null;

		if (!existing) {
			return {
				kind: 'create',
				submitted: reference,
				values: {
					carer_id: carerId,
					...values,
					status: 'pending',
					created_at: now,
				},
				shouldRequest: true,
			};
		}

		const emailChanged =
			normalizeReferenceEmail(reference.email) !== normalizeReferenceEmail(existing.email);

		return {
			kind: 'update',
			referenceId: existing.id,
			submitted: reference,
			emailChanged,
			values: emailChanged ? { ...values, ...resetReferenceLifecycle() } : values,
			shouldRequest: emailChanged,
		};
	});
}

export function normalizeReferenceEmail(email: string) {
	return email.trim().toLowerCase();
}

function referenceEditableValues(
	reference: SubmittedReferenceInput,
	now: string,
): ReferencePersistenceValues {
	return {
		full_name: reference.fullName,
		organization: reference.organization || null,
		email: normalizeReferenceEmail(reference.email),
		phone: reference.phone,
		relationship: reference.relationship,
		notes: reference.notes || null,
		reference_type: reference.referenceType,
		updated_at: now,
	};
}

function resetReferenceLifecycle() {
	return {
		status: 'pending' as const,
		reference_token: null,
		token_expires_at: null,
		request_sent_at: null,
		request_attempted_at: null,
		request_error: null,
		response_received_at: null,
		response_payload: null,
		response_url: null,
		reviewed_at: null,
		reviewed_by: null,
		review_notes: null,
		last_chased_at: null,
		chase_count: 0 as const,
	};
}

import {
	getCarerOnboardingContext,
	OnboardingTokenError,
} from '@/lib/onboarding';
import { createSystemAuditLog } from '@/lib/audit-server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
	REFERENCE_SELECT_FIELDS,
	enqueueReferenceRequestJob,
	type ReferenceRequestResult,
} from '@/lib/reference-requests';
import {
	buildReferenceReconciliation,
	type ExistingReferenceLifecycle,
} from '@/lib/reference-reconciliation';
import { processReferenceJobBatch } from '@/lib/reference-worker';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const referenceSchema = z.object({
	id: z.string().uuid().optional(),
	fullName: z.string().trim().min(2),
	organization: z.string().trim().optional(),
	email: z.string().trim().email(),
	phone: z
		.string()
		.trim()
		.min(5)
		.refine((value) => /^[\d\s+()-]+$/.test(value), 'Invalid phone number'),
	relationship: z.string().trim().min(2),
	notes: z.string().trim().optional(),
	referenceType: z.enum(['work', 'character']),
});

const requestSchema = z.object({
	token: z.string().min(1),
	carerPhone: z
		.string()
		.trim()
		.optional()
		.refine((value) => !value || /^[\d\s+()-]+$/.test(value), {
			message: 'Invalid phone number',
		}),
	references: z.array(referenceSchema).min(1).max(10),
});

const REFERENCE_LIFECYCLE_SELECT_FIELDS = [
	'id',
	'email',
	'status',
	'reference_token',
	'token_expires_at',
	'request_sent_at',
	'request_attempted_at',
	'request_error',
	'response_received_at',
	'response_payload',
	'response_url',
	'reviewed_at',
	'reviewed_by',
	'review_notes',
	'last_chased_at',
	'chase_count',
].join(', ');

export async function POST(request: Request) {
	let payload: z.infer<typeof requestSchema>;

	try {
		payload = requestSchema.parse(await request.json());
	} catch {
		return NextResponse.json(
			{ error: 'Please provide valid reference details.' },
			{ status: 400 },
		);
	}

	const admin = createAdminClient();

	try {
		const context = await getCarerOnboardingContext(admin, payload.token);
		const now = new Date().toISOString();

		const typesBeingUpdated = [
			...new Set(payload.references.map((r) => r.referenceType)),
		];

		const { data: existingReferences, error: existingError } = await admin
			.from('carer_references')
			.select(REFERENCE_LIFECYCLE_SELECT_FIELDS)
			.eq('carer_id', context.carer.id)
			.in('reference_type', typesBeingUpdated);

		if (existingError) {
			throw existingError;
		}

		const operations = buildReferenceReconciliation({
			carerId: context.carer.id,
			submitted: payload.references,
			existingById: new Map(
				((existingReferences ?? []) as ExistingReferenceLifecycle[]).map(
					(reference) => [reference.id, reference],
				),
			),
			now,
		});
		const requestCandidates: {
			referenceId: string;
			reason: 'new' | 'email_changed';
		}[] = [];

		for (const operation of operations) {
			if (operation.kind === 'create') {
				const { data: createdReference, error: createError } = await admin
					.from('carer_references')
					.insert(operation.values)
					.select('id')
					.single();

				if (createError || !createdReference) {
					throw createError ?? new Error('Reference could not be created.');
				}

				requestCandidates.push({
					referenceId: createdReference.id,
					reason: 'new',
				});
				continue;
			}

			const { error: updateError } = await admin
				.from('carer_references')
				.update(operation.values)
				.eq('id', operation.referenceId)
				.eq('carer_id', context.carer.id);

			if (updateError) {
				throw updateError;
			}

			if (operation.shouldRequest) {
				requestCandidates.push({
					referenceId: operation.referenceId,
					reason: 'email_changed',
				});
			}
		}

		const requestResults = await Promise.all(
			requestCandidates.map((candidate) =>
				enqueueReferenceRequestJob({
					admin,
					referenceId: candidate.referenceId,
					organizationId: context.carer.organization_id,
					carerId: context.carer.id,
				}),
			),
		);
		if (requestResults.some((result) => result.ok)) {
			await processReferenceJobBatch(admin, 25).catch((error) => {
				console.error('[onboarding-references] worker processing failed', error);
			});
		}

		const requestedReferenceIds = requestResults
			.filter((result) => result.ok)
			.map((result) => result.referenceId);
		const requestReasonByReferenceId = new Map(
			requestCandidates.map((candidate) => [
				candidate.referenceId,
				candidate.reason,
			]),
		);

		const requestAttemptedAt = new Date().toISOString();
		if (requestResults.length > 0) {
			await Promise.all(
				requestResults.map((requestResult) =>
					updateReferenceRequestState(admin, requestResult, requestAttemptedAt),
				),
			);
		}

		const failedRequests = requestResults.filter((result) => !result.ok);
		const { data: returnedReferences, error: returnedReferencesError } =
			await admin
				.from('carer_references')
				.select(REFERENCE_SELECT_FIELDS)
				.eq('carer_id', context.carer.id)
				.in('reference_type', typesBeingUpdated)
				.order('created_at', { ascending: true });

		if (returnedReferencesError) {
			throw returnedReferencesError;
		}
		const updatedWithoutRequest = operations.filter(
			(operation) => operation.kind === 'update' && !operation.shouldRequest,
		).length;
		const successfulNewRequests = requestedReferenceIds.filter(
			(referenceId) => requestReasonByReferenceId.get(referenceId) === 'new',
		).length;
		const successfulEmailChangedRequests = requestedReferenceIds.filter(
			(referenceId) =>
				requestReasonByReferenceId.get(referenceId) === 'email_changed',
		).length;

		await admin
			.from('carers')
			.update({
				phone: payload.carerPhone || null,
				updated_at: now,
			})
			.eq('id', context.carer.id);

		await createSystemAuditLog({
			action: 'onboarding.references_updated',
			entityType: 'carer',
			organizationId: context.carer.organization_id,
			entityId: context.carer.id,
			entityName: context.carer.full_name,
			source: 'onboarding',
			details: {
				carer_email: context.carer.email,
				before: { phone: context.carer.phone },
				after: {
					phone: payload.carerPhone || null,
					reference_count: returnedReferences?.length ?? 0,
				},
				changed_fields: ['phone', 'references'],
				reference_types_updated: typesBeingUpdated,
				reference_relationships: payload.references.map((r) => r.relationship),
				reference_request_handoff: {
					requested: requestedReferenceIds.length,
					updated_without_request: updatedWithoutRequest,
					email_changed_requested: successfulEmailChangedRequests,
					new_requested: successfulNewRequests,
					failed: failedRequests.length,
					configured: Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL),
				},
				outcome: 'carer_onboarding_references_saved',
			},
		});

		await Promise.all(
			requestedReferenceIds.map((referenceId) =>
				createSystemAuditLog({
					action: 'reference.requested',
					entityType: 'reference',
					organizationId: context.carer.organization_id,
					entityId: referenceId,
					entityName: context.carer.full_name,
					source: 'onboarding',
					details: {
						carer_id: context.carer.id,
						carer_email: context.carer.email,
						request_reason:
							requestReasonByReferenceId.get(referenceId) ?? 'unknown',
						outcome: 'reference_request_queued',
					},
				}),
			),
		);

		return NextResponse.json({
			references: returnedReferences ?? [],
			carerPhone: payload.carerPhone || null,
			referenceRequestWarning:
				failedRequests.length > 0
					? 'Some reference request emails could not be queued.'
					: null,
		});
	} catch (error) {
		if (error instanceof OnboardingTokenError) {
			return NextResponse.json(
				{ error: error.message },
				{ status: error.status },
			);
		}

		console.error('Failed to save references:', error);
		return NextResponse.json(
			{ error: 'Reference details could not be saved.' },
			{ status: 500 },
		);
	}
}

function updateReferenceRequestState(
	admin: ReturnType<typeof createAdminClient>,
	result: ReferenceRequestResult,
	at: string,
) {
	if (result.ok) {
		return admin
			.from('carer_references')
			.update({
				request_error: null,
				updated_at: at,
			})
			.eq('id', result.referenceId);
	}

	return admin
		.from('carer_references')
		.update({
			request_error: result.error,
			updated_at: at,
		})
		.eq('id', result.referenceId);
}

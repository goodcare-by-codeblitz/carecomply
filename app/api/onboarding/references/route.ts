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
import { processReferenceJobBatch } from '@/lib/reference-worker';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const referenceSchema = z.object({
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

		// Only delete the reference types being submitted, preserving the other type
		const typesBeingUpdated = [
			...new Set(payload.references.map((r) => r.referenceType)),
		];
		const { error: deleteError } = await admin
			.from('carer_references')
			.delete()
			.eq('carer_id', context.carer.id)
			.in('reference_type', typesBeingUpdated);

		if (deleteError) {
			throw deleteError;
		}

		const { data, error } = await admin
			.from('carer_references')
			.insert(
				payload.references.map((reference) => ({
					carer_id: context.carer.id,
					full_name: reference.fullName,
					organization: reference.organization || null,
					email: reference.email.toLowerCase(),
					phone: reference.phone,
					relationship: reference.relationship,
					notes: reference.notes || null,
					reference_type: reference.referenceType,
					status: 'pending',
					created_at: now,
					updated_at: now,
				})),
			)
			.select(REFERENCE_SELECT_FIELDS);

		if (error) {
			throw error;
		}

		const requestResults = await Promise.all(
			(data ?? []).map((reference) =>
				enqueueReferenceRequestJob({
					admin,
					referenceId: reference.id,
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

		let returnedReferences = data ?? [];
		const requestAttemptedAt = new Date().toISOString();
		if (requestResults.length > 0) {
			await Promise.all(
				requestResults.map((requestResult) =>
					updateReferenceRequestState(admin, requestResult, requestAttemptedAt),
				),
			);

			const { data: refreshedReferences } = await admin
				.from('carer_references')
				.select(REFERENCE_SELECT_FIELDS)
				.in(
					'id',
					requestResults.map((requestResult) => requestResult.referenceId),
				);

			if (refreshedReferences) {
				const refreshedById = new Map(
					refreshedReferences.map((reference) => [reference.id, reference]),
				);
				returnedReferences = returnedReferences.map(
					(reference) => refreshedById.get(reference.id) ?? reference,
				);
			}
		}

		const failedRequests = requestResults.filter((result) => !result.ok);

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
					reference_count: returnedReferences.length,
				},
				changed_fields: ['phone', 'references'],
				reference_types_updated: typesBeingUpdated,
				reference_relationships: payload.references.map((r) => r.relationship),
				reference_request_handoff: {
					requested: requestedReferenceIds.length,
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
						outcome: 'reference_request_queued',
					},
				}),
			),
		);

		return NextResponse.json({
			references: returnedReferences,
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

import { createSystemAuditLog } from '@/lib/audit-server';
import { enqueueManagerNotificationJob } from '@/lib/reference-requests';
import { processReferenceJobBatch } from '@/lib/reference-worker';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const submitSchema = z.object({
	token: z.string().min(32),
	relationshipConfirmed: z.enum(['yes', 'no']),
	workedWithApplicant: z.enum(['yes', 'no']),
	wouldRecommend: z.enum(['yes', 'no', 'with_reservations']),
	reliability: z.enum(['excellent', 'good', 'fair', 'poor', 'not_applicable']),
	safeguardingConcerns: z.enum(['yes', 'no']),
	comments: z.string().trim().max(4000).optional(),
	refereeName: z.string().trim().min(2),
	refereeRole: z.string().trim().max(120).optional(),
});

type ReferenceForSubmit = {
	id: string;
	carer_id: string;
	full_name: string;
	email: string;
	status: string;
	token_expires_at: string | null;
	carers:
		| {
				id: string;
				full_name: string;
				email: string;
				organization_id: string;
		  }
		| {
				id: string;
				full_name: string;
				email: string;
				organization_id: string;
		  }[]
		| null;
};

function normalizeRelation<T>(value: T | T[] | null | undefined) {
	return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

export async function POST(request: Request) {
	const payload = submitSchema.safeParse(await request.json().catch(() => null));
	if (!payload.success) {
		return NextResponse.json(
			{ error: 'Please complete the reference form.' },
			{ status: 400 },
		);
	}

	const admin = createAdminClient();
	const { data: referenceData, error: referenceError } = await admin
		.from('carer_references')
		.select('id, carer_id, full_name, email, status, token_expires_at, carers!inner(id, full_name, email, organization_id)')
		.eq('reference_token', payload.data.token)
		.maybeSingle();

	if (referenceError || !referenceData) {
		return NextResponse.json({ error: 'Reference form not found.' }, { status: 404 });
	}

	const reference = referenceData as ReferenceForSubmit;
	const carer = normalizeRelation(reference.carers);
	if (!carer) {
		return NextResponse.json({ error: 'Reference is not linked to a carer.' }, { status: 404 });
	}

	if (reference.token_expires_at && new Date(reference.token_expires_at) < new Date()) {
		return NextResponse.json({ error: 'This reference link has expired.' }, { status: 410 });
	}

	if (['responded', 'approved', 'rejected'].includes(reference.status)) {
		return NextResponse.json({ error: 'This reference has already been submitted.' }, { status: 409 });
	}

	const now = new Date().toISOString();
	const responsePayload = {
		relationship_confirmed: payload.data.relationshipConfirmed,
		worked_with_applicant: payload.data.workedWithApplicant,
		would_recommend: payload.data.wouldRecommend,
		reliability: payload.data.reliability,
		safeguarding_concerns: payload.data.safeguardingConcerns,
		comments: payload.data.comments ?? null,
		referee_name: payload.data.refereeName,
		referee_role: payload.data.refereeRole ?? null,
	};

	const { data: updatedReference, error: updateError } = await admin
		.from('carer_references')
		.update({
			status: 'responded',
			response_received_at: now,
			response_payload: responsePayload,
			response_url: new URL(request.url).origin + `/reference/${payload.data.token}`,
			reference_token: null,
			token_expires_at: null,
			updated_at: now,
		})
		.eq('id', reference.id)
		.select('id, status, response_received_at, response_url')
		.single();

	if (updateError || !updatedReference) {
		return NextResponse.json(
			{ error: 'Reference response could not be saved.' },
			{ status: 500 },
		);
	}

	await createSystemAuditLog({
		action: 'reference.responded',
		entityType: 'reference',
		organizationId: carer.organization_id,
		entityId: reference.id,
		entityName: reference.full_name,
		source: 'api',
		details: {
			carer_id: carer.id,
			carer_name: carer.full_name,
			reference_email: reference.email,
			before: { status: reference.status },
			after: {
				status: updatedReference.status,
				response_received_at: updatedReference.response_received_at,
				response_url: updatedReference.response_url,
			},
			changed_fields: ['status', 'response_received_at', 'response_payload', 'response_url'],
			outcome: 'reference_response_received_from_next_form',
		},
		request,
	});

	await enqueueManagerNotificationJob({
		admin,
		referenceId: reference.id,
		organizationId: carer.organization_id,
		carerId: carer.id,
	});
	await processReferenceJobBatch(admin, 10).catch((error) => {
		console.error('[reference-submit] manager notification failed', error);
	});

	return NextResponse.json({ ok: true, reference: updatedReference });
}

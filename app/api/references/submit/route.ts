import { createSystemAuditLog } from '@/lib/audit-server';
import { enqueueManagerNotificationJob } from '@/lib/reference-requests';
import { processReferenceJobBatch } from '@/lib/reference-worker';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const ratingScale = z.enum([
	'excellent',
	'good',
	'satisfactory',
	'needs_improvement',
	'unable_to_comment',
]);

const competencyScale = z.enum(['yes', 'no', 'unable_to_comment']);

const submitSchema = z.object({
	token: z.string().min(32),
	// S1: Referee Verification
	refereeName: z.string().trim().min(2),
	refereeJobTitle: z.string().trim().min(2),
	refereeOrganization: z.string().trim().min(2),
	refereeWorkEmail: z.string().trim().email(),
	refereeWorkPhone: z.string().trim().min(6),
	relationshipToApplicant: z.enum([
		'line_manager',
		'supervisor',
		'registered_manager',
		'team_leader',
		'colleague',
		'other',
	]),
	howLongKnown: z.string().trim().min(1),
	datesWorkedTogether: z.string().trim().min(1),
	// S2: Employment Verification
	confirmedEmployment: z.enum(['yes', 'no']),
	jobTitleHeld: z.string().trim().optional(),
	employmentStartDate: z.string().optional(),
	currentlyEmployed: z.enum(['yes', 'no']).optional(),
	employmentEndDate: z.string().optional(),
	reasonForLeaving: z.string().trim().max(500).optional(),
	employmentType: z.enum(['permanent', 'temporary', 'agency', 'bank_staff']).optional(),
	// S3: Performance Ratings (all 10 skills)
	ratings: z.record(z.string(), ratingScale),
	// S4: Care Competency (all 6 questions)
	competency: z.record(z.string(), competencyScale),
	// S5: Safeguarding & Conduct
	safeguardingConcerns: z.enum(['yes', 'no']),
	disciplinaryActions: z.enum(['yes', 'no']),
	conductConcerns: z.record(z.string(), z.boolean()).optional(),
	conductDetails: z.string().trim().max(2000).optional(),
	// S6: Rehire
	wouldReemploy: z.enum(['yes', 'no', 'with_reservations']),
	reemployReservations: z.string().trim().max(1000).optional(),
	// S7: Overall Recommendation
	overallRecommendation: z.enum([
		'strongly_recommend',
		'recommend',
		'recommend_with_reservations',
		'do_not_recommend',
	]),
	// S8: Additional Comments
	additionalComments: z.string().trim().max(4000).optional(),
	// S9: Declaration
	declarationAgreed: z.literal(true),
	signatureName: z.string().trim().min(2),
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
			{ error: payload.error.issues[0]?.message ?? 'Please complete all required fields.' },
			{ status: 400 },
		);
	}

	const admin = createAdminClient();
	const { data: referenceData, error: referenceError } = await admin
		.from('carer_references')
		.select(
			'id, carer_id, full_name, email, status, token_expires_at, carers!inner(id, full_name, email, organization_id)',
		)
		.eq('reference_token', payload.data.token)
		.maybeSingle();

	if (referenceError || !referenceData) {
		return NextResponse.json({ error: 'Reference form not found.' }, { status: 404 });
	}

	const reference = referenceData as ReferenceForSubmit;
	const carer = normalizeRelation(reference.carers);
	if (!carer) {
		return NextResponse.json(
			{ error: 'Reference is not linked to a carer.' },
			{ status: 404 },
		);
	}

	if (reference.token_expires_at && new Date(reference.token_expires_at) < new Date()) {
		return NextResponse.json({ error: 'This reference link has expired.' }, { status: 410 });
	}

	if (['responded', 'approved', 'rejected'].includes(reference.status)) {
		return NextResponse.json(
			{ error: 'This reference has already been submitted.' },
			{ status: 409 },
		);
	}

	const { token, ...formData } = payload.data;
	const now = new Date().toISOString();

	const responsePayload = {
		...formData,
		date_submitted: now,
	};

	const { data: updatedReference, error: updateError } = await admin
		.from('carer_references')
		.update({
			status: 'responded',
			response_received_at: now,
			response_payload: responsePayload,
			response_url: new URL(request.url).origin + `/reference/${token}`,
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
			outcome: 'reference_response_received',
		},
		request,
	});

	await enqueueManagerNotificationJob({
		admin,
		referenceId: reference.id,
		organizationId: carer.organization_id,
		carerId: carer.id,
	});
	await processReferenceJobBatch(admin, 10).catch((err) => {
		console.error('[reference-submit] manager notification failed', err);
	});

	return NextResponse.json({ ok: true, reference: updatedReference });
}

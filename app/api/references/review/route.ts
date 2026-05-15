import { createUserAuditLog } from '@/lib/audit-server';
import { updateCarerOnboardingProgress } from '@/lib/onboarding';
import { PERMISSIONS } from '@/lib/permissions';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const requestSchema = z.object({
	referenceId: z.string().uuid(),
	action: z.enum(['approve', 'reject']),
	reviewNotes: z.string().trim().optional(),
});

type ReferenceForReview = {
	id: string;
	carer_id: string;
	full_name: string;
	email: string;
	phone: string;
	relationship: string;
	reference_type: string;
	status: string;
	response_received_at: string | null;
	reviewed_at: string | null;
	reviewed_by: string | null;
	review_notes: string | null;
	carers:
		| {
				id: string;
				organization_id: string;
				full_name: string;
				email: string;
		  }
		| {
				id: string;
				organization_id: string;
				full_name: string;
				email: string;
		  }[]
		| null;
};

function normalizeRelation<T>(value: T | T[] | null | undefined) {
	return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

export async function POST(request: Request) {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
	}

	const result = requestSchema.safeParse(await request.json().catch(() => null));

	if (!result.success) {
		return NextResponse.json(
			{ error: 'A valid reference review request is required.' },
			{ status: 400 },
		);
	}

	const admin = createAdminClient();
	const { data: referenceData, error: referenceError } = await admin
		.from('carer_references')
		.select(
			'id, carer_id, full_name, email, phone, relationship, reference_type, status, response_received_at, reviewed_at, reviewed_by, review_notes, carers!inner(id, organization_id, full_name, email)',
		)
		.eq('id', result.data.referenceId)
		.maybeSingle();

	if (referenceError || !referenceData) {
		return NextResponse.json({ error: 'Reference not found.' }, { status: 404 });
	}

	const reference = referenceData as ReferenceForReview;
	const carer = normalizeRelation(reference.carers);

	if (!carer) {
		return NextResponse.json(
			{ error: 'Reference is not linked to a carer.' },
			{ status: 404 },
		);
	}

	const { data: canEditCarers } = await supabase.rpc('has_org_permission', {
		p_org_id: carer.organization_id,
		p_permission_code: PERMISSIONS.CARERS_EDIT,
	});

	if (!canEditCarers) {
		return NextResponse.json(
			{ error: 'You do not have permission to review references.' },
			{ status: 403 },
		);
	}

	if (reference.status !== 'responded') {
		return NextResponse.json(
			{ error: 'This reference has not received a response yet.' },
			{ status: 409 },
		);
	}

	const reviewedAt = new Date().toISOString();
	const nextStatus = result.data.action === 'approve' ? 'approved' : 'rejected';
	const { data: updatedReference, error: updateError } = await admin
		.from('carer_references')
		.update({
			status: nextStatus,
			reviewed_at: reviewedAt,
			reviewed_by: user.id,
			review_notes: result.data.reviewNotes || null,
			updated_at: reviewedAt,
		})
		.eq('id', reference.id)
		.select(
			'id, status, response_received_at, reviewed_at, reviewed_by, review_notes',
		)
		.single();

	if (updateError || !updatedReference) {
		return NextResponse.json(
			{ error: 'Reference review could not be saved.' },
			{ status: 500 },
		);
	}

	const carerStatus = await updateCarerOnboardingProgress(
		admin,
		carer.id,
		carer.organization_id,
	);

	await createUserAuditLog({
		action:
			result.data.action === 'approve'
				? 'reference.approved'
				: 'reference.rejected',
		entityType: 'reference',
		organizationId: carer.organization_id,
		entityId: reference.id,
		entityName: `${reference.full_name} - ${carer.full_name}`,
		details: {
			carer_id: carer.id,
			carer_name: carer.full_name,
			carer_email: carer.email,
			reference_email: reference.email,
			reference_type: reference.reference_type,
			before: {
				status: reference.status,
				reviewed_at: reference.reviewed_at,
				reviewed_by: reference.reviewed_by,
				review_notes: reference.review_notes,
			},
			after: updatedReference,
			changed_fields: ['status', 'reviewed_at', 'reviewed_by', 'review_notes'],
			carer_status_after_review: carerStatus,
			permission_checked: PERMISSIONS.CARERS_EDIT,
			outcome:
				result.data.action === 'approve'
					? 'reference_approved'
					: 'reference_rejected',
		},
		request,
	});

	return NextResponse.json({
		ok: true,
		reference: updatedReference,
		carerStatus,
	});
}

import { createUserAuditLog } from '@/lib/audit-server';
import { PERMISSIONS } from '@/lib/permissions';
import {
	REFERENCE_SELECT_FIELDS,
	sendReferenceRequestToN8n,
} from '@/lib/reference-requests';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const requestSchema = z.object({
	referenceId: z.string().uuid(),
});

type ReferenceForRequest = {
	id: string;
	full_name: string;
	organization: string | null;
	email: string;
	phone: string;
	relationship: string;
	reference_type: string;
	status: string;
	carer_id: string;
	carers:
		| {
				id: string;
				organization_id: string;
				full_name: string;
				email: string;
				phone: string | null;
		  }
		| {
				id: string;
				organization_id: string;
				full_name: string;
				email: string;
				phone: string | null;
		  }[]
		| null;
};

function normalizeRelation<T>(value: T | T[] | null | undefined) {
	return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

export async function POST(request: Request) {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
	}

	const result = requestSchema.safeParse(
		await request.json().catch(() => null),
	);

	if (!result.success) {
		return NextResponse.json(
			{ error: 'A valid reference id is required.' },
			{ status: 400 },
		);
	}

	const admin = createAdminClient();
	const { data: referenceData, error: referenceError } = await admin
		.from('carer_references')
		.select(
			'id, carer_id, full_name, organization, email, phone, relationship, reference_type, status, carers!inner(id, organization_id, full_name, email, phone)',
		)
		.eq('id', result.data.referenceId)
		.maybeSingle();

	if (referenceError || !referenceData) {
		return NextResponse.json(
			{ error: 'Reference not found.' },
			{ status: 404 },
		);
	}

	const reference = referenceData as ReferenceForRequest;
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
			{ error: 'You do not have permission to request references.' },
			{ status: 403 },
		);
	}

	const { data: organization } = await admin
		.from('organizations')
		.select('name, slug')
		.eq('id', carer.organization_id)
		.maybeSingle();

	const requestedAt = new Date().toISOString();
	const requestResult = await sendReferenceRequestToN8n({
		reference,
		carer,
		organization: organization ?? null,
	});

	const updatePayload = requestResult.ok
		? {
				status: 'requested',
				request_sent_at: requestedAt,
				request_error: null,
				updated_at: requestedAt,
		}
		: {
				request_error: requestResult.error,
				updated_at: requestedAt,
			};

	const { data: updatedReference, error: updateError } = await admin
		.from('carer_references')
		.update(updatePayload)
		.eq('id', reference.id)
		.select(REFERENCE_SELECT_FIELDS)
		.single();

	if (updateError || !updatedReference) {
		return NextResponse.json(
			{ error: 'Reference request state could not be saved.' },
			{ status: 500 },
		);
	}

	await createUserAuditLog({
		action: 'reference.requested',
		entityType: 'reference',
		organizationId: carer.organization_id,
		entityId: reference.id,
		entityName: `${reference.full_name} - ${carer.full_name}`,
		details: {
			carer_id: carer.id,
			carer_name: carer.full_name,
			carer_email: carer.email,
			reference_email: reference.email,
			before: { status: reference.status },
			after: {
				status: updatedReference.status,
				request_sent_at: updatedReference.request_sent_at,
				request_error: updatedReference.request_error,
			},
			permission_checked: PERMISSIONS.CARERS_EDIT,
			outcome: requestResult.ok
				? 'reference_request_sent_to_n8n'
				: 'reference_request_handoff_failed',
		},
		request,
	});

	return NextResponse.json({
		ok: requestResult.ok,
		reference: updatedReference,
		error: requestResult.error,
	});
}

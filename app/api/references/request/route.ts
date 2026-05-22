import { createUserAuditLog } from '@/lib/audit-server';
import {
	canReceiveReferenceCommunication,
	referenceCommunicationBlockedMessage,
} from '@/lib/carer-communications';
import { PERMISSIONS } from '@/lib/permissions';
import {
	REFERENCE_SELECT_FIELDS,
	enqueueReferenceRequestJob,
} from '@/lib/reference-requests';
import { processReferenceJobBatch } from '@/lib/reference-worker';
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
				status: string | null;
		  }
		| {
				id: string;
				organization_id: string;
				full_name: string;
				email: string;
				phone: string | null;
				status: string | null;
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
			'id, carer_id, full_name, organization, email, phone, relationship, reference_type, status, carers!inner(id, organization_id, full_name, email, phone, status)',
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

	if (!canReceiveReferenceCommunication(carer.status)) {
		const requestedAt = new Date().toISOString();
		const message = referenceCommunicationBlockedMessage(carer.status);
		const { data: updatedReference } = await admin
			.from('carer_references')
			.update({
				request_error: message,
				updated_at: requestedAt,
			})
			.eq('id', reference.id)
			.select(REFERENCE_SELECT_FIELDS)
			.maybeSingle();

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
				carer_status: carer.status,
				reference_email: reference.email,
				before: { status: reference.status },
				after: {
					status: updatedReference?.status ?? reference.status,
					request_error: updatedReference?.request_error ?? message,
				},
				permission_checked: PERMISSIONS.CARERS_EDIT,
				outcome: 'reference_request_skipped_carer_not_active',
			},
			request,
		});

		return NextResponse.json(
			{
				ok: false,
				reference: updatedReference ?? null,
				error: message,
				skipped: true,
			},
			{ status: 409 },
		);
	}

	const requestedAt = new Date().toISOString();
	const requestResult = await enqueueReferenceRequestJob({
		admin,
		referenceId: reference.id,
		organizationId: carer.organization_id,
		carerId: carer.id,
		requestedBy: user.id,
	});
	if (requestResult.ok) {
		await processReferenceJobBatch(admin, 10).catch((error) => {
			console.error('[reference-request] worker processing failed', error);
		});
	}

	const { data: updatedReference, error: updateError } = await admin
		.from('carer_references')
		.update({ updated_at: requestedAt })
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
				? 'reference_request_queued'
				: 'reference_request_queue_failed',
		},
		request,
	});

	return NextResponse.json({
		ok: requestResult.ok,
		reference: updatedReference,
		error: requestResult.error,
	});
}

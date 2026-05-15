import { createSystemAuditLog } from '@/lib/audit-server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const requestSchema = z.object({
	referenceId: z.uuid(),
	carerId: z.uuid(),
	organizationId: z.uuid(),
	responseUrl: z.string().url().optional(),
	submissionUrl: z.string().url().optional(),
	tallySubmissionUrl: z.string().url().optional(),
	responsePayload: z.record(z.string(), z.unknown()).optional(),
});

function isAuthorized(request: Request) {
	const configuredSecret = process.env.N8N_REFERENCE_WEBHOOK_SECRET;
	const header = request.headers.get('authorization') ?? '';
	const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : '';

	return Boolean(configuredSecret && token && token === configuredSecret);
}

export async function POST(request: Request) {
	if (!isAuthorized(request)) {
		return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
	}

	const result = requestSchema.safeParse(await request.json().catch(() => null));

	if (!result.success) {
		return NextResponse.json(
			{ error: 'A valid reference response payload is required.' },
			{ status: 400 },
		);
	}

	const admin = createAdminClient();
	const { data: reference, error: referenceError } = await admin
		.from('carer_references')
		.select('id, carer_id, full_name, email, status, carers!inner(id, organization_id, full_name, email)')
		.eq('id', result.data.referenceId)
		.eq('carer_id', result.data.carerId)
		.eq('carers.organization_id', result.data.organizationId)
		.maybeSingle();

	if (referenceError || !reference) {
		return NextResponse.json({ error: 'Reference not found.' }, { status: 404 });
	}

	const now = new Date().toISOString();
	const responseUrl =
		result.data.responseUrl ??
		result.data.submissionUrl ??
		result.data.tallySubmissionUrl ??
		null;
	const { data: updatedReference, error: updateError } = await admin
		.from('carer_references')
		.update({
			status: 'responded',
			response_received_at: now,
			response_payload: result.data.responsePayload ?? {},
			response_url: responseUrl,
			updated_at: now,
		})
		.eq('id', result.data.referenceId)
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
		organizationId: result.data.organizationId,
		entityId: result.data.referenceId,
		entityName: reference.full_name,
		source: 'api',
		details: {
			carer_id: result.data.carerId,
			reference_email: reference.email,
			before: { status: reference.status },
			after: {
				status: updatedReference.status,
				response_received_at: updatedReference.response_received_at,
				response_url: updatedReference.response_url,
			},
			changed_fields: ['status', 'response_received_at', 'response_payload', 'response_url'],
			outcome: 'reference_response_received_from_n8n',
		},
		request,
	});

	return NextResponse.json({ ok: true, reference: updatedReference });
}

export type ReferenceRequestRow = {
	id: string;
	full_name: string;
	organization: string | null;
	email: string;
	phone: string;
	relationship: string;
	reference_type: string;
};

export type ReferenceRequestCarer = {
	id: string;
	organization_id: string;
	full_name: string;
	email: string;
	phone: string | null;
};

export type ReferenceRequestOrganization = {
	name: string;
	slug: string;
} | null;

export type ReferenceRequestResult = {
	referenceId: string;
	ok: boolean;
	error: string | null;
};

export const REFERENCE_SELECT_FIELDS =
	'id, full_name, organization, email, phone, relationship, notes, reference_type, status, request_sent_at, request_error, response_received_at, response_payload, response_url, reviewed_at, review_notes';

export async function sendReferenceRequestToN8n({
	reference,
	carer,
	organization,
}: {
	reference: ReferenceRequestRow;
	carer: ReferenceRequestCarer;
	organization: ReferenceRequestOrganization;
}): Promise<ReferenceRequestResult> {
	const webhookUrl = process.env.N8N_REFERENCE_REQUEST_WEBHOOK_URL;
	if (!webhookUrl) {
		return {
			referenceId: reference.id,
			ok: false,
			error: 'N8N_REFERENCE_REQUEST_WEBHOOK_URL is not configured.',
		};
	}

	try {
		const response = await fetch(webhookUrl, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				referenceId: reference.id,
				carerId: carer.id,
				organizationId: carer.organization_id,
				organization: organization
					? { name: organization.name, slug: organization.slug }
					: null,
				carer: {
					fullName: carer.full_name,
					email: carer.email,
					phone: carer.phone,
				},
				reference: {
					fullName: reference.full_name,
					email: reference.email,
					phone: reference.phone,
					organization: reference.organization,
					relationship: reference.relationship,
					referenceType: reference.reference_type,
				},
			}),
		});

		if (!response.ok) {
			return {
				referenceId: reference.id,
				ok: false,
				error: `n8n returned ${response.status}`,
			};
		}

		return { referenceId: reference.id, ok: true, error: null };
	} catch (error) {
		console.warn('Reference request handoff to n8n failed:', error);
		return {
			referenceId: reference.id,
			ok: false,
			error: error instanceof Error ? error.message : 'Unknown n8n error',
		};
	}
}

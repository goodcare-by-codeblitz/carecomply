import { createUserAuditLog } from '@/lib/audit-server';
import { PERMISSIONS } from '@/lib/permissions';
import {
	personDetailsBaseSchema,
	personDetailsToRow,
} from '@/lib/person-profile';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const requestSchema = personDetailsBaseSchema.extend({
	carerId: z.string().uuid(),
}).refine(
	(data) =>
		!data.emergencyContactName ||
		Boolean(data.emergencyContactPhone || data.emergencyContactEmail),
	{
		message: 'Emergency contact phone or email is required.',
		path: ['emergencyContactPhone'],
	},
);

export async function PATCH(request: Request) {
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
			{ error: result.error.issues[0]?.message ?? 'Please provide valid carer details.' },
			{ status: 400 },
		);
	}

	const admin = createAdminClient();
	const { data: carer, error: carerError } = await admin
		.from('carers')
		.select(
			'id, organization_id, full_name, email, phone, address_line1, address_line2, city, county, postcode, emergency_contact_name, emergency_contact_relationship, emergency_contact_phone, emergency_contact_email',
		)
		.eq('id', result.data.carerId)
		.maybeSingle();

	if (carerError || !carer) {
		return NextResponse.json({ error: 'Carer not found.' }, { status: 404 });
	}

	const { data: canEdit } = await supabase.rpc('has_org_permission', {
		p_org_id: carer.organization_id,
		p_permission_code: PERMISSIONS.CARERS_EDIT,
	});

	if (!canEdit) {
		return NextResponse.json(
			{ error: 'You do not have permission to update this carer.' },
			{ status: 403 },
		);
	}

	const now = new Date().toISOString();
	const row = {
		...personDetailsToRow(result.data),
		updated_at: now,
	};

	const { data: updatedCarer, error } = await admin
		.from('carers')
		.update(row)
		.eq('id', carer.id)
		.select(
			'id, phone, address_line1, address_line2, city, county, postcode, emergency_contact_name, emergency_contact_relationship, emergency_contact_phone, emergency_contact_email',
		)
		.single();

	if (error || !updatedCarer) {
		return NextResponse.json(
			{ error: 'Carer details could not be updated.' },
			{ status: 500 },
		);
	}

	await createUserAuditLog({
		action: 'carer.updated',
		entityType: 'carer',
		organizationId: carer.organization_id,
		entityId: carer.id,
		entityName: carer.full_name,
		details: {
			before: carer,
			after: updatedCarer,
			changed_fields: Object.keys(row).filter((key) => key !== 'updated_at'),
			carer_email: carer.email,
			permission_checked: PERMISSIONS.CARERS_EDIT,
			outcome: 'carer_profile_details_updated',
		},
		request,
	});

	return NextResponse.json({ carer: updatedCarer });
}

import { PERMISSIONS } from '@/lib/permissions';
import { createUserAuditLog } from '@/lib/audit-server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const documentTypeSchema = z.object({
	orgId: z.string().uuid(),
	name: z.string().trim().min(2),
	description: z.string().trim().optional(),
	isRequired: z.boolean(),
	expiryMonths: z.number().int().positive().max(240).nullable().optional(),
});

const updateDocumentTypeSchema = documentTypeSchema.extend({
	id: z.string().uuid(),
});

const deleteDocumentTypeSchema = z.object({
	orgId: z.string().uuid(),
	id: z.string().uuid(),
});

async function requireSettingsManage(orgId: string) {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		return { ok: false as const, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
	}

	const { data: canManage } = await supabase.rpc('has_org_permission', {
		p_org_id: orgId,
		p_permission_code: PERMISSIONS.SETTINGS_MANAGE,
	});

	if (!canManage) {
		return {
			ok: false as const,
			response: NextResponse.json(
				{ error: 'You do not have permission to manage settings.' },
				{ status: 403 },
			),
		};
	}

	return { ok: true as const };
}

export async function GET(request: Request) {
	const { searchParams } = new URL(request.url);
	const orgId = searchParams.get('orgId');

	if (!orgId || !z.string().uuid().safeParse(orgId).success) {
		return NextResponse.json(
			{ error: 'A valid organization id is required.' },
			{ status: 400 },
		);
	}

	const auth = await requireSettingsManage(orgId);
	if (!auth.ok) return auth.response;

	const admin = createAdminClient();
	const { data, error } = await admin
		.from('document_types')
		.select('id, name, description, is_required, expiry_months, created_at')
		.eq('organization_id', orgId)
		.order('name');

	if (error) {
		return NextResponse.json(
			{ error: 'Document requirements could not be loaded.' },
			{ status: 500 },
		);
	}

	return NextResponse.json({ documentTypes: data ?? [] });
}

export async function POST(request: Request) {
	const result = documentTypeSchema.safeParse(await request.json().catch(() => null));

	if (!result.success) {
		return NextResponse.json(
			{ error: 'Please provide valid document requirement details.' },
			{ status: 400 },
		);
	}

	const auth = await requireSettingsManage(result.data.orgId);
	if (!auth.ok) return auth.response;

	const admin = createAdminClient();
	const { data, error } = await admin
		.from('document_types')
		.insert({
			organization_id: result.data.orgId,
			name: result.data.name,
			description: result.data.description || null,
			is_required: result.data.isRequired,
			expiry_months: result.data.expiryMonths ?? null,
		})
		.select('id, name, description, is_required, expiry_months, created_at')
		.single();

	if (error) {
		return NextResponse.json(
			{ error: 'Document requirement could not be created.' },
			{ status: 500 },
		);
	}

	await createUserAuditLog({
		action: 'document_type.created',
		entityType: 'document_type',
		organizationId: result.data.orgId,
		entityId: data.id,
		entityName: data.name,
		details: {
			after: data,
			permission_checked: PERMISSIONS.SETTINGS_MANAGE,
			outcome: 'document_requirement_created',
		},
		request,
	});

	return NextResponse.json({ documentType: data });
}

export async function PATCH(request: Request) {
	const result = updateDocumentTypeSchema.safeParse(
		await request.json().catch(() => null),
	);

	if (!result.success) {
		return NextResponse.json(
			{ error: 'Please provide valid document requirement details.' },
			{ status: 400 },
		);
	}

	const auth = await requireSettingsManage(result.data.orgId);
	if (!auth.ok) return auth.response;

	const admin = createAdminClient();
	const { data: existing } = await admin
		.from('document_types')
		.select('id, name, description, is_required, expiry_months')
		.eq('id', result.data.id)
		.eq('organization_id', result.data.orgId)
		.maybeSingle();
	const { data, error } = await admin
		.from('document_types')
		.update({
			name: result.data.name,
			description: result.data.description || null,
			is_required: result.data.isRequired,
			expiry_months: result.data.expiryMonths ?? null,
		})
		.eq('id', result.data.id)
		.eq('organization_id', result.data.orgId)
		.select('id, name, description, is_required, expiry_months, created_at')
		.single();

	if (error) {
		return NextResponse.json(
			{ error: 'Document requirement could not be updated.' },
			{ status: 500 },
		);
	}

	await createUserAuditLog({
		action: 'document_type.updated',
		entityType: 'document_type',
		organizationId: result.data.orgId,
		entityId: data.id,
		entityName: data.name,
		details: {
			before: existing,
			after: data,
			changed_fields: ['name', 'description', 'is_required', 'expiry_months'],
			permission_checked: PERMISSIONS.SETTINGS_MANAGE,
			outcome: 'document_requirement_updated',
		},
		request,
	});

	return NextResponse.json({ documentType: data });
}

export async function DELETE(request: Request) {
	const result = deleteDocumentTypeSchema.safeParse(
		await request.json().catch(() => null),
	);

	if (!result.success) {
		return NextResponse.json(
			{ error: 'A valid document requirement id is required.' },
			{ status: 400 },
		);
	}

	const auth = await requireSettingsManage(result.data.orgId);
	if (!auth.ok) return auth.response;

	const admin = createAdminClient();
	const { data: existing } = await admin
		.from('document_types')
		.select('id, name, description, is_required, expiry_months')
		.eq('id', result.data.id)
		.eq('organization_id', result.data.orgId)
		.maybeSingle();
	const { count, error: countError } = await admin
		.from('documents')
		.select('id', { count: 'exact', head: true })
		.eq('document_type_id', result.data.id);

	if (countError) {
		return NextResponse.json(
			{ error: 'Document usage could not be checked.' },
			{ status: 500 },
		);
	}

	if ((count ?? 0) > 0) {
		return NextResponse.json(
			{
				error:
					'This requirement already has uploaded documents and cannot be deleted.',
			},
			{ status: 409 },
		);
	}

	const { error } = await admin
		.from('document_types')
		.delete()
		.eq('id', result.data.id)
		.eq('organization_id', result.data.orgId);

	if (error) {
		return NextResponse.json(
			{ error: 'Document requirement could not be deleted.' },
			{ status: 500 },
		);
	}

	await createUserAuditLog({
		action: 'document_type.deleted',
		entityType: 'document_type',
		organizationId: result.data.orgId,
		entityId: result.data.id,
		entityName: existing?.name ?? result.data.id,
		details: {
			before: existing,
			permission_checked: PERMISSIONS.SETTINGS_MANAGE,
			outcome: 'document_requirement_deleted',
		},
		request,
	});

	return NextResponse.json({ ok: true });
}

import { createUserAuditLog } from '@/lib/audit-server';
import { PERMISSIONS } from '@/lib/permissions';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const createRoleSchema = z.object({
	orgId: z.string().uuid(),
	name: z.string().trim().min(1),
	description: z.string().trim().optional(),
});

const permissionSchema = z.object({
	orgId: z.string().uuid(),
	roleId: z.string().uuid(),
	permissionId: z.string().uuid(),
	checked: z.boolean(),
});

async function requireSettingsManage(orgId: string) {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		return {
			ok: false as const,
			response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
		};
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

export async function POST(request: Request) {
	const result = createRoleSchema.safeParse(await request.json().catch(() => null));

	if (!result.success) {
		return NextResponse.json(
			{ error: 'Please provide valid role details.' },
			{ status: 400 },
		);
	}

	const auth = await requireSettingsManage(result.data.orgId);
	if (!auth.ok) return auth.response;

	const admin = createAdminClient();
	const { data, error } = await admin
		.from('roles')
		.insert({
			organization_id: result.data.orgId,
			name: result.data.name,
			description: result.data.description || null,
			scope: 'ORGANIZATION',
			is_system_role: false,
		})
		.select('id, name, description, is_system_role')
		.single();

	if (error) {
		return NextResponse.json(
			{ error: 'Role could not be created.' },
			{ status: 500 },
		);
	}

	await createUserAuditLog({
		action: 'settings.updated',
		entityType: 'organization',
		organizationId: result.data.orgId,
		entityId: data.id,
		entityName: data.name,
		details: {
			setting_area: 'roles',
			after: data,
			changed_fields: ['roles'],
			permission_checked: PERMISSIONS.SETTINGS_MANAGE,
			outcome: 'role_created',
		},
		request,
	});

	return NextResponse.json({ role: { ...data, permissionIds: [] } });
}

export async function PATCH(request: Request) {
	const result = permissionSchema.safeParse(await request.json().catch(() => null));

	if (!result.success) {
		return NextResponse.json(
			{ error: 'Please provide valid permission details.' },
			{ status: 400 },
		);
	}

	const auth = await requireSettingsManage(result.data.orgId);
	if (!auth.ok) return auth.response;

	const admin = createAdminClient();
	const [{ data: role }, { data: permission }] = await Promise.all([
		admin
			.from('roles')
			.select('id, name, description, is_system_role, organization_id')
			.eq('id', result.data.roleId)
			.eq('organization_id', result.data.orgId)
			.maybeSingle(),
		admin
			.from('permissions')
			.select('id, code, name, category')
			.eq('id', result.data.permissionId)
			.maybeSingle(),
	]);

	if (!role || !permission) {
		return NextResponse.json(
			{ error: 'Role or permission could not be found.' },
			{ status: 404 },
		);
	}

	if (role.is_system_role) {
		return NextResponse.json(
			{ error: 'Protected system roles cannot be edited.' },
			{ status: 409 },
		);
	}

	const { data: beforePermissions } = await admin
		.from('role_permissions')
		.select('permission_id')
		.eq('role_id', result.data.roleId);

	if (result.data.checked) {
		const { error } = await admin
			.from('role_permissions')
			.upsert(
				{ role_id: result.data.roleId, permission_id: result.data.permissionId },
				{ onConflict: 'role_id,permission_id' },
			);

		if (error) {
			return NextResponse.json(
				{ error: 'Permission could not be added.' },
				{ status: 500 },
			);
		}
	} else {
		const { error } = await admin
			.from('role_permissions')
			.delete()
			.eq('role_id', result.data.roleId)
			.eq('permission_id', result.data.permissionId);

		if (error) {
			return NextResponse.json(
				{ error: 'Permission could not be removed.' },
				{ status: 500 },
			);
		}
	}

	const { data: afterPermissions } = await admin
		.from('role_permissions')
		.select('permission_id')
		.eq('role_id', result.data.roleId);

	await createUserAuditLog({
		action: 'settings.updated',
		entityType: 'organization',
		organizationId: result.data.orgId,
		entityId: role.id,
		entityName: role.name,
		details: {
			setting_area: 'role_permissions',
			role,
			permission,
			permission_enabled: result.data.checked,
			before: beforePermissions ?? [],
			after: afterPermissions ?? [],
			changed_fields: ['role_permissions'],
			permission_checked: PERMISSIONS.SETTINGS_MANAGE,
			outcome: result.data.checked ? 'role_permission_added' : 'role_permission_removed',
		},
		request,
	});

	return NextResponse.json({ ok: true });
}

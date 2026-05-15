import { createUserAuditLog } from '@/lib/audit-server';
import { PERMISSIONS } from '@/lib/permissions';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const baseSchema = z.object({
	orgId: z.string().uuid(),
});

const profileSchema = baseSchema.extend({
	action: z.literal('profile'),
	name: z.string().trim().min(1),
});

const logoSchema = baseSchema.extend({
	action: z.literal('logo'),
	logoPath: z.string().trim().min(1),
	logoUrl: z.string().trim().url(),
});

const referenceRequirementsSchema = baseSchema.extend({
	action: z.literal('reference_requirements'),
	requiredWorkReferencesCount: z.number().int().min(1).max(5).nullable(),
	requiredCharacterReferencesCount: z.number().int().min(1).max(5).nullable(),
});

const organizationSettingsSchema = z.discriminatedUnion('action', [
	profileSchema,
	logoSchema,
	referenceRequirementsSchema,
]);

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

export async function PATCH(request: Request) {
	const result = organizationSettingsSchema.safeParse(
		await request.json().catch(() => null),
	);

	if (!result.success) {
		return NextResponse.json(
			{ error: 'Please provide valid organization settings.' },
			{ status: 400 },
		);
	}

	const auth = await requireSettingsManage(result.data.orgId);
	if (!auth.ok) return auth.response;

	const admin = createAdminClient();
	const { data: before, error: beforeError } = await admin
		.from('organizations')
		.select(
			'id, name, slug, logo_url, logo_path, required_work_references_count, required_character_references_count',
		)
		.eq('id', result.data.orgId)
		.maybeSingle();

	if (beforeError || !before) {
		return NextResponse.json(
			{ error: 'Organization could not be loaded.' },
			{ status: 404 },
		);
	}

	const update =
		result.data.action === 'profile'
			? { name: result.data.name }
			: result.data.action === 'logo'
				? { logo_path: result.data.logoPath, logo_url: result.data.logoUrl }
				: {
						required_work_references_count:
							result.data.requiredWorkReferencesCount,
						required_character_references_count:
							result.data.requiredCharacterReferencesCount,
					};

	const { data: after, error } = await admin
		.from('organizations')
		.update(update)
		.eq('id', result.data.orgId)
		.select('*')
		.single();

	if (error) {
		return NextResponse.json(
			{ error: 'Organization settings could not be saved.' },
			{ status: 500 },
		);
	}

	const changedFields =
		result.data.action === 'profile'
			? ['name']
			: result.data.action === 'logo'
				? ['logo_path', 'logo_url']
				: [
						'required_work_references_count',
						'required_character_references_count',
					];

	await createUserAuditLog({
		action: 'settings.updated',
		entityType: 'organization',
		organizationId: result.data.orgId,
		entityId: result.data.orgId,
		entityName: after.name,
		details: {
			setting_area: result.data.action,
			before,
			after,
			changed_fields: changedFields,
			permission_checked: PERMISSIONS.SETTINGS_MANAGE,
			outcome: 'organization_settings_updated',
		},
		request,
	});

	return NextResponse.json({ organization: after });
}

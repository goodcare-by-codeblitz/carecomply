import { createAdminClient } from '@/lib/supabase/admin';

export type PlatformRoleName =
	| 'platform_super_admin'
	| 'platform_admin'
	| 'support';

export type PlatformAccess = {
	role: PlatformRoleName | null;
	canAccessAdmin: boolean;
};

const PLATFORM_ADMIN_ROLES: PlatformRoleName[] = [
	'platform_super_admin',
	'platform_admin',
];

type AdminClient = ReturnType<typeof createAdminClient>;

type PlatformMembershipRow = {
	roles?: { name?: string | null } | { name?: string | null }[] | null;
};

function normalizeRelation<T>(value: T | T[] | null | undefined) {
	return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function isPlatformRoleName(value: string | null | undefined): value is PlatformRoleName {
	return (
		value === 'platform_super_admin' ||
		value === 'platform_admin' ||
		value === 'support'
	);
}

function getBootstrapEmail() {
	return process.env.PLATFORM_SUPER_ADMIN_EMAIL?.trim().toLowerCase() || null;
}

export async function bootstrapPlatformSuperAdmin(loginEmail?: string) {
	const email = getBootstrapEmail();
	const password = process.env.PLATFORM_SUPER_ADMIN_PASSWORD;
	const fullName =
		process.env.PLATFORM_SUPER_ADMIN_NAME?.trim() || 'Platform Super Admin';

	if (!email || !password) return;
	if (loginEmail && loginEmail.trim().toLowerCase() !== email) return;

	const admin = createAdminClient();
	const roleId = await ensurePlatformRole(admin, 'platform_super_admin');
	const user = await findAuthUserByEmail(admin, email);

	const userId = user?.id ?? (await createBootstrapUser(admin, email, password, fullName));
	if (!userId) return;

	await admin.from('profiles').upsert({
		id: userId,
		full_name: fullName,
		email,
		is_super_admin: true,
	});

	await admin
		.from('platform_memberships')
		.upsert(
			{
				user_id: userId,
				role_id: roleId,
			},
			{ onConflict: 'user_id' },
		);
}

export async function getPlatformAccessForUser(
	admin: AdminClient,
	userId: string,
): Promise<PlatformAccess> {
	const { data: membership } = await admin
		.from('platform_memberships')
		.select('roles!inner(name)')
		.eq('user_id', userId)
		.maybeSingle();

	const role = normalizeRelation((membership as PlatformMembershipRow | null)?.roles);
	if (isPlatformRoleName(role?.name)) {
		return {
			role: role.name,
			canAccessAdmin: PLATFORM_ADMIN_ROLES.includes(role.name),
		};
	}

	const { data: profile } = await admin
		.from('profiles')
		.select('is_super_admin')
		.eq('id', userId)
		.maybeSingle();

	if (profile?.is_super_admin) {
		return { role: 'platform_super_admin', canAccessAdmin: true };
	}

	return { role: null, canAccessAdmin: false };
}

async function ensurePlatformRole(admin: AdminClient, name: PlatformRoleName) {
	const description =
		name === 'platform_super_admin'
			? 'Full platform control. Can manage all tenants, billing, and system settings.'
			: name === 'platform_admin'
				? 'Can manage tenants and system operations but limited access to critical settings.'
				: 'Support role with read access and limited operational capabilities.';

	const { data: existing } = await admin
		.from('roles')
		.select('id')
		.is('organization_id', null)
		.eq('scope', 'PLATFORM')
		.eq('name', name)
		.maybeSingle();

	if (existing?.id) return existing.id as string;

	const { data, error } = await admin
		.from('roles')
		.insert({
			organization_id: null,
			name,
			scope: 'PLATFORM',
			is_system_role: true,
			description,
		})
		.select('id')
		.single();

	if (error || !data?.id) {
		throw new Error(error?.message ?? `Could not create ${name} role.`);
	}

	return data.id as string;
}

async function findAuthUserByEmail(admin: AdminClient, email: string) {
	for (let page = 1; page <= 10; page += 1) {
		const { data, error } = await admin.auth.admin.listUsers({
			page,
			perPage: 1000,
		});

		if (error) throw error;

		const user = data.users.find(
			(candidate) => candidate.email?.toLowerCase() === email,
		);
		if (user) return user;
		if (data.users.length < 1000) return null;
	}

	return null;
}

async function createBootstrapUser(
	admin: AdminClient,
	email: string,
	password: string,
	fullName: string,
) {
	const { data, error } = await admin.auth.admin.createUser({
		email,
		password,
		email_confirm: true,
		user_metadata: {
			full_name: fullName,
		},
	});

	if (!error && data.user?.id) return data.user.id;

	if (error?.message.toLowerCase().includes('already')) {
		const existing = await findAuthUserByEmail(admin, email);
		return existing?.id ?? null;
	}

	throw error ?? new Error('Platform super admin user could not be created.');
}

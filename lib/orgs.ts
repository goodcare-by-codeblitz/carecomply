export type UserOrganization = {
	id: string;
	name: string;
	slug: string;
	logo_url?: string | null;
	logo_path?: string | null;
	required_work_references_count?: number | null;
	required_character_references_count?: number | null;
};

export type UserOrganizationsResult =
	| { ok: true; organizations: UserOrganization[]; usedLegacyFallback: boolean }
	| { ok: false; error: unknown };

type OrganizationAccessRow = UserOrganization & {
	organization_memberships?: { user_id: string; deleted_at: string | null }[];
};

type MembershipRow = {
	organizations: UserOrganization | UserOrganization[] | null;
};

type QueryResult<T> = {
	data: T | null;
	error: unknown;
};

type QueryBuilder<T> = PromiseLike<QueryResult<T>> & {
	eq: (column: string, value: string) => QueryBuilder<T>;
	is: (column: string, value: null) => QueryBuilder<T>;
	maybeSingle: () => PromiseLike<QueryResult<T>>;
};

type SupabaseLike = {
	from: (table: string) => {
		select: (columns: string) => QueryBuilder<MembershipRow[]>;
	};
};

type OrganizationSupabaseLike = {
	from: (table: string) => {
		select: (columns: string) => QueryBuilder<OrganizationAccessRow>;
	};
};

export async function getUserOrganizations(
	supabase: unknown,
	userId: string,
): Promise<UserOrganization[]> {
	const result = await getUserOrganizationsResult(supabase, userId);

	if (!result.ok) {
		console.error('User organizations could not be loaded', result.error);
		return [];
	}

	return result.organizations;
}

export async function getUserOrganizationsResult(
	supabase: unknown,
	userId: string,
): Promise<UserOrganizationsResult> {
	const client = supabase as SupabaseLike;
	const { data, error } = await client
		.from('organization_memberships')
		.select('organizations(*)')
		.eq('user_id', userId)
		.is('deleted_at', null);

	if (error) {
		if (isMissingColumnOrSchemaCacheError(error)) {
			console.warn(
				'organization_memberships.deleted_at is unavailable; using legacy organization lookup. Apply the soft-delete migration to restore active-member filtering.',
			);
			return getUserOrganizationsLegacy(client, userId);
		}

		return { ok: false, error };
	}

	if (!Array.isArray(data)) {
		return {
			ok: false,
			error: new Error('Organization membership query returned invalid data.'),
		};
	}

	return {
		ok: true,
		organizations: normalizeOrganizations(data),
		usedLegacyFallback: false,
	};
}

async function getUserOrganizationsLegacy(
	client: SupabaseLike,
	userId: string,
): Promise<UserOrganizationsResult> {
	const { data, error } = await client
		.from('organization_memberships')
		.select('organizations(*)')
		.eq('user_id', userId);

	if (error) {
		return { ok: false, error };
	}

	if (!Array.isArray(data)) {
		return {
			ok: false,
			error: new Error('Legacy organization membership query returned invalid data.'),
		};
	}

	return {
		ok: true,
		organizations: normalizeOrganizations(data),
		usedLegacyFallback: true,
	};
}

function normalizeOrganizations(rows: MembershipRow[]) {
	return rows
		.map((row) =>
			Array.isArray(row.organizations)
				? row.organizations[0]
				: row.organizations,
		)
		.filter((org): org is UserOrganization => Boolean(org?.id && org.slug));
}

export async function resolveOrgAccess(
	supabase: unknown,
	userId: string,
	orgSlug: string,
): Promise<UserOrganization | null> {
	return getCurrentOrgBySlug(supabase, userId, orgSlug);
}

export async function getCurrentOrgBySlug(
	supabase: unknown,
	userId: string,
	orgSlug: string,
): Promise<UserOrganization | null> {
	const client = supabase as OrganizationSupabaseLike;
	const { data, error } = await client
		.from('organizations')
		.select('*, organization_memberships!inner(user_id, deleted_at)')
		.eq('slug', orgSlug)
		.eq('organization_memberships.user_id', userId)
		.is('organization_memberships.deleted_at', null)
		.maybeSingle();

	if (error) {
		if (isMissingColumnOrSchemaCacheError(error)) {
			console.warn(
				'organization_memberships.deleted_at is unavailable; using legacy current organization lookup. Apply the soft-delete migration to restore active-member filtering.',
			);
			return getCurrentOrgBySlugLegacy(client, userId, orgSlug);
		}

		return null;
	}

	if (!data) {
		return null;
	}

	return normalizeOrganizationAccessRow(data);
}

async function getCurrentOrgBySlugLegacy(
	client: OrganizationSupabaseLike,
	userId: string,
	orgSlug: string,
) {
	const { data, error } = await client
		.from('organizations')
		.select('*, organization_memberships!inner(user_id)')
		.eq('slug', orgSlug)
		.eq('organization_memberships.user_id', userId)
		.maybeSingle();

	if (error || !data) {
		return null;
	}

	return normalizeOrganizationAccessRow(data);
}

function normalizeOrganizationAccessRow(data: OrganizationAccessRow) {
	return {
		id: data.id,
		name: data.name,
		slug: data.slug,
		logo_url: data.logo_url ?? null,
		logo_path: data.logo_path ?? null,
		required_work_references_count: data.required_work_references_count ?? null,
		required_character_references_count: data.required_character_references_count ?? null,
	};
}

export function getOrgRedirectPath(organizations: UserOrganization[]) {
	if (organizations.length === 0) return '/create-org';
	if (organizations.length === 1) return `/${organizations[0].slug}/dashboard`;
	return '/select-org';
}

export function getOrganizationBySlug(
	organizations: UserOrganization[],
	orgSlug: string,
) {
	return organizations.find((org) => org.slug === orgSlug) ?? null;
}

export function isMissingRelationError(error: unknown) {
	if (!error || typeof error !== 'object') return false;

	const maybeError = error as {
		code?: string;
		message?: string;
		details?: string;
	};

	const text =
		`${maybeError.message ?? ''} ${maybeError.details ?? ''}`.toLowerCase();

	return (
		maybeError.code === '42P01' ||
		text.includes('does not exist') ||
		text.includes('could not find the table') ||
		text.includes('schema cache')
	);
}

export function isMissingColumnOrBucketError(error: unknown) {
	const maybeError = error as {
		code?: string;
		message?: string;
		details?: string;
	};
	const text =
		`${maybeError.message ?? ''} ${maybeError.details ?? ''}`.toLowerCase();

	return (
		maybeError.code === '42703' ||
		maybeError.code === 'PGRST204' ||
		text.includes('could not find') ||
		text.includes('does not exist') ||
		text.includes('schema cache') ||
		text.includes('bucket not found') ||
		text.includes('bucket')
	);
}

export function isMissingColumnOrSchemaCacheError(error: unknown) {
	const maybeError = error as {
		code?: string;
		message?: string;
		details?: string;
	};
	const text =
		`${maybeError.message ?? ''} ${maybeError.details ?? ''}`.toLowerCase();

	return (
		maybeError.code === '42703' ||
		maybeError.code === 'PGRST204' ||
		text.includes('deleted_at') ||
		text.includes('schema cache') ||
		text.includes('could not find')
	);
}

export function getOrgInitials(name: string) {
	const initials = name
		.trim()
		.split(/\s+/)
		.map((part) => part[0])
		.join('')
		.slice(0, 2)
		.toUpperCase();

	return initials || 'O';
}

export function getOrgLogoSrc(
	org: Pick<UserOrganization, 'logo_url' | 'logo_path'> | null | undefined,
) {
	if (!org) return null;
	return org.logo_url ?? null;
}

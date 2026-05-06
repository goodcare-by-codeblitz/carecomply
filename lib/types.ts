export type Permission = {
	id: string;
	code: string;
	name: string;
	description: string;
	category: string;
};

export type RolePermission = {
	id: string;
	permissions: Permission | null;
};

export type Role = {
	id: string;
	organization_id: string;
	name: string;
	description: string;
	is_system_role: boolean;
	role_permissions: RolePermission[];
};

export type Membership = {
	user_id: string;
	organization_id: string;
	deleted_at?: string | null;
	roles: Role | null; // ✅ FIXED (object, not array)
};

export type Organization = {
	id: string;
	name: string;
	slug: string;
	logo_url?: string | null;
	logo_path?: string | null;
	organization_memberships: Membership[];
};

export type NormalizedState = {
	organizations: Record<
		string,
		{
			id: string;
			name: string;
			slug: string;
			logo_url?: string | null;
			logo_path?: string | null;
		}
	>;
	memberships: Record<
		string,
		{
			user_id: string;
			organization_id: string;
			role_id: string | null;
		}
	>;
	roles: Record<string, Role>;
	permissions: Record<string, Permission>;
};

import { useOrgStore } from '@/stores/auth-store';

function useUserPermissions(orgId: string): string[] {
	const { memberships, roles, permissions } = useOrgStore();

	const membership = Object.values(memberships).find(
		(m) => m.organization_id === orgId,
	);

	if (!membership || !membership.role_id) return [];

	const role = roles[membership.role_id];
	if (!role) return [];

	return (role.role_permissions ?? [])
		.map((rp) => {
			const permissionId = rp.permissions?.id;
			return permissionId ? permissions[permissionId]?.code : null;
		})
		.filter((code): code is string => Boolean(code));
}

export function usePermissionSet(orgId: string): Set<string> {
	const permissions = useUserPermissions(orgId);
	return new Set(permissions);
}

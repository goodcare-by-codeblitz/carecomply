import { getOrgRedirectPath, type UserOrganization } from '@/lib/orgs';

export type PlatformAccess = {
	role: 'platform_super_admin' | 'platform_admin' | 'support' | null;
	canAccessAdmin: boolean;
};

export function getPostLoginRedirect({
	inviteRedirect,
	pendingCreateOrgRedirect,
	platformAccess,
	organizations,
}: {
	inviteRedirect: string | null;
	pendingCreateOrgRedirect: string | null;
	platformAccess?: PlatformAccess | null;
	organizations: UserOrganization[];
}) {
	return (
		inviteRedirect ??
		pendingCreateOrgRedirect ??
		(platformAccess?.canAccessAdmin ? '/admin/reminders' : null) ??
		getOrgRedirectPath(organizations)
	);
}

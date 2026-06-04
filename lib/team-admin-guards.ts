import type { createAdminClient } from '@/lib/supabase/admin';

type AdminClient = ReturnType<typeof createAdminClient>;

type MembershipAdminGuardRow = {
	id: string;
	organization_id: string;
	role_id: string | null;
	status: string | null;
	deleted_at: string | null;
};

export const LAST_ADMIN_ERROR =
	'Every organization must have at least one active admin. Add another admin before changing this member.';

export async function wouldRemoveLastOrganizationAdmin({
	admin,
	membership,
	nextRoleId,
	nextStatus,
	nextDeletedAt,
}: {
	admin: AdminClient;
	membership: MembershipAdminGuardRow;
	nextRoleId?: string | null;
	nextStatus?: string | null;
	nextDeletedAt?: string | null;
}) {
	const { data: adminRole, error: roleError } = await admin
		.from('roles')
		.select('id')
		.eq('organization_id', membership.organization_id)
		.eq('name', 'admin')
		.maybeSingle();

	if (roleError || !adminRole) {
		return false;
	}

	if (membership.role_id !== adminRole.id) {
		return false;
	}

	const currentStatus = membership.status ?? 'active';
	const currentCountsAsAdmin =
		!membership.deleted_at && ['active', 'on_leave'].includes(currentStatus);

	if (!currentCountsAsAdmin) {
		return false;
	}

	const nextCountsAsAdmin =
		(nextRoleId ?? membership.role_id) === adminRole.id &&
		!nextDeletedAt &&
		['active', 'on_leave'].includes(nextStatus ?? currentStatus);

	if (nextCountsAsAdmin) {
		return false;
	}

	const { count, error: countError } = await admin
		.from('organization_memberships')
		.select('id', { count: 'exact', head: true })
		.eq('organization_id', membership.organization_id)
		.eq('role_id', adminRole.id)
		.is('deleted_at', null)
		.in('status', ['active', 'on_leave']);

	if (countError) {
		throw new Error(countError.message || 'Admin membership count failed.');
	}

	return (count ?? 0) <= 1;
}

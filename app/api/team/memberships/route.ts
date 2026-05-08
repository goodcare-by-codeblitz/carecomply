import { PERMISSIONS } from '@/lib/permissions';
import { createUserAuditLog } from '@/lib/audit-server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

type MembershipActionRequest = {
	action?: 'update_role' | 'remove';
	membershipId?: string;
	roleId?: string;
};

type MembershipRow = {
	id: string;
	user_id: string;
	organization_id: string;
	role_id: string | null;
	deleted_at: string | null;
};

export async function PATCH(request: Request) {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
	}

	let payload: MembershipActionRequest;

	try {
		payload = (await request.json()) as MembershipActionRequest;
	} catch {
		return NextResponse.json(
			{ error: 'Invalid membership request.' },
			{ status: 400 },
		);
	}

	if (!payload.membershipId || !payload.action) {
		return NextResponse.json(
			{ error: 'Membership id and action are required.' },
			{ status: 400 },
		);
	}

	const admin = createAdminClient();
	const { data: membership, error: membershipError } = await admin
		.from('organization_memberships')
		.select('id, user_id, organization_id, role_id, deleted_at, roles(name), profiles(full_name, email)')
		.eq('id', payload.membershipId)
		.maybeSingle();

	if (membershipError || !membership) {
		return NextResponse.json(
			{ error: 'Membership was not found.' },
			{ status: 404 },
		);
	}

	const targetMembership = membership as MembershipRow;

	if (targetMembership.deleted_at) {
		return NextResponse.json(
			{ error: 'Membership is no longer active.' },
			{ status: 404 },
		);
	}

	const { data: canManageTeam } = await supabase.rpc('has_org_permission', {
		p_org_id: targetMembership.organization_id,
		p_permission_code: PERMISSIONS.TEAM_MANAGE,
	});

	if (!canManageTeam) {
		return NextResponse.json(
			{ error: 'You do not have permission to manage team members.' },
			{ status: 403 },
		);
	}

	if (payload.action === 'remove') {
		if (targetMembership.user_id === user.id) {
			return NextResponse.json(
				{ error: 'You cannot remove yourself from the team.' },
				{ status: 400 },
			);
		}

		const removedAt = new Date().toISOString();
		const targetProfile = normalizeRelation(
			(membership as typeof membership & {
				profiles?: { full_name: string | null; email: string | null } | { full_name: string | null; email: string | null }[] | null;
			}).profiles,
		);
		const targetRole = normalizeRelation(
			(membership as typeof membership & {
				roles?: { name: string | null } | { name: string | null }[] | null;
			}).roles,
		);
		const { error } = await admin
			.from('organization_memberships')
			.update({
				deleted_at: removedAt,
				updated_at: removedAt,
			})
			.eq('id', targetMembership.id)
			.is('deleted_at', null);

		if (error) {
			return NextResponse.json(
				{ error: 'Member could not be removed.' },
				{ status: 500 },
			);
		}

		const { count: activeMemberships } = await admin
			.from('organization_memberships')
			.select('id', { count: 'exact', head: true })
			.eq('user_id', targetMembership.user_id)
			.is('deleted_at', null);
		const profileSoftDeleted = (activeMemberships ?? 0) === 0;

		if (profileSoftDeleted) {
			await admin
				.from('profiles')
				.update({
					deleted_at: removedAt,
					deleted_by: user.id,
				})
				.eq('id', targetMembership.user_id)
				.is('deleted_at', null);
		}

		await createUserAuditLog({
			action: 'team.member_removed',
			entityType: 'team_member',
			organizationId: targetMembership.organization_id,
			entityId: targetMembership.id,
			entityName:
				targetProfile?.full_name ??
				targetProfile?.email ??
				targetMembership.user_id,
			details: {
				removed_user_id: targetMembership.user_id,
				removed_email: targetProfile?.email ?? null,
				previous_role_id: targetMembership.role_id,
				previous_role_name: targetRole?.name ?? null,
				deleted_membership_at: removedAt,
				profile_soft_deleted: profileSoftDeleted,
				permission_checked: PERMISSIONS.TEAM_MANAGE,
				outcome: 'organization_access_removed',
			},
			request,
		});

		return NextResponse.json({
			ok: true,
			membership: { ...targetMembership, deleted_at: removedAt },
		});
	}

	if (!payload.roleId) {
		return NextResponse.json(
			{ error: 'Role id is required.' },
			{ status: 400 },
		);
	}

	const { data: role, error: roleError } = await admin
		.from('roles')
		.select('id, name, description, is_system_role')
		.eq('id', payload.roleId)
		.eq('organization_id', targetMembership.organization_id)
		.maybeSingle();

	if (roleError || !role) {
		return NextResponse.json(
			{ error: 'Role was not found for this organization.' },
			{ status: 400 },
		);
	}

	const updatedAt = new Date().toISOString();
	const { data: updatedMembership, error: updateError } = await admin
		.from('organization_memberships')
		.update({
			role_id: payload.roleId,
			updated_at: updatedAt,
		})
		.eq('id', targetMembership.id)
		.is('deleted_at', null)
		.select('id, user_id, role_id, deleted_at')
		.single();

	if (updateError || !updatedMembership) {
		return NextResponse.json(
			{ error: 'Role could not be updated.' },
			{ status: 500 },
		);
	}

	await createUserAuditLog({
		action: 'team.role_changed',
		entityType: 'team_member',
		organizationId: targetMembership.organization_id,
		entityId: targetMembership.id,
		entityName: targetMembership.user_id,
		details: {
			user_id: targetMembership.user_id,
			before: { role_id: targetMembership.role_id },
			after: { role_id: payload.roleId, role_name: role.name },
			changed_fields: ['role_id'],
			permission_checked: PERMISSIONS.TEAM_MANAGE,
		},
		request,
	});

	return NextResponse.json({
		ok: true,
		membership: updatedMembership,
		role,
	});
}

function normalizeRelation<T>(value: T | T[] | null | undefined) {
	return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

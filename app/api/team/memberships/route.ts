import { PERMISSIONS } from '@/lib/permissions';
import { createUserAuditLog } from '@/lib/audit-server';
import {
	teamDetailsToRow,
	teamMemberDetailsBaseSchema,
} from '@/lib/person-profile';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

type MembershipActionRequest = {
	action?:
		| 'update_role'
		| 'update_details'
		| 'remove'
		| 'mark_on_leave'
		| 'return_from_leave'
		| 'mark_suspended'
		| 'return_from_suspension'
		| 'mark_former'
		| 'restore_former';
	membershipId?: string;
	roleId?: string;
	details?: unknown;
};

type MembershipRow = {
	id: string;
	user_id: string;
	organization_id: string;
	role_id: string | null;
	deleted_at: string | null;
	status: string | null;
	previous_status: string | null;
	former_at: string | null;
	phone: string | null;
	job_title: string | null;
	department: string | null;
	address_line1: string | null;
	address_line2: string | null;
	city: string | null;
	county: string | null;
	postcode: string | null;
	emergency_contact_name: string | null;
	emergency_contact_relationship: string | null;
	emergency_contact_phone: string | null;
	emergency_contact_email: string | null;
};

type ProfileRow = {
	full_name: string | null;
	email: string | null;
};

const BLOCKING_SELF_ACTIONS = new Set([
	'remove',
	'mark_suspended',
	'mark_former',
]);
const HOLD_STATUSES = new Set(['on_leave', 'suspended', 'former']);
const detailsSchema = teamMemberDetailsBaseSchema.refine(
	(data) =>
		!data.emergencyContactName ||
		Boolean(data.emergencyContactPhone || data.emergencyContactEmail),
	{
		message: 'Emergency contact phone or email is required.',
		path: ['emergencyContactPhone'],
	},
);

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
		.select('id, user_id, organization_id, role_id, deleted_at, status, previous_status, former_at, phone, job_title, department, address_line1, address_line2, city, county, postcode, emergency_contact_name, emergency_contact_relationship, emergency_contact_phone, emergency_contact_email, roles(name)')
		.eq('id', payload.membershipId)
		.maybeSingle();

	if (membershipError) {
		console.error('[team-memberships] membership lookup failed', membershipError);
		return NextResponse.json(
			{
				error: 'Membership could not be loaded.',
				...(process.env.NODE_ENV !== 'production'
					? { diagnostics: formatQueryError(membershipError) }
					: {}),
			},
			{ status: 500 },
		);
	}

	if (!membership) {
		return NextResponse.json(
			{ error: 'Membership was not found.' },
			{ status: 404 },
		);
	}

	const targetMembership = membership as MembershipRow;
	let targetProfile: ProfileRow | null = null;

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

	const { data: profile, error: profileError } = await admin
		.from('profiles')
		.select('full_name, email')
		.eq('id', targetMembership.user_id)
		.maybeSingle();

	if (profileError) {
		console.warn('[team-memberships] profile lookup failed', {
			userId: targetMembership.user_id,
			error: profileError,
		});
	} else {
		targetProfile = profile;
	}

	const targetRole = normalizeRelation(
		(membership as typeof membership & {
			roles?: { name: string | null } | { name: string | null }[] | null;
		}).roles,
	);

	if (BLOCKING_SELF_ACTIONS.has(payload.action) && targetMembership.user_id === user.id) {
		return NextResponse.json(
			{ error: 'You cannot change your own access from the team page.' },
			{ status: 400 },
		);
	}

	if (payload.action === 'update_details') {
		const detailsResult = detailsSchema.safeParse(payload.details);
		if (!detailsResult.success) {
			return NextResponse.json(
				{
					error:
						detailsResult.error.issues[0]?.message ??
						'Please provide valid member details.',
				},
				{ status: 400 },
			);
		}

		const now = new Date().toISOString();
		const updateRow = {
			...teamDetailsToRow(detailsResult.data),
			updated_at: now,
		};
		const { data: updatedMembership, error: updateError } = await admin
			.from('organization_memberships')
			.update(updateRow)
			.eq('id', targetMembership.id)
			.is('deleted_at', null)
			.select('id, user_id, role_id, deleted_at, status, previous_status, former_at, phone, job_title, department, address_line1, address_line2, city, county, postcode, emergency_contact_name, emergency_contact_relationship, emergency_contact_phone, emergency_contact_email')
			.single();

		if (updateError || !updatedMembership) {
			return NextResponse.json(
				{ error: 'Member details could not be updated.' },
				{ status: 500 },
			);
		}

		await createUserAuditLog({
			action: 'team.member_updated',
			entityType: 'team_member',
			organizationId: targetMembership.organization_id,
			entityId: targetMembership.id,
			entityName:
				targetProfile?.full_name ??
				targetProfile?.email ??
				targetMembership.user_id,
			details: {
				target_user_id: targetMembership.user_id,
				target_email: targetProfile?.email ?? null,
				before: targetMembership,
				after: updatedMembership,
				changed_fields: Object.keys(updateRow).filter(
					(key) => key !== 'updated_at',
				),
				permission_checked: PERMISSIONS.TEAM_MANAGE,
				outcome: 'team_member_details_updated',
			},
			request,
		});

		return NextResponse.json({ ok: true, membership: updatedMembership });
	}

	if (payload.action !== 'update_role') {
		const statusAction = payload.action === 'remove' ? 'mark_former' : payload.action;
		const result = await updateMembershipStatus({
			admin,
			membership: targetMembership,
			action: statusAction,
			changedBy: user.id,
		});

		if (!result.ok) {
			return NextResponse.json(
				{ error: result.error },
				{ status: result.status },
			);
		}

		const audit = getMembershipStatusAudit(statusAction);

		await createUserAuditLog({
			action: audit.action,
			entityType: 'team_member',
			organizationId: targetMembership.organization_id,
			entityId: targetMembership.id,
			entityName:
				targetProfile?.full_name ??
				targetProfile?.email ??
				targetMembership.user_id,
			details: {
				target_user_id: targetMembership.user_id,
				target_email: targetProfile?.email ?? null,
				role_id: targetMembership.role_id,
				previous_role_name: targetRole?.name ?? null,
				before: {
					status: targetMembership.status ?? 'active',
					previous_status: targetMembership.previous_status,
					former_at: targetMembership.former_at,
				},
				after: {
					status: result.membership.status,
					previous_status: result.membership.previous_status,
					former_at: result.membership.former_at,
				},
				changed_fields: ['status', 'previous_status', 'former_at'],
				permission_checked: PERMISSIONS.TEAM_MANAGE,
				outcome: audit.outcome,
			},
			request,
		});

		return NextResponse.json({
			ok: true,
			membership: result.membership,
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

function formatQueryError(error: unknown) {
	if (!error || typeof error !== 'object') return null;
	const maybeError = error as {
		code?: string;
		message?: string;
		details?: string;
		hint?: string;
	};

	return {
		code: maybeError.code ?? null,
		message: maybeError.message ?? null,
		details: maybeError.details ?? null,
		hint: maybeError.hint ?? null,
	};
}

function normalizeRelation<T>(value: T | T[] | null | undefined) {
	return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

async function updateMembershipStatus({
	admin,
	membership,
	action,
	changedBy,
}: {
	admin: ReturnType<typeof createAdminClient>;
	membership: MembershipRow;
	action: Exclude<
		MembershipActionRequest['action'],
		'update_role' | 'update_details' | 'remove'
	>;
	changedBy: string;
}): Promise<
	| { ok: true; membership: MembershipRow }
	| { ok: false; error: string; status: number }
> {
	if (!action) {
		return { ok: false, error: 'Membership action is required.', status: 400 };
	}

	const currentStatus = membership.status ?? 'active';
	const now = new Date().toISOString();
	let nextStatus: string;
	let previousStatus: string | null = membership.previous_status ?? null;
	let formerAt: string | null = membership.former_at ?? null;

	if (action === 'mark_on_leave') {
		if (currentStatus === 'former') {
			return { ok: false, error: 'Former members must be restored first.', status: 400 };
		}
		nextStatus = 'on_leave';
		previousStatus = HOLD_STATUSES.has(currentStatus)
			? (membership.previous_status ?? 'active')
			: currentStatus;
	} else if (action === 'mark_suspended') {
		if (currentStatus === 'former') {
			return { ok: false, error: 'Former members must be restored first.', status: 400 };
		}
		nextStatus = 'suspended';
		previousStatus = HOLD_STATUSES.has(currentStatus)
			? (membership.previous_status ?? 'active')
			: currentStatus;
	} else if (action === 'mark_former') {
		nextStatus = 'former';
		previousStatus = HOLD_STATUSES.has(currentStatus)
			? (membership.previous_status ?? 'active')
			: currentStatus;
		formerAt = now;
	} else if (action === 'return_from_leave') {
		if (currentStatus !== 'on_leave') {
			return { ok: false, error: 'Member is not currently on leave.', status: 400 };
		}
		nextStatus = getRestoredMembershipStatus(membership.previous_status);
		previousStatus = null;
	} else if (action === 'return_from_suspension') {
		if (currentStatus !== 'suspended') {
			return { ok: false, error: 'Member is not currently suspended.', status: 400 };
		}
		nextStatus = getRestoredMembershipStatus(membership.previous_status);
		previousStatus = null;
	} else {
		if (currentStatus !== 'former') {
			return { ok: false, error: 'Member is not currently former.', status: 400 };
		}
		nextStatus = getRestoredMembershipStatus(membership.previous_status);
		previousStatus = null;
		formerAt = null;
	}

	const { data, error } = await admin
		.from('organization_memberships')
		.update({
			status: nextStatus,
			previous_status: previousStatus,
			status_changed_at: now,
			status_changed_by: changedBy,
			former_at: formerAt,
			updated_at: now,
		})
		.eq('id', membership.id)
		.is('deleted_at', null)
		.select('id, user_id, organization_id, role_id, deleted_at, status, previous_status, former_at')
		.single();

	if (error || !data) {
		return { ok: false, error: 'Member status could not be updated.', status: 500 };
	}

	return { ok: true, membership: data as MembershipRow };
}

function getRestoredMembershipStatus(previousStatus: string | null | undefined) {
	if (!previousStatus || HOLD_STATUSES.has(previousStatus)) return 'active';
	return previousStatus;
}

function getMembershipStatusAudit(
	action: Exclude<
		MembershipActionRequest['action'],
		'update_role' | 'update_details' | 'remove'
	>,
) {
	if (action === 'mark_on_leave') {
		return {
			action: 'team.member_on_leave' as const,
			outcome: 'team_member_marked_on_leave',
		};
	}
	if (action === 'return_from_leave') {
		return {
			action: 'team.member_returned' as const,
			outcome: 'team_member_returned_from_leave',
		};
	}
	if (action === 'mark_suspended') {
		return {
			action: 'team.member_suspended' as const,
			outcome: 'team_member_suspended',
		};
	}
	if (action === 'return_from_suspension') {
		return {
			action: 'team.member_restored' as const,
			outcome: 'team_member_returned_from_suspension',
		};
	}
	if (action === 'restore_former') {
		return {
			action: 'team.member_restored' as const,
			outcome: 'former_team_member_restored',
		};
	}
	return {
		action: 'team.member_marked_former' as const,
		outcome: 'team_member_marked_former',
	};
}

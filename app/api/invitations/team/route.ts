import { createUserAuditLog } from '@/lib/audit-server';
import { requireBillingCanModify } from '@/lib/billing-guard';
import { createInvitationToken, getInviteExpiry } from '@/lib/invitations';
import { PERMISSIONS } from '@/lib/permissions';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const teamInviteSchema = z.object({
	orgId: z.string().uuid(),
	email: z.string().trim().email(),
	roleId: z.string().uuid(),
});

export async function POST(request: Request) {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
	}

	const parsed = teamInviteSchema.safeParse(await request.json().catch(() => null));

	if (!parsed.success) {
		return NextResponse.json(
			{ error: 'Please provide a valid email and role.' },
			{ status: 400 },
		);
	}

	const normalizedEmail = parsed.data.email.toLowerCase();
	const { data: canInvite } = await supabase.rpc('has_org_permission', {
		p_org_id: parsed.data.orgId,
		p_permission_code: PERMISSIONS.TEAM_INVITE,
	});

	if (!canInvite) {
		return NextResponse.json(
			{ error: 'You do not have permission to invite team members.' },
			{ status: 403 },
		);
	}

	const billing = await requireBillingCanModify(parsed.data.orgId);
	if (!billing.ok) return billing.response;

	const admin = createAdminClient();
	const { data: role, error: roleError } = await admin
		.from('roles')
		.select('id, name')
		.eq('id', parsed.data.roleId)
		.eq('organization_id', parsed.data.orgId)
		.maybeSingle();

	if (roleError || !role) {
		return NextResponse.json(
			{ error: 'Role was not found for this organization.' },
			{ status: 400 },
		);
	}

	const { data: matchingProfiles, error: profilesError } = await admin
		.from('profiles')
		.select('id')
		.ilike('email', normalizedEmail)
		.is('deleted_at', null);

	if (profilesError) {
		console.error('[team-invite] profile lookup failed', profilesError);
		return NextResponse.json(
			{ error: 'Existing team members could not be checked.' },
			{ status: 500 },
		);
	}

	const profileIds = (matchingProfiles ?? []).map((profile) => profile.id);
	if (profileIds.length > 0) {
		const { count, error: membershipError } = await admin
			.from('organization_memberships')
			.select('id', { count: 'exact', head: true })
			.eq('organization_id', parsed.data.orgId)
			.in('user_id', profileIds)
			.is('deleted_at', null);

		if (membershipError) {
			console.error('[team-invite] membership lookup failed', membershipError);
			return NextResponse.json(
				{ error: 'Existing team members could not be checked.' },
				{ status: 500 },
			);
		}

		if ((count ?? 0) > 0) {
			return NextResponse.json(
				{
					error:
						'This person is already a team member. Restore or update their existing membership instead.',
				},
				{ status: 409 },
			);
		}
	}

	const { count: pendingInviteCount, error: pendingInviteError } = await admin
		.from('organization_invitations')
		.select('id', { count: 'exact', head: true })
		.eq('organization_id', parsed.data.orgId)
		.eq('invite_type', 'team_member')
		.ilike('email', normalizedEmail)
		.eq('status', 'pending');

	if (pendingInviteError) {
		console.error('[team-invite] pending invite lookup failed', pendingInviteError);
		return NextResponse.json(
			{ error: 'Existing invitations could not be checked.' },
			{ status: 500 },
		);
	}

	if ((pendingInviteCount ?? 0) > 0) {
		return NextResponse.json(
			{ error: 'A pending invitation already exists for this email.' },
			{ status: 409 },
		);
	}

	const token = createInvitationToken();
	const { data: invitation, error: inviteError } = await admin
		.from('organization_invitations')
		.insert({
			organization_id: parsed.data.orgId,
			invite_type: 'team_member',
			email: normalizedEmail,
			token,
			status: 'pending',
			role_id: role.id,
			invited_by: user.id,
			expires_at: getInviteExpiry(),
		})
		.select('*')
		.single();

	if (inviteError || !invitation) {
		console.error('[team-invite] invitation create failed', inviteError);
		return NextResponse.json(
			{ error: 'Team invitation could not be created.' },
			{ status: 500 },
		);
	}

	await createUserAuditLog({
		action: 'team.invited',
		entityType: 'invitation',
		organizationId: parsed.data.orgId,
		entityId: invitation.id,
		entityName: invitation.email,
		details: {
			email: invitation.email,
			role_id: role.id,
			role_name: role.name,
			invite_type: 'team_member',
			expires_at: invitation.expires_at,
			permission_checked: PERMISSIONS.TEAM_INVITE,
			outcome: 'team_invitation_created',
		},
		request,
	});

	return NextResponse.json({ invitation, role });
}

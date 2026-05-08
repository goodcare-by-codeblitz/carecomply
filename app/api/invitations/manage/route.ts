import { PERMISSIONS } from '@/lib/permissions';
import { createUserAuditLog } from '@/lib/audit-server';
import { createInvitationToken, getInviteExpiry } from '@/lib/invitations';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

type ManageInvitationRequest = {
	invitationId?: string;
	action?: 'revoke' | 'delete' | 'reinvite';
};

export async function POST(request: Request) {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
	}

	let payload: ManageInvitationRequest;

	try {
		payload = (await request.json()) as ManageInvitationRequest;
	} catch {
		return NextResponse.json(
			{ error: 'Invalid invitation request.' },
			{ status: 400 },
		);
	}

	if (!payload.invitationId || !payload.action) {
		return NextResponse.json(
			{ error: 'Invitation id and action are required.' },
			{ status: 400 },
		);
	}

	const admin = createAdminClient();
	const { data: invitation, error: invitationError } = await admin
		.from('organization_invitations')
		.select('id, organization_id, invite_type, email, status, carer_id, role_id')
		.eq('id', payload.invitationId)
		.maybeSingle();

	if (invitationError || !invitation) {
		return NextResponse.json(
			{ error: 'Invitation was not found.' },
			{ status: 404 },
		);
	}

	const { data: canInvite } = await supabase.rpc('has_org_permission', {
		p_org_id: invitation.organization_id,
		p_permission_code: PERMISSIONS.TEAM_INVITE,
	});

	if (!canInvite) {
		return NextResponse.json(
			{ error: 'You do not have permission to manage invitations.' },
			{ status: 403 },
		);
	}

	if (payload.action === 'revoke') {
		const now = new Date().toISOString();
		const { data, error } = await admin
			.from('organization_invitations')
			.update({
				status: 'revoked',
				revoked_at: now,
				revoked_by: user.id,
				updated_at: now,
			})
			.eq('id', payload.invitationId)
			.select('*')
			.single();

		if (error) {
			return NextResponse.json(
				{ error: 'Invitation could not be revoked.' },
				{ status: 500 },
			);
		}

		await createUserAuditLog({
			action: 'invitation.revoked',
			entityType: 'invitation',
			organizationId: invitation.organization_id,
			entityId: invitation.id,
			entityName: invitation.email,
			details: {
				invite_type: invitation.invite_type,
				email: invitation.email,
				before: { status: invitation.status },
				after: { status: 'revoked', revoked_at: now },
				carer_id: invitation.carer_id,
				role_id: invitation.role_id,
				permission_checked: PERMISSIONS.TEAM_INVITE,
				outcome: 'invite_link_revoked',
			},
			request,
		});

		return NextResponse.json({ ok: true, invitation: data });
	}

	if (payload.action === 'reinvite') {
		const now = new Date().toISOString();
		const { data, error } = await admin
			.from('organization_invitations')
			.update({
				token: createInvitationToken(),
				status: 'pending',
				expires_at: getInviteExpiry(invitation.invite_type === 'carer' ? 30 : 7),
				revoked_at: null,
				revoked_by: null,
				accepted_by: null,
				updated_at: now,
			})
			.eq('id', payload.invitationId)
			.select('*')
			.single();

		if (error) {
			return NextResponse.json(
				{ error: 'Invitation could not be regenerated.' },
				{ status: 500 },
			);
		}

		await createUserAuditLog({
			action: 'invitation.reinvited',
			entityType: 'invitation',
			organizationId: invitation.organization_id,
			entityId: invitation.id,
			entityName: invitation.email,
			details: {
				invite_type: invitation.invite_type,
				email: invitation.email,
				before: { status: invitation.status },
				after: {
					status: 'pending',
					expires_at: data.expires_at,
				},
				carer_id: invitation.carer_id,
				role_id: invitation.role_id,
				permission_checked: PERMISSIONS.TEAM_INVITE,
				outcome: 'new_invite_token_generated',
			},
			request,
		});

		return NextResponse.json({ ok: true, invitation: data });
	}

	const { error } = await admin
		.from('organization_invitations')
		.delete()
		.eq('id', payload.invitationId);

	if (error) {
		return NextResponse.json(
			{ error: 'Invitation could not be deleted.' },
			{ status: 500 },
		);
	}

	return NextResponse.json({ ok: true, deleted: true });
}

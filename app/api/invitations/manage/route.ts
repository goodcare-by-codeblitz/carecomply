import { PERMISSIONS } from '@/lib/permissions';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

type ManageInvitationRequest = {
	invitationId?: string;
	action?: 'revoke' | 'delete';
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

	const { data: invitation, error: invitationError } = await supabase
		.from('organization_invitations')
		.select('id, organization_id, invite_type')
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
		const { data, error } = await supabase
			.from('organization_invitations')
			.update({
				status: 'revoked',
				revoked_at: new Date().toISOString(),
				revoked_by: user.id,
				updated_at: new Date().toISOString(),
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

		return NextResponse.json({ ok: true, invitation: data });
	}

	const { error } = await supabase
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

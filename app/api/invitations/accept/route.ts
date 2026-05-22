import { createAdminClient } from '@/lib/supabase/admin';
import { createAuditLog } from '@/lib/audit-server';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

type AcceptInvitationRequest = {
	token?: string;
	password?: string;
};

type InvitationRow = {
	id: string;
	organization_id: string;
	invite_type: 'team_member' | 'carer';
	email: string;
	status: 'pending' | 'accepted' | 'revoked' | 'expired';
	role_id: string | null;
	expires_at: string | null;
	organizations: { slug: string } | { slug: string }[] | null;
};

function normalizeRelation<T>(value: T | T[] | null | undefined) {
	return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function isExpired(expiresAt: string | null) {
	return Boolean(expiresAt && new Date(expiresAt) < new Date());
}

export async function POST(request: Request) {
	let payload: AcceptInvitationRequest;

	try {
		payload = (await request.json()) as AcceptInvitationRequest;
	} catch {
		return NextResponse.json(
			{ error: 'Invalid invitation request.' },
			{ status: 400 },
		);
	}

	if (!payload.token) {
		return NextResponse.json(
			{ error: 'Invitation token is required.' },
			{ status: 400 },
		);
	}

	const admin = createAdminClient();
	const { data: invitation, error: invitationError } = await admin
		.from('organization_invitations')
		.select(
			'id, organization_id, invite_type, email, status, role_id, expires_at, organizations(slug)',
		)
		.eq('token', payload.token)
		.maybeSingle();

	if (invitationError || !invitation) {
		return NextResponse.json(
			{ error: 'Invitation was not found.' },
			{ status: 404 },
		);
	}

	const invite = invitation as InvitationRow;
	const organization = normalizeRelation(invite.organizations);

	if (invite.invite_type !== 'team_member') {
		return NextResponse.json(
			{ error: 'Only team member invitations can be accepted here.' },
			{ status: 400 },
		);
	}

	if (invite.status !== 'pending') {
		return NextResponse.json(
			{ error: `This invitation is ${invite.status}.` },
			{ status: 409 },
		);
	}

	if (isExpired(invite.expires_at)) {
		await admin
			.from('organization_invitations')
			.update({ status: 'expired' })
			.eq('id', invite.id);

		return NextResponse.json(
			{ error: 'This invitation has expired.' },
			{ status: 409 },
		);
	}

	const serverClient = await createClient();
	const {
		data: { user: currentUser },
	} = await serverClient.auth.getUser();

	let acceptedUserId = currentUser?.id ?? null;
	const inviteEmail = invite.email.trim().toLowerCase();

	if (currentUser) {
		if (currentUser.email?.trim().toLowerCase() !== inviteEmail) {
			return NextResponse.json(
				{ error: 'You must log in with the invited email address.' },
				{ status: 403 },
			);
		}
	} else {
		if (!payload.password || payload.password.length < 8) {
			return NextResponse.json(
				{ error: 'Password must be at least 8 characters.' },
				{ status: 400 },
			);
		}

		const { data: existingProfile } = await admin
			.from('profiles')
			.select('id')
			.eq('email', inviteEmail)
			.maybeSingle();

		if (existingProfile?.id) {
			return NextResponse.json(
				{
					error:
						'An account already exists for this email. Log in to accept this invitation.',
					code: 'existing_account',
				},
				{ status: 409 },
			);
		}

		const { data: createdUser, error: createUserError } =
			await admin.auth.admin.createUser({
				email: inviteEmail,
				password: payload.password,
				email_confirm: true,
				user_metadata: {
					full_name: inviteEmail.split('@')[0],
				},
			});

		if (createUserError || !createdUser.user) {
			const message =
				createUserError?.message ?? 'Unable to create invited user account.';
			const alreadyExists = message.toLowerCase().includes('already');

			return NextResponse.json(
				{
					error: alreadyExists
						? 'An account already exists for this email. Log in to accept this invitation.'
						: message,
					code: alreadyExists ? 'existing_account' : 'create_user_failed',
				},
				{ status: alreadyExists ? 409 : 500 },
			);
		}

		acceptedUserId = createdUser.user.id;

		const { error: profileError } = await admin.from('profiles').upsert({
			id: acceptedUserId,
			email: inviteEmail,
			full_name: createdUser.user.user_metadata?.full_name ?? inviteEmail,
		});

		if (profileError) {
			return NextResponse.json(
				{ error: 'Invited user profile could not be created.' },
				{ status: 500 },
			);
		}
	}

	if (!acceptedUserId) {
		return NextResponse.json(
			{ error: 'Unable to identify invited user.' },
			{ status: 500 },
		);
	}

	const { error: membershipError } = await admin
		.from('organization_memberships')
		.upsert(
			{
				user_id: acceptedUserId,
				organization_id: invite.organization_id,
				role_id: invite.role_id,
				status: 'active',
				previous_status: null,
				status_changed_at: new Date().toISOString(),
				status_changed_by: acceptedUserId,
				former_at: null,
				deleted_at: null,
				updated_at: new Date().toISOString(),
			},
			{ onConflict: 'user_id,organization_id' },
		);

	if (membershipError) {
		return NextResponse.json(
			{ error: 'Organization membership could not be created.' },
			{ status: 500 },
		);
	}

	const { error: acceptError } = await admin
		.from('organization_invitations')
		.update({
			status: 'accepted',
			accepted_by: acceptedUserId,
			token: null,
			updated_at: new Date().toISOString(),
		})
		.eq('id', invite.id);

	if (acceptError) {
		return NextResponse.json(
			{ error: 'Invitation could not be marked as accepted.' },
			{ status: 500 },
		);
	}

	await createAuditLog({
		action: 'invitation.accepted',
		entityType: 'invitation',
		organizationId: invite.organization_id,
		entityId: invite.id,
		entityName: inviteEmail,
		source: 'api',
		userId: acceptedUserId,
		userEmail: inviteEmail,
		request,
		details: {
			invite_type: invite.invite_type,
			role_id: invite.role_id,
			accepted_user_id: acceptedUserId,
			created_user: !currentUser,
			outcome: 'team_invitation_accepted',
		},
	});

	return NextResponse.json({
		ok: true,
		orgSlug: organization?.slug ?? null,
		email: inviteEmail,
		createdUser: !currentUser,
	});
}

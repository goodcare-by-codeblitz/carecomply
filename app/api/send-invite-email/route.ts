import { createClient } from '@/lib/supabase/server';
import { createUserAuditLog } from '@/lib/audit-server';
import {
	canReceiveOnboardingInvite,
	carerCommunicationBlockedMessage,
} from '@/lib/carer-communications';
import { getInvitationLink } from '@/lib/invitations';
import { CarerInvitation, TeamInvitation } from '@/emails';
import { renderEmailTemplate } from '@/emails/render';
import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

type SendInviteEmailRequest = {
	email?: string;
	token?: string;
	roleName?: string;
};

type InvitationForEmail = {
	id: string;
	organization_id: string;
	email: string;
	invite_type: 'team_member' | 'carer';
	expires_at: string | null;
	carer_id: string | null;
	carers: { status: string | null; full_name: string | null } | { status: string | null; full_name: string | null }[] | null;
	organizations: { name: string } | { name: string }[] | null;
	roles: { name: string } | { name: string }[] | null;
};

function normalizeRelation<T>(value: T | T[] | null | undefined) {
	return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function formatExpiryTime(expiresAt: string | null): string {
	if (!expiresAt) return 'soon';
	const date = new Date(expiresAt);
	const days = Math.ceil((date.getTime() - Date.now()) / 86400000);
	const label = new Intl.DateTimeFormat('en-GB', {
		day: 'numeric',
		month: 'long',
		year: 'numeric',
	}).format(date);
	return days > 0 ? `in ${days} day${days === 1 ? '' : 's'} (${label})` : label;
}

export async function POST(request: NextRequest) {
	try {
		const supabase = await createClient();
		const {
			data: { user },
		} = await supabase.auth.getUser();

		if (!user) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const { email, token, roleName } =
			(await request.json()) as SendInviteEmailRequest;
		const normalizedEmail = email?.trim().toLowerCase();

		if (!normalizedEmail || !token) {
			return NextResponse.json(
				{ error: 'Missing required fields' },
				{ status: 400 },
			);
		}

		const { data: invitation, error: inviteError } = await supabase
			.from('organization_invitations')
			.select(
				'id, organization_id, email, invite_type, expires_at, carer_id, carers(status, full_name), organizations(name), roles(name)',
			)
			.eq('token', token)
			.eq('email', normalizedEmail)
			.maybeSingle();

		if (inviteError || !invitation) {
			return NextResponse.json(
				{ error: 'Invitation not found' },
				{ status: 404 },
			);
		}

		const invite = invitation as InvitationForEmail;
		const organization = normalizeRelation(invite.organizations);

		const role = normalizeRelation(invite.roles);
		const carer = normalizeRelation(invite.carers);

		const orgName = organization?.name ?? 'CareComply';
		const resolvedRoleName = roleName ?? role?.name ?? 'team member';
		const isCarerInvite = invite.invite_type === 'carer';

		if (
			isCarerInvite &&
			(!invite.carer_id || !canReceiveOnboardingInvite(carer?.status))
		) {
			const message = carerCommunicationBlockedMessage(carer?.status);
			await createUserAuditLog({
				action: 'email.sent',
				entityType: 'email',
				organizationId: invite.organization_id,
				entityId: invite.id,
				entityName: normalizedEmail,
				details: {
					email_type: 'carer_onboarding_invite',
					invite_type: invite.invite_type,
					carer_status: carer?.status ?? null,
					outcome: 'invite_email_skipped_carer_not_eligible',
				},
				request,
			});

			return NextResponse.json({ error: message }, { status: 409 });
		}

		const inviteUrl = getInvitationLink(
			token,
			process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
			invite.invite_type,
		);
		const apiKey = process.env.RESEND_API_KEY;
		const fromEmail = process.env.RESEND_FROM_EMAIL;

		if (!apiKey || !fromEmail) {
			return NextResponse.json(
				{
					error:
						'Invite email is not configured. Set RESEND_API_KEY and RESEND_FROM_EMAIL.',
					inviteUrl,
				},
				{ status: 503 },
			);
		}

		// Fetch inviter name from profiles
		const { data: inviterProfile } = await supabase
			.from('profiles')
			.select('full_name')
			.eq('id', user.id)
			.maybeSingle();
		const inviterName = inviterProfile?.full_name ?? orgName;

		const expiryTime = formatExpiryTime(invite.expires_at);

		let html: string;

		if (isCarerInvite) {
			// Fetch required documents for the organisation
			const { data: docTypes } = await supabase
				.from('document_types')
				.select('name')
				.eq('organization_id', invite.organization_id)
				.eq('is_required', true);
			const requiredDocuments = (docTypes ?? []).map((d) => d.name);

			html = await renderEmailTemplate(CarerInvitation, {
				carerName: carer?.full_name ?? normalizedEmail,
				organizationName: orgName,
				inviterName,
				inviteUrl,
				requiredDocuments,
				supportEmail: fromEmail,
				expiryTime,
			});
		} else {
			html = await renderEmailTemplate(TeamInvitation, {
				organizationName: orgName,
				inviterName,
				roleName: resolvedRoleName,
				inviteUrl,
				supportEmail: fromEmail,
				expiryTime,
			});
		}

		const resend = new Resend(apiKey);
		const subject = isCarerInvite
			? `Complete your onboarding for ${orgName}`
			: `You've been invited to join ${orgName} on CareComply`;

		const { data: emailData, error: emailError } = await resend.emails.send({
			from: `${orgName} <${fromEmail}>`,
			to: normalizedEmail,
			subject,
			html,
		});

		if (emailError) {
			console.error('Resend invite email failed:', emailError);
			return NextResponse.json(
				{
					error: emailError.message || 'Resend rejected the invite email.',
					inviteUrl,
				},
				{ status: 502 },
			);
		}

		await createUserAuditLog({
			action: 'email.sent',
			entityType: 'email',
			organizationId: invite.organization_id,
			entityId: invite.id,
			entityName: normalizedEmail,
			details: {
				email_type: isCarerInvite ? 'carer_onboarding_invite' : 'team_invite',
				invite_type: invite.invite_type,
				resend_email_id: emailData?.id ?? null,
				expires_at: invite.expires_at,
				outcome: 'invite_email_sent',
			},
			request,
		});

		return NextResponse.json({
			success: true,
			method: 'email',
			emailId: emailData?.id,
			inviteUrl,
		});
	} catch (error) {
		console.error('Failed to send invite email:', error);
		return NextResponse.json(
			{ error: 'Failed to send invite email' },
			{ status: 500 },
		);
	}
}

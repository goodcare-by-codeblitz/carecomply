import { createClient } from '@/lib/supabase/server';
import { createUserAuditLog } from '@/lib/audit-server';
import {
	canReceiveOnboardingInvite,
	carerCommunicationBlockedMessage,
} from '@/lib/carer-communications';
import { getInvitationLink } from '@/lib/invitations';
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
	carers: { status: string | null } | { status: string | null }[] | null;
	organizations: { name: string } | { name: string }[] | null;
	roles: { name: string } | { name: string }[] | null;
};

function normalizeRelation<T>(value: T | T[] | null | undefined) {
	return Array.isArray(value) ? value[0] ?? null : value ?? null;
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
				'id, organization_id, email, invite_type, expires_at, carer_id, carers(status), organizations(name), roles(name)',
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

		const resend = new Resend(apiKey);
		const subject = isCarerInvite
			? `Complete your onboarding for ${orgName}`
			: `You've been invited to join ${orgName} on CareComply`;

		const intro = isCarerInvite
			? `You've been invited to complete onboarding for <strong>${orgName}</strong> on CareComply.`
			: `You've been invited to join <strong>${orgName}</strong> on CareComply as a <strong>${resolvedRoleName}</strong>.`;

		const actionCopy = isCarerInvite
			? 'Complete Onboarding'
			: 'Accept Invitation';
		const expiryCopy = invite.expires_at
			? `This invitation expires on ${new Intl.DateTimeFormat('en-GB', {
					day: 'numeric',
					month: 'short',
					year: 'numeric',
				}).format(new Date(invite.expires_at))}.`
			: 'This invitation will expire soon.';

		const { data: emailData, error: emailError } = await resend.emails.send({
			from: `${orgName} <${fromEmail}>`,
			to: normalizedEmail,
			subject,
			html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1a1a2e; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 32px;">
              <h1 style="font-size: 24px; font-weight: 600; margin: 0;">CareComply</h1>
            </div>
            
            <div style="background: #f8f9fa; border-radius: 12px; padding: 32px; margin-bottom: 24px;">
              <h2 style="font-size: 20px; font-weight: 600; margin: 0 0 16px 0;">You've been invited!</h2>
              <p style="margin: 0 0 16px 0; color: #666;">
                ${intro}
              </p>
              <p style="margin: 0 0 24px 0; color: #666;">
                Click the button below to continue.
              </p>
              <a href="${inviteUrl}" style="display: inline-block; background: #1a1a2e; color: white; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 500;">
                ${actionCopy}
              </a>
            </div>
            
            <p style="font-size: 14px; color: #666; margin: 0 0 8px 0;">
              ${expiryCopy}
            </p>
            <p style="font-size: 14px; color: #666; margin: 0;">
              If you didn't expect this invitation, you can safely ignore this email.
            </p>
            
            <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0;">
            
            <p style="font-size: 12px; color: #999; margin: 0;">
              CareComply - Automated Compliance Management
            </p>
          </body>
          </html>
        `,
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

import {
	createInvitationToken,
	getInvitationLink,
	getInviteExpiry,
} from '@/lib/invitations';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { z } from 'zod';

const requestSchema = z.object({
	carerId: z.string().uuid(),
	carerEmail: z.string().email(),
	carerName: z.string(),
	documentType: z.string(),
	rejectionReason: z.string(),
	inviteToken: z.string().uuid().nullable().optional(),
});

type CarerWithOrg = {
	id: string;
	organization_id: string;
	email: string;
	organizations: { name: string } | { name: string }[] | null;
};

function normalizeRelation<T>(value: T | T[] | null | undefined) {
	return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

export async function POST(request: NextRequest) {
	try {
		const supabase = await createClient();
		const {
			data: { user },
			error: authError,
		} = await supabase.auth.getUser();

		if (authError || !user) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const result = requestSchema.safeParse(await request.json());

		if (!result.success) {
			return NextResponse.json(
				{ error: 'Invalid request data' },
				{ status: 400 },
			);
		}

		const {
			carerId,
			carerEmail,
			carerName,
			documentType,
			rejectionReason,
			inviteToken,
		} = result.data;
		const admin = createAdminClient();

		const { data: carerData, error: carerError } = await admin
			.from('carers')
			.select('id, organization_id, email, organizations(name)')
			.eq('id', carerId)
			.maybeSingle();

		if (carerError || !carerData) {
			return NextResponse.json({ error: 'Carer not found' }, { status: 404 });
		}

		const carer = carerData as CarerWithOrg;
		const organization = normalizeRelation(carer.organizations);
		const organizationName = organization?.name || 'Your Care Agency';

		let token = inviteToken ?? null;

		if (!token) {
			const { data: existingInvite } = await admin
				.from('organization_invitations')
				.select('token')
				.eq('invite_type', 'carer')
				.eq('carer_id', carerId)
				.eq('status', 'pending')
				.not('token', 'is', null)
				.order('created_at', { ascending: false })
				.limit(1)
				.maybeSingle();

			token = existingInvite?.token ?? null;
		}

		if (!token) {
			token = createInvitationToken();
			const { error: inviteError } = await admin
				.from('organization_invitations')
				.insert({
					organization_id: carer.organization_id,
					invite_type: 'carer',
					email: carerEmail.trim().toLowerCase(),
					token,
					status: 'pending',
					carer_id: carerId,
					invited_by: user.id,
					expires_at: getInviteExpiry(30),
				});

			if (inviteError) {
				console.error('Failed to create carer invitation:', inviteError);
				return NextResponse.json(
					{ error: 'Failed to generate invite link' },
					{ status: 500 },
				);
			}
		}

		const onboardingUrl = getInvitationLink(
			token,
			process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
			'carer',
		);
		const emailHtml = `
      <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <h1 style="color: #1a1a2e; font-size: 24px; font-weight: 600; margin-bottom: 24px; text-align: center;">
          Document Review Update
        </h1>
        <p style="color: #374151; font-size: 16px; line-height: 1.6;">Hi ${carerName},</p>
        <p style="color: #374151; font-size: 16px; line-height: 1.6;">
          Your <strong>${documentType}</strong> document submitted to <strong>${organizationName}</strong> has been reviewed and requires your attention.
        </p>
        <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 12px; padding: 20px; margin: 24px 0;">
          <p style="color: #991b1b; font-weight: 600; margin: 0 0 8px 0; font-size: 14px;">Reason for rejection:</p>
          <p style="color: #7f1d1d; margin: 0; font-size: 15px; line-height: 1.5;">${rejectionReason}</p>
        </div>
        <p style="color: #374151; font-size: 16px; line-height: 1.6;">Please upload a new document to complete your compliance requirements.</p>
        <div style="text-align: center; margin: 32px 0;">
          <a href="${onboardingUrl}" style="display: inline-block; background: #1a1a2e; color: white; padding: 16px 32px; border-radius: 10px; text-decoration: none; font-weight: 500; font-size: 16px;">
            Upload New Document
          </a>
        </div>
        <p style="color: #6b7280; font-size: 14px; line-height: 1.6; text-align: center;">
          This link remains available until the onboarding invitation expires. If you have any questions, please contact your agency directly.
        </p>
      </div>
    `;

		if (process.env.RESEND_API_KEY) {
			const resend = new Resend(process.env.RESEND_API_KEY);

			const { error: emailError } = await resend.emails.send({
				from:
					process.env.RESEND_FROM_EMAIL ||
					'CareComply <onboarding@resend.dev>',
				to: carerEmail,
				subject: `Action Required: Your ${documentType} document needs attention`,
				html: emailHtml,
			});

			if (emailError) {
				console.error('Failed to send rejection email:', emailError);
			}
		} else {
			console.log('[CareComply] Rejection email would be sent:', {
				to: carerEmail,
				subject: `Action Required: Your ${documentType} document needs attention`,
				onboardingUrl,
			});
		}

		return NextResponse.json({
			success: true,
			emailSent: Boolean(process.env.RESEND_API_KEY),
			...(process.env.NODE_ENV !== 'production' && { onboardingUrl }),
		});
	} catch (error) {
		console.error('Error sending rejection email:', error);
		return NextResponse.json(
			{ error: 'Internal server error' },
			{ status: 500 },
		);
	}
}

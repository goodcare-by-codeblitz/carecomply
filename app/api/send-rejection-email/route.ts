import {
	createInvitationToken,
	getInvitationLink,
	getInviteExpiry,
} from '@/lib/invitations';
import {
	canReceiveDocumentRejectionCommunication,
	documentRejectionCommunicationBlockedMessage,
} from '@/lib/carer-communications';
import { DocumentRejectedCarerEmail } from '@/emails';
import { renderEmailTemplate } from '@/emails/render';
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
	status: string | null;
	organizations: { name: string } | { name: string }[] | null;
};

type ReviewerProfile = {
	full_name: string | null;
	email: string | null;
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
			.select('id, organization_id, email, status, organizations(name)')
			.eq('id', carerId)
			.maybeSingle();

		if (carerError || !carerData) {
			return NextResponse.json({ error: 'Carer not found' }, { status: 404 });
		}

		const carer = carerData as CarerWithOrg;
		const organization = normalizeRelation(carer.organizations);
		const organizationName = organization?.name || 'Your Care Agency';

		if (!canReceiveDocumentRejectionCommunication(carer.status)) {
			return NextResponse.json(
				{
					error: documentRejectionCommunicationBlockedMessage(carer.status),
					emailSent: false,
					skipped: true,
				},
				{ status: 409 },
			);
		}

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

		if (process.env.RESEND_API_KEY) {
			const resend = new Resend(process.env.RESEND_API_KEY);
			const supportEmail =
				process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
			const { data: reviewer } = await admin
				.from('profiles')
				.select('full_name, email')
				.eq('id', user.id)
				.maybeSingle();
			const reviewerProfile = reviewer as ReviewerProfile | null;
			const reviewerName =
				reviewerProfile?.full_name ?? reviewerProfile?.email ?? organizationName;
			const emailHtml = await renderEmailTemplate(DocumentRejectedCarerEmail, {
				carerName,
				organizationName,
				documentName: documentType,
				rejectionReason,
				reviewerName,
				actionUrl: onboardingUrl,
				supportEmail,
			});

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

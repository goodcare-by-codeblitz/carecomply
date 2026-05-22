import { createUserAuditLog } from '@/lib/audit-server';
import {
	canReceiveOperationalCommunication,
	carerCommunicationBlockedMessage,
} from '@/lib/carer-communications';
import { updateCarerOnboardingProgress } from '@/lib/onboarding';
import { PERMISSIONS } from '@/lib/permissions';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { getInvitationLink } from '@/lib/invitations';
import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { z } from 'zod';

const reviewSchema = z.object({
	documentId: z.string().uuid(),
	action: z.enum(['approve', 'reject']),
	rejectionReason: z.string().trim().optional(),
	reviewNotes: z.string().trim().optional(),
});

type DocumentForReview = {
	id: string;
	file_name: string;
	file_path: string;
	status: string;
	expiry_date: string | null;
	reviewed_at: string | null;
	reviewed_by: string | null;
	rejection_reason: string | null;
	review_notes: string | null;
	carer_id: string;
	document_type_id: string;
	carers:
		| {
				id: string;
				full_name: string;
				email: string;
				status: string | null;
				organization_id: string;
				organizations: { name: string } | { name: string }[] | null;
		  }
		| {
				id: string;
				full_name: string;
				email: string;
				status: string | null;
				organization_id: string;
				organizations: { name: string } | { name: string }[] | null;
		  }[]
		| null;
	document_type: { name: string } | { name: string }[] | null;
};

function normalizeRelation<T>(value: T | T[] | null | undefined) {
	return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

export async function POST(request: Request) {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
	}

	const result = reviewSchema.safeParse(await request.json().catch(() => null));

	if (!result.success) {
		return NextResponse.json(
			{ error: 'A valid document review request is required.' },
			{ status: 400 },
		);
	}

	if (
		result.data.action === 'reject' &&
		(!result.data.rejectionReason || result.data.rejectionReason.length < 10)
	) {
		return NextResponse.json(
			{ error: 'Please provide a detailed rejection reason.' },
			{ status: 400 },
		);
	}

	const admin = createAdminClient();
	const { data: documentData, error: documentError } = await admin
		.from('documents')
		.select(
			'id, file_name, file_path, status, expiry_date, reviewed_at, reviewed_by, rejection_reason, review_notes, carer_id, document_type_id, carers!inner(id, full_name, email, status, organization_id, organizations(name)), document_type:document_types!documents_document_type_id_fkey(name)',
		)
		.eq('id', result.data.documentId)
		.maybeSingle();

	if (documentError || !documentData) {
		return NextResponse.json({ error: 'Document not found.' }, { status: 404 });
	}

	const document = documentData as DocumentForReview;
	const carer = normalizeRelation(document.carers);
	const documentType = normalizeRelation(document.document_type);
	const organization = normalizeRelation(carer?.organizations);
	const documentTypeName = documentType?.name ?? 'Unknown document type';

	if (!carer) {
		return NextResponse.json(
			{ error: 'Document is not linked to a carer.' },
			{ status: 404 },
		);
	}

	if (document.status === 'obsolete') {
		return NextResponse.json(
			{ error: 'This document has been replaced and can no longer be reviewed.' },
			{ status: 409 },
		);
	}

	const { data: canReview } = await supabase.rpc('has_org_permission', {
		p_org_id: carer.organization_id,
		p_permission_code: PERMISSIONS.DOCUMENTS_REVIEW,
	});

	if (!canReview) {
		return NextResponse.json(
			{ error: 'You do not have permission to review documents.' },
			{ status: 403 },
		);
	}

	const reviewedAt = new Date().toISOString();
	const nextStatus = result.data.action === 'approve' ? 'approved' : 'rejected';
	const { data: updatedDocument, error: updateError } = await admin
		.from('documents')
		.update({
			status: nextStatus,
			reviewed_at: reviewedAt,
			reviewed_by: user.id,
			rejection_reason:
				result.data.action === 'reject' ? result.data.rejectionReason : null,
			review_notes: result.data.reviewNotes || null,
		})
		.eq('id', document.id)
		.select('id, status, reviewed_at, reviewed_by, rejection_reason, review_notes')
		.single();

	if (updateError || !updatedDocument) {
		return NextResponse.json(
			{ error: 'Document review could not be saved.' },
			{ status: 500 },
		);
	}

	const carerStatus = await updateCarerOnboardingProgress(
		admin,
		carer.id,
		carer.organization_id,
	);

	try {
		await createUserAuditLog({
			action:
				result.data.action === 'approve'
					? 'document.approved'
					: 'document.rejected',
			entityType: 'document',
			organizationId: carer.organization_id,
			entityId: document.id,
			entityName: `${documentTypeName} - ${carer.full_name}`,
			details: {
				document_id: document.id,
				carer_id: carer.id,
				carer_name: carer.full_name,
				carer_email: carer.email,
				document_type_id: document.document_type_id,
				document_type_name: documentTypeName,
				file_name: document.file_name,
				expiry_date: document.expiry_date,
				before: {
					status: document.status,
					reviewed_at: document.reviewed_at,
					reviewed_by: document.reviewed_by,
					rejection_reason: document.rejection_reason,
					review_notes: document.review_notes,
				},
				after: {
					status: nextStatus,
					reviewed_at: updatedDocument.reviewed_at,
					reviewed_by: updatedDocument.reviewed_by,
					rejection_reason: updatedDocument.rejection_reason,
					review_notes: updatedDocument.review_notes,
				},
				changed_fields: [
					'status',
					'reviewed_at',
					'reviewed_by',
					'rejection_reason',
					'review_notes',
				],
				carer_status_after_review: carerStatus,
				permission_checked: PERMISSIONS.DOCUMENTS_REVIEW,
				outcome:
					result.data.action === 'approve'
						? 'document_approved'
						: 'document_rejected',
			},
			request,
		});
	} catch (error) {
		console.error('Document review audit log could not be created:', error);
	}

	let emailWarning: string | null = null;
	if (result.data.action === 'reject') {
		emailWarning = await sendRejectionEmail({
			admin,
			carerId: carer.id,
			carerEmail: carer.email,
			carerName: carer.full_name,
			carerStatus: carer.status,
			documentType: documentTypeName,
			rejectionReason: result.data.rejectionReason ?? '',
			organizationId: carer.organization_id,
			organizationName: organization?.name ?? 'CareComply',
		});
	}

	return NextResponse.json({
		ok: true,
		document: updatedDocument,
		carerStatus,
		emailWarning,
	});
}

async function sendRejectionEmail({
	admin,
	carerId,
	carerEmail,
	carerName,
	carerStatus,
	documentType,
	rejectionReason,
	organizationId,
	organizationName,
}: {
	admin: ReturnType<typeof createAdminClient>;
	carerId: string;
	carerEmail: string;
	carerName: string;
	carerStatus: string | null;
	documentType: string;
	rejectionReason: string;
	organizationId: string;
	organizationName: string;
}) {
	try {
		const apiKey = process.env.RESEND_API_KEY;
		const fromEmail = process.env.RESEND_FROM_EMAIL;

		if (!canReceiveOperationalCommunication(carerStatus)) {
			return carerCommunicationBlockedMessage(carerStatus);
		}

		if (!apiKey || !fromEmail) {
			return 'Rejection email is not configured.';
		}

		const { data: invitation } = await admin
			.from('organization_invitations')
			.select('token')
			.eq('organization_id', organizationId)
			.eq('invite_type', 'carer')
			.eq('carer_id', carerId)
			.eq('status', 'pending')
			.order('created_at', { ascending: false })
			.limit(1)
			.maybeSingle();

		const inviteUrl = invitation?.token
			? getInvitationLink(
					invitation.token,
					process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
					'carer',
				)
			: null;

		const resend = new Resend(apiKey);
		await resend.emails.send({
			from: `${organizationName} <${fromEmail}>`,
			to: carerEmail,
			subject: `Action Required: Your ${documentType} document needs attention`,
			html: `
				<p>Hi ${carerName},</p>
				<p>Your <strong>${documentType}</strong> document submitted to <strong>${organizationName}</strong> has been reviewed and requires your attention.</p>
				<p><strong>Reason:</strong> ${rejectionReason}</p>
				${inviteUrl ? `<p><a href="${inviteUrl}">Upload a new document</a></p>` : ''}
				<p>Please contact your agency if you have any questions.</p>
			`,
		});

		return null;
	} catch (error) {
		console.warn('Failed to send rejection email:', error);
		return 'Document was rejected, but the rejection email could not be sent.';
	}
}

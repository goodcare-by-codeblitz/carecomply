import {
	CARER_DOCUMENTS_BUCKET,
	getCarerOnboardingContext,
	OnboardingTokenError,
	updateCarerOnboardingProgress,
} from '@/lib/onboarding';
import { createSystemAuditLog } from '@/lib/audit-server';
import { createAdminClient } from '@/lib/supabase/admin';
import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const uploadSchema = z.object({
	token: z.string().min(1),
	documentTypeId: z.string().uuid(),
	expiryDate: z
		.string()
		.optional()
		.refine((value) => !value || !Number.isNaN(Date.parse(value)), {
			message: 'Invalid expiry date',
		}),
});

function safeFileName(fileName: string) {
	return fileName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-120);
}

async function ensureBucket(admin: ReturnType<typeof createAdminClient>) {
	const { data } = await admin.storage.getBucket(CARER_DOCUMENTS_BUCKET);

	if (data) return;

	const { error } = await admin.storage.createBucket(CARER_DOCUMENTS_BUCKET, {
		public: false,
		fileSizeLimit: `${MAX_FILE_SIZE}`,
		allowedMimeTypes: [
			'application/pdf',
			'image/jpeg',
			'image/png',
			'application/msword',
			'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
		],
	});

	if (error && !error.message.toLowerCase().includes('already exists')) {
		throw error;
	}
}

export async function POST(request: Request) {
	const formData = await request.formData();
	const file = formData.get('file');
	const parsed = uploadSchema.safeParse({
		token: formData.get('token'),
		documentTypeId: formData.get('documentTypeId'),
		expiryDate: formData.get('expiryDate') || undefined,
	});

	if (!parsed.success) {
		return NextResponse.json(
			{ error: 'Please provide a valid document type and expiry date.' },
			{ status: 400 },
		);
	}

	if (!(file instanceof File)) {
		return NextResponse.json({ error: 'Please choose a file.' }, { status: 400 });
	}

	if (file.size > MAX_FILE_SIZE) {
		return NextResponse.json(
			{ error: 'Files must be 10MB or smaller.' },
			{ status: 400 },
		);
	}

	const admin = createAdminClient();

	try {
		const context = await getCarerOnboardingContext(admin, parsed.data.token);

		const { data: documentType, error: documentTypeError } = await admin
			.from('document_types')
			.select('id, name, is_required, expiry_months')
			.eq('id', parsed.data.documentTypeId)
			.eq('organization_id', context.carer.organization_id)
			.maybeSingle();

		if (documentTypeError || !documentType) {
			return NextResponse.json(
				{ error: 'This document type is not available for onboarding.' },
				{ status: 400 },
			);
		}

		await ensureBucket(admin);

		const storagePath = [
			context.carer.organization_id,
			context.carer.id,
			`${Date.now()}-${randomUUID()}-${safeFileName(file.name)}`,
		].join('/');

		const { error: uploadError } = await admin.storage
			.from(CARER_DOCUMENTS_BUCKET)
			.upload(storagePath, file, {
				contentType: file.type || 'application/octet-stream',
				upsert: false,
			});

		if (uploadError) {
			throw uploadError;
		}

		const { data: document, error: insertError } = await admin
			.from('documents')
			.insert({
				carer_id: context.carer.id,
				document_type_id: parsed.data.documentTypeId,
				file_name: file.name,
				file_path: storagePath,
				file_size: file.size,
				status: 'pending',
				expiry_date: parsed.data.expiryDate || null,
			})
			.select(
				'id, document_type_id, file_name, file_size, status, expiry_date, uploaded_at, rejection_reason',
			)
			.single();

		if (insertError) {
			await admin.storage.from(CARER_DOCUMENTS_BUCKET).remove([storagePath]);
			throw insertError;
		}

		const supersededAt = new Date().toISOString();
		const { data: supersededDocuments, error: supersedeError } = await admin
			.from('documents')
			.update({
				status: 'obsolete',
				superseded_by: document.id,
				superseded_at: supersededAt,
			})
			.eq('carer_id', context.carer.id)
			.eq('document_type_id', parsed.data.documentTypeId)
			.neq('id', document.id)
			.neq('status', 'obsolete')
			.select('id, status');

		if (supersedeError) {
			throw supersedeError;
		}

		const { progress } = await updateCarerOnboardingProgress(
			admin,
			context.carer.id,
			context.carer.organization_id,
		);

		await createSystemAuditLog({
			action: 'document.uploaded',
			entityType: 'document',
			organizationId: context.carer.organization_id,
			entityId: document.id,
			entityName: `${documentType.name} - ${context.carer.full_name}`,
			source: 'onboarding',
			details: {
				invitation_id: context.invitation.id,
				invitation_email: context.invitation.email,
				invitation_expires_at: context.invitation.expires_at,
				carer_id: context.carer.id,
				carer_name: context.carer.full_name,
				carer_email: context.carer.email,
				document_type_id: documentType.id,
				document_type_name: documentType.name,
				is_required: documentType.is_required,
				expiry_months: documentType.expiry_months,
				expiry_date: parsed.data.expiryDate ?? null,
				file_name: file.name,
				file_size: file.size,
				file_type: file.type || 'application/octet-stream',
				status: 'pending',
				replacement_document_id: document.id,
				superseded_document_ids:
					supersededDocuments?.map((superseded) => superseded.id) ?? [],
				superseded_at: supersededAt,
				onboarding_progress: progress,
				outcome: 'carer_uploaded_onboarding_document',
			},
			request,
		});

		return NextResponse.json({ document, progress });
	} catch (error) {
		if (error instanceof OnboardingTokenError) {
			return NextResponse.json({ error: error.message }, { status: error.status });
		}

		console.error('Failed to upload onboarding document:', error);
		return NextResponse.json(
			{ error: 'Document could not be uploaded.' },
			{ status: 500 },
		);
	}
}

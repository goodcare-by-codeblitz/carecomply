import { createUserAuditLog } from '@/lib/audit-server';
import {
	CARER_DOCUMENTS_BUCKET,
	updateCarerOnboardingProgress,
} from '@/lib/onboarding';
import { PERMISSIONS } from '@/lib/permissions';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const uploadSchema = z.object({
	carerId: z.string().uuid(),
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
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
	}

	const formData = await request.formData();
	const file = formData.get('file');
	const parsed = uploadSchema.safeParse({
		carerId: formData.get('carerId'),
		documentTypeId: formData.get('documentTypeId'),
		expiryDate: formData.get('expiryDate') || undefined,
	});

	if (!parsed.success) {
		return NextResponse.json(
			{ error: 'Please provide a valid document upload.' },
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
	const { data: carer, error: carerError } = await admin
		.from('carers')
		.select('id, full_name, email, organization_id')
		.eq('id', parsed.data.carerId)
		.maybeSingle();

	if (carerError || !carer) {
		return NextResponse.json({ error: 'Carer not found.' }, { status: 404 });
	}

	const { data: canUpload } = await supabase.rpc('has_org_permission', {
		p_org_id: carer.organization_id,
		p_permission_code: PERMISSIONS.DOCUMENTS_UPLOAD,
	});

	if (!canUpload) {
		return NextResponse.json(
			{ error: 'You do not have permission to upload documents.' },
			{ status: 403 },
		);
	}

	const { data: documentType, error: documentTypeError } = await admin
		.from('document_types')
		.select('id, name, is_required, expiry_months')
		.eq('id', parsed.data.documentTypeId)
		.eq('organization_id', carer.organization_id)
		.maybeSingle();

	if (documentTypeError || !documentType) {
		return NextResponse.json(
			{ error: 'This document type is not available.' },
			{ status: 400 },
		);
	}

	try {
		await ensureBucket(admin);
		const storagePath = [
			carer.organization_id,
			carer.id,
			`${Date.now()}-${randomUUID()}-${safeFileName(file.name)}`,
		].join('/');

		const { error: uploadError } = await admin.storage
			.from(CARER_DOCUMENTS_BUCKET)
			.upload(storagePath, file, {
				contentType: file.type || 'application/octet-stream',
				upsert: false,
			});

		if (uploadError) throw uploadError;

		const { data: document, error: insertError } = await admin
			.from('documents')
			.insert({
				carer_id: carer.id,
				document_type_id: documentType.id,
				file_name: file.name,
				file_path: storagePath,
				file_size: file.size,
				status: 'pending',
				expiry_date: parsed.data.expiryDate || null,
			})
			.select('id, file_name, file_size, status, expiry_date, uploaded_at')
			.single();

		if (insertError || !document) {
			throw insertError ?? new Error('Document could not be recorded.');
		}

		const supersededAt = new Date().toISOString();
		const { data: supersededDocuments, error: supersedeError } = await admin
			.from('documents')
			.update({
				status: 'obsolete',
				superseded_by: document.id,
				superseded_at: supersededAt,
			})
			.eq('carer_id', carer.id)
			.eq('document_type_id', documentType.id)
			.neq('id', document.id)
			.neq('status', 'obsolete')
			.select('id');

		if (supersedeError) throw supersedeError;

		const { progress } = await updateCarerOnboardingProgress(
			admin,
			carer.id,
			carer.organization_id,
		);

		await createUserAuditLog({
			action: 'document.uploaded',
			entityType: 'document',
			organizationId: carer.organization_id,
			entityId: document.id,
			entityName: `${documentType.name} - ${carer.full_name}`,
			details: {
				carer_id: carer.id,
				carer_name: carer.full_name,
				carer_email: carer.email,
				document_type_id: documentType.id,
				document_type_name: documentType.name,
				file_name: file.name,
				file_size: file.size,
				file_type: file.type || 'application/octet-stream',
				status: 'pending',
				replacement_document_id: document.id,
				superseded_document_ids:
					supersededDocuments?.map((superseded) => superseded.id) ?? [],
				superseded_at: supersededAt,
				onboarding_progress: progress,
				outcome: 'manual_read_only_document_uploaded',
			},
			request,
		});

		return NextResponse.json({ document, progress });
	} catch (error) {
		console.error('Failed to upload document:', error);
		return NextResponse.json(
			{ error: 'Document could not be uploaded.' },
			{ status: 500 },
		);
	}
}

import {
	CARER_DOCUMENTS_BUCKET,
	getCarerOnboardingContext,
	OnboardingTokenError,
	updateCarerOnboardingProgress,
} from '@/lib/onboarding';
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
			.select('id')
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

		const progress = await updateCarerOnboardingProgress(
			admin,
			context.carer.id,
			context.carer.organization_id,
		);

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

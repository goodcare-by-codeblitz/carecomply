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
const ALLOWED_MIME_TYPES = new Set([
	'application/pdf',
	'image/jpeg',
	'image/png',
	'application/msword',
	'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

const metadataSchema = z.object({
	documentId: z.string().uuid(),
	expiryDate: z
		.string()
		.nullable()
		.optional()
		.refine((value) => !value || !Number.isNaN(Date.parse(value)), {
			message: 'Invalid expiry date',
		}),
	reviewNotes: z.string().trim().max(2000).nullable().optional(),
});

type DocumentForManagement = {
	id: string;
	file_name: string;
	file_path: string;
	file_size: number | null;
	status: string;
	expiry_date: string | null;
	review_notes: string | null;
	reviewed_at: string | null;
	reviewed_by: string | null;
	carer_id: string;
	document_type_id: string;
	superseded_by: string | null;
	carers:
		| {
				id: string;
				full_name: string;
				email: string;
				organization_id: string;
		  }
		| {
				id: string;
				full_name: string;
				email: string;
				organization_id: string;
		  }[]
		| null;
	document_type: { name: string } | { name: string }[] | null;
};

function normalizeRelation<T>(value: T | T[] | null | undefined) {
	return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function safeFileName(fileName: string) {
	return fileName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-120);
}

function normalizeDate(value: string | null | undefined) {
	if (!value) return null;
	return value.slice(0, 10);
}

async function ensureBucket(admin: ReturnType<typeof createAdminClient>) {
	const { data } = await admin.storage.getBucket(CARER_DOCUMENTS_BUCKET);
	if (data) return;

	const { error } = await admin.storage.createBucket(CARER_DOCUMENTS_BUCKET, {
		public: false,
		fileSizeLimit: `${MAX_FILE_SIZE}`,
		allowedMimeTypes: Array.from(ALLOWED_MIME_TYPES),
	});

	if (error && !error.message.toLowerCase().includes('already exists')) {
		throw error;
	}
}

async function getApprovedCurrentDocument(
	admin: ReturnType<typeof createAdminClient>,
	documentId: string,
) {
	const { data, error } = await admin
		.from('documents')
		.select(
			'id, file_name, file_path, file_size, status, expiry_date, review_notes, reviewed_at, reviewed_by, carer_id, document_type_id, superseded_by, carers!inner(id, full_name, email, organization_id), document_type:document_types!documents_document_type_id_fkey(name)',
		)
		.eq('id', documentId)
		.maybeSingle();

	if (error || !data) {
		return { document: null, error: 'Document not found.' };
	}

	const document = data as DocumentForManagement;
	if (document.status === 'obsolete' || document.superseded_by) {
		return {
			document: null,
			error: 'This document has been replaced and can no longer be edited.',
			status: 409,
		};
	}

	if (document.status !== 'approved') {
		return {
			document: null,
			error: 'Only approved current documents can be edited here.',
			status: 409,
		};
	}

	return { document, error: null };
}

async function requireReviewPermission(
	supabase: Awaited<ReturnType<typeof createClient>>,
	organizationId: string,
) {
	const { data: canReview } = await supabase.rpc('has_org_permission', {
		p_org_id: organizationId,
		p_permission_code: PERMISSIONS.DOCUMENTS_REVIEW,
	});
	return Boolean(canReview);
}

async function skipQueuedReminderJobsForDocument(
	admin: ReturnType<typeof createAdminClient>,
	documentId: string,
	reason: string,
) {
	const { data: jobs, error } = await admin
		.from('reminder_jobs')
		.update({
			status: 'skipped',
			last_error: reason,
			locked_at: null,
			locked_by: null,
			processed_at: new Date().toISOString(),
			updated_at: new Date().toISOString(),
		})
		.eq('document_id', documentId)
		.in('status', ['queued', 'processing'])
		.select(
			'id, reminder_id, carer_id, document_id, recipient_type, recipient_email',
		);

	if (error || !jobs?.length) return 0;

	await admin.from('reminder_logs').insert(
		jobs.map((job) => ({
			reminder_id: job.reminder_id,
			reminder_job_id: job.id,
			carer_id: job.carer_id,
			document_id: job.document_id,
			channel: 'email',
			recipient_type: job.recipient_type,
			recipient_email: job.recipient_email,
			status: 'skipped',
			error_message: reason,
		})),
	);

	return jobs.length;
}

export async function PATCH(request: Request) {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
	}

	const parsed = metadataSchema.safeParse(await request.json().catch(() => null));
	if (!parsed.success) {
		return NextResponse.json(
			{ error: 'Please provide valid document metadata.' },
			{ status: 400 },
		);
	}

	const admin = createAdminClient();
	const { document, error, status } = await getApprovedCurrentDocument(
		admin,
		parsed.data.documentId,
	);
	if (!document) {
		return NextResponse.json({ error }, { status: status ?? 404 });
	}

	const carer = normalizeRelation(document.carers);
	const documentType = normalizeRelation(document.document_type);
	if (!carer) {
		return NextResponse.json(
			{ error: 'Document is not linked to a carer.' },
			{ status: 404 },
		);
	}

	if (!(await requireReviewPermission(supabase, carer.organization_id))) {
		return NextResponse.json(
			{ error: 'You do not have permission to edit approved documents.' },
			{ status: 403 },
		);
	}

	const nextExpiryDate = normalizeDate(parsed.data.expiryDate);
	const nextReviewNotes = parsed.data.reviewNotes ?? document.review_notes;
	const changedFields = [
		document.expiry_date !== nextExpiryDate ? 'expiry_date' : null,
		document.review_notes !== nextReviewNotes ? 'review_notes' : null,
	].filter((field): field is string => Boolean(field));

	if (changedFields.length === 0) {
		return NextResponse.json({ ok: true, document, skippedReminderJobs: 0 });
	}

	const { data: updatedDocument, error: updateError } = await admin
		.from('documents')
		.update({
			expiry_date: nextExpiryDate,
			review_notes: nextReviewNotes,
			reviewed_at: new Date().toISOString(),
			reviewed_by: user.id,
		})
		.eq('id', document.id)
		.select('id, status, expiry_date, review_notes, reviewed_at, reviewed_by')
		.single();

	if (updateError || !updatedDocument) {
		return NextResponse.json(
			{ error: 'Document changes could not be saved.' },
			{ status: 500 },
		);
	}

	const skippedReminderJobs = changedFields.includes('expiry_date')
		? await skipQueuedReminderJobsForDocument(
				admin,
				document.id,
				'Document expiry date changed.',
			)
		: 0;

	const { progress } = await updateCarerOnboardingProgress(
		admin,
		carer.id,
		carer.organization_id,
	);

	await createUserAuditLog({
		action: 'document.updated',
		entityType: 'document',
		organizationId: carer.organization_id,
		entityId: document.id,
		entityName: `${documentType?.name ?? 'Document'} - ${carer.full_name}`,
		details: {
			document_id: document.id,
			carer_id: carer.id,
			carer_name: carer.full_name,
			carer_email: carer.email,
			document_type_id: document.document_type_id,
			document_type_name: documentType?.name ?? null,
			file_name: document.file_name,
			before: {
				expiry_date: document.expiry_date,
				review_notes: document.review_notes,
			},
			after: {
				expiry_date: updatedDocument.expiry_date,
				review_notes: updatedDocument.review_notes,
			},
			changed_fields: changedFields,
			skipped_reminder_jobs: skippedReminderJobs,
			onboarding_progress: progress,
			permission_checked: PERMISSIONS.DOCUMENTS_REVIEW,
			outcome: 'approved_document_metadata_updated',
		},
		request,
	});

	return NextResponse.json({
		ok: true,
		document: updatedDocument,
		skippedReminderJobs,
		progress,
	});
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
	const documentId = formData.get('documentId');
	const parsed = metadataSchema.safeParse({
		documentId,
		expiryDate: formData.get('expiryDate') || null,
		reviewNotes: formData.get('reviewNotes') || null,
	});

	if (!parsed.success) {
		return NextResponse.json(
			{ error: 'Please provide a valid replacement document.' },
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

	if (file.type && !ALLOWED_MIME_TYPES.has(file.type)) {
		return NextResponse.json(
			{ error: 'This file type is not supported.' },
			{ status: 400 },
		);
	}

	const admin = createAdminClient();
	const { document, error, status } = await getApprovedCurrentDocument(
		admin,
		parsed.data.documentId,
	);
	if (!document) {
		return NextResponse.json({ error }, { status: status ?? 404 });
	}

	const carer = normalizeRelation(document.carers);
	const documentType = normalizeRelation(document.document_type);
	if (!carer) {
		return NextResponse.json(
			{ error: 'Document is not linked to a carer.' },
			{ status: 404 },
		);
	}

	if (!(await requireReviewPermission(supabase, carer.organization_id))) {
		return NextResponse.json(
			{ error: 'You do not have permission to replace approved documents.' },
			{ status: 403 },
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

		const reviewedAt = new Date().toISOString();
		const { data: replacement, error: insertError } = await admin
			.from('documents')
			.insert({
				carer_id: carer.id,
				document_type_id: document.document_type_id,
				file_name: file.name,
				file_path: storagePath,
				file_size: file.size,
				status: 'approved',
				expiry_date: normalizeDate(parsed.data.expiryDate),
				reviewed_at: reviewedAt,
				reviewed_by: user.id,
				review_notes: parsed.data.reviewNotes,
			})
			.select(
				'id, file_name, file_size, status, expiry_date, uploaded_at, reviewed_at, reviewed_by, review_notes',
			)
			.single();

		if (insertError || !replacement) {
			throw insertError ?? new Error('Replacement document could not be recorded.');
		}

		const supersededAt = new Date().toISOString();
		const { error: supersedeError } = await admin
			.from('documents')
			.update({
				status: 'obsolete',
				superseded_by: replacement.id,
				superseded_at: supersededAt,
			})
			.eq('id', document.id)
			.eq('status', 'approved')
			.is('superseded_by', null);

		if (supersedeError) throw supersedeError;

		const skippedReminderJobs = await skipQueuedReminderJobsForDocument(
			admin,
			document.id,
			'Document replaced.',
		);

		const { progress } = await updateCarerOnboardingProgress(
			admin,
			carer.id,
			carer.organization_id,
		);

		await createUserAuditLog({
			action: 'document.replaced',
			entityType: 'document',
			organizationId: carer.organization_id,
			entityId: replacement.id,
			entityName: `${documentType?.name ?? 'Document'} - ${carer.full_name}`,
			details: {
				old_document_id: document.id,
				new_document_id: replacement.id,
				carer_id: carer.id,
				carer_name: carer.full_name,
				carer_email: carer.email,
				document_type_id: document.document_type_id,
				document_type_name: documentType?.name ?? null,
				before: {
					file_name: document.file_name,
					file_size: document.file_size,
					expiry_date: document.expiry_date,
					status: document.status,
				},
				after: {
					file_name: replacement.file_name,
					file_size: replacement.file_size,
					expiry_date: replacement.expiry_date,
					status: replacement.status,
				},
				superseded_at: supersededAt,
				skipped_reminder_jobs: skippedReminderJobs,
				onboarding_progress: progress,
				permission_checked: PERMISSIONS.DOCUMENTS_REVIEW,
				outcome: 'approved_document_replaced_read_only_history_preserved',
			},
			request,
		});

		return NextResponse.json({
			ok: true,
			document: replacement,
			replacedDocumentId: document.id,
			skippedReminderJobs,
			progress,
		});
	} catch (error) {
		console.error('Failed to replace approved document:', error);
		return NextResponse.json(
			{ error: 'Replacement document could not be saved.' },
			{ status: 500 },
		);
	}
}

import { CARER_DOCUMENTS_BUCKET } from '@/lib/onboarding';
import { createUserAuditLog } from '@/lib/audit-server';
import { PERMISSIONS } from '@/lib/permissions';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

type DocumentFileRow = {
	id: string;
	file_name: string;
	file_path: string;
	carers:
		| {
				id: string;
				full_name: string;
				organization_id: string;
		  }
		| {
				id: string;
				full_name: string;
				organization_id: string;
		  }[]
		| null;
};

function normalizeRelation<T>(value: T | T[] | null | undefined) {
	return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

export async function GET(request: Request) {
	const { searchParams } = new URL(request.url);
	const documentId = searchParams.get('documentId');

	if (!documentId) {
		return NextResponse.json(
			{ error: 'A document id is required.' },
			{ status: 400 },
		);
	}

	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
	}

	const admin = createAdminClient();
	const { data, error } = await admin
		.from('documents')
		.select('id, file_name, file_path, carers!inner(id, full_name, organization_id)')
		.eq('id', documentId)
		.maybeSingle();

	if (error || !data) {
		return NextResponse.json({ error: 'Document not found.' }, { status: 404 });
	}

	const document = data as DocumentFileRow;
	const carer = normalizeRelation(document.carers);

	if (!carer) {
		return NextResponse.json(
			{ error: 'Document is not linked to a carer.' },
			{ status: 404 },
		);
	}

	const [{ data: canView }, { data: canReview }] = await Promise.all([
		supabase.rpc('has_org_permission', {
			p_org_id: carer.organization_id,
			p_permission_code: PERMISSIONS.DOCUMENTS_VIEW,
		}),
		supabase.rpc('has_org_permission', {
			p_org_id: carer.organization_id,
			p_permission_code: PERMISSIONS.DOCUMENTS_REVIEW,
		}),
	]);

	if (!canView && !canReview) {
		return NextResponse.json(
			{ error: 'You do not have permission to view documents.' },
			{ status: 403 },
		);
	}

	const { data: signedUrl, error: signedUrlError } = await admin.storage
		.from(CARER_DOCUMENTS_BUCKET)
		.createSignedUrl(document.file_path, 60);

	if (signedUrlError || !signedUrl?.signedUrl) {
		return NextResponse.json(
			{ error: 'Document file could not be opened.' },
			{ status: 500 },
		);
	}

	await createUserAuditLog({
		action: 'document.viewed',
		entityType: 'document',
		organizationId: carer.organization_id,
		entityId: document.id,
		entityName: document.file_name,
		details: {
			carer_id: carer.id,
			carer_name: carer.full_name,
			file_name: document.file_name,
			outcome: 'read_only_document_file_opened',
		},
		request,
	});

	return NextResponse.redirect(signedUrl.signedUrl);
}

import {
	createManifestHash,
	decodeManifest,
	sha256Hex,
	verifyManifestSignature,
	type AuditExportManifest,
} from '@/lib/audit-export-signing';
import { createAuditLog } from '@/lib/audit-server';
import { PERMISSIONS } from '@/lib/permissions';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import ExcelJS from 'exceljs';
import { NextResponse } from 'next/server';

type AuditExportRow = {
	id: string;
	organization_id: string;
	format: 'csv' | 'xlsx';
	file_hash: string;
	manifest_hash: string;
	signature: string;
	row_count: number;
	verification_count: number;
};

export async function POST(request: Request) {
	const signingSecret = process.env.AUDIT_EXPORT_SIGNING_SECRET;
	if (!signingSecret) {
		return NextResponse.json(
			{ error: 'Audit export signing is not configured.' },
			{ status: 503 },
		);
	}

	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
	}

	const formData = await request.formData();
	const file = formData.get('file');

	if (!(file instanceof File)) {
		return NextResponse.json(
			{ error: 'Please upload an audit export file.' },
			{ status: 400 },
		);
	}

	const buffer = Buffer.from(await file.arrayBuffer());
	const fileHash = sha256Hex(buffer);
	const parsed = await parseExportManifest(file.name, buffer);

	if (!parsed) {
		return NextResponse.json(
			{ valid: false, reason: 'Verification metadata was not found.' },
			{ status: 400 },
		);
	}

	const admin = createAdminClient();
	const { data: exportRow, error } = await admin
		.from('audit_exports')
		.select(
			'id, organization_id, format, file_hash, manifest_hash, signature, row_count, verification_count',
		)
		.eq('id', parsed.manifest.exportId)
		.maybeSingle();

	if (error || !exportRow) {
		return NextResponse.json(
			{ valid: false, reason: 'This export is not registered in CareComply.' },
			{ status: 404 },
		);
	}

	const row = exportRow as AuditExportRow;
	const { data: canViewAudit } = await supabase.rpc('has_org_permission', {
		p_org_id: row.organization_id,
		p_permission_code: PERMISSIONS.AUDIT_VIEW,
	});

	if (!canViewAudit) {
		return NextResponse.json(
			{ error: 'You do not have permission to verify this export.' },
			{ status: 403 },
		);
	}

	const manifestHash = createManifestHash(parsed.manifest);
	const valid =
		row.file_hash === fileHash &&
		row.manifest_hash === manifestHash &&
		row.signature === parsed.signature &&
		verifyManifestSignature(signingSecret, manifestHash, parsed.signature);
	const reason = valid
		? 'Export is valid and has not changed since generation.'
		: 'Export has changed or its signature does not match CareComply records.';

	await admin
		.from('audit_exports')
		.update({
			verification_count: row.verification_count + 1,
			last_verified_at: new Date().toISOString(),
		})
		.eq('id', row.id);

	await createAuditLog({
		action: 'audit.export_verified',
		entityType: 'audit_export',
		organizationId: row.organization_id,
		entityId: row.id,
		entityName: `${row.format.toUpperCase()} audit export`,
		userId: user.id,
		userEmail: user.email ?? null,
		details: {
			export_id: row.id,
			format: row.format,
			valid,
			reason,
			file_hash: fileHash,
			expected_file_hash: row.file_hash,
			manifest_hash: manifestHash,
			expected_manifest_hash: row.manifest_hash,
			outcome: valid
				? 'audit_export_verification_passed'
				: 'audit_export_verification_failed',
		},
		request,
	});

	return NextResponse.json({
		valid,
		reason,
		exportId: row.id,
		format: row.format,
		rowCount: row.row_count,
	});
}

async function parseExportManifest(fileName: string, buffer: Buffer): Promise<{
	manifest: AuditExportManifest;
	signature: string;
} | null> {
	if (fileName.toLowerCase().endsWith('.xlsx')) {
		const workbook = new ExcelJS.Workbook();
		const arrayBuffer = buffer.buffer.slice(
			buffer.byteOffset,
			buffer.byteOffset + buffer.byteLength,
		) as ArrayBuffer;
		await workbook.xlsx.load(arrayBuffer);
		const sheet = workbook.getWorksheet('Verification');
		if (!sheet) return null;

		const values = new Map<string, string>();
		sheet.eachRow((row) => {
			const key = String(row.getCell(1).value ?? '');
			const value = String(row.getCell(2).value ?? '');
			if (key && value) values.set(key, value);
		});

		const encodedManifest = values.get('Manifest JSON');
		const signature = values.get('Signature');
		if (!encodedManifest || !signature) return null;
		return { manifest: decodeManifest(encodedManifest), signature };
	}

	const text = buffer.toString('utf8');
	const metadata = new Map<string, string>();
	for (const line of text.split(/\r?\n/)) {
		if (!line.startsWith('#')) break;
		const content = line.slice(1).trim();
		const separator = content.indexOf(',');
		if (separator === -1) continue;
		metadata.set(content.slice(0, separator), content.slice(separator + 1));
	}

	const encodedManifest = metadata.get('manifest_json');
	const signature = metadata.get('signature');
	if (!encodedManifest || !signature) return null;
	return { manifest: decodeManifest(encodedManifest), signature };
}

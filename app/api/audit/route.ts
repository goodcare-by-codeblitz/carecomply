import { createAuditLog } from '@/lib/audit-server';
import { getBillingEntitlements } from '@/lib/billing';
import {
	canonicalJson,
	createManifestHash,
	encodeManifest,
	sha256Hex,
	signManifest,
	type AuditExportManifest,
} from '@/lib/audit-export-signing';
import {
	type AuditAction,
	type AuditCategory,
	type AuditSeverity,
	type CqcKeyQuestion,
	type EntityType,
} from '@/lib/audit';
import { PERMISSIONS } from '@/lib/permissions';
import { createAdminClient } from '@/lib/supabase/admin';
import ExcelJS from 'exceljs';
import { randomUUID } from 'crypto';
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const auditPostSchema = z.object({
	orgId: z.string().uuid().optional(),
	orgSlug: z.string().min(1).optional(),
	action: z.string().min(2),
	entityType: z.string().min(2),
	entityId: z.string().uuid().nullable().optional(),
	entityName: z.string().nullable().optional(),
	details: z.record(z.string(), z.unknown()).optional(),
	category: z.string().optional(),
	severity: z.string().optional(),
	source: z.string().optional(),
	cqcKeyQuestion: z.string().optional(),
});

const FILTERABLE_COLUMNS = [
	'action',
	'category',
	'cqc_key_question',
	'entity_type',
	'severity',
	'user_email',
] as const;

const STARTER_ENTITY_TYPES = [
	'carer',
	'document',
	'document_type',
	'email',
	'invitation',
	'reference',
	'reminder',
	'team_member',
] as const;

const STARTER_RETENTION_DAYS = 90;
const TENANT_HIDDEN_AUDIT_ACTIONS = ['reminder.worker_configuration_missing'];

export async function GET(request: NextRequest) {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
	}

	const { searchParams } = new URL(request.url);
	const organization = await resolveOrganization(
		supabase,
		user.id,
		searchParams.get('orgId') ?? undefined,
		searchParams.get('orgSlug') ?? undefined,
	);

	if (!organization) {
		return NextResponse.json({ error: 'Organization not found.' }, { status: 404 });
	}

	const { data: canViewAudit } = await supabase.rpc('has_org_permission', {
		p_org_id: organization.id,
		p_permission_code: PERMISSIONS.AUDIT_VIEW,
	});

	if (!canViewAudit) {
		return NextResponse.json(
			{ error: 'You do not have permission to view audit logs.' },
			{ status: 403 },
		);
	}

	const admin = createAdminClient();
	const billing = await getAuditBilling(admin, organization.id);
	const hasPro = billing.isPro;
	const capabilities = getAuditCapabilities(hasPro);

	const page = Math.max(1, Number(searchParams.get('page') ?? '1') || 1);
	const pageSize = Math.min(
		hasPro ? 200 : 20,
		Math.max(1, Number(searchParams.get('pageSize') ?? '20') || 20),
	);
	const exportMode = searchParams.get('export');

	if (exportMode === 'xlsx' && !hasPro) {
		return NextResponse.json(
			{ error: 'Excel CQC evidence export is available on Pro.' },
			{ status: 403 },
		);
	}

	const warnings: string[] = [];
	let query = admin
		.from('audit_logs')
		.select('*', { count: 'exact' })
		.eq('organization_id', organization.id)
		.not('action', 'in', `(${TENANT_HIDDEN_AUDIT_ACTIONS.join(',')})`)
		.order('created_at', { ascending: false });

	const filterableColumns = hasPro
		? FILTERABLE_COLUMNS
		: (['entity_type'] as const);
	for (const column of filterableColumns) {
		const value = searchParams.get(column);
		if (value && value !== 'all') {
			query = query.eq(column, value);
		}
	}

	if (!hasPro) {
		query = query
			.in('entity_type', [...STARTER_ENTITY_TYPES])
			.gte(
				'created_at',
				new Date(
					Date.now() - STARTER_RETENTION_DAYS * 24 * 60 * 60 * 1000,
				).toISOString(),
			);

		for (const column of ['category', 'severity', 'cqc_key_question'] as const) {
			if (searchParams.get(column) && searchParams.get(column) !== 'all') {
				warnings.push(`${column} is available on Pro and was ignored.`);
			}
		}
	}

	const dateFrom = searchParams.get('dateFrom');
	const dateTo = searchParams.get('dateTo');
	if (hasPro) {
		if (dateFrom) query = query.gte('created_at', dateFrom);
		if (dateTo) query = query.lte('created_at', dateTo);
	} else if (dateFrom || dateTo) {
		warnings.push('Date range filters are available on Pro and were ignored.');
	}

	if (!exportMode) {
		query = query.range((page - 1) * pageSize, page * pageSize - 1);
	}

	const { data, error, count } = await query;

	if (error) {
		return NextResponse.json(
			{ error: 'Audit logs could not be loaded.' },
			{ status: 500 },
		);
	}

	const logs = data ?? [];

	if (exportMode === 'csv') {
		const signedExport = await buildSignedAuditCsv({
			admin,
			logs,
			hasPro,
			organization,
			user,
			filters: exportFilters(searchParams),
			request,
		});
		if (!signedExport.ok) return signedExport.response;

		return new NextResponse(signedExport.body, {
			headers: {
				'Content-Type': 'text/csv; charset=utf-8',
				'Content-Disposition': `attachment; filename="carecomply-audit-${organization.slug}.csv"`,
			},
		});
	}

	if (exportMode === 'xlsx') {
		const signedExport = await buildSignedAuditWorkbook({
			admin,
			logs,
			organization,
			user,
			filters: exportFilters(searchParams),
			dateFrom,
			dateTo,
			request,
		});
		if (!signedExport.ok) return signedExport.response;

		return new NextResponse(signedExport.body, {
			headers: {
				'Content-Type':
					'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
				'Content-Disposition': `attachment; filename="carecomply-cqc-audit-${organization.slug}.xlsx"`,
			},
		});
	}

	return NextResponse.json({
		logs,
		count: count ?? 0,
		totalPages: Math.max(1, Math.ceil((count ?? 0) / pageSize)),
		billing: {
			plan: billing.plan,
			status: billing.status,
			isPro: hasPro,
		},
		capabilities,
		warnings,
	});
}

function exportFilters(searchParams: URLSearchParams) {
	return Object.fromEntries(
		FILTERABLE_COLUMNS.map((column) => [
			column,
			searchParams.get(column) ?? 'all',
		]),
	);
}

type ExportOrganization = {
	id: string;
	name: string;
	slug: string;
};

type SignedExportParams = {
	admin: ReturnType<typeof createAdminClient>;
	logs: Record<string, unknown>[];
	organization: ExportOrganization;
	user: { id: string; email?: string | null };
	filters: Record<string, string>;
	request: Request;
};

async function buildSignedAuditCsv({
	admin,
	logs,
	hasPro,
	organization,
	user,
	filters,
	request,
}: SignedExportParams & { hasPro: boolean }) {
	const signingSecret = process.env.AUDIT_EXPORT_SIGNING_SECRET;
	if (!signingSecret) {
		return {
			ok: false as const,
			response: NextResponse.json(
				{ error: 'Audit export signing is not configured.' },
				{ status: 503 },
			),
		};
	}

	const exportId = randomUUID();
	const generatedAt = new Date().toISOString();
	const csvBody = buildAuditCsv(logs, hasPro);
	const manifest = createAuditExportManifest({
		exportId,
		organization,
		format: 'csv',
		generatedAt,
		filters,
		logs,
		rowsHash: sha256Hex(csvBody),
	});
	const manifestHash = createManifestHash(manifest);
	const signature = signManifest(signingSecret, manifestHash);
	const body = buildSignedCsvBody({
		csvBody,
		manifest,
		manifestHash,
		signature,
	});
	const fileHash = sha256Hex(body);

	await recordAuditExport({
		admin,
		manifest,
		user,
		fileHash,
		manifestHash,
		signature,
		filters,
	});
	await logAuditExport({ manifest, fileHash, manifestHash, signature, user, request });

	return { ok: true as const, body };
}

async function buildSignedAuditWorkbook({
	admin,
	logs,
	organization,
	user,
	filters,
	dateFrom,
	dateTo,
	request,
}: SignedExportParams & { dateFrom: string | null; dateTo: string | null }) {
	const signingSecret = process.env.AUDIT_EXPORT_SIGNING_SECRET;
	if (!signingSecret) {
		return {
			ok: false as const,
			response: NextResponse.json(
				{ error: 'Audit export signing is not configured.' },
				{ status: 503 },
			),
		};
	}

	const exportId = randomUUID();
	const generatedAt = new Date().toISOString();
	const manifest = createAuditExportManifest({
		exportId,
		organization,
		format: 'xlsx',
		generatedAt,
		filters,
		logs,
		rowsHash: sha256Hex(canonicalJson(logs)),
	});
	const manifestHash = createManifestHash(manifest);
	const signature = signManifest(signingSecret, manifestHash);
	const workbookBuffer = await buildAuditExportWorkbook(
		logs,
		{
			orgName: organization.name,
			orgSlug: organization.slug,
			dateFrom,
			dateTo,
			generatedAt: new Date(generatedAt),
			filters,
		},
		{ manifest, manifestHash, signature },
	);
	const body = Buffer.from(workbookBuffer);
	const fileHash = sha256Hex(body);

	await recordAuditExport({
		admin,
		manifest,
		user,
		fileHash,
		manifestHash,
		signature,
		filters,
	});
	await logAuditExport({ manifest, fileHash, manifestHash, signature, user, request });

	return { ok: true as const, body };
}

function createAuditExportManifest({
	exportId,
	organization,
	format,
	generatedAt,
	filters,
	logs,
	rowsHash,
}: {
	exportId: string;
	organization: ExportOrganization;
	format: 'csv' | 'xlsx';
	generatedAt: string;
	filters: Record<string, string>;
	logs: Record<string, unknown>[];
	rowsHash: string;
}): AuditExportManifest {
	return {
		exportId,
		organizationId: organization.id,
		organizationSlug: organization.slug,
		format,
		generatedAt,
		rowCount: logs.length,
		filters,
		rowsHash,
	};
}

function buildSignedCsvBody({
	csvBody,
	manifest,
	manifestHash,
	signature,
}: {
	csvBody: string;
	manifest: AuditExportManifest;
	manifestHash: string;
	signature: string;
}) {
	return [
		'# CareComply Tamper-Evident Audit Export',
		`# export_id,${manifest.exportId}`,
		`# format,${manifest.format}`,
		`# generated_at,${manifest.generatedAt}`,
		`# organization_slug,${manifest.organizationSlug}`,
		`# row_count,${manifest.rowCount}`,
		`# rows_hash,${manifest.rowsHash}`,
		`# manifest_hash,${manifestHash}`,
		`# signature,${signature}`,
		`# manifest_json,${encodeManifest(manifest)}`,
		'# Verify this file in CareComply. Any byte-level edit will fail verification.',
		'',
		csvBody,
	].join('\n');
}

async function recordAuditExport({
	admin,
	manifest,
	user,
	fileHash,
	manifestHash,
	signature,
	filters,
}: {
	admin: ReturnType<typeof createAdminClient>;
	manifest: AuditExportManifest;
	user: { id: string; email?: string | null };
	fileHash: string;
	manifestHash: string;
	signature: string;
	filters: Record<string, string>;
}) {
	const { error } = await admin.from('audit_exports').insert({
		id: manifest.exportId,
		organization_id: manifest.organizationId,
		user_id: user.id,
		user_email: user.email ?? null,
		format: manifest.format,
		filters,
		row_count: manifest.rowCount,
		generated_at: manifest.generatedAt,
		rows_hash: manifest.rowsHash,
		file_hash: fileHash,
		manifest_hash: manifestHash,
		signature,
	});

	if (error) {
		console.error('Failed to record audit export:', error);
		throw error;
	}
}

async function logAuditExport({
	manifest,
	fileHash,
	manifestHash,
	signature,
	user,
	request,
}: {
	manifest: AuditExportManifest;
	fileHash: string;
	manifestHash: string;
	signature: string;
	user: { id: string; email?: string | null };
	request: Request;
}) {
	await createAuditLog({
		action: 'audit.exported',
		entityType: 'audit_export',
		organizationId: manifest.organizationId,
		entityId: manifest.exportId,
		entityName: `${manifest.format.toUpperCase()} audit export`,
		userId: user.id,
		userEmail: user.email ?? null,
		details: {
			export_id: manifest.exportId,
			format: manifest.format,
			row_count: manifest.rowCount,
			rows_hash: manifest.rowsHash,
			file_hash: fileHash,
			manifest_hash: manifestHash,
			signature,
			outcome: 'tamper_evident_audit_export_created',
		},
		request,
	});
}

function getAuditCapabilities(hasPro: boolean) {
	return {
		advancedAudit: hasPro,
		csvExport: true,
		excelExport: hasPro,
		cqcFilters: hasPro,
		fullDetails: hasPro,
		maxRetentionDays: hasPro ? null : STARTER_RETENTION_DAYS,
	};
}

async function getAuditBilling(
	admin: ReturnType<typeof createAdminClient>,
	organizationId: string,
) {
	const { data } = await admin
		.from('organization_billing')
		.select('plan, status')
		.eq('organization_id', organizationId)
		.maybeSingle();

	const entitlements = getBillingEntitlements(data?.plan, data?.status);

	return {
		plan: entitlements.plan,
		status: entitlements.status,
		isPro: entitlements.advancedAudit,
	};
}

export async function POST(request: NextRequest) {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
	}

	const result = auditPostSchema.safeParse(await request.json().catch(() => null));
	if (!result.success) {
		return NextResponse.json(
			{ error: 'Invalid audit log request.' },
			{ status: 400 },
		);
	}

	const organization = await resolveOrganization(
		supabase,
		user.id,
		result.data.orgId,
		result.data.orgSlug,
	);

	if (!organization) {
		return NextResponse.json({ error: 'Organization not found.' }, { status: 404 });
	}

	await createAuditLog({
		action: result.data.action as AuditAction,
		entityType: result.data.entityType as EntityType,
		organizationId: organization.id,
		entityId: result.data.entityId,
		entityName: result.data.entityName,
		details: result.data.details,
		category: result.data.category as AuditCategory | undefined,
		severity: result.data.severity as AuditSeverity | undefined,
		source: result.data.source ?? 'dashboard',
		cqcKeyQuestion: result.data.cqcKeyQuestion as CqcKeyQuestion | undefined,
		userId: user.id,
		userEmail: user.email ?? null,
		request,
	});

	return NextResponse.json({ success: true });
}

async function resolveOrganization(
	supabase: Awaited<ReturnType<typeof createClient>>,
	userId: string,
	orgId?: string,
	orgSlug?: string,
) {
	let query = supabase
		.from('organizations')
		.select('id, name, slug, organization_memberships!inner(user_id, deleted_at)')
		.eq('organization_memberships.user_id', userId)
		.is('organization_memberships.deleted_at', null);

	if (orgId) {
		query = query.eq('id', orgId);
	} else if (orgSlug) {
		query = query.eq('slug', orgSlug);
	} else {
		return null;
	}

	const { data, error } = await query.maybeSingle();
	if (error || !data) return null;

	return {
		id: data.id as string,
		name: data.name as string,
		slug: data.slug as string,
	};
}

type ExportContext = {
	orgName: string;
	orgSlug: string;
	dateFrom: string | null;
	dateTo: string | null;
	generatedAt: Date;
	filters: Record<string, string>;
};

async function buildAuditExportWorkbook(
	logs: Record<string, unknown>[],
	context: ExportContext,
	verification?: {
		manifest: AuditExportManifest;
		manifestHash: string;
		signature: string;
	},
) {
	const workbook = new ExcelJS.Workbook();
	workbook.creator = 'CareComply';
	workbook.created = context.generatedAt;
	workbook.modified = context.generatedAt;

	buildOverviewSheet(workbook, logs, context);
	buildSummarySheet(workbook, logs);
	buildAuditLogsSheet(workbook, logs);
	if (verification) buildVerificationSheet(workbook, verification);

	await Promise.all(
		workbook.worksheets.map((sheet) =>
			sheet.protect(process.env.AUDIT_EXPORT_SIGNING_SECRET ?? randomUUID(), {
				selectLockedCells: true,
				selectUnlockedCells: true,
			}),
		),
	);

	return workbook.xlsx.writeBuffer();
}

function buildVerificationSheet(
	workbook: ExcelJS.Workbook,
	verification: {
		manifest: AuditExportManifest;
		manifestHash: string;
		signature: string;
	},
) {
	const sheet = workbook.addWorksheet('Verification', {
		views: [{ showGridLines: false }],
	});
	sheet.columns = [{ width: 28 }, { width: 90 }];
	sheet.addRow(['CareComply Tamper-Evident Export']);
	sheet.addRow(['Export ID', verification.manifest.exportId]);
	sheet.addRow(['Format', verification.manifest.format]);
	sheet.addRow(['Generated At', verification.manifest.generatedAt]);
	sheet.addRow(['Organization', verification.manifest.organizationSlug]);
	sheet.addRow(['Row Count', verification.manifest.rowCount]);
	sheet.addRow(['Rows Hash', verification.manifest.rowsHash]);
	sheet.addRow(['Manifest Hash', verification.manifestHash]);
	sheet.addRow(['Signature', verification.signature]);
	sheet.addRow(['Manifest JSON', encodeManifest(verification.manifest)]);
	sheet.addRow([
		'Verification',
		'Upload this file in CareComply using Verify export. If any byte has changed since generation, verification will fail.',
	]);
	styleTitleCell(sheet.getCell('A1'));
	sheet.getRow(1).height = 24;
	sheet.eachRow((row, rowNumber) => {
		row.eachCell((cell) => {
			cell.alignment = { vertical: 'middle', wrapText: true };
			cell.border = border('FFE5E7EB');
			if (rowNumber > 1 && cell.address.startsWith('A')) {
				styleLabelCell(cell);
			}
		});
	});
}

function buildOverviewSheet(
	workbook: ExcelJS.Workbook,
	logs: Record<string, unknown>[],
	context: ExportContext,
) {
	const sheet = workbook.addWorksheet('Overview', {
		views: [{ showGridLines: false }],
	});
	sheet.columns = [{ width: 28 }, { width: 60 }];

	sheet.mergeCells('A1:B1');
	sheet.getCell('A1').value = 'CareComply CQC Audit Export';
	styleTitleCell(sheet.getCell('A1'));

	const rows = [
		['Organization', context.orgName],
		['Generated At', formatExportDate(context.generatedAt.toISOString())],
		['Date From', context.dateFrom ? formatExportDate(context.dateFrom) : 'All'],
		['Date To', context.dateTo ? formatExportDate(context.dateTo) : 'All'],
		['Total Events', logs.length],
		['Organization Slug', context.orgSlug],
		['Filters', readableFilters(context.filters)],
	];

	rows.forEach((row) => sheet.addRow(row));
	sheet.addRow([]);
	sheet.addRow(['Report Guidance']);
	sheet.addRow([
		'Use the CQC Summary sheet for high-level evidence coverage. Use Audit Logs for the complete event trail.',
	]);

	sheet.eachRow((row, rowNumber) => {
		row.eachCell((cell) => {
			cell.alignment = { vertical: 'middle', wrapText: true };
			if (rowNumber > 1 && rowNumber <= rows.length + 1 && cell.address.startsWith('A')) {
				styleLabelCell(cell);
			}
		});
	});
	styleSectionRow(sheet.getRow(rows.length + 3));
}

function buildSummarySheet(workbook: ExcelJS.Workbook, logs: Record<string, unknown>[]) {
	const sheet = workbook.addWorksheet('CQC Summary', {
		views: [{ state: 'frozen', ySplit: 1 }],
	});
	sheet.columns = [
		{ header: 'Group', key: 'group', width: 24 },
		{ header: 'Value', key: 'value', width: 28 },
		{ header: 'Count', key: 'count', width: 12 },
	];
	styleHeaderRow(sheet.getRow(1));

	const groups = [
		['CQC Key Question', 'cqc_key_question'],
		['Category', 'category'],
		['Severity', 'severity'],
		['Action', 'action'],
		['Entity Type', 'entity_type'],
	] as const;

	groups.forEach(([label, key]) => {
		summaryRows(logs, key).forEach(([, value, count]) => {
			const row = sheet.addRow({
				group: label,
				value: labelValue(String(value)),
				count,
			});
			styleSummaryRow(row, key, String(value));
		});
	});
	sheet.autoFilter = 'A1:C1';
}

function buildAuditLogsSheet(
	workbook: ExcelJS.Workbook,
	logs: Record<string, unknown>[],
) {
	const sheet = workbook.addWorksheet('Audit Logs', {
		views: [{ state: 'frozen', ySplit: 1 }],
	});
	sheet.columns = [
		{ header: 'Created At', key: 'createdAt', width: 22 },
		{ header: 'User', key: 'user', width: 28 },
		{ header: 'Action', key: 'action', width: 28 },
		{ header: 'Entity Type', key: 'entityType', width: 18 },
		{ header: 'Entity Name', key: 'entityName', width: 30 },
		{ header: 'Category', key: 'category', width: 18 },
		{ header: 'Severity', key: 'severity', width: 14 },
		{ header: 'CQC Key Question', key: 'cqc', width: 18 },
		{ header: 'Source', key: 'source', width: 16 },
		{ header: 'IP Address', key: 'ipAddress', width: 18 },
		{ header: 'Details Summary', key: 'detailsSummary', width: 55 },
		{ header: 'Details JSON', key: 'detailsJson', width: 70 },
	];
	styleHeaderRow(sheet.getRow(1));

	logs.forEach((log, index) => {
		const row = sheet.addRow({
			createdAt: formatExportDate(stringValue(log.created_at)),
			user: stringValue(log.user_email) || 'System',
			action: labelValue(stringValue(log.action)),
			entityType: labelValue(stringValue(log.entity_type)),
			entityName: stringValue(log.entity_name),
			category: labelValue(stringValue(log.category)),
			severity: labelValue(stringValue(log.severity)),
			cqc: labelValue(stringValue(log.cqc_key_question)),
			source: labelValue(stringValue(log.source)),
			ipAddress: stringValue(log.ip_address),
			detailsSummary: summarizeDetails(log.details),
			detailsJson: JSON.stringify(log.details ?? {}, null, 2),
		});
		styleAuditRow(row, log, index);
	});

	sheet.autoFilter = 'A1:L1';
}

function summaryRows(logs: Record<string, unknown>[], key: string) {
	const counts = new Map<string, number>();
	logs.forEach((log) => {
		const value = stringValue(log[key]) || 'Unspecified';
		counts.set(value, (counts.get(value) ?? 0) + 1);
	});

	return Array.from(counts.entries()).map(([value, count]) => [key, value, count]);
}

function summarizeDetails(details: unknown) {
	if (!details || typeof details !== 'object') return '';
	return Object.entries(details as Record<string, unknown>)
		.filter(([key]) => !['user_agent'].includes(key))
		.slice(0, 8)
		.map(([key, value]) => `${labelValue(key)}: ${detailValue(value)}`)
		.join('\n');
}

function detailValue(value: unknown) {
	if (value == null) return '';
	if (typeof value === 'object') return JSON.stringify(value);
	return String(value);
}

function stringValue(value: unknown) {
	return typeof value === 'string' ? value : value == null ? '' : String(value);
}

function labelValue(value: string) {
	if (!value) return 'Unspecified';
	return value.replace(/_/g, ' ').replace(/^\w/, (char) => char.toUpperCase());
}

function formatExportDate(value: string) {
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return value;
	return new Intl.DateTimeFormat('en-GB', {
		year: 'numeric',
		month: 'short',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
	}).format(date);
}

function readableFilters(filters: Record<string, string>) {
	return Object.entries(filters)
		.filter(([, value]) => value && value !== 'all')
		.map(([key, value]) => `${labelValue(key)}: ${labelValue(value)}`)
		.join('\n') || 'None';
}

function buildAuditCsv(logs: Record<string, unknown>[], hasPro: boolean) {
	const headers = hasPro
		? [
				'Created At',
				'User',
				'Action',
				'Entity Type',
				'Entity Name',
				'Category',
				'Severity',
				'CQC Key Question',
				'Source',
				'IP Address',
				'Details Summary',
			]
		: [
				'Created At',
				'User',
				'Action',
				'Entity Type',
				'Entity Name',
				'Details Summary',
			];

	const rows = logs.map((log) => {
		const basic = [
			formatExportDate(stringValue(log.created_at)),
			stringValue(log.user_email) || 'System',
			labelValue(stringValue(log.action)),
			labelValue(stringValue(log.entity_type)),
			stringValue(log.entity_name),
			summarizeDetails(log.details),
		];

		if (!hasPro) return basic;

		return [
			basic[0],
			basic[1],
			basic[2],
			basic[3],
			basic[4],
			labelValue(stringValue(log.category)),
			labelValue(stringValue(log.severity)),
			labelValue(stringValue(log.cqc_key_question)),
			labelValue(stringValue(log.source)),
			stringValue(log.ip_address),
			basic[5],
		];
	});

	return [headers, ...rows]
		.map((row) => row.map(csvCell).join(','))
		.join('\n');
}

function csvCell(value: unknown) {
	const text = value == null ? '' : String(value);
	return `"${text.replaceAll('"', '""')}"`;
}

function styleTitleCell(cell: ExcelJS.Cell) {
	cell.font = { bold: true, size: 18, color: { argb: 'FFFFFFFF' } };
	cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF111827' } };
	cell.alignment = { vertical: 'middle', horizontal: 'center' };
	cell.border = border('FF111827');
}

function styleLabelCell(cell: ExcelJS.Cell) {
	cell.font = { bold: true, color: { argb: 'FF374151' } };
	cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
	cell.border = border('FFE5E7EB');
}

function styleSectionRow(row: ExcelJS.Row) {
	row.eachCell((cell) => {
		cell.font = { bold: true, color: { argb: 'FF111827' } };
		cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0F2FE' } };
		cell.border = border('FFBAE6FD');
	});
}

function styleHeaderRow(row: ExcelJS.Row) {
	row.eachCell((cell) => {
		cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
		cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2937' } };
		cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
		cell.border = border('FF111827');
	});
}

function styleSummaryRow(row: ExcelJS.Row, key: string, value: string) {
	row.eachCell((cell) => {
		cell.border = border('FFE5E7EB');
		cell.alignment = { vertical: 'middle', wrapText: true };
	});
	const color = semanticFill(key, value);
	if (color) {
		row.getCell(2).fill = {
			type: 'pattern',
			pattern: 'solid',
			fgColor: { argb: color },
		};
	}
}

function styleAuditRow(row: ExcelJS.Row, log: Record<string, unknown>, index: number) {
	const rowFill = index % 2 === 0 ? 'FFFFFFFF' : 'FFF9FAFB';
	row.eachCell((cell) => {
		cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowFill } };
		cell.border = border('FFE5E7EB');
		cell.alignment = { vertical: 'top', wrapText: true };
	});
	const severityFill = semanticFill('severity', stringValue(log.severity));
	if (severityFill) {
		row.getCell('G').fill = {
			type: 'pattern',
			pattern: 'solid',
			fgColor: { argb: severityFill },
		};
		row.getCell('G').font = { bold: true, color: { argb: 'FF111827' } };
	}
	const cqcFill = semanticFill('cqc_key_question', stringValue(log.cqc_key_question));
	if (cqcFill) {
		row.getCell('H').fill = {
			type: 'pattern',
			pattern: 'solid',
			fgColor: { argb: cqcFill },
		};
	}
}

function semanticFill(key: string, value: string) {
	if (key === 'severity') {
		if (value === 'critical') return 'FFFEE2E2';
		if (value === 'warning') return 'FFFEF3C7';
		if (value === 'info') return 'FFDBEAFE';
	}
	if (key === 'cqc_key_question') {
		if (value === 'safe') return 'FFD1FAE5';
		if (value === 'effective') return 'FFE0F2FE';
		if (value === 'caring') return 'FFFCE7F3';
		if (value === 'responsive') return 'FFEDE9FE';
		if (value === 'well_led') return 'FFE5E7EB';
	}
	if (key === 'category') {
		if (value === 'documents') return 'FFE0F2FE';
		if (value === 'staffing') return 'FFD1FAE5';
		if (value === 'onboarding') return 'FFEDE9FE';
		if (value === 'billing') return 'FFFEF3C7';
		if (value === 'governance') return 'FFF3F4F6';
	}
	return null;
}

function border(color: string): Partial<ExcelJS.Borders> {
	return {
		top: { style: 'thin', color: { argb: color } },
		left: { style: 'thin', color: { argb: color } },
		bottom: { style: 'thin', color: { argb: color } },
		right: { style: 'thin', color: { argb: color } },
	};
}

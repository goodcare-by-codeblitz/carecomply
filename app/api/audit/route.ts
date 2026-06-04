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
import { buildAuditExportWorkbook } from '@/lib/audit-export-workbook';
import { PERMISSIONS } from '@/lib/permissions';
import { createAdminClient } from '@/lib/supabase/admin';
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
	'training_record',
	'training_requirement',
] as const;

const STARTER_RETENTION_DAYS = 90;
const TENANT_HIDDEN_AUDIT_ACTIONS = ['reminder.worker_configuration_missing'];
const CQC_KEY_QUESTIONS = [
	'safe',
	'effective',
	'caring',
	'responsive',
	'well_led',
] as const;

type CqcCoverage = Record<(typeof CQC_KEY_QUESTIONS)[number], number>;

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
	const dateFrom = searchParams.get('dateFrom');
	const dateTo = searchParams.get('dateTo');
	pushIgnoredAuditFilterWarnings({ searchParams, hasPro, dateFrom, dateTo, warnings });

	let query = applyAuditFilters({
		query: admin
			.from('audit_logs')
			.select('*', { count: 'exact' })
			.order('created_at', { ascending: false }) as unknown as AuditQueryBuilder,
		organizationId: organization.id,
		searchParams,
		hasPro,
		dateFrom,
		dateTo,
	});
	if (!exportMode) {
		query = query.range((page - 1) * pageSize, page * pageSize - 1);
	}

	const [{ data, error, count }, cqcCoverage] = await Promise.all([
		query,
		getCqcCoverage({
			admin,
			organizationId: organization.id,
			searchParams,
			hasPro,
			dateFrom,
			dateTo,
		}),
	]);

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
		cqcCoverage,
		billing: {
			plan: billing.plan,
			status: billing.status,
			isPro: hasPro,
		},
		capabilities,
		warnings,
	});
}

function applyAuditFilters<Query extends AuditQueryBuilder>({
	query,
	organizationId,
	searchParams,
	hasPro,
	dateFrom,
	dateTo,
}: {
	query: Query;
	organizationId: string;
	searchParams: URLSearchParams;
	hasPro: boolean;
	dateFrom: string | null;
	dateTo: string | null;
}) {
	let filteredQuery = query
		.eq('organization_id', organizationId)
		.not('action', 'in', `(${TENANT_HIDDEN_AUDIT_ACTIONS.join(',')})`);
	const filterableColumns = hasPro
		? FILTERABLE_COLUMNS
		: (['entity_type'] as const);

	for (const column of filterableColumns) {
		const value = searchParams.get(column);
		if (value && value !== 'all') {
			filteredQuery = filteredQuery.eq(column, value);
		}
	}

	if (!hasPro) {
		filteredQuery = filteredQuery
			.in('entity_type', [...STARTER_ENTITY_TYPES])
			.gte(
				'created_at',
				new Date(
					Date.now() - STARTER_RETENTION_DAYS * 24 * 60 * 60 * 1000,
				).toISOString(),
			);
	} else {
		if (dateFrom) filteredQuery = filteredQuery.gte('created_at', dateFrom);
		if (dateTo) filteredQuery = filteredQuery.lte('created_at', dateTo);
	}

	return filteredQuery;
}

function pushIgnoredAuditFilterWarnings({
	searchParams,
	hasPro,
	dateFrom,
	dateTo,
	warnings,
}: {
	searchParams: URLSearchParams;
	hasPro: boolean;
	dateFrom: string | null;
	dateTo: string | null;
	warnings: string[];
}) {
	if (hasPro) return;

	for (const column of ['category', 'severity', 'cqc_key_question'] as const) {
		if (searchParams.get(column) && searchParams.get(column) !== 'all') {
			warnings.push(`${column} is available on Pro and was ignored.`);
		}
	}

	if (dateFrom || dateTo) {
		warnings.push('Date range filters are available on Pro and were ignored.');
	}
}

async function getCqcCoverage({
	admin,
	organizationId,
	searchParams,
	hasPro,
	dateFrom,
	dateTo,
}: {
	admin: ReturnType<typeof createAdminClient>;
	organizationId: string;
	searchParams: URLSearchParams;
	hasPro: boolean;
	dateFrom: string | null;
	dateTo: string | null;
}): Promise<CqcCoverage> {
	const entries = await Promise.all(
		CQC_KEY_QUESTIONS.map(async (key) => {
			const query = applyAuditFilters({
				query: admin
					.from('audit_logs')
					.select('id', {
						count: 'exact',
						head: true,
					}) as unknown as AuditQueryBuilder,
				organizationId,
				searchParams,
				hasPro,
				dateFrom,
				dateTo,
			}).eq('cqc_key_question', key);
			const { count, error } = await query;

			if (error) {
				console.error(`Failed to count ${key} audit coverage:`, error);
			}

			return [key, error ? 0 : count ?? 0] as const;
		}),
	);

	return Object.fromEntries(entries) as CqcCoverage;
}

type AuditQueryResult = {
	data: Record<string, unknown>[] | null;
	error: unknown;
	count: number | null;
};

type AuditQueryBuilder = PromiseLike<AuditQueryResult> & {
	eq: (column: string, value: string) => AuditQueryBuilder;
	not: (column: string, operator: string, value: string) => AuditQueryBuilder;
	in: (column: string, values: readonly string[]) => AuditQueryBuilder;
	gte: (column: string, value: string) => AuditQueryBuilder;
	lte: (column: string, value: string) => AuditQueryBuilder;
	range: (from: number, to: number) => AuditQueryBuilder;
};

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

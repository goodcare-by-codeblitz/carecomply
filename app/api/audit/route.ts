import { createAuditLog } from '@/lib/audit-server';
import {
	type AuditAction,
	type AuditCategory,
	type AuditSeverity,
	type CqcKeyQuestion,
	type EntityType,
} from '@/lib/audit';
import { PERMISSIONS } from '@/lib/permissions';
import { createAdminClient } from '@/lib/supabase/admin';
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

	const page = Math.max(1, Number(searchParams.get('page') ?? '1') || 1);
	const pageSize = Math.min(
		200,
		Math.max(1, Number(searchParams.get('pageSize') ?? '20') || 20),
	);
	const exportMode = searchParams.get('export') === 'csv';
	const admin = createAdminClient();
	let query = admin
		.from('audit_logs')
		.select('*', { count: 'exact' })
		.eq('organization_id', organization.id)
		.order('created_at', { ascending: false });

	for (const column of FILTERABLE_COLUMNS) {
		const value = searchParams.get(column);
		if (value && value !== 'all') {
			query = query.eq(column, value);
		}
	}

	const dateFrom = searchParams.get('dateFrom');
	const dateTo = searchParams.get('dateTo');
	if (dateFrom) query = query.gte('created_at', dateFrom);
	if (dateTo) query = query.lte('created_at', dateTo);

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

	if (exportMode) {
		const csv = buildAuditExportCsv(logs, {
			orgName: organization.name,
			dateFrom,
			dateTo,
		});

		return new NextResponse(csv, {
			headers: {
				'Content-Type': 'text/csv; charset=utf-8',
				'Content-Disposition': `attachment; filename="carecomply-cqc-audit-${organization.slug}.csv"`,
			},
		});
	}

	return NextResponse.json({
		logs,
		count: count ?? 0,
		totalPages: Math.max(1, Math.ceil((count ?? 0) / pageSize)),
	});
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

function buildAuditExportCsv(
	logs: Record<string, unknown>[],
	context: { orgName: string; dateFrom: string | null; dateTo: string | null },
) {
	const rows = [
		['CareComply CQC Audit Export'],
		['Organization', context.orgName],
		['Date From', context.dateFrom ?? 'All'],
		['Date To', context.dateTo ?? 'All'],
		[],
		['CQC Summary'],
		['Group', 'Value', 'Count'],
		...summaryRows(logs, 'cqc_key_question'),
		...summaryRows(logs, 'category'),
		...summaryRows(logs, 'severity'),
		[],
		['Audit Logs'],
		[
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
			'Details',
		],
		...logs.map((log) => [
			stringValue(log.created_at),
			stringValue(log.user_email) || 'System',
			stringValue(log.action),
			stringValue(log.entity_type),
			stringValue(log.entity_name),
			stringValue(log.category),
			stringValue(log.severity),
			stringValue(log.cqc_key_question),
			stringValue(log.source),
			stringValue(log.ip_address),
			JSON.stringify(log.details ?? {}),
		]),
	];

	return rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
}

function summaryRows(logs: Record<string, unknown>[], key: string) {
	const counts = new Map<string, number>();
	logs.forEach((log) => {
		const value = stringValue(log[key]) || 'Unspecified';
		counts.set(value, (counts.get(value) ?? 0) + 1);
	});

	return Array.from(counts.entries()).map(([value, count]) => [key, value, count]);
}

function stringValue(value: unknown) {
	return typeof value === 'string' ? value : value == null ? '' : String(value);
}

function csvCell(value: unknown) {
	const text = stringValue(value).replace(/"/g, '""');
	return `"${text}"`;
}

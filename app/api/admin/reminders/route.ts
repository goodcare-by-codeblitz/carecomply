import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { getPlatformAccessForUser } from '@/lib/platform-admin';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const postSchema = z.discriminatedUnion('action', [
	z.object({
		action: z.literal('document_eligibility'),
		documentId: z.string().uuid(),
		runDate: z.string().optional(),
	}),
	z.object({
		action: z.literal('enqueue_dry_run'),
		orgId: z.string().uuid(),
		runDate: z.string().optional(),
	}),
	z.object({
		action: z.literal('enqueue_now'),
		runDate: z.string().optional(),
	}),
	z.object({
		action: z.literal('process_batch'),
		batchSize: z.number().int().min(1).max(100).default(25),
	}),
	z.object({
		action: z.literal('run_pipeline_once'),
		runDate: z.string().optional(),
		batchSize: z.number().int().min(1).max(100).default(25),
	}),
	z.object({
		action: z.literal('save_worker_settings'),
		workerUrl: z.string().url(),
		workerSecret: z.string().trim().min(1),
	}),
]);

type ReminderRule = {
	id: string;
	name: string;
	document_type_id: string | null;
	trigger_type: 'days_before_expiry' | 'days_after_expiry';
	trigger_days: number | null;
	recipient_type: 'carer' | 'management';
	min_plan: 'starter' | 'pro';
	is_active: boolean;
};

type DocumentRow = {
	id: string;
	status: string;
	expiry_date: string | null;
	superseded_by: string | null;
	document_type_id: string;
	file_name?: string | null;
	carers:
		| {
				id: string;
				full_name: string;
				email: string;
				status: string | null;
				organization_id: string;
		  }
		| {
				id: string;
				full_name: string;
				email: string;
				status: string | null;
				organization_id: string;
		  }[]
		| null;
	document_types?: { name: string } | { name: string }[] | null;
};

type BillingRow = {
	plan: string | null;
	status: string | null;
};

function normalizeRelation<T>(value: T | T[] | null | undefined) {
	return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

async function requirePlatformAdmin() {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		return { ok: false as const, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
	}

	const admin = createAdminClient();
	const platformAccess = await getPlatformAccessForUser(admin, user.id);

	if (!platformAccess.canAccessAdmin) {
		return {
			ok: false as const,
			response: NextResponse.json(
				{ error: 'Platform admin access is required.' },
				{ status: 403 },
			),
		};
	}

	return { ok: true as const, user, admin, platformAccess };
}

export async function GET(request: Request) {
	const auth = await requirePlatformAdmin();
	if (!auth.ok) return auth.response;

	const { searchParams } = new URL(request.url);
	const requestedOrgId = searchParams.get('orgId');
	const admin = auth.admin;

	const { data: organizations } = await admin
		.from('organizations')
		.select('id, name, slug')
		.order('name');
	const orgId = requestedOrgId || organizations?.[0]?.id || null;

	if (!orgId) {
		return NextResponse.json({ organizations: [], selectedOrgId: null });
	}

	const now = new Date().toISOString();
	const [
		{ data: diagnostics, error: diagnosticsError },
		{ data: workerUrlSetting },
		queued,
		processing,
		sent,
		failed,
		skipped,
		{ data: recentJobs },
		{ data: recentLogs },
		{ data: reminders },
	] = await Promise.all([
		admin.rpc('reminder_delivery_diagnostics', { p_org_id: orgId }),
		admin
			.from('platform_settings')
			.select('value')
			.eq('key', 'reminder_worker_url')
			.maybeSingle(),
		countJobs(admin, orgId, 'queued'),
		countJobs(admin, orgId, 'processing'),
		countJobs(admin, orgId, 'sent'),
		countJobs(admin, orgId, 'failed'),
		countJobs(admin, orgId, 'skipped'),
		admin
			.from('reminder_jobs')
			.select(
				'id, status, due_on, attempts, max_attempts, recipient_type, recipient_email, last_error, created_at, next_attempt_at, processed_at, document_id, carer_id',
			)
			.eq('organization_id', orgId)
			.order('created_at', { ascending: false })
			.limit(50),
		admin
			.from('reminder_logs')
			.select(
				'id, status, recipient_type, recipient_email, error_message, provider_message_id, sent_at, document_id, carer_id, carers!inner(organization_id)',
			)
			.eq('carers.organization_id', orgId)
			.order('sent_at', { ascending: false })
			.limit(50),
		admin
			.from('reminders')
			.select(
				'id, name, trigger_type, trigger_days, recipient_type, min_plan, is_active, document_type_id, document_types(name)',
			)
			.eq('organization_id', orgId)
			.order('is_system', { ascending: false })
			.order('trigger_days', { ascending: false }),
	]);

	return NextResponse.json(
		{
			organizations: organizations ?? [],
			selectedOrgId: orgId,
			configuration: {
				resendApiKeyConfigured: Boolean(process.env.RESEND_API_KEY),
				resendFromEmailConfigured: Boolean(process.env.RESEND_FROM_EMAIL),
				workerSecretConfigured: Boolean(process.env.REMINDER_WORKER_SECRET),
				appUrlConfigured: Boolean(process.env.NEXT_PUBLIC_APP_URL),
				expectedWorkerUrl: buildExpectedWorkerUrl(),
				localWorkerUrl: buildLocalWorkerUrl(),
				workerUrl: workerUrlSetting?.value ?? null,
				database: diagnostics ?? null,
				databaseWarning: diagnosticsError?.message ?? null,
			},
			counts: {
				queued: queued.count ?? 0,
				processing: processing.count ?? 0,
				sent: sent.count ?? 0,
				failed: failed.count ?? 0,
				skipped: skipped.count ?? 0,
				dueQueued: await countDueQueuedJobs(admin, orgId, now),
			},
			recentJobs: recentJobs ?? [],
			recentLogs: recentLogs ?? [],
			reminders: reminders ?? [],
		},
		{ headers: { 'Cache-Control': 'no-store' } },
	);
}

export async function POST(request: Request) {
	const auth = await requirePlatformAdmin();
	if (!auth.ok) return auth.response;

	const parsed = postSchema.safeParse(await request.json().catch(() => null));
	if (!parsed.success) {
		return NextResponse.json(
			{ error: 'A valid reminder admin action is required.' },
			{ status: 400 },
		);
	}

	if (parsed.data.action === 'process_batch') {
		return processWorkerBatch(parsed.data.batchSize);
	}

	if (parsed.data.action === 'enqueue_now') {
		const result = await enqueueReminderJobs(
			auth.admin,
			normalizeRunDate(parsed.data.runDate),
		);
		return NextResponse.json(result, { status: result.ok ? 200 : 500 });
	}

	if (parsed.data.action === 'run_pipeline_once') {
		const runDate = normalizeRunDate(parsed.data.runDate);
		const enqueueResult = await enqueueReminderJobs(auth.admin, runDate);
		if (!enqueueResult.ok) {
			return NextResponse.json(enqueueResult, { status: 500 });
		}
		const workerResult = await callWorkerBatch(parsed.data.batchSize);
		return NextResponse.json(
			{
				ok: workerResult.ok,
				runDate,
				insertedCount: enqueueResult.insertedCount,
				workerStatus: workerResult.status,
				workerResponse: workerResult.payload,
			},
			{ status: workerResult.ok ? 200 : 502 },
		);
	}

	if (parsed.data.action === 'save_worker_settings') {
		const saved = await saveWorkerSettings(
			auth.admin,
			auth.user.id,
			parsed.data.workerUrl,
			parsed.data.workerSecret,
		);
		return NextResponse.json(saved, { status: saved.ok ? 200 : 500 });
	}

	if (parsed.data.action === 'document_eligibility') {
		const result = await getDocumentEligibility(
			auth.admin,
			parsed.data.documentId,
			normalizeRunDate(parsed.data.runDate),
		);
		return NextResponse.json(result);
	}

	const preview = await getDryRunPreview(
		auth.admin,
		parsed.data.orgId,
		normalizeRunDate(parsed.data.runDate),
	);
	return NextResponse.json(preview);
}

async function saveWorkerSettings(
	admin: ReturnType<typeof createAdminClient>,
	userId: string,
	workerUrl: string,
	workerSecret: string,
) {
	const timestamp = new Date().toISOString();
	const { error } = await admin.from('platform_settings').upsert(
		[
			{
				key: 'reminder_worker_url',
				value: workerUrl,
				updated_by: userId,
				updated_at: timestamp,
			},
			{
				key: 'reminder_worker_secret',
				value: workerSecret,
				updated_by: userId,
				updated_at: timestamp,
			},
		],
		{ onConflict: 'key' },
	);

	if (error) {
		return { ok: false, error: error.message };
	}

	return { ok: true };
}

async function countJobs(
	admin: ReturnType<typeof createAdminClient>,
	orgId: string,
	status: string,
) {
	return admin
		.from('reminder_jobs')
		.select('id', { count: 'exact', head: true })
		.eq('organization_id', orgId)
		.eq('status', status);
}

async function countDueQueuedJobs(
	admin: ReturnType<typeof createAdminClient>,
	orgId: string,
	now: string,
) {
	const { count } = await admin
		.from('reminder_jobs')
		.select('id', { count: 'exact', head: true })
		.eq('organization_id', orgId)
		.eq('status', 'queued')
		.lte('next_attempt_at', now);
	return count ?? 0;
}

async function getDocumentEligibility(
	admin: ReturnType<typeof createAdminClient>,
	documentId: string,
	runDate: string,
) {
	const { data, error } = await admin
		.from('documents')
		.select(
			'id, file_name, status, expiry_date, superseded_by, document_type_id, carers!inner(id, full_name, email, status, organization_id), document_types(name)',
		)
		.eq('id', documentId)
		.maybeSingle();

	if (error || !data) {
		return { ok: false, error: 'Document not found.' };
	}

	const document = data as DocumentRow;
	const carer = normalizeRelation(document.carers);
	if (!carer) return { ok: false, error: 'Document is not linked to a carer.' };

	const { data: billing } = await admin
		.from('organization_billing')
		.select('plan, status')
		.eq('organization_id', carer.organization_id)
		.maybeSingle();
	const { data: reminders } = await admin
		.from('reminders')
		.select(
			'id, name, document_type_id, trigger_type, trigger_days, recipient_type, min_plan, is_active',
		)
		.eq('organization_id', carer.organization_id);

	const evaluation = evaluateDocument(document, billing as BillingRow | null, (reminders ?? []) as ReminderRule[], runDate);
	return {
		ok: true,
		runDate,
		document,
		billing,
		...evaluation,
	};
}

async function enqueueReminderJobs(
	admin: ReturnType<typeof createAdminClient>,
	runDate: string,
) {
	const { data, error } = await admin.rpc('enqueue_document_expiry_reminders', {
		p_run_date: runDate,
	});

	if (error) {
		return {
			ok: false,
			runDate,
			insertedCount: 0,
			error: error.message,
		};
	}

	return {
		ok: true,
		runDate,
		insertedCount: typeof data === 'number' ? data : Number(data ?? 0),
	};
}

async function getDryRunPreview(
	admin: ReturnType<typeof createAdminClient>,
	orgId: string,
	runDate: string,
) {
	const [{ data: billing }, { data: reminders }, { data: documents }] =
		await Promise.all([
			admin
				.from('organization_billing')
				.select('plan, status')
				.eq('organization_id', orgId)
				.maybeSingle(),
			admin
				.from('reminders')
				.select(
					'id, name, document_type_id, trigger_type, trigger_days, recipient_type, min_plan, is_active',
				)
				.eq('organization_id', orgId),
			admin
				.from('documents')
				.select(
					'id, file_name, status, expiry_date, superseded_by, document_type_id, carers!inner(id, full_name, email, status, organization_id), document_types(name)',
				)
				.eq('carers.organization_id', orgId)
				.not('expiry_date', 'is', null)
				.order('expiry_date', { ascending: true })
				.limit(250),
		]);

	const rows = ((documents ?? []) as DocumentRow[])
		.map((document) => ({
			document,
			...evaluateDocument(
				document,
				billing as BillingRow | null,
				(reminders ?? []) as ReminderRule[],
				runDate,
			),
		}))
		.filter((row) => row.matchingReminders.length > 0 || row.blockers.length > 0)
		.slice(0, 100);

	return {
		ok: true,
		runDate,
		billing,
		rows,
		wouldQueueCount: rows.reduce(
			(total, row) => total + row.matchingReminders.length,
			0,
		),
	};
}

function evaluateDocument(
	document: DocumentRow,
	billing: BillingRow | null,
	reminders: ReminderRule[],
	runDate: string,
) {
	const carer = normalizeRelation(document.carers);
	const blockers: string[] = [];
	if (document.status !== 'approved') blockers.push('Document is not approved.');
	if (document.superseded_by) blockers.push('Document has been replaced.');
	if (!document.expiry_date) blockers.push('Document has no expiry date.');
	if (carer?.status !== 'active') blockers.push('Carer is not active.');

	const matchingReminders =
		blockers.length > 0
			? []
			: reminders.filter((reminder) =>
					reminderMatchesDocument(reminder, document, billing, runDate),
				);

	const dueOnOtherDates =
		blockers.length > 0
			? []
			: reminders
					.filter((reminder) =>
						reminder.document_type_id === null ||
						reminder.document_type_id === document.document_type_id,
					)
					.map((reminder) => ({
						id: reminder.id,
						name: reminder.name,
						recipientType: reminder.recipient_type,
						dueOn: calculateDueDate(document.expiry_date, reminder),
						minPlan: reminder.min_plan,
						active: reminder.is_active,
					}));

	const reason =
		blockers[0] ??
		(matchingReminders.length > 0
			? 'Document is due for the listed reminder rule(s).'
			: 'Document is not due for any active reminder rule on this run date.');

	return {
		eligible: matchingReminders.length > 0,
		reason,
		blockers,
		matchingReminders,
		dueOnOtherDates,
	};
}

function reminderMatchesDocument(
	reminder: ReminderRule,
	document: DocumentRow,
	billing: BillingRow | null,
	runDate: string,
) {
	if (!reminder.is_active || !document.expiry_date) return false;
	if (
		reminder.document_type_id &&
		reminder.document_type_id !== document.document_type_id
	) {
		return false;
	}
	if (
		reminder.min_plan === 'pro' &&
		!(
			billing?.plan === 'pro' &&
			['active', 'trialing'].includes(billing.status ?? '')
		)
	) {
		return false;
	}
	return calculateDueDate(document.expiry_date, reminder) === runDate;
}

function calculateDueDate(expiryDate: string | null, reminder: ReminderRule) {
	if (!expiryDate) return null;
	const date = new Date(`${expiryDate}T00:00:00.000Z`);
	const days = reminder.trigger_days ?? 0;
	if (reminder.trigger_type === 'days_before_expiry') {
		date.setUTCDate(date.getUTCDate() - days);
	} else {
		date.setUTCDate(date.getUTCDate() + days);
	}
	return date.toISOString().slice(0, 10);
}

async function processWorkerBatch(batchSize: number) {
	const result = await callWorkerBatch(batchSize);
	return NextResponse.json(
		{ ok: result.ok, workerStatus: result.status, workerResponse: result.payload },
		{ status: result.ok ? 200 : 502 },
	);
}

async function callWorkerBatch(batchSize: number) {
	const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, '');
	const secret = process.env.REMINDER_WORKER_SECRET;
	if (!appUrl || !secret) {
		return {
			ok: false,
			status: 500,
			payload: {
				error:
					'NEXT_PUBLIC_APP_URL and REMINDER_WORKER_SECRET are required to process a batch from the admin dashboard.',
			},
		};
	}

	const response = await fetch(`${appUrl}/api/reminders/worker`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${secret}`,
		},
		body: JSON.stringify({ batchSize, source: 'admin_reminder_ops' }),
		cache: 'no-store',
	});
	const payload = await response.json().catch(() => null);
	return {
		ok: response.ok,
		status: response.status,
		payload,
	};
}

function normalizeRunDate(value?: string) {
	if (!value || Number.isNaN(Date.parse(value))) {
		return new Date().toISOString().slice(0, 10);
	}
	return value.slice(0, 10);
}

function buildExpectedWorkerUrl() {
	const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, '');
	return appUrl
		? `${appUrl}/api/reminders/worker`
		: 'https://<your-domain>/api/reminders/worker';
}

function buildLocalWorkerUrl() {
	return 'http://host.docker.internal:3000/api/reminders/worker';
}

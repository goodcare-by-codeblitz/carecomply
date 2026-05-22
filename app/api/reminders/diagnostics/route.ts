import { PERMISSIONS } from '@/lib/permissions';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
	const { searchParams } = new URL(request.url);
	const orgId = searchParams.get('orgId');

	if (!orgId) {
		return NextResponse.json(
			{ error: 'An organization id is required.' },
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

	const [{ data: canViewAudit }, { data: canViewAutomations }] =
		await Promise.all([
			supabase.rpc('has_org_permission', {
				p_org_id: orgId,
				p_permission_code: PERMISSIONS.AUDIT_VIEW,
			}),
			supabase.rpc('has_org_permission', {
				p_org_id: orgId,
				p_permission_code: PERMISSIONS.AUTOMATIONS_VIEW,
			}),
		]);

	if (!canViewAudit && !canViewAutomations) {
		return NextResponse.json(
			{ error: 'You do not have permission to view reminder diagnostics.' },
			{ status: 403 },
		);
	}

	const admin = createAdminClient();
	const now = new Date().toISOString();

	const [
		{ data: dbDiagnostics, error: dbDiagnosticsError },
		{ count: dueJobs },
		{ count: failedJobs },
		{ count: skippedJobs },
		{ data: recentJobs },
		{ data: recentLogs },
	] = await Promise.all([
		admin.rpc('reminder_delivery_diagnostics', { p_org_id: orgId }),
		admin
			.from('reminder_jobs')
			.select('id', { count: 'exact', head: true })
			.eq('organization_id', orgId)
			.eq('status', 'queued')
			.lte('next_attempt_at', now),
		admin
			.from('reminder_jobs')
			.select('id', { count: 'exact', head: true })
			.eq('organization_id', orgId)
			.eq('status', 'failed'),
		admin
			.from('reminder_jobs')
			.select('id', { count: 'exact', head: true })
			.eq('organization_id', orgId)
			.eq('status', 'skipped'),
		admin
			.from('reminder_jobs')
			.select(
				'id, status, due_on, attempts, max_attempts, last_error, next_attempt_at, processed_at, created_at, recipient_type, document_id, carer_id',
			)
			.eq('organization_id', orgId)
			.order('created_at', { ascending: false })
			.limit(20),
		admin
			.from('reminder_logs')
			.select(
				'id, status, recipient_type, recipient_email, error_message, sent_at, document_id, carer_id, carers!inner(organization_id)',
			)
			.eq('carers.organization_id', orgId)
			.order('sent_at', { ascending: false })
			.limit(20),
	]);
	const databaseDiagnostics = normalizeDatabaseDiagnostics(dbDiagnostics);
	const expectedWorkerUrl = buildExpectedWorkerUrl();
	const missingDatabaseSettings = [
		databaseDiagnostics.workerUrlConfigured ? null : 'reminder_worker_url',
		databaseDiagnostics.workerSecretConfigured
			? null
			: 'reminder_worker_secret',
	].filter((setting): setting is string => Boolean(setting));

	return NextResponse.json(
		{
			ok: true,
			configuration: {
				resendApiKeyConfigured: Boolean(process.env.RESEND_API_KEY),
				resendFromEmailConfigured: Boolean(process.env.RESEND_FROM_EMAIL),
				workerSecretConfigured: Boolean(process.env.REMINDER_WORKER_SECRET),
				appUrlConfigured: Boolean(process.env.NEXT_PUBLIC_APP_URL),
				expectedWorkerUrl,
				expectedWorkerUrlWarning: process.env.NEXT_PUBLIC_APP_URL
					? null
					: 'NEXT_PUBLIC_APP_URL is missing, so the expected production worker URL cannot be inferred.',
				missingDatabaseSettings,
				setupMessage:
					'Platform admins can save reminder worker URL and secret from /admin/reminders. ALTER DATABASE is no longer required.',
				expectedLocalWorkerUrl: 'http://host.docker.internal:3000/api/reminders/worker',
				database: databaseDiagnostics.raw,
				databaseWarning: dbDiagnosticsError?.message ?? null,
			},
			counts: {
				dueJobs: dueJobs ?? 0,
				failedJobs: failedJobs ?? 0,
				skippedJobs: skippedJobs ?? 0,
			},
			recentJobs: recentJobs ?? [],
			recentLogs: recentLogs ?? [],
			starterReminderSchedule: {
				daysBeforeExpiry: [30, 7, 0],
				note:
					'Starter fixed reminders fire 30 days before expiry, 7 days before expiry, and on expiry day. A 15 or 14 day reminder requires a Pro custom automation.',
			},
		},
		{ headers: { 'Cache-Control': 'no-store' } },
	);
}

type DatabaseDiagnostics = {
	workerUrlConfigured: boolean;
	workerSecretConfigured: boolean;
	raw: unknown;
};

function normalizeDatabaseDiagnostics(value: unknown): DatabaseDiagnostics {
	if (!value || typeof value !== 'object') {
		return {
			workerUrlConfigured: false,
			workerSecretConfigured: false,
			raw: value ?? null,
		};
	}

	const diagnostics = value as Record<string, unknown>;
	return {
		workerUrlConfigured: diagnostics.worker_url_configured === true,
		workerSecretConfigured: diagnostics.worker_secret_configured === true,
		raw: value,
	};
}

function buildExpectedWorkerUrl() {
	const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, '');
	return appUrl
		? `${appUrl}/api/reminders/worker`
		: 'https://<your-domain>/api/reminders/worker';
}

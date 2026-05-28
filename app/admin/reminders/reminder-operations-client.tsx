'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import {
	Activity,
	AlertTriangle,
	CheckCircle,
	Mail,
	Play,
	RefreshCw,
	Search,
	XCircle,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

type Organization = { id: string; name: string; slug: string };
type OpsData = {
	organizations: Organization[];
	selectedOrgId: string | null;
	configuration: {
		resendApiKeyConfigured: boolean;
		resendFromEmailConfigured: boolean;
		workerSecretConfigured: boolean;
		appUrlConfigured: boolean;
		expectedWorkerUrl: string;
		localWorkerUrl: string;
		workerUrl: string | null;
		database: Record<string, unknown> | null;
		databaseWarning: string | null;
	};
	counts: Record<string, number>;
	recentJobs: ReminderJob[];
	recentLogs: ReminderLog[];
	reminders: ReminderRule[];
};

type ReminderJob = {
	id: string;
	status: string;
	due_on: string;
	attempts: number;
	max_attempts: number;
	recipient_type: string;
	recipient_email: string | null;
	last_error: string | null;
	created_at: string;
	next_attempt_at: string;
	processed_at: string | null;
	document_id: string | null;
	carer_id: string;
};

type ReminderLog = {
	id: string;
	status: string;
	recipient_type: string;
	recipient_email: string | null;
	error_message: string | null;
	provider_message_id: string | null;
	sent_at: string;
	document_id: string | null;
	carer_id: string;
};

type ReminderRule = {
	id: string;
	name: string;
	trigger_type: string;
	trigger_days: number | null;
	recipient_type: string;
	min_plan: string;
	is_active: boolean;
	document_type_id: string | null;
	document_types?: { name: string } | { name: string }[] | null;
};

type EligibilityResult = {
	ok: boolean;
	error?: string;
	runDate?: string;
	eligible?: boolean;
	reason?: string;
	blockers?: string[];
	matchingReminders?: ReminderRule[];
	dueOnOtherDates?: Array<{
		id: string;
		name: string;
		dueOn: string | null;
		recipientType: string;
		minPlan: string;
		active: boolean;
	}>;
};

type DryRunResult = {
	ok: boolean;
	runDate?: string;
	wouldQueueCount?: number;
	rows?: Array<{
		document: {
			id: string;
			file_name?: string | null;
			expiry_date: string | null;
			status: string;
			carers?: { full_name: string; status: string | null } | { full_name: string; status: string | null }[] | null;
			document_types?: { name: string } | { name: string }[] | null;
		};
		eligible: boolean;
		reason: string;
		blockers: string[];
		matchingReminders: ReminderRule[];
	}>;
};

type EnqueueResult = {
	ok: boolean;
	runDate: string;
	insertedCount: number;
	error?: string;
};

type WorkerActionResult = {
	ok?: boolean;
	workerStatus?: number;
	workerResponse?: unknown;
};

type PipelineResult = EnqueueResult & WorkerActionResult;

type SaveWorkerSettingsResult = {
	ok: boolean;
	error?: string;
};

function jobStatusCls(status: string) {
	if (status === 'sent' || status === 'processed') return 'bg-ok-50 text-ok';
	if (status === 'failed') return 'bg-danger-50 text-danger';
	if (status === 'processing') return 'bg-brand-50 text-brand-700';
	return 'bg-warn-50 text-warn';
}

export function ReminderOperationsClient() {
	const [data, setData] = useState<OpsData | null>(null);
	const [orgId, setOrgId] = useState<string>('');
	const [loading, setLoading] = useState(true);
	const [documentId, setDocumentId] = useState('');
	const [runDate, setRunDate] = useState(today());
	const [eligibility, setEligibility] = useState<EligibilityResult | null>(null);
	const [dryRun, setDryRun] = useState<DryRunResult | null>(null);
	const [operationResult, setOperationResult] = useState<
		EnqueueResult | WorkerActionResult | PipelineResult | null
	>(null);
	const [workerUrl, setWorkerUrl] = useState('');
	const [workerSecret, setWorkerSecret] = useState('');
	const [actionLoading, setActionLoading] = useState(false);

	const selectedOrg = useMemo(
		() => data?.organizations.find((org) => org.id === data.selectedOrgId),
		[data],
	);
	const database = data?.configuration.database ?? {};
	const cronJobs = Array.isArray(database.cron_jobs) ? database.cron_jobs : [];
	const cronRuns = Array.isArray(database.cron_runs) ? database.cron_runs : [];
	const needsDatabaseSetup =
		database.worker_url_configured !== true ||
		database.worker_secret_configured !== true;
	const dryRunHasMatches = (dryRun?.wouldQueueCount ?? 0) > 0;
	const hasRecentJobs = (data?.recentJobs.length ?? 0) > 0;

	const loadData = useCallback(async (nextOrgId?: string) => {
		setLoading(true);
		try {
			const params = new URLSearchParams();
			if (nextOrgId) params.set('orgId', nextOrgId);
			const response = await fetch(`/api/admin/reminders?${params}`, { cache: 'no-store' });
			const payload = (await response.json()) as OpsData & { error?: string };
			if (!response.ok) throw new Error(payload.error || 'Diagnostics failed');
			setData(payload);
			if (!orgId && payload.selectedOrgId) setOrgId(payload.selectedOrgId);
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Diagnostics failed');
		} finally {
			setLoading(false);
		}
	}, [orgId]);

	useEffect(() => { void loadData(orgId || undefined); }, [loadData, orgId]);

	useEffect(() => {
		if (!data) return;
		setWorkerUrl(
			data.configuration.workerUrl ||
			String(database.worker_url ?? '') ||
			data.configuration.localWorkerUrl,
		);
	}, [data, database.worker_url]);

	async function checkDocument() {
		if (!documentId) { toast.error('Enter a document id'); return; }
		setActionLoading(true);
		try {
			const payload = await adminAction<EligibilityResult>({ action: 'document_eligibility', documentId, runDate });
			setEligibility(payload);
		} finally { setActionLoading(false); }
	}

	async function runDryPreview() {
		if (!data?.selectedOrgId) return;
		setActionLoading(true);
		try {
			const payload = await adminAction<DryRunResult>({ action: 'enqueue_dry_run', orgId: data.selectedOrgId, runDate });
			setDryRun(payload);
			setOperationResult(null);
		} finally { setActionLoading(false); }
	}

	async function enqueueNow() {
		setActionLoading(true);
		try {
			const payload = await adminAction<EnqueueResult>({ action: 'enqueue_now', runDate });
			setOperationResult(payload);
			toast.success(`Enqueued ${payload.insertedCount} reminder job(s) for ${payload.runDate}.`);
			await loadData(data?.selectedOrgId ?? undefined);
		} finally { setActionLoading(false); }
	}

	async function saveWorkerSettings() {
		if (!workerUrl.trim()) { toast.error('Enter a worker URL'); return; }
		if (!workerSecret.trim()) { toast.error('Paste the worker secret from REMINDER_WORKER_SECRET'); return; }
		setActionLoading(true);
		try {
			await adminAction<SaveWorkerSettingsResult>({ action: 'save_worker_settings', workerUrl: workerUrl.trim(), workerSecret: workerSecret.trim() });
			setWorkerSecret('');
			toast.success('Worker settings saved');
			await loadData(data?.selectedOrgId ?? undefined);
		} finally { setActionLoading(false); }
	}

	async function processBatch() {
		setActionLoading(true);
		try {
			const payload = await adminAction<WorkerActionResult>({ action: 'process_batch', batchSize: 25 });
			setOperationResult(payload);
			toast.success(`Worker response: ${JSON.stringify(payload.workerResponse ?? payload)}`);
			await loadData(data?.selectedOrgId ?? undefined);
		} finally { setActionLoading(false); }
	}

	async function runPipelineOnce() {
		setActionLoading(true);
		try {
			const payload = await adminAction<PipelineResult>({ action: 'run_pipeline_once', runDate, batchSize: 25 });
			setOperationResult(payload);
			toast.success(`Enqueued ${payload.insertedCount} job(s); worker response: ${JSON.stringify(payload.workerResponse ?? payload)}`);
			await loadData(data?.selectedOrgId ?? undefined);
		} finally { setActionLoading(false); }
	}

	return (
		<div className='min-h-full'>
			{/* Page header */}
			<div className='border-b border-line bg-white px-6 py-5 lg:px-8'>
				<div className='mx-auto flex max-w-7xl items-center justify-between gap-4'>
					<div>
						<h1 className='text-[22px] font-semibold tracking-tight text-ink'>
							Reminder Operations
						</h1>
						<p className='mt-0.5 text-[13px] text-slate-500'>
							Platform diagnostics for cron, queues, worker delivery, and email logs.
						</p>
					</div>
					<div className='flex items-center gap-3'>
						<Select value={orgId} onValueChange={setOrgId}>
							<SelectTrigger className='w-[240px]'>
								<SelectValue placeholder='Select organisation' />
							</SelectTrigger>
							<SelectContent>
								{data?.organizations.map((org) => (
									<SelectItem key={org.id} value={org.id}>
										{org.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						<Button
							variant='outline'
							onClick={() => loadData(data?.selectedOrgId ?? undefined)}
							disabled={loading}>
							<RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
							{loading ? 'Loading...' : 'Refresh'}
						</Button>
					</div>
				</div>
			</div>

			<div className='mx-auto max-w-7xl space-y-6 px-6 py-6 lg:px-8'>

				{/* Configuration */}
				<div className='overflow-hidden rounded-xl border border-line bg-white shadow-card'>
					<div className='border-b border-line bg-surface-page px-5 py-3.5'>
						<p className='text-[14px] font-semibold text-ink'>Configuration</p>
						<p className='mt-0.5 text-[12.5px] text-slate-500'>
							{selectedOrg ? `Current organisation: ${selectedOrg.name}` : 'Loading organisations…'}
						</p>
					</div>
					<div className='p-5 space-y-5'>
						<div className='grid gap-3 md:grid-cols-2 lg:grid-cols-4'>
							<StatusTile label='Worker URL' ok={database.worker_url_configured === true} detail={String(database.worker_url ?? data?.configuration.expectedWorkerUrl ?? '')} />
							<StatusTile label='DB worker secret' ok={database.worker_secret_configured === true} detail={String(database.worker_secret_source ?? 'platform_settings')} />
							<StatusTile label='Resend API key' ok={Boolean(data?.configuration.resendApiKeyConfigured)} detail='RESEND_API_KEY' />
							<StatusTile label='Resend from email' ok={Boolean(data?.configuration.resendFromEmailConfigured)} detail='RESEND_FROM_EMAIL' />
						</div>

						{data && (
							<div className='rounded-xl border border-warn/30 bg-warn-50 p-4'>
								<p className='text-[13.5px] font-semibold text-ink'>Reminder worker settings</p>
								<p className='mt-1 text-[13px] text-slate-600'>
									For local Supabase, Postgres runs in Docker and should call the host app through{' '}
									<code className='rounded bg-warn/10 px-1 text-[12px] font-mono'>{data.configuration.localWorkerUrl}</code>.
									Keep <code className='rounded bg-warn/10 px-1 text-[12px] font-mono'>NEXT_PUBLIC_APP_URL</code> as{' '}
									<code className='rounded bg-warn/10 px-1 text-[12px] font-mono'>http://localhost:3000</code> for app links.
								</p>
								<div className='mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]'>
									<div className='space-y-1.5'>
										<Label htmlFor='worker-url'>Worker URL</Label>
										<Input
											id='worker-url'
											value={workerUrl}
											onChange={(e) => setWorkerUrl(e.target.value)}
											placeholder={data.configuration.localWorkerUrl}
										/>
									</div>
									<div className='space-y-1.5'>
										<Label htmlFor='worker-secret'>Worker secret</Label>
										<Input
											id='worker-secret'
											type='password'
											value={workerSecret}
											onChange={(e) => setWorkerSecret(e.target.value)}
											placeholder='Paste REMINDER_WORKER_SECRET'
										/>
									</div>
									<Button className='self-end' onClick={saveWorkerSettings} disabled={actionLoading}>
										Save settings
									</Button>
								</div>
								{needsDatabaseSetup && (
									<p className='mt-3 text-[12px] text-slate-600'>
										Save these settings here instead of running ALTER DATABASE. The worker secret is write-only and will not be shown after saving.
									</p>
								)}
							</div>
						)}
					</div>
				</div>

				{/* Metrics */}
				<div className='grid gap-3 md:grid-cols-3 lg:grid-cols-6'>
					{[
						{ label: 'Due queued', key: 'dueQueued' },
						{ label: 'Queued', key: 'queued' },
						{ label: 'Processing', key: 'processing' },
						{ label: 'Sent', key: 'sent' },
						{ label: 'Failed', key: 'failed' },
						{ label: 'Skipped', key: 'skipped' },
					].map(({ label, key }) => (
						<div key={key} className='overflow-hidden rounded-xl border border-line bg-white p-4 shadow-card'>
							<p className='text-[11.5px] font-semibold uppercase tracking-wider text-slate-400'>{label}</p>
							<p className='mt-1.5 text-[28px] font-semibold leading-none text-ink'>
								{data?.counts[key] ?? 0}
							</p>
						</div>
					))}
				</div>

				{/* Cron grid */}
				<div className='grid gap-6 lg:grid-cols-2'>
					<div className='overflow-hidden rounded-xl border border-line bg-white shadow-card'>
						<div className='flex items-center gap-2 border-b border-line bg-surface-page px-5 py-3.5'>
							<Activity className='h-3.5 w-3.5 text-slate-400' />
							<p className='text-[14px] font-semibold text-ink'>Cron Jobs</p>
						</div>
						<div className='p-4'>
							<SimpleTable rows={cronJobs} columns={['jobname', 'schedule', 'active', 'command']} empty='No cron jobs found.' />
						</div>
					</div>

					<div className='overflow-hidden rounded-xl border border-line bg-white shadow-card'>
						<div className='border-b border-line bg-surface-page px-5 py-3.5'>
							<p className='text-[14px] font-semibold text-ink'>Recent Cron Runs</p>
						</div>
						<div className='p-4'>
							<SimpleTable rows={cronRuns} columns={['jobname', 'status', 'return_message', 'start_time']} empty='No cron run history found.' />
						</div>
					</div>
				</div>

				{/* Debug tools */}
				<div className='overflow-hidden rounded-xl border border-line bg-white shadow-card'>
					<div className='border-b border-line bg-surface-page px-5 py-3.5'>
						<p className='text-[14px] font-semibold text-ink'>Debug Tools</p>
						<p className='mt-0.5 text-[12.5px] text-slate-500'>
							Check a document, preview what would queue for a date, enqueue jobs, or process one worker batch.
						</p>
					</div>
					<div className='space-y-5 p-5'>
						{/* Input row */}
						<div className='grid gap-3 md:grid-cols-[1fr_180px_auto_auto]'>
							<div className='space-y-1.5'>
								<Label htmlFor='document-id'>Document ID</Label>
								<Input
									id='document-id'
									value={documentId}
									onChange={(e) => setDocumentId(e.target.value)}
									placeholder='UUID'
								/>
							</div>
							<div className='space-y-1.5'>
								<Label htmlFor='run-date'>Run date</Label>
								<Input
									id='run-date'
									type='date'
									value={runDate}
									onChange={(e) => setRunDate(e.target.value)}
								/>
							</div>
							<Button className='self-end' onClick={checkDocument} disabled={actionLoading}>
								<Search className='h-3.5 w-3.5' />
								Check document
							</Button>
							<Button className='self-end' variant='outline' onClick={runDryPreview} disabled={actionLoading || !data?.selectedOrgId}>
								Preview enqueue
							</Button>
						</div>

						{/* Action buttons */}
						<div className='flex flex-wrap gap-3'>
							<Button variant='outline' onClick={enqueueNow} disabled={actionLoading}>
								Enqueue jobs now
							</Button>
							<Button variant='outline' onClick={processBatch} disabled={actionLoading}>
								<Play className='h-3.5 w-3.5' />
								Process worker batch
							</Button>
							<Button onClick={runPipelineOnce} disabled={actionLoading}>
								<Play className='h-3.5 w-3.5' />
								Run pipeline now
							</Button>
						</div>

						{/* Eligibility result */}
						{eligibility && (
							<div className='rounded-xl border border-dashed border-line p-4 space-y-3'>
								<div className='flex items-start justify-between'>
									<div>
										<p className='text-[13.5px] font-semibold text-ink'>Document Eligibility</p>
										<p className='mt-0.5 text-[12.5px] text-slate-500'>{eligibility.error || eligibility.reason}</p>
									</div>
									<span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${eligibility.eligible ? 'bg-ok-50 text-ok' : 'bg-surface-muted text-slate-600'}`}>
										{eligibility.eligible ? 'Will queue' : 'Will not queue'}
									</span>
								</div>
								{Boolean(eligibility.blockers?.length) && (
									<p className='text-[12.5px] text-slate-500'>{eligibility.blockers?.join(' ')}</p>
								)}
								<p className='text-[13px] text-ink'>
									Matching rules: {eligibility.matchingReminders?.map((r) => r.name).join(', ') || '—'}
								</p>
								<p className='text-[12px] text-slate-400'>
									Other due dates: {eligibility.dueOnOtherDates?.map((item) => `${item.name}: ${item.dueOn}`).join(' | ') || '—'}
								</p>
							</div>
						)}

						{/* Operation result */}
						{operationResult && <OperationResultCard result={operationResult} />}

						{/* Dry run preview */}
						{dryRun && (
							<div className='rounded-xl border border-dashed border-line p-4 space-y-3'>
								<div>
									<p className='text-[13.5px] font-semibold text-ink'>Preview Result</p>
									<p className='mt-0.5 text-[12.5px] text-slate-500'>
										{dryRun.wouldQueueCount ?? 0} reminder job(s) would queue for {dryRun.runDate}. Preview does not create jobs.
									</p>
								</div>
								{dryRunHasMatches && !hasRecentJobs && (
									<div className='rounded-xl border border-warn/30 bg-warn-50 px-4 py-3 text-[13px] text-slate-700'>
										Preview only — run enqueue to create jobs.
									</div>
								)}
								<div className='overflow-hidden rounded-xl border border-line'>
									<div className='grid grid-cols-4 gap-3 border-b border-line bg-surface-page px-4 py-2.5'>
										{['Document', 'Status', 'Reason', 'Matching rules'].map((h) => (
											<span key={h} className='text-[11px] font-semibold uppercase tracking-wider text-slate-400'>{h}</span>
										))}
									</div>
									{dryRun.rows?.slice(0, 20).map((row) => (
										<div key={row.document.id} className='grid grid-cols-4 gap-3 border-b border-line px-4 py-3 last:border-0 hover:bg-surface-page transition-colors'>
											<span className='truncate text-[13px] text-ink'>{row.document.file_name || row.document.id}</span>
											<span className='text-[13px] text-slate-500'>{row.document.status}</span>
											<span className='text-[13px] text-slate-500 whitespace-normal'>{row.reason}</span>
											<span className='text-[13px] text-slate-500'>{row.matchingReminders.map((r) => r.name).join(', ') || '—'}</span>
										</div>
									))}
								</div>
							</div>
						)}
					</div>
				</div>

				{/* Jobs + Logs */}
				<div className='grid gap-6 lg:grid-cols-2'>
					<JobsPanel jobs={data?.recentJobs ?? []} />
					<LogsPanel logs={data?.recentLogs ?? []} />
				</div>

				{/* Reminder rules */}
				<div className='overflow-hidden rounded-xl border border-line bg-white shadow-card'>
					<div className='border-b border-line bg-surface-page px-5 py-3.5'>
						<p className='text-[14px] font-semibold text-ink'>Reminder Rules</p>
					</div>
					<div className='divide-y divide-line'>
						<div className='grid grid-cols-5 gap-3 px-5 py-2.5'>
							{['Name', 'Trigger', 'Recipient', 'Plan', 'Active'].map((h) => (
								<span key={h} className='text-[11px] font-semibold uppercase tracking-wider text-slate-400'>{h}</span>
							))}
						</div>
						{(data?.reminders ?? []).length === 0 ? (
							<div className='px-5 py-8 text-center text-[13px] text-slate-400'>No reminder rules found.</div>
						) : data?.reminders.map((rule) => (
							<div key={rule.id} className='grid grid-cols-5 gap-3 px-5 py-3 hover:bg-surface-page transition-colors'>
								<span className='text-[13.5px] font-medium text-ink'>{rule.name}</span>
								<span className='text-[13px] text-slate-500'>{rule.trigger_days} {rule.trigger_type.replace(/_/g, ' ')}</span>
								<span className='text-[13px] text-slate-500 capitalize'>{rule.recipient_type}</span>
								<span className='text-[13px] text-slate-500 capitalize'>{rule.min_plan}</span>
								<span className={`inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${rule.is_active ? 'bg-ok-50 text-ok' : 'bg-surface-muted text-slate-500'}`}>
									{rule.is_active ? 'Active' : 'Paused'}
								</span>
							</div>
						))}
					</div>
				</div>
			</div>
		</div>
	);
}

async function adminAction<T>(body: Record<string, unknown>) {
	const response = await fetch('/api/admin/reminders', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body),
	});
	const payload = (await response.json().catch(() => ({}))) as T & { error?: string };
	if (!response.ok) {
		toast.error(payload.error || 'Admin action failed');
		throw new Error(payload.error || 'Admin action failed');
	}
	return payload;
}

function StatusTile({ label, ok, detail }: { label: string; ok: boolean; detail: string }) {
	return (
		<div className='rounded-xl border border-line bg-white p-4'>
			<div className='flex items-center justify-between gap-2'>
				<p className='text-[13px] font-medium text-ink'>{label}</p>
				{ok
					? <CheckCircle className='h-4 w-4 shrink-0 text-ok' />
					: <AlertTriangle className='h-4 w-4 shrink-0 text-warn' />}
			</div>
			<p className='mt-1.5 truncate text-[12px] text-slate-500'>{detail}</p>
		</div>
	);
}

function SimpleTable({ rows, columns, empty }: { rows: unknown[]; columns: string[]; empty: string }) {
	if (rows.length === 0) {
		return <p className='py-4 text-center text-[13px] text-slate-400'>{empty}</p>;
	}
	return (
		<div className='overflow-hidden rounded-xl border border-line'>
			<div className={`grid gap-3 border-b border-line bg-surface-page px-4 py-2.5`} style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}>
				{columns.map((col) => (
					<span key={col} className='text-[11px] font-semibold uppercase tracking-wider text-slate-400'>{col.replace(/_/g, ' ')}</span>
				))}
			</div>
			{rows.slice(0, 10).map((row, i) => {
				const record = row as Record<string, unknown>;
				return (
					<div key={i} className={`grid gap-3 border-b border-line px-4 py-3 last:border-0 hover:bg-surface-page transition-colors`} style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}>
						{columns.map((col) => (
							<span key={col} className='truncate text-[12.5px] text-slate-600'>{String(record[col] ?? '—')}</span>
						))}
					</div>
				);
			})}
		</div>
	);
}

function JobsPanel({ jobs }: { jobs: ReminderJob[] }) {
	return (
		<div className='overflow-hidden rounded-xl border border-line bg-white shadow-card'>
			<div className='border-b border-line bg-surface-page px-5 py-3.5'>
				<p className='text-[14px] font-semibold text-ink'>Recent Jobs</p>
			</div>
			<div className='divide-y divide-line'>
				{jobs.length === 0 ? (
					<p className='px-5 py-8 text-center text-[13px] text-slate-400'>
						No recent jobs. Run enqueue to create jobs from matching reminder rules.
					</p>
				) : jobs.map((job) => (
					<div key={job.id} className='flex items-center justify-between gap-3 px-5 py-3.5 hover:bg-surface-page transition-colors'>
						<div>
							<p className='text-[13.5px] font-medium text-ink'>{job.recipient_email || job.recipient_type}</p>
							<p className='text-[12px] text-slate-400'>Due {job.due_on}</p>
							{job.last_error && <p className='mt-0.5 text-[12px] text-danger'>{job.last_error}</p>}
						</div>
						<span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${jobStatusCls(job.status)}`}>
							{job.status}
						</span>
					</div>
				))}
			</div>
		</div>
	);
}

function LogsPanel({ logs }: { logs: ReminderLog[] }) {
	return (
		<div className='overflow-hidden rounded-xl border border-line bg-white shadow-card'>
			<div className='flex items-center gap-2 border-b border-line bg-surface-page px-5 py-3.5'>
				<Mail className='h-3.5 w-3.5 text-slate-400' />
				<p className='text-[14px] font-semibold text-ink'>Recent Email Activity</p>
			</div>
			<div className='divide-y divide-line'>
				{logs.length === 0 ? (
					<p className='px-5 py-8 text-center text-[13px] text-slate-400'>
						No recent email activity. Process a queued worker batch to create logs.
					</p>
				) : logs.map((log) => (
					<div key={log.id} className='flex items-center justify-between gap-3 px-5 py-3.5 hover:bg-surface-page transition-colors'>
						<div>
							<p className='text-[13.5px] font-medium text-ink'>{log.recipient_email || log.recipient_type}</p>
							<p className='text-[12px] text-slate-400'>{new Date(log.sent_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
							{log.error_message && <p className='mt-0.5 text-[12px] text-danger'>{log.error_message}</p>}
						</div>
						<span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${log.status === 'sent' ? 'bg-ok-50 text-ok' : 'bg-danger-50 text-danger'}`}>
							{log.status}
						</span>
					</div>
				))}
			</div>
		</div>
	);
}

function OperationResultCard({ result }: { result: EnqueueResult | WorkerActionResult | PipelineResult }) {
	const maybeEnqueue = result as Partial<EnqueueResult>;
	const maybeWorker = result as Partial<WorkerActionResult>;

	return (
		<div className='rounded-xl border border-dashed border-line p-4 space-y-3'>
			<div>
				<p className='text-[13.5px] font-semibold text-ink'>Last Operation</p>
				<p className='mt-0.5 text-[12.5px] text-slate-500'>
					{typeof maybeEnqueue.insertedCount === 'number'
						? `Inserted ${maybeEnqueue.insertedCount} job(s) for ${maybeEnqueue.runDate}.`
						: `Worker status: ${maybeWorker.workerStatus ?? '—'}`}
				</p>
			</div>
			<pre className='max-h-52 overflow-auto rounded-xl bg-surface-muted px-4 py-3 text-[12px] font-mono text-slate-600'>
				{JSON.stringify(result, null, 2)}
			</pre>
		</div>
	);
}

function today() {
	return new Date().toISOString().slice(0, 10);
}

// Unused XCircle kept to avoid lint warning
void XCircle;

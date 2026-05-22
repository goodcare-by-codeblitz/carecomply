'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@/components/ui/table';
import { Activity, AlertTriangle, CheckCircle, Mail, Play, RefreshCw, Search } from 'lucide-react';
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
			const response = await fetch(`/api/admin/reminders?${params}`, {
				cache: 'no-store',
			});
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

	useEffect(() => {
		void loadData(orgId || undefined);
	}, [loadData, orgId]);

	useEffect(() => {
		if (!data) return;
		setWorkerUrl(
			data.configuration.workerUrl ||
				String(database.worker_url ?? '') ||
				data.configuration.localWorkerUrl,
		);
	}, [data, database.worker_url]);

	async function checkDocument() {
		if (!documentId) {
			toast.error('Enter a document id');
			return;
		}
		setActionLoading(true);
		try {
			const payload = await adminAction<EligibilityResult>({
				action: 'document_eligibility',
				documentId,
				runDate,
			});
			setEligibility(payload);
		} finally {
			setActionLoading(false);
		}
	}

	async function runDryPreview() {
		if (!data?.selectedOrgId) return;
		setActionLoading(true);
		try {
			const payload = await adminAction<DryRunResult>({
				action: 'enqueue_dry_run',
				orgId: data.selectedOrgId,
				runDate,
			});
			setDryRun(payload);
			setOperationResult(null);
		} finally {
			setActionLoading(false);
		}
	}

	async function enqueueNow() {
		setActionLoading(true);
		try {
			const payload = await adminAction<EnqueueResult>({
				action: 'enqueue_now',
				runDate,
			});
			setOperationResult(payload);
			toast.success(
				`Enqueued ${payload.insertedCount} reminder job(s) for ${payload.runDate}.`,
			);
			await loadData(data?.selectedOrgId ?? undefined);
		} finally {
			setActionLoading(false);
		}
	}

	async function saveWorkerSettings() {
		if (!workerUrl.trim()) {
			toast.error('Enter a worker URL');
			return;
		}
		if (!workerSecret.trim()) {
			toast.error('Paste the worker secret from REMINDER_WORKER_SECRET');
			return;
		}

		setActionLoading(true);
		try {
			await adminAction<SaveWorkerSettingsResult>({
				action: 'save_worker_settings',
				workerUrl: workerUrl.trim(),
				workerSecret: workerSecret.trim(),
			});
			setWorkerSecret('');
			toast.success('Worker settings saved');
			await loadData(data?.selectedOrgId ?? undefined);
		} finally {
			setActionLoading(false);
		}
	}

	async function processBatch() {
		setActionLoading(true);
		try {
			const payload = await adminAction<WorkerActionResult>({
				action: 'process_batch',
				batchSize: 25,
			});
			setOperationResult(payload);
			toast.success(`Worker response: ${JSON.stringify(payload.workerResponse ?? payload)}`);
			await loadData(data?.selectedOrgId ?? undefined);
		} finally {
			setActionLoading(false);
		}
	}

	async function runPipelineOnce() {
		setActionLoading(true);
		try {
			const payload = await adminAction<PipelineResult>({
				action: 'run_pipeline_once',
				runDate,
				batchSize: 25,
			});
			setOperationResult(payload);
			toast.success(
				`Enqueued ${payload.insertedCount} job(s); worker response: ${JSON.stringify(payload.workerResponse ?? payload)}`,
			);
			await loadData(data?.selectedOrgId ?? undefined);
		} finally {
			setActionLoading(false);
		}
	}

	return (
		<div className='mx-auto max-w-7xl space-y-6 p-8'>
			<div className='flex flex-wrap items-start justify-between gap-4'>
				<div>
					<h1 className='text-2xl font-semibold tracking-tight'>Reminder Operations</h1>
					<p className='mt-1 text-sm text-muted-foreground'>
						Platform diagnostics for cron, queues, worker delivery, and email logs.
					</p>
				</div>
				<div className='flex items-center gap-3'>
					<Select value={orgId} onValueChange={setOrgId}>
						<SelectTrigger className='w-[260px]'>
							<SelectValue placeholder='Select organization' />
						</SelectTrigger>
						<SelectContent>
							{data?.organizations.map((org) => (
								<SelectItem key={org.id} value={org.id}>
									{org.name}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<Button variant='outline' onClick={() => loadData(data?.selectedOrgId ?? undefined)} disabled={loading}>
						<RefreshCw className='mr-2 h-4 w-4' />
						Refresh
					</Button>
				</div>
			</div>

			<Card>
				<CardHeader>
					<CardTitle className='text-base'>Configuration</CardTitle>
					<CardDescription>
						{selectedOrg ? `Current organization: ${selectedOrg.name}` : 'Loading organizations...'}
					</CardDescription>
				</CardHeader>
				<CardContent className='grid gap-3 md:grid-cols-2 lg:grid-cols-4'>
					<StatusTile label='Worker URL' ok={database.worker_url_configured === true} detail={String(database.worker_url ?? data?.configuration.expectedWorkerUrl ?? '')} />
					<StatusTile label='DB worker secret' ok={database.worker_secret_configured === true} detail={String(database.worker_secret_source ?? 'platform_settings')} />
					<StatusTile label='Resend API key' ok={Boolean(data?.configuration.resendApiKeyConfigured)} detail='RESEND_API_KEY' />
					<StatusTile label='Resend from email' ok={Boolean(data?.configuration.resendFromEmailConfigured)} detail='RESEND_FROM_EMAIL' />
				</CardContent>
				{data && (
					<CardContent className='border-t pt-4'>
						<div className='rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950'>
							<p className='font-medium'>Reminder worker settings</p>
							<p className='mt-1 text-amber-900'>
								For local Supabase, Postgres runs in Docker and should call the host app through {data.configuration.localWorkerUrl}. Keep NEXT_PUBLIC_APP_URL as http://localhost:3000 for app links.
							</p>
							<div className='mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]'>
								<div className='space-y-2'>
									<Label htmlFor='worker-url'>Worker URL</Label>
									<Input
										id='worker-url'
										value={workerUrl}
										onChange={(event) => setWorkerUrl(event.target.value)}
										placeholder={data.configuration.localWorkerUrl}
									/>
								</div>
								<div className='space-y-2'>
									<Label htmlFor='worker-secret'>Worker secret</Label>
									<Input
										id='worker-secret'
										type='password'
										value={workerSecret}
										onChange={(event) => setWorkerSecret(event.target.value)}
										placeholder='Paste REMINDER_WORKER_SECRET'
									/>
								</div>
								<Button
									className='self-end'
									onClick={saveWorkerSettings}
									disabled={actionLoading}>
									Save worker settings
								</Button>
							</div>
							{needsDatabaseSetup && (
								<p className='mt-3 text-xs text-amber-900'>
									Save these settings here instead of running ALTER DATABASE. The worker secret is write-only and will not be shown after saving.
								</p>
							)}
						</div>
					</CardContent>
				)}
			</Card>

			<div className='grid gap-4 md:grid-cols-3 lg:grid-cols-6'>
				<Metric label='Due queued' value={data?.counts.dueQueued ?? 0} />
				<Metric label='Queued' value={data?.counts.queued ?? 0} />
				<Metric label='Processing' value={data?.counts.processing ?? 0} />
				<Metric label='Sent' value={data?.counts.sent ?? 0} />
				<Metric label='Failed' value={data?.counts.failed ?? 0} />
				<Metric label='Skipped' value={data?.counts.skipped ?? 0} />
			</div>

			<div className='grid gap-6 lg:grid-cols-2'>
				<Card>
					<CardHeader>
						<CardTitle className='flex items-center gap-2 text-base'>
							<Activity className='h-4 w-4' />
							Cron Jobs
						</CardTitle>
					</CardHeader>
					<CardContent>
						<SimpleTable
							rows={cronJobs}
							columns={['jobname', 'schedule', 'active', 'command']}
							empty='No cron jobs found.'
						/>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle className='text-base'>Recent Cron Runs</CardTitle>
					</CardHeader>
					<CardContent>
						<SimpleTable
							rows={cronRuns}
							columns={['jobname', 'status', 'return_message', 'start_time']}
							empty='No cron run history found.'
						/>
					</CardContent>
				</Card>
			</div>

			<Card>
				<CardHeader>
					<CardTitle className='text-base'>Debug Tools</CardTitle>
					<CardDescription>
						Check a document, preview what would queue for a date, enqueue jobs, or process one worker batch.
					</CardDescription>
				</CardHeader>
				<CardContent className='space-y-5'>
					<div className='grid gap-4 md:grid-cols-[1fr_180px_auto_auto]'>
						<div className='space-y-2'>
							<Label htmlFor='document-id'>Document ID</Label>
							<Input id='document-id' value={documentId} onChange={(event) => setDocumentId(event.target.value)} placeholder='UUID' />
						</div>
						<div className='space-y-2'>
							<Label htmlFor='run-date'>Run date</Label>
							<Input id='run-date' type='date' value={runDate} onChange={(event) => setRunDate(event.target.value)} />
						</div>
						<Button className='self-end' onClick={checkDocument} disabled={actionLoading}>
							<Search className='mr-2 h-4 w-4' />
							Check document
						</Button>
						<Button className='self-end' variant='outline' onClick={runDryPreview} disabled={actionLoading || !data?.selectedOrgId}>
							Preview enqueue
						</Button>
					</div>
					<div className='flex flex-wrap gap-3'>
						<Button variant='secondary' onClick={enqueueNow} disabled={actionLoading}>
							Enqueue jobs now
						</Button>
						<Button variant='secondary' onClick={processBatch} disabled={actionLoading}>
							<Play className='mr-2 h-4 w-4' />
							Process worker batch
						</Button>
						<Button onClick={runPipelineOnce} disabled={actionLoading}>
							<Play className='mr-2 h-4 w-4' />
							Run pipeline now
						</Button>
					</div>
					{eligibility && (
						<ResultCard title='Document Eligibility' result={eligibility} />
					)}
					{operationResult && (
						<OperationResultCard result={operationResult} />
					)}
					{dryRun && (
						<Card className='border-dashed'>
							<CardHeader>
								<CardTitle className='text-sm'>Preview Result</CardTitle>
								<CardDescription>
									{dryRun.wouldQueueCount ?? 0} reminder job(s) would queue for {dryRun.runDate}. Preview does not create jobs.
								</CardDescription>
							</CardHeader>
							<CardContent>
								{dryRunHasMatches && !hasRecentJobs && (
									<p className='mb-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950'>
										Preview only; run enqueue to create jobs.
									</p>
								)}
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>Document</TableHead>
											<TableHead>Status</TableHead>
											<TableHead>Reason</TableHead>
											<TableHead>Matching rules</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{dryRun.rows?.slice(0, 20).map((row) => (
											<TableRow key={row.document.id}>
												<TableCell>{row.document.file_name || row.document.id}</TableCell>
												<TableCell>{row.document.status}</TableCell>
												<TableCell className='whitespace-normal'>{row.reason}</TableCell>
												<TableCell>{row.matchingReminders.map((rule) => rule.name).join(', ') || '-'}</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>
							</CardContent>
						</Card>
					)}
				</CardContent>
			</Card>

			<div className='grid gap-6 lg:grid-cols-2'>
				<JobsTable jobs={data?.recentJobs ?? []} />
				<LogsTable logs={data?.recentLogs ?? []} />
			</div>

			<Card>
				<CardHeader>
					<CardTitle className='text-base'>Reminder Rules</CardTitle>
				</CardHeader>
				<CardContent>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Name</TableHead>
								<TableHead>Trigger</TableHead>
								<TableHead>Recipient</TableHead>
								<TableHead>Plan</TableHead>
								<TableHead>Active</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{data?.reminders.map((rule) => (
								<TableRow key={rule.id}>
									<TableCell>{rule.name}</TableCell>
									<TableCell>{rule.trigger_days} {rule.trigger_type.replace(/_/g, ' ')}</TableCell>
									<TableCell>{rule.recipient_type}</TableCell>
									<TableCell>{rule.min_plan}</TableCell>
									<TableCell>{rule.is_active ? 'Yes' : 'No'}</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</CardContent>
			</Card>
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
		<div className='rounded-lg border p-4'>
			<div className='flex items-center justify-between gap-3'>
				<p className='text-sm font-medium'>{label}</p>
				{ok ? <CheckCircle className='h-4 w-4 text-green-600' /> : <AlertTriangle className='h-4 w-4 text-amber-600' />}
			</div>
			<p className='mt-2 truncate text-xs text-muted-foreground'>{detail}</p>
		</div>
	);
}

function Metric({ label, value }: { label: string; value: number }) {
	return (
		<Card>
			<CardContent className='p-4'>
				<p className='text-xs text-muted-foreground'>{label}</p>
				<p className='mt-1 text-2xl font-semibold'>{value}</p>
			</CardContent>
		</Card>
	);
}

function SimpleTable({ rows, columns, empty }: { rows: unknown[]; columns: string[]; empty: string }) {
	return (
		<Table>
			<TableHeader>
				<TableRow>
					{columns.map((column) => <TableHead key={column}>{column.replace(/_/g, ' ')}</TableHead>)}
				</TableRow>
			</TableHeader>
			<TableBody>
				{rows.length === 0 ? (
					<TableRow><TableCell colSpan={columns.length}>{empty}</TableCell></TableRow>
				) : rows.slice(0, 10).map((row, index) => {
					const record = row as Record<string, unknown>;
					return (
						<TableRow key={index}>
							{columns.map((column) => (
								<TableCell key={column} className='max-w-[260px] truncate'>
									{String(record[column] ?? '-')}
								</TableCell>
							))}
						</TableRow>
					);
				})}
			</TableBody>
		</Table>
	);
}

function ResultCard({ title, result }: { title: string; result: EligibilityResult }) {
	return (
		<Card className='border-dashed'>
			<CardHeader>
				<CardTitle className='text-sm'>{title}</CardTitle>
				<CardDescription>{result.error || result.reason}</CardDescription>
			</CardHeader>
			<CardContent className='space-y-3'>
				<Badge variant={result.eligible ? 'default' : 'secondary'}>
					{result.eligible ? 'Will queue' : 'Will not queue'}
				</Badge>
				{Boolean(result.blockers?.length) && (
					<p className='text-sm text-muted-foreground'>{result.blockers?.join(' ')}</p>
				)}
				<p className='text-sm'>
					Matching rules: {result.matchingReminders?.map((rule) => rule.name).join(', ') || '-'}
				</p>
				<p className='text-xs text-muted-foreground'>
					Other due dates: {result.dueOnOtherDates?.map((item) => `${item.name}: ${item.dueOn}`).join(' | ') || '-'}
				</p>
			</CardContent>
		</Card>
	);
}

function JobsTable({ jobs }: { jobs: ReminderJob[] }) {
	return (
		<Card>
			<CardHeader>
				<CardTitle className='text-base'>Recent Jobs</CardTitle>
			</CardHeader>
			<CardContent>
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Status</TableHead>
							<TableHead>Due</TableHead>
							<TableHead>Recipient</TableHead>
							<TableHead>Error</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{jobs.length === 0 ? (
							<TableRow>
								<TableCell colSpan={4}>No recent jobs. Run enqueue to create jobs from matching reminder rules.</TableCell>
							</TableRow>
						) : (
							jobs.map((job) => (
								<TableRow key={job.id}>
									<TableCell><Badge variant='outline'>{job.status}</Badge></TableCell>
									<TableCell>{job.due_on}</TableCell>
									<TableCell>{job.recipient_email || job.recipient_type}</TableCell>
									<TableCell className='max-w-[260px] truncate'>{job.last_error || '-'}</TableCell>
								</TableRow>
							))
						)}
					</TableBody>
				</Table>
			</CardContent>
		</Card>
	);
}

function LogsTable({ logs }: { logs: ReminderLog[] }) {
	return (
		<Card>
			<CardHeader>
				<CardTitle className='flex items-center gap-2 text-base'>
					<Mail className='h-4 w-4' />
					Recent Email Activity
				</CardTitle>
			</CardHeader>
			<CardContent>
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Status</TableHead>
							<TableHead>Recipient</TableHead>
							<TableHead>Sent</TableHead>
							<TableHead>Error</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{logs.length === 0 ? (
							<TableRow>
								<TableCell colSpan={4}>No recent email activity. Process a queued worker batch to create logs.</TableCell>
							</TableRow>
						) : (
							logs.map((log) => (
								<TableRow key={log.id}>
									<TableCell><Badge variant='outline'>{log.status}</Badge></TableCell>
									<TableCell>{log.recipient_email || log.recipient_type}</TableCell>
									<TableCell>{new Date(log.sent_at).toLocaleString()}</TableCell>
									<TableCell className='max-w-[260px] truncate'>{log.error_message || '-'}</TableCell>
								</TableRow>
							))
						)}
					</TableBody>
				</Table>
			</CardContent>
		</Card>
	);
}

function today() {
	return new Date().toISOString().slice(0, 10);
}

function OperationResultCard({
	result,
}: {
	result: EnqueueResult | WorkerActionResult | PipelineResult;
}) {
	const maybeEnqueue = result as Partial<EnqueueResult>;
	const maybeWorker = result as Partial<WorkerActionResult>;

	return (
		<Card className='border-dashed'>
			<CardHeader>
				<CardTitle className='text-sm'>Last Operation</CardTitle>
				<CardDescription>
					{typeof maybeEnqueue.insertedCount === 'number'
						? `Inserted ${maybeEnqueue.insertedCount} job(s) for ${maybeEnqueue.runDate}.`
						: `Worker status: ${maybeWorker.workerStatus ?? '-'}`}
				</CardDescription>
			</CardHeader>
			<CardContent>
				<pre className='max-h-52 overflow-auto rounded-md bg-muted p-3 text-xs'>
					{JSON.stringify(result, null, 2)}
				</pre>
			</CardContent>
		</Card>
	);
}

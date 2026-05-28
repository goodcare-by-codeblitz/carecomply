'use client';

import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { getCurrentOrgBySlug } from '@/lib/orgs';
import { createClient } from '@/lib/supabase/client';
import {
	AlertCircle,
	Bell,
	Clock,
	Loader2,
	Mail,
	Pencil,
	Plus,
	Send,
	Trash2,
	Zap,
} from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

type Reminder = {
	id: string;
	document_type_id: string | null;
	name: string;
	trigger_type: 'days_before_expiry' | 'days_after_expiry';
	trigger_days: number | null;
	recipient_type: 'carer' | 'management';
	min_plan: 'starter' | 'pro';
	subject_template: string | null;
	message_template: string | null;
	is_system: boolean;
	is_active: boolean;
	document_types?: { name: string } | { name: string }[] | null;
};

type ReminderLog = {
	id: string;
	sent_at: string;
	channel: string;
	status: string;
	recipient_type: string;
	recipient_email: string | null;
	error_message: string | null;
	carers: {
		full_name: string;
		email: string;
	} | null;
	documents: {
		file_name: string;
		document_types: { name: string } | { name: string }[] | null;
	} | null;
};

type DocumentType = {
	id: string;
	name: string;
};

type AutomationPayload = {
	reminders?: Reminder[];
	logs?: ReminderLog[];
	documentTypes?: DocumentType[];
	billing?: {
		plan: 'starter' | 'pro';
		status: string;
		isPro: boolean;
	};
	warnings?: { code: string; message: string }[];
	error?: string;
};

type FormState = {
	id?: string;
	name: string;
	documentTypeId: string;
	triggerType: 'days_before_expiry' | 'days_after_expiry';
	triggerDays: string;
	recipientType: 'carer' | 'management';
	subjectTemplate: string;
	messageTemplate: string;
	isActive: boolean;
};

const ALL_DOCUMENT_TYPES = 'all';

const emptyForm: FormState = {
	name: '',
	documentTypeId: ALL_DOCUMENT_TYPES,
	triggerType: 'days_before_expiry',
	triggerDays: '30',
	recipientType: 'carer',
	subjectTemplate: '{{document_type}} renewal reminder',
	messageTemplate:
		'Hi {{carer_name}},\n\nYour {{document_type}} for {{organization_name}} expires on {{expiry_date}}.\n\nUpload a renewed document here: {{onboarding_link}}',
	isActive: true,
};

async function readJson<T>(response: Response): Promise<T> {
	const contentType = response.headers.get('content-type') ?? '';
	if (!contentType.includes('application/json')) {
		const preview = (await response.text()).replace(/\s+/g, ' ').slice(0, 180);
		throw new Error(
			response.status === 401
				? 'Please sign in again to view automations.'
				: `Automation request returned ${response.status} ${response.statusText || ''} from ${response.url || 'unknown URL'} with content-type "${contentType || 'unknown'}"${preview ? `: ${preview}` : '.'}`,
		);
	}
	return (await response.json()) as T;
}

function normalizeRelation<T>(value: T | T[] | null | undefined) {
	return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

export default function AutomationsPage() {
	const { orgSlug } = useParams<{ orgSlug: string }>();
	const router = useRouter();
	const [organizationId, setOrganizationId] = useState<string | null>(null);
	const [reminders, setReminders] = useState<Reminder[]>([]);
	const [logs, setLogs] = useState<ReminderLog[]>([]);
	const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([]);
	const [billing, setBilling] = useState<AutomationPayload['billing']>({
		plan: 'starter',
		status: 'not_configured',
		isPro: false,
	});
	const [isLoading, setIsLoading] = useState(true);
	const [isDialogOpen, setIsDialogOpen] = useState(false);
	const [form, setForm] = useState<FormState>(emptyForm);
	const [isSaving, setIsSaving] = useState(false);
	const [deletingId, setDeletingId] = useState<string | null>(null);

	useEffect(() => {
		const resolveOrganization = async () => {
			const supabase = createClient();
			const {
				data: { user },
			} = await supabase.auth.getUser();

			if (!user) {
				router.push('/auth/login');
				return;
			}

			const org = await getCurrentOrgBySlug(supabase, user.id, orgSlug);
			setOrganizationId(org?.id ?? null);
		};

		resolveOrganization();
	}, [orgSlug, router]);

	const loadAutomations = useCallback(async () => {
		if (!organizationId) return;

		setIsLoading(true);
		try {
			const response = await fetch(
				`/api/automations?orgId=${encodeURIComponent(organizationId)}`,
				{ cache: 'no-store', headers: { Accept: 'application/json' } },
			);
			const payload = await readJson<AutomationPayload>(response);

			if (!response.ok) {
				if (response.status === 401) {
					router.push('/auth/login');
				}
				throw new Error(payload.error || 'Automations could not be loaded.');
			}

			setReminders(payload.reminders ?? []);
			setLogs(payload.logs ?? []);
			setDocumentTypes(payload.documentTypes ?? []);
			setBilling(
				payload.billing ?? {
					plan: 'starter',
					status: 'not_configured',
					isPro: false,
				},
			);
			payload.warnings?.forEach((warning) => toast.warning(warning.message));
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : 'Automations could not be loaded.',
			);
		} finally {
			setIsLoading(false);
		}
	}, [organizationId, router]);

	useEffect(() => {
		loadAutomations();
	}, [loadAutomations]);

	const systemReminders = useMemo(
		() => reminders.filter((reminder) => reminder.is_system),
		[reminders],
	);
	const customReminders = useMemo(
		() => reminders.filter((reminder) => !reminder.is_system),
		[reminders],
	);

	const openCreateDialog = () => {
		if (!billing?.isPro) {
			toast.info('Custom automations are available on Pro.');
			return;
		}
		setForm(emptyForm);
		setIsDialogOpen(true);
	};

	const openEditDialog = (reminder: Reminder) => {
		if (reminder.is_system) return;
		setForm({
			id: reminder.id,
			name: reminder.name,
			documentTypeId: reminder.document_type_id ?? ALL_DOCUMENT_TYPES,
			triggerType: reminder.trigger_type,
			triggerDays: String(reminder.trigger_days ?? 0),
			recipientType: reminder.recipient_type,
			subjectTemplate: reminder.subject_template ?? '',
			messageTemplate: reminder.message_template ?? '',
			isActive: reminder.is_active,
		});
		setIsDialogOpen(true);
	};

	const saveReminder = async () => {
		if (!organizationId) return;

		const triggerDays = Number(form.triggerDays);
		if (!form.name.trim() || !Number.isInteger(triggerDays) || triggerDays < 0) {
			toast.error('Please provide a name and valid trigger day.');
			return;
		}

		setIsSaving(true);
		try {
			const response = await fetch('/api/automations', {
				method: form.id ? 'PATCH' : 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					id: form.id,
					orgId: organizationId,
					name: form.name.trim(),
					documentTypeId:
						form.documentTypeId === ALL_DOCUMENT_TYPES
							? null
							: form.documentTypeId,
					triggerType: form.triggerType,
					triggerDays,
					recipientType: form.recipientType,
					subjectTemplate: form.subjectTemplate.trim(),
					messageTemplate: form.messageTemplate.trim(),
					isActive: form.isActive,
				}),
			});
			const payload = await readJson<{ reminder?: Reminder; error?: string }>(
				response,
			);

			if (!response.ok || !payload.reminder) {
				throw new Error(payload.error || 'Automation could not be saved.');
			}

			setIsDialogOpen(false);
			toast.success(form.id ? 'Automation updated' : 'Automation created');
			await loadAutomations();
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : 'Automation could not be saved.',
			);
		} finally {
			setIsSaving(false);
		}
	};

	const deleteReminder = async (reminder: Reminder) => {
		if (!organizationId || reminder.is_system) return;

		setDeletingId(reminder.id);
		try {
			const response = await fetch('/api/automations', {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ orgId: organizationId, id: reminder.id }),
			});
			const payload = await readJson<{ error?: string }>(response);

			if (!response.ok) {
				throw new Error(payload.error || 'Automation could not be deleted.');
			}

			toast.success('Automation deleted');
			await loadAutomations();
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: 'Automation could not be deleted.',
			);
		} finally {
			setDeletingId(null);
		}
	};

	if (isLoading || !organizationId) {
		return (
			<div className='flex min-h-[420px] items-center justify-center p-8'>
				<Loader2 className='h-8 w-8 animate-spin text-slate-400' />
			</div>
		);
	}

	return (
		<div className='min-h-full'>
			{/* Page header */}
			<div className='border-b border-line bg-white px-6 py-5 lg:px-8'>
				<div className='mx-auto flex max-w-6xl items-center justify-between gap-4'>
					<div>
						<h1 className='text-[22px] font-semibold tracking-tight text-ink'>Automations</h1>
						<p className='mt-0.5 text-[13px] text-slate-500'>
							Manage document expiry reminders, escalation, and reminder activity.
						</p>
					</div>
					<Button type='button' onClick={openCreateDialog}>
						<Plus className='h-3.5 w-3.5' />
						New automation
					</Button>
				</div>
			</div>

			<div className='mx-auto max-w-6xl space-y-6 px-6 py-6 lg:px-8'>
				{!billing?.isPro && (
					<div className='flex items-start gap-3 rounded-xl border border-warn/30 bg-warn-50 px-4 py-3.5'>
						<AlertCircle className='mt-0.5 h-4 w-4 shrink-0 text-warn' />
						<div>
							<p className='text-[13.5px] font-semibold text-ink'>Starter reminders included</p>
							<p className='mt-0.5 text-[13px] text-slate-600'>
								Starter includes fixed expiry reminders. Upgrade to Pro for custom
								document-type rules, scheduled sequences, and escalation workflows.
							</p>
						</div>
					</div>
				)}

				<div className='grid gap-6 lg:grid-cols-[1fr_340px]'>
					<div className='space-y-6'>
						<ReminderSection
							title='Included Starter Reminders'
							description='Fixed system-managed rules available to every organization.'
							reminders={systemReminders}
							readOnly
						/>
						<ReminderSection
							title='Custom Pro Automations'
							description='Per-document-type reminders and escalation rules.'
							reminders={customReminders}
							onEdit={openEditDialog}
							onDelete={deleteReminder}
							deletingId={deletingId}
							emptyAction={billing?.isPro ? openCreateDialog : undefined}
						/>
					</div>

					{/* Recent Emails sidebar */}
					<div className='overflow-hidden rounded-xl border border-line bg-white shadow-card'>
						<div className='border-b border-line bg-surface-page px-5 py-3'>
							<p className='text-[13.5px] font-semibold text-ink'>Recent Emails</p>
							<p className='text-[12px] text-slate-400'>Latest reminder worker activity.</p>
						</div>
						<div className='p-5'>
							{logs.length === 0 ? (
								<div className='py-8 text-center'>
									<Send className='mx-auto mb-3 h-7 w-7 text-slate-300' />
									<p className='text-[13px] text-slate-400'>No reminders sent yet</p>
								</div>
							) : (
								<div className='space-y-3'>
									{logs.map((log) => (
										<div
											key={log.id}
											className='border-b border-line pb-3 last:border-0 last:pb-0'>
											<div className='flex items-start justify-between gap-3'>
												<div className='min-w-0'>
													<p className='truncate text-[13px] font-medium text-ink'>
														{log.recipient_email || log.carers?.email || 'No recipient'}
													</p>
													<p className='truncate text-[12px] text-slate-400'>
														{getLogDocumentType(log)} &middot; {log.recipient_type}
													</p>
												</div>
												<span
													className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${log.status === 'sent' ? 'bg-ok-50 text-ok' : 'bg-surface-muted text-slate-600'}`}>
													{log.status}
												</span>
											</div>
											<p className='mt-1 text-[12px] text-slate-400'>
												{new Date(log.sent_at).toLocaleString('en-GB', {
													day: 'numeric',
													month: 'short',
													hour: '2-digit',
													minute: '2-digit',
												})}
											</p>
											{log.error_message && (
												<p className='mt-1 text-[12px] text-danger'>{log.error_message}</p>
											)}
										</div>
									))}
								</div>
							)}
						</div>
					</div>
				</div>
			</div>

			<Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
				<DialogContent className='sm:max-w-xl'>
					<DialogHeader>
						<div className='mb-1 flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50'>
							<Zap className='h-4 w-4 text-brand-700' />
						</div>
						<DialogTitle className='text-[16px]'>
							{form.id ? 'Edit automation' : 'New automation'}
						</DialogTitle>
						<DialogDescription className='text-[13px]'>
							Configure a document expiry reminder rule for your organisation.
						</DialogDescription>
					</DialogHeader>

					<div className='space-y-4 pt-1'>
						{/* Name */}
						<div className='space-y-1.5'>
							<Label className='text-[13px] font-medium text-ink'>Name</Label>
							<Input
								value={form.name}
								onChange={(event) =>
									setForm((current) => ({ ...current, name: event.target.value }))
								}
								placeholder='DBS 14-day reminder'
								className='text-[13.5px]'
							/>
						</div>

						{/* Schedule group */}
						<div className='rounded-xl border border-line bg-surface-muted/30 p-4'>
							<p className='mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400'>
								Schedule
							</p>
							<div className='grid gap-3 sm:grid-cols-2'>
								<div className='space-y-1.5'>
									<Label className='text-[12.5px] text-slate-600'>Trigger</Label>
									<Select
										value={form.triggerType}
										onValueChange={(value: FormState['triggerType']) =>
											setForm((current) => ({ ...current, triggerType: value }))
										}>
										<SelectTrigger className='text-[13.5px]'>
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value='days_before_expiry'>Days before expiry</SelectItem>
											<SelectItem value='days_after_expiry'>Days after expiry</SelectItem>
										</SelectContent>
									</Select>
								</div>
								<div className='space-y-1.5'>
									<Label className='text-[12.5px] text-slate-600'>Days</Label>
									<Input
										type='number'
										min='0'
										max='365'
										value={form.triggerDays}
										onChange={(event) =>
											setForm((current) => ({
												...current,
												triggerDays: event.target.value,
											}))
										}
										className='text-[13.5px]'
									/>
								</div>
							</div>
						</div>

						{/* Target group */}
						<div className='rounded-xl border border-line bg-surface-muted/30 p-4'>
							<p className='mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400'>
								Target
							</p>
							<div className='grid gap-3 sm:grid-cols-2'>
								<div className='space-y-1.5'>
									<Label className='text-[12.5px] text-slate-600'>Document type</Label>
									<Select
										value={form.documentTypeId}
										onValueChange={(value) =>
											setForm((current) => ({ ...current, documentTypeId: value }))
										}>
										<SelectTrigger className='text-[13.5px]'>
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value={ALL_DOCUMENT_TYPES}>All document types</SelectItem>
											{documentTypes.map((documentType) => (
												<SelectItem key={documentType.id} value={documentType.id}>
													{documentType.name}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
								<div className='space-y-1.5'>
									<Label className='text-[12.5px] text-slate-600'>Recipient</Label>
									<Select
										value={form.recipientType}
										onValueChange={(value: FormState['recipientType']) =>
											setForm((current) => ({ ...current, recipientType: value }))
										}>
										<SelectTrigger className='text-[13.5px]'>
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value='carer'>Carer</SelectItem>
											<SelectItem value='management'>Admins and managers</SelectItem>
										</SelectContent>
									</Select>
								</div>
							</div>
						</div>

						{/* Email template */}
						<div className='rounded-xl border border-line bg-surface-muted/30 p-4'>
							<p className='mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400'>
								Email template
							</p>
							<div className='space-y-3'>
								<div className='space-y-1.5'>
									<Label className='text-[12.5px] text-slate-600'>Subject line</Label>
									<Input
										value={form.subjectTemplate}
										onChange={(event) =>
											setForm((current) => ({
												...current,
												subjectTemplate: event.target.value,
											}))
										}
										className='text-[13.5px]'
									/>
								</div>
								<div className='space-y-1.5'>
									<Label className='text-[12.5px] text-slate-600'>Message body</Label>
									<Textarea
										value={form.messageTemplate}
										onChange={(event) =>
											setForm((current) => ({
												...current,
												messageTemplate: event.target.value,
											}))
										}
										rows={5}
										className='font-mono text-[12.5px]'
									/>
									<p className='text-[11.5px] text-slate-400'>
										Variables:{' '}
										{[
											'{{carer_name}}',
											'{{document_type}}',
											'{{expiry_date}}',
											'{{onboarding_link}}',
											'{{organization_name}}',
										].join(', ')}
									</p>
								</div>
							</div>
						</div>

						{/* Active toggle */}
						<div className='flex items-center justify-between rounded-xl border border-line p-3.5'>
							<div>
								<p className='text-[13.5px] font-medium text-ink'>Active</p>
								<p className='text-[12px] text-slate-500'>
									Paused automations will not enqueue reminder jobs.
								</p>
							</div>
							<Switch
								checked={form.isActive}
								onCheckedChange={(checked) =>
									setForm((current) => ({ ...current, isActive: checked }))
								}
							/>
						</div>
					</div>

					<DialogFooter>
						<Button variant='outline' onClick={() => setIsDialogOpen(false)}>
							Cancel
						</Button>
						<Button onClick={saveReminder} disabled={isSaving}>
							{isSaving ? (
								<Loader2 className='h-3.5 w-3.5 animate-spin' />
							) : (
								<Zap className='h-3.5 w-3.5' />
							)}
							{form.id ? 'Save changes' : 'Create automation'}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}

function ReminderSection({
	title,
	description,
	reminders,
	readOnly = false,
	onEdit,
	onDelete,
	deletingId,
	emptyAction,
}: {
	title: string;
	description: string;
	reminders: Reminder[];
	readOnly?: boolean;
	onEdit?: (reminder: Reminder) => void;
	onDelete?: (reminder: Reminder) => void;
	deletingId?: string | null;
	emptyAction?: () => void;
}) {
	return (
		<div className='overflow-hidden rounded-xl border border-line bg-white shadow-card'>
			<div className='border-b border-line bg-surface-page px-5 py-3'>
				<p className='text-[13.5px] font-semibold text-ink'>{title}</p>
				<p className='text-[12px] text-slate-400'>{description}</p>
			</div>
			<div className='p-5'>
				{reminders.length === 0 ? (
					<div className='rounded-xl border border-dashed border-line p-8 text-center'>
						<Zap className='mx-auto mb-3 h-7 w-7 text-slate-300' />
						<p className='text-[13px] text-slate-400'>No automations configured.</p>
						{emptyAction && (
							<div className='mt-4'>
								<Button type='button' onClick={emptyAction}>
									<Plus className='mr-2 h-4 w-4' />
									Create automation
								</Button>
							</div>
						)}
					</div>
				) : (
					<div className='space-y-3'>
						{reminders.map((reminder) => (
							<div
								key={reminder.id}
								className='flex flex-col gap-4 rounded-xl border border-line p-4 sm:flex-row sm:items-center sm:justify-between'>
								<div className='min-w-0'>
									<div className='flex flex-wrap items-center gap-2'>
										{getTriggerIcon(reminder)}
										<p className='text-[13.5px] font-medium text-ink'>{reminder.name}</p>
										<span
											className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${reminder.is_active ? 'bg-ok-50 text-ok' : 'bg-surface-muted text-slate-500'}`}>
											{reminder.is_active ? 'Active' : 'Paused'}
										</span>
										{reminder.is_system && (
											<span className='inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold bg-surface-muted text-slate-600'>
												Included
											</span>
										)}
										{reminder.min_plan === 'pro' && (
											<span className='inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold bg-brand-50 text-brand-700'>
												Pro
											</span>
										)}
									</div>
									<p className='mt-1 text-[12.5px] text-slate-400'>
										{getTriggerLabel(reminder)}
										<span aria-hidden='true'> &middot; </span>
										{getRecipientLabel(reminder)}
										<span aria-hidden='true'> &middot; </span>
										{getDocumentTypeName(reminder) ?? 'All document types'}
									</p>
								</div>
								{!readOnly && (
									<div className='flex gap-2'>
										<Button
											type='button'
											variant='outline'
											size='sm'
											onClick={() => onEdit?.(reminder)}>
											<Pencil className='mr-2 h-4 w-4' />
											Edit
										</Button>
										<Button
											type='button'
											variant='outline'
											size='sm'
											disabled={deletingId === reminder.id}
											onClick={() => onDelete?.(reminder)}>
											{deletingId === reminder.id ? (
												<Loader2 className='mr-2 h-4 w-4 animate-spin' />
											) : (
												<Trash2 className='mr-2 h-4 w-4' />
											)}
											Delete
										</Button>
									</div>
								)}
							</div>
						))}
					</div>
				)}
			</div>
		</div>
	);
}

function getTriggerIcon(reminder: Reminder) {
	if (reminder.recipient_type === 'management') {
		return <Bell className='h-4 w-4 text-slate-400' />;
	}
	if (reminder.trigger_type === 'days_after_expiry') {
		return <Mail className='h-4 w-4 text-slate-400' />;
	}
	return <Clock className='h-4 w-4 text-slate-400' />;
}

function getTriggerLabel(reminder: Reminder) {
	const days = reminder.trigger_days ?? 0;
	if (reminder.trigger_type === 'days_after_expiry') {
		return days === 1 ? '1 day after expiry' : `${days} days after expiry`;
	}
	if (days === 0) return 'On expiry day';
	return days === 1 ? '1 day before expiry' : `${days} days before expiry`;
}

function getRecipientLabel(reminder: Reminder) {
	return reminder.recipient_type === 'management'
		? 'Admins and managers'
		: 'Carer';
}

function getDocumentTypeName(reminder: Reminder) {
	return normalizeRelation(reminder.document_types)?.name ?? null;
}

function getLogDocumentType(log: ReminderLog) {
	return normalizeRelation(log.documents?.document_types)?.name ?? 'General reminder';
}

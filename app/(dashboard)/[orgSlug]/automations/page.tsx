'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui/card';
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
				<Loader2 className='h-8 w-8 animate-spin text-muted-foreground' />
			</div>
		);
	}

	return (
		<div className='mx-auto max-w-6xl space-y-6 p-8'>
			<div className='flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between'>
				<div>
					<h1 className='text-2xl font-semibold tracking-tight'>Automations</h1>
					<p className='mt-1 text-muted-foreground'>
						Manage document expiry reminders, escalation, and reminder activity.
					</p>
				</div>
				<Button type='button' onClick={openCreateDialog}>
					<Plus className='mr-2 h-4 w-4' />
					New automation
				</Button>
			</div>

			{!billing?.isPro && (
				<Card className='border-amber-200 bg-amber-50/50'>
					<CardContent className='flex gap-3 py-4'>
						<AlertCircle className='mt-0.5 h-5 w-5 shrink-0 text-amber-600' />
						<div>
							<p className='font-medium text-amber-900'>Starter reminders included</p>
							<p className='mt-1 text-sm text-amber-800'>
								Starter includes fixed expiry reminders. Upgrade to Pro for custom
								document-type rules, scheduled sequences, and escalation workflows.
							</p>
						</div>
					</CardContent>
				</Card>
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

				<Card>
					<CardHeader>
						<CardTitle className='text-base'>Recent Emails</CardTitle>
						<CardDescription>Latest reminder worker activity.</CardDescription>
					</CardHeader>
					<CardContent>
						{logs.length === 0 ? (
							<div className='py-8 text-center text-sm text-muted-foreground'>
								<Send className='mx-auto mb-3 h-8 w-8 text-muted-foreground/50' />
								No reminders sent yet
							</div>
						) : (
							<div className='space-y-3'>
								{logs.map((log) => (
									<div key={log.id} className='border-b pb-3 last:border-0 last:pb-0'>
										<div className='flex items-start justify-between gap-3'>
											<div className='min-w-0'>
												<p className='truncate text-sm font-medium'>
													{log.recipient_email || log.carers?.email || 'No recipient'}
												</p>
												<p className='truncate text-xs text-muted-foreground'>
													{getLogDocumentType(log)} &middot; {log.recipient_type}
												</p>
											</div>
											<Badge variant={log.status === 'sent' ? 'default' : 'secondary'}>
												{log.status}
											</Badge>
										</div>
										<p className='mt-1 text-xs text-muted-foreground'>
											{new Date(log.sent_at).toLocaleString('en-GB', {
												day: 'numeric',
												month: 'short',
												hour: '2-digit',
												minute: '2-digit',
											})}
										</p>
										{log.error_message && (
											<p className='mt-1 text-xs text-destructive'>{log.error_message}</p>
										)}
									</div>
								))}
							</div>
						)}
					</CardContent>
				</Card>
			</div>

			<Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
				<DialogContent className='sm:max-w-xl'>
					<DialogHeader>
						<DialogTitle>
							{form.id ? 'Edit automation' : 'Create automation'}
						</DialogTitle>
						<DialogDescription>
							Custom automations are available on Pro.
						</DialogDescription>
					</DialogHeader>

					<div className='space-y-4 py-2'>
						<div className='space-y-2'>
							<Label>Name</Label>
							<Input
								value={form.name}
								onChange={(event) =>
									setForm((current) => ({ ...current, name: event.target.value }))
								}
								placeholder='DBS 14 day reminder'
							/>
						</div>

						<div className='grid gap-4 sm:grid-cols-2'>
							<div className='space-y-2'>
								<Label>Document type</Label>
								<Select
									value={form.documentTypeId}
									onValueChange={(value) =>
										setForm((current) => ({ ...current, documentTypeId: value }))
									}>
									<SelectTrigger>
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

							<div className='space-y-2'>
								<Label>Recipient</Label>
								<Select
									value={form.recipientType}
									onValueChange={(value: FormState['recipientType']) =>
										setForm((current) => ({ ...current, recipientType: value }))
									}>
									<SelectTrigger>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value='carer'>Carer</SelectItem>
										<SelectItem value='management'>Admins and managers</SelectItem>
									</SelectContent>
								</Select>
							</div>
						</div>

						<div className='grid gap-4 sm:grid-cols-2'>
							<div className='space-y-2'>
								<Label>Trigger</Label>
								<Select
									value={form.triggerType}
									onValueChange={(value: FormState['triggerType']) =>
										setForm((current) => ({ ...current, triggerType: value }))
									}>
									<SelectTrigger>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value='days_before_expiry'>Days before expiry</SelectItem>
										<SelectItem value='days_after_expiry'>Days after expiry</SelectItem>
									</SelectContent>
								</Select>
							</div>
							<div className='space-y-2'>
								<Label>Days</Label>
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
								/>
							</div>
						</div>

						<div className='space-y-2'>
							<Label>Subject</Label>
							<Input
								value={form.subjectTemplate}
								onChange={(event) =>
									setForm((current) => ({
										...current,
										subjectTemplate: event.target.value,
									}))
								}
							/>
						</div>
						<div className='space-y-2'>
							<Label>Email message</Label>
							<Textarea
								value={form.messageTemplate}
								onChange={(event) =>
									setForm((current) => ({
										...current,
										messageTemplate: event.target.value,
									}))
								}
								rows={6}
								className='font-mono text-sm'
							/>
							<p className='text-xs text-muted-foreground'>
								Variables: {'{{carer_name}}'}, {'{{document_type}}'},{' '}
								{'{{expiry_date}}'}, {'{{onboarding_link}}'},{' '}
								{'{{organization_name}}'}
							</p>
						</div>
						<div className='flex items-center justify-between rounded-md border p-3'>
							<div>
								<p className='text-sm font-medium'>Active</p>
								<p className='text-xs text-muted-foreground'>
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
							{isSaving && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
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
		<Card>
			<CardHeader>
				<CardTitle className='text-base'>{title}</CardTitle>
				<CardDescription>{description}</CardDescription>
			</CardHeader>
			<CardContent>
				{reminders.length === 0 ? (
					<div className='rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground'>
						<Zap className='mx-auto mb-3 h-8 w-8 text-muted-foreground/50' />
						No automations configured.
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
								className='flex flex-col gap-4 rounded-md border p-4 sm:flex-row sm:items-center sm:justify-between'>
								<div className='min-w-0'>
									<div className='flex flex-wrap items-center gap-2'>
										{getTriggerIcon(reminder)}
										<p className='font-medium'>{reminder.name}</p>
										<Badge variant={reminder.is_active ? 'default' : 'secondary'}>
											{reminder.is_active ? 'Active' : 'Paused'}
										</Badge>
										{reminder.is_system && <Badge variant='outline'>Included</Badge>}
										{reminder.min_plan === 'pro' && <Badge variant='outline'>Pro</Badge>}
									</div>
									<p className='mt-1 text-sm text-muted-foreground'>
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
			</CardContent>
		</Card>
	);
}

function getTriggerIcon(reminder: Reminder) {
	if (reminder.recipient_type === 'management') {
		return <Bell className='h-4 w-4 text-muted-foreground' />;
	}
	if (reminder.trigger_type === 'days_after_expiry') {
		return <Mail className='h-4 w-4 text-muted-foreground' />;
	}
	return <Clock className='h-4 w-4 text-muted-foreground' />;
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

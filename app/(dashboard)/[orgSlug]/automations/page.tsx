'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from '@/components/ui/dialog';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import {
	Plus,
	Zap,
	Bell,
	Clock,
	Mail,
	MoreHorizontal,
	Pencil,
	Trash2,
	AlertCircle,
	CheckCircle2,
	Send,
} from 'lucide-react';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { z } from 'zod';
import { useParams } from 'next/navigation';
import { getCurrentOrgBySlug, isMissingRelationError } from '@/lib/orgs';
// import { logAction } from '@/lib/audit'

interface Reminder {
	id: string;
	name: string;
	trigger_type: 'days_before_expiry' | 'days_after_upload' | 'manual';
	trigger_days: number | null;
	message_template: string | null;
	is_active: boolean;
	created_at: string;
}

interface ReminderLog {
	id: string;
	sent_at: string;
	channel: string;
	status: string;
	carers: {
		full_name: string;
		email: string;
	};
	documents: {
		file_name: string;
		document_types: {
			name: string;
		};
	} | null;
}

const reminderSchema = z.object({
	name: z.string().min(3, 'Name must be at least 3 characters'),
	trigger_type: z.enum(['days_before_expiry', 'days_after_upload', 'manual']),
	trigger_days: z.number().min(1).max(365).nullable(),
	message_template: z.string().optional(),
	is_active: z.boolean(),
});

type ReminderInput = z.infer<typeof reminderSchema>;

export default function AutomationsPage() {
	const { orgSlug } = useParams<{ orgSlug: string }>();
	const [reminders, setReminders] = useState<Reminder[]>([]);
	const [logs, setLogs] = useState<ReminderLog[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [isDialogOpen, setIsDialogOpen] = useState(false);
	const [editingReminder, setEditingReminder] = useState<Reminder | null>(null);
	const [isSaving, setIsSaving] = useState(false);
	const [emailConfigured, setEmailConfigured] = useState(false);
	const [automationTablesReady, setAutomationTablesReady] = useState(true);

	const [formData, setFormData] = useState<ReminderInput>({
		name: '',
		trigger_type: 'days_before_expiry',
		trigger_days: 30,
		message_template: '',
		is_active: true,
	});
	const [errors, setErrors] = useState<Record<string, string>>({});

	useEffect(() => {
		fetchData();
		checkEmailConfig();
	}, [orgSlug]);

	const getCurrentOrganizationId = async () => {
		const supabase = createClient();
		const {
			data: { user },
		} = await supabase.auth.getUser();

		if (!user) return null;

		const organization = await getCurrentOrgBySlug(supabase, user.id, orgSlug);

		return organization?.id ?? null;
	};

	const checkEmailConfig = async () => {
		// Check if RESEND_API_KEY is configured
		try {
			const res = await fetch('/api/check-email-config');
			const data = await res.json();
			setEmailConfigured(data.configured);
		} catch {
			setEmailConfigured(false);
		}
	};

	const fetchData = async () => {
		const supabase = createClient();
		const organizationId = await getCurrentOrganizationId();

		if (!organizationId) {
			setReminders([]);
			setLogs([]);
			setIsLoading(false);
			return;
		}

		const [remindersRes, logsRes] = await Promise.all([
			supabase
				.from('reminders')
				.select('*')
				.eq('organization_id', organizationId)
				.order('created_at', { ascending: false }),
			supabase
				.from('reminder_logs')
				.select(
					'*, carers!inner(full_name, email, organization_id), documents(file_name, document_types(name))',
				)
				.eq('carers.organization_id', organizationId)
				.order('sent_at', { ascending: false })
				.limit(20),
		]);

		// if (
		// 	isMissingRelationError(remindersRes.error) ||
		// 	isMissingRelationError(logsRes.error)
		// ) {
		// 	setAutomationTablesReady(false);
		// 	setReminders([]);
		// 	setLogs([]);
		// 	setIsLoading(false);
		// 	return;
		// }

		setAutomationTablesReady(true);
		if (remindersRes.data) setReminders(remindersRes.data);
		if (logsRes.data) setLogs(logsRes.data as ReminderLog[]);
		setIsLoading(false);
	};

	const openCreateDialog = () => {
		setEditingReminder(null);
		setFormData({
			name: '',
			trigger_type: 'days_before_expiry',
			trigger_days: 30,
			message_template: getDefaultTemplate('days_before_expiry'),
			is_active: true,
		});
		setErrors({});
		setIsDialogOpen(true);
	};

	const openEditDialog = (reminder: Reminder) => {
		setEditingReminder(reminder);
		setFormData({
			name: reminder.name,
			trigger_type: reminder.trigger_type,
			trigger_days: reminder.trigger_days,
			message_template: reminder.message_template || '',
			is_active: reminder.is_active,
		});
		setErrors({});
		setIsDialogOpen(true);
	};

	const getDefaultTemplate = (type: string) => {
		switch (type) {
			case 'days_before_expiry':
				return `Hi {{carer_name}},

Your {{document_type}} is expiring on {{expiry_date}}. Please upload a renewed certificate to maintain your compliance status.

Upload here: {{onboarding_link}}

Best regards,
{{organization_name}}`;
			case 'days_after_upload':
				return `Hi {{carer_name}},

Thank you for uploading your {{document_type}}. We've received your document and it's now being reviewed.

You can check your status here: {{onboarding_link}}

Best regards,
{{organization_name}}`;
			default:
				return '';
		}
	};

	const handleSave = async () => {
		const result = reminderSchema.safeParse(formData);

		if (!result.success) {
			const fieldErrors: Record<string, string> = {};
			result.error.issues.forEach((err) => {
				if (err.path[0]) {
					fieldErrors[err.path[0] as string] = err.message;
				}
			});
			setErrors(fieldErrors);
			return;
		}

		setIsSaving(true);
		const supabase = createClient();
		const organizationId = await getCurrentOrganizationId();

		if (!organizationId) {
			toast.error('No organization found');
			setIsSaving(false);
			return;
		}

		const reminderData = {
			name: formData.name,
			trigger_type: formData.trigger_type,
			trigger_days:
				formData.trigger_type === 'manual' ? null : formData.trigger_days,
			message_template: formData.message_template || null,
			is_active: formData.is_active,
			organization_id: organizationId,
		};

		if (editingReminder) {
			const { error } = await supabase
				.from('reminders')
				.update(reminderData)
				.eq('organization_id', organizationId)
				.eq('id', editingReminder.id);

			if (error) {
				toast.error(
					isMissingRelationError(error)
						? 'Automations table is not set up yet'
						: 'Failed to update automation',
				);
			} else {
				// await logAction({
				//   action: 'reminder.updated',
				//   entityType: 'reminder',
				//   entityId: editingReminder.id,
				//   entityName: formData.name,
				//   details: { trigger_type: formData.trigger_type, trigger_days: formData.trigger_days }
				// })
				toast.success('Automation updated');
				setIsDialogOpen(false);
				fetchData();
			}
		} else {
			const { error } = await supabase
				.from('reminders')
				.insert(reminderData)
				.select('id')
				.single();

			if (error) {
				toast.error(
					isMissingRelationError(error)
						? 'Automations table is not set up yet'
						: 'Failed to create automation',
				);
			} else {
				// await logAction({
				//   action: 'reminder.created',
				//   entityType: 'reminder',
				//   entityId: newReminder?.id,
				//   entityName: formData.name,
				//   details: { trigger_type: formData.trigger_type, trigger_days: formData.trigger_days }
				// })
				toast.success('Automation created');
				setIsDialogOpen(false);
				fetchData();
			}
		}

		setIsSaving(false);
	};

	const toggleActive = async (reminder: Reminder) => {
		const supabase = createClient();
		const organizationId = await getCurrentOrganizationId();
		if (!organizationId) return;

		const { error } = await supabase
			.from('reminders')
			.update({ is_active: !reminder.is_active })
			.eq('organization_id', organizationId)
			.eq('id', reminder.id);

		if (error) {
			toast.error(
				isMissingRelationError(error)
					? 'Automations table is not set up yet'
					: 'Failed to update',
			);
		} else {
			// await logAction({
			//   action: 'reminder.toggled',
			//   entityType: 'reminder',
			//   entityId: reminder.id,
			//   entityName: reminder.name,
			//   details: { is_active: !reminder.is_active }
			// })
			setReminders(
				reminders.map((r) =>
					r.id === reminder.id ? { ...r, is_active: !r.is_active } : r,
				),
			);
		}
	};

	const deleteReminder = async (id: string) => {
		const supabase = createClient();
		const organizationId = await getCurrentOrganizationId();
		if (!organizationId) return;

		const { error } = await supabase
			.from('reminders')
			.delete()
			.eq('organization_id', organizationId)
			.eq('id', id);

		if (error) {
			toast.error(
				isMissingRelationError(error)
					? 'Automations table is not set up yet'
					: 'Failed to delete',
			);
		} else {
			// await logAction({
			//   action: 'reminder.deleted',
			//   entityType: 'reminder',
			//   entityId: id,
			//   entityName: reminder?.name,
			// })
			toast.success('Automation deleted');
			setReminders(reminders.filter((r) => r.id !== id));
		}
	};

	const getTriggerLabel = (type: string, days: number | null) => {
		switch (type) {
			case 'days_before_expiry':
				return `${days} days before expiry`;
			case 'days_after_upload':
				return `${days} days after upload`;
			case 'manual':
				return 'Manual trigger';
			default:
				return type;
		}
	};

	const getTriggerIcon = (type: string) => {
		switch (type) {
			case 'days_before_expiry':
				return <Clock className='w-4 h-4' />;
			case 'days_after_upload':
				return <Mail className='w-4 h-4' />;
			case 'manual':
				return <Bell className='w-4 h-4' />;
			default:
				return <Zap className='w-4 h-4' />;
		}
	};

	if (isLoading) {
		return (
			<div className='p-8 flex items-center justify-center min-h-[400px]'>
				<div className='animate-spin rounded-full h-8 w-8 border-b-2 border-foreground' />
			</div>
		);
	}

	return (
		<div className='p-8 max-w-6xl mx-auto'>
			{/* Page header */}
			<div className='flex items-center justify-between mb-8'>
				<div>
					<h1 className='text-2xl font-semibold tracking-tight'>Automations</h1>
					<p className='text-muted-foreground mt-1'>
						Configure automatic reminders for document expiry and compliance.
					</p>
				</div>
				<Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
					<DialogTrigger asChild>
						<Button
							onClick={openCreateDialog}
							disabled={!automationTablesReady}>
							<Plus className='w-4 h-4 mr-2' />
							New Automation
						</Button>
					</DialogTrigger>
					<DialogContent className='sm:max-w-lg'>
						<DialogHeader>
							<DialogTitle>
								{editingReminder ? 'Edit Automation' : 'Create Automation'}
							</DialogTitle>
							<DialogDescription>
								Set up automatic email reminders for your carers.
							</DialogDescription>
						</DialogHeader>

						<div className='space-y-5 py-4'>
							<div className='space-y-2'>
								<Label>Name</Label>
								<Input
									value={formData.name}
									onChange={(e) =>
										setFormData({ ...formData, name: e.target.value })
									}
									placeholder='e.g., 30 Day Expiry Warning'
									className={errors.name ? 'border-destructive' : ''}
								/>
								{errors.name && (
									<p className='text-xs text-destructive'>{errors.name}</p>
								)}
							</div>

							<div className='space-y-2'>
								<Label>Trigger</Label>
								<Select
									value={formData.trigger_type}
									onValueChange={(value: ReminderInput['trigger_type']) => {
										setFormData({
											...formData,
											trigger_type: value,
											message_template: getDefaultTemplate(value),
										});
									}}>
									<SelectTrigger>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value='days_before_expiry'>
											Days before document expires
										</SelectItem>
										<SelectItem value='days_after_upload'>
											Days after document upload
										</SelectItem>
										<SelectItem value='manual'>Manual trigger only</SelectItem>
									</SelectContent>
								</Select>
							</div>

							{formData.trigger_type !== 'manual' && (
								<div className='space-y-2'>
									<Label>Days</Label>
									<Input
										type='number'
										min={1}
										max={365}
										value={formData.trigger_days || ''}
										onChange={(e) =>
											setFormData({
												...formData,
												trigger_days: parseInt(e.target.value) || null,
											})
										}
										className={errors.trigger_days ? 'border-destructive' : ''}
									/>
									{errors.trigger_days && (
										<p className='text-xs text-destructive'>
											{errors.trigger_days}
										</p>
									)}
								</div>
							)}

							<div className='space-y-2'>
								<Label>Email Template</Label>
								<Textarea
									value={formData.message_template}
									onChange={(e) =>
										setFormData({
											...formData,
											message_template: e.target.value,
										})
									}
									placeholder='Email message template...'
									rows={6}
									className='font-mono text-sm'
								/>
								<p className='text-xs text-muted-foreground'>
									Available variables: {'{{carer_name}}'}, {'{{document_type}}'}
									, {'{{expiry_date}}'}, {'{{onboarding_link}}'},{' '}
									{'{{organization_name}}'}
								</p>
							</div>

							<div className='flex items-center justify-between rounded-lg border p-4'>
								<div className='space-y-0.5'>
									<Label>Active</Label>
									<p className='text-sm text-muted-foreground'>
										Enable this automation
									</p>
								</div>
								<Switch
									checked={formData.is_active}
									onCheckedChange={(checked) =>
										setFormData({ ...formData, is_active: checked })
									}
								/>
							</div>
						</div>

						<DialogFooter>
							<Button variant='outline' onClick={() => setIsDialogOpen(false)}>
								Cancel
							</Button>
							<Button onClick={handleSave} disabled={isSaving}>
								{isSaving ? 'Saving...' : editingReminder ? 'Update' : 'Create'}
							</Button>
						</DialogFooter>
					</DialogContent>
				</Dialog>
			</div>

			{/* Email configuration warning */}
			{!emailConfigured && (
				<Card className='mb-6 border-amber-200 bg-amber-50/50'>
					<CardContent className='py-4'>
						<div className='flex gap-3'>
							<AlertCircle className='w-5 h-5 text-amber-600 shrink-0 mt-0.5' />
							<div>
								<p className='font-medium text-amber-800'>
									Email sending not configured
								</p>
								<p className='text-sm text-amber-700 mt-1'>
									To send automated reminder emails, add your{' '}
									<code className='bg-amber-100 px-1 rounded'>
										RESEND_API_KEY
									</code>{' '}
									environment variable. Get your API key from{' '}
									<a
										href='https://resend.com'
										target='_blank'
										rel='noopener noreferrer'
										className='underline'>
										resend.com
									</a>
									.
								</p>
							</div>
						</div>
					</CardContent>
				</Card>
			)}

			{!automationTablesReady && (
				<Card className='mb-6 border-amber-200 bg-amber-50/50'>
					<CardContent className='py-4'>
						<div className='flex gap-3'>
							<AlertCircle className='w-5 h-5 text-amber-600 shrink-0 mt-0.5' />
							<div>
								<p className='font-medium text-amber-800'>
									Automations are not set up yet
								</p>
								<p className='text-sm text-amber-700 mt-1'>
									The reminders tables have not been added to the database yet.
									This page will start working once those migrations exist.
								</p>
							</div>
						</div>
					</CardContent>
				</Card>
			)}

			<div className='grid gap-6 lg:grid-cols-3'>
				{/* Automations list */}
				<div className='lg:col-span-2 space-y-4'>
					<h2 className='text-sm font-medium text-muted-foreground uppercase tracking-wider'>
						Reminder Rules
					</h2>

					{reminders.length === 0 ? (
						<Card>
							<CardContent className='py-12 text-center'>
								<Zap className='w-10 h-10 mx-auto text-muted-foreground/50 mb-4' />
								<h3 className='font-medium mb-1'>No automations yet</h3>
								<p className='text-sm text-muted-foreground mb-4'>
									Create your first automation to send automatic reminders.
								</p>
								<Button
									onClick={openCreateDialog}
									disabled={!automationTablesReady}>
									<Plus className='w-4 h-4 mr-2' />
									Create Automation
								</Button>
							</CardContent>
						</Card>
					) : (
						<div className='space-y-3'>
							{reminders.map((reminder) => (
								<Card
									key={reminder.id}
									className={!reminder.is_active ? 'opacity-60' : ''}>
									<CardContent className='py-4'>
										<div className='flex items-start justify-between gap-4'>
											<div className='flex items-start gap-3 min-w-0'>
												<div
													className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
														reminder.is_active
															? 'bg-primary/10 text-primary'
															: 'bg-muted text-muted-foreground'
													}`}>
													{getTriggerIcon(reminder.trigger_type)}
												</div>
												<div className='min-w-0'>
													<div className='flex items-center gap-2'>
														<h3 className='font-medium truncate'>
															{reminder.name}
														</h3>
														{reminder.is_active ? (
															<span className='text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium'>
																Active
															</span>
														) : (
															<span className='text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium'>
																Paused
															</span>
														)}
													</div>
													<p className='text-sm text-muted-foreground mt-0.5'>
														{getTriggerLabel(
															reminder.trigger_type,
															reminder.trigger_days,
														)}
													</p>
												</div>
											</div>

											<div className='flex items-center gap-2 shrink-0'>
												<Switch
													checked={reminder.is_active}
													onCheckedChange={() => toggleActive(reminder)}
												/>
												<DropdownMenu>
													<DropdownMenuTrigger asChild>
														<Button
															variant='ghost'
															size='icon'
															className='h-8 w-8'>
															<MoreHorizontal className='w-4 h-4' />
														</Button>
													</DropdownMenuTrigger>
													<DropdownMenuContent align='end'>
														<DropdownMenuItem
															onClick={() => openEditDialog(reminder)}>
															<Pencil className='w-4 h-4 mr-2' />
															Edit
														</DropdownMenuItem>
														<DropdownMenuItem
															onClick={() => deleteReminder(reminder.id)}
															className='text-destructive'>
															<Trash2 className='w-4 h-4 mr-2' />
															Delete
														</DropdownMenuItem>
													</DropdownMenuContent>
												</DropdownMenu>
											</div>
										</div>
									</CardContent>
								</Card>
							))}
						</div>
					)}
				</div>

				{/* Recent activity */}
				<div className='space-y-4'>
					<h2 className='text-sm font-medium text-muted-foreground uppercase tracking-wider'>
						Recent Emails
					</h2>

					<Card>
						<CardContent className='py-4'>
							{logs.length === 0 ? (
								<div className='text-center py-8'>
									<Send className='w-8 h-8 mx-auto text-muted-foreground/50 mb-3' />
									<p className='text-sm text-muted-foreground'>
										No emails sent yet
									</p>
								</div>
							) : (
								<div className='space-y-3'>
									{logs.map((log) => (
										<div
											key={log.id}
											className='flex items-start gap-3 pb-3 border-b last:border-0 last:pb-0'>
											<div
												className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
													log.status === 'sent' || log.status === 'delivered'
														? 'bg-green-100 text-green-600'
														: 'bg-red-100 text-red-600'
												}`}>
												{log.status === 'sent' || log.status === 'delivered' ? (
													<CheckCircle2 className='w-4 h-4' />
												) : (
													<AlertCircle className='w-4 h-4' />
												)}
											</div>
											<div className='min-w-0 flex-1'>
												<p className='text-sm font-medium truncate'>
													{log.carers?.full_name}
												</p>
												<p className='text-xs text-muted-foreground truncate'>
													{log.documents?.document_types?.name ||
														'General reminder'}
												</p>
												<p className='text-xs text-muted-foreground mt-1'>
													{new Date(log.sent_at).toLocaleDateString('en-GB', {
														day: 'numeric',
														month: 'short',
														hour: '2-digit',
														minute: '2-digit',
													})}
												</p>
											</div>
										</div>
									))}
								</div>
							)}
						</CardContent>
					</Card>
				</div>
			</div>
		</div>
	);
}

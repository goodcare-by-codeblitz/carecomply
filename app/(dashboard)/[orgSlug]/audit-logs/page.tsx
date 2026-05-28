'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
	Search,
	History,
	User,
	FileText,
	Users,
	Mail,
	Settings,
	CheckCircle,
	XCircle,
	Upload,
	Eye,
	Trash2,
	Plus,
	Edit,
	Zap,
	ChevronLeft,
	ChevronRight,
	Download,
	ShieldCheck,
	RefreshCcw,
	AlertCircle,
} from 'lucide-react';
import { useRef, useState, useEffect } from 'react';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { useParams } from 'next/navigation';
import { toast } from 'sonner';

type AuditLog = {
	id: string;
	user_email: string;
	action: string;
	entity_type: string;
	entity_id: string | null;
	entity_name: string | null;
	details: Record<string, unknown>;
	ip_address: string | null;
	category: string | null;
	severity: string | null;
	source: string | null;
	cqc_key_question: string | null;
	created_at: string;
};

type AuditCapabilities = {
	advancedAudit: boolean;
	csvExport: boolean;
	excelExport: boolean;
	cqcFilters: boolean;
	fullDetails: boolean;
	maxRetentionDays: number | null;
};

const DEFAULT_AUDIT_CAPABILITIES: AuditCapabilities = {
	advancedAudit: false,
	csvExport: true,
	excelExport: false,
	cqcFilters: false,
	fullDetails: false,
	maxRetentionDays: 90,
};

const ACTION_ICONS: Record<string, typeof FileText> = {
	'carer.created': Plus,
	'carer.updated': Edit,
	'carer.deleted': Trash2,
	'carer.invited': Mail,
	'document.uploaded': Upload,
	'document.approved': CheckCircle,
	'document.rejected': XCircle,
	'document.replaced': RefreshCcw,
	'document.updated': Edit,
	'document.deleted': Trash2,
	'document.viewed': Eye,
	'reminder.created': Plus,
	'reminder.updated': Edit,
	'reminder.deleted': Trash2,
	'reminder.toggled': Zap,
	'reminder.worker_configuration_missing': XCircle,
	'email.sent': Mail,
	'settings.updated': Settings,
	'user.login_attempted': User,
	'user.login_failed': XCircle,
	'user.login': User,
	'user.logout': User,
	'billing.checkout_started': Settings,
	'billing.portal_opened': Settings,
	'billing.subscription_change_requested': Settings,
	'billing.checkout_completed': CheckCircle,
	'billing.subscription_updated': CheckCircle,
	'billing.invoice_payment_failed': XCircle,
	'carer.marked_former': Trash2,
	'carer.marked_on_leave': Edit,
	'carer.returned_from_leave': CheckCircle,
	'carer.restored': CheckCircle,
	'carer.suspended': XCircle,
	'document_type.created': Plus,
	'document_type.updated': Edit,
	'document_type.deleted': Trash2,
	'audit.exported': Download,
	'audit.export_verified': ShieldCheck,
	'invitation.revoked': XCircle,
	'invitation.reinvited': Mail,
	'onboarding.references_updated': Edit,
	'reference.approved': CheckCircle,
	'reference.rejected': XCircle,
	'reference.requested': Mail,
	'reference.responded': CheckCircle,
	'team.member_removed': Trash2,
	'team.member_marked_former': Trash2,
	'team.member_on_leave': Edit,
	'team.member_restored': CheckCircle,
	'team.member_returned': CheckCircle,
	'team.member_suspended': XCircle,
	'team.role_changed': Edit,
};

const ACTION_LABELS: Record<string, string> = {
	'carer.created': 'Created carer',
	'carer.updated': 'Updated carer',
	'carer.deleted': 'Deleted carer',
	'carer.invited': 'Invited carer',
	'document.uploaded': 'Uploaded document',
	'document.approved': 'Approved document',
	'document.rejected': 'Rejected document',
	'document.replaced': 'Replaced document',
	'document.updated': 'Updated document',
	'document.deleted': 'Deleted document',
	'document.viewed': 'Viewed document',
	'reminder.created': 'Created reminder',
	'reminder.updated': 'Updated reminder',
	'reminder.deleted': 'Deleted reminder',
	'reminder.toggled': 'Toggled reminder',
	'reminder.worker_configuration_missing': 'Reminder worker configuration missing',
	'email.sent': 'Sent email',
	'settings.updated': 'Updated settings',
	'user.login_attempted': 'Login attempted',
	'user.login_failed': 'Login failed',
	'user.login': 'Logged in',
	'user.logout': 'Logged out',
	'billing.checkout_started': 'Started billing checkout',
	'billing.portal_opened': 'Opened billing portal',
	'billing.subscription_change_requested': 'Requested subscription change',
	'billing.checkout_completed': 'Checkout completed',
	'billing.subscription_updated': 'Subscription updated',
	'billing.invoice_payment_failed': 'Invoice payment failed',
	'carer.marked_former': 'Moved carer to former',
	'carer.marked_on_leave': 'Marked carer on leave',
	'carer.returned_from_leave': 'Returned carer from leave',
	'carer.restored': 'Restored carer',
	'carer.suspended': 'Suspended carer',
	'document_type.created': 'Created document requirement',
	'document_type.updated': 'Updated document requirement',
	'document_type.deleted': 'Deleted document requirement',
	'audit.exported': 'Exported audit logs',
	'audit.export_verified': 'Verified audit export',
	'invitation.revoked': 'Revoked invitation',
	'invitation.reinvited': 'Reinvited',
	'onboarding.references_updated': 'Updated onboarding references',
	'reference.approved': 'Approved reference',
	'reference.rejected': 'Rejected reference',
	'reference.requested': 'Requested reference',
	'reference.responded': 'Reference responded',
	'team.member_removed': 'Removed team member',
	'team.member_marked_former': 'Moved team member to former',
	'team.member_on_leave': 'Marked team member on leave',
	'team.member_restored': 'Restored team member',
	'team.member_returned': 'Returned team member',
	'team.member_suspended': 'Suspended team member',
	'team.role_changed': 'Changed team role',
};

const ENTITY_ICONS: Record<string, typeof FileText> = {
	carer: Users,
	document: FileText,
	reminder: Zap,
	organization: Settings,
	user: User,
	email: Mail,
	billing: Settings,
	document_type: FileText,
	invitation: Mail,
	reference: Mail,
	team_member: Users,
	audit_export: ShieldCheck,
};

export default function AuditLogsPage() {
	const { orgSlug } = useParams<{ orgSlug: string }>();
	const [logs, setLogs] = useState<AuditLog[]>([]);
	const [loading, setLoading] = useState(true);
	const [search, setSearch] = useState('');
	const [entityFilter, setEntityFilter] = useState<string>('all');
	const [categoryFilter, setCategoryFilter] = useState<string>('all');
	const [severityFilter, setSeverityFilter] = useState<string>('all');
	const [cqcFilter, setCqcFilter] = useState<string>('all');
	const [dateFrom, setDateFrom] = useState('');
	const [dateTo, setDateTo] = useState('');
	const [page, setPage] = useState(1);
	const [totalPages, setTotalPages] = useState(1);
	const [exporting, setExporting] = useState(false);
	const [verifying, setVerifying] = useState(false);
	const [capabilities, setCapabilities] = useState<AuditCapabilities>(
		DEFAULT_AUDIT_CAPABILITIES,
	);
	const verifyInputRef = useRef<HTMLInputElement | null>(null);
	const pageSize = 20;

	useEffect(() => {
		fetchLogs();
	}, [page, entityFilter, categoryFilter, severityFilter, cqcFilter, dateFrom, dateTo, orgSlug]);

	const fetchLogs = async () => {
		setLoading(true);
		const response = await fetch(buildAuditUrl());
		const payload = (await response.json().catch(() => ({}))) as {
			logs?: AuditLog[];
			totalPages?: number;
			capabilities?: AuditCapabilities;
			warnings?: string[];
			error?: string;
		};

		if (!response.ok) {
			toast.error(payload.error ?? 'Audit logs could not be loaded');
			setLogs([]);
			setTotalPages(1);
		} else {
			setLogs(payload.logs ?? []);
			setTotalPages(payload.totalPages ?? 1);
			setCapabilities(payload.capabilities ?? DEFAULT_AUDIT_CAPABILITIES);
			payload.warnings?.forEach((warning) => toast.warning(warning));
		}
		setLoading(false);
	};

	const buildAuditUrl = (exportFormat?: 'csv' | 'xlsx') => {
		const params = new URLSearchParams({
			orgSlug,
			page: String(page),
			pageSize: String(pageSize),
		});
		if (exportFormat) params.set('export', exportFormat);
		if (entityFilter !== 'all') params.set('entity_type', entityFilter);
		if (capabilities.advancedAudit) {
			if (categoryFilter !== 'all') params.set('category', categoryFilter);
			if (severityFilter !== 'all') params.set('severity', severityFilter);
			if (cqcFilter !== 'all') params.set('cqc_key_question', cqcFilter);
			if (dateFrom) params.set('dateFrom', new Date(dateFrom).toISOString());
			if (dateTo) {
				const end = new Date(dateTo);
				end.setHours(23, 59, 59, 999);
				params.set('dateTo', end.toISOString());
			}
		}
		return `/api/audit?${params.toString()}`;
	};

	const exportAuditLogs = async (format: 'csv' | 'xlsx') => {
		setExporting(true);
		try {
			const response = await fetch(buildAuditUrl(format));
			if (!response.ok) throw new Error('Export failed');
			const blob = await response.blob();
			const url = URL.createObjectURL(blob);
			const link = document.createElement('a');
			link.href = url;
			link.download =
				format === 'xlsx'
					? `carecomply-cqc-audit-${orgSlug}.xlsx`
					: `carecomply-audit-${orgSlug}.csv`;
			document.body.appendChild(link);
			link.click();
			link.remove();
			URL.revokeObjectURL(url);
		} catch {
			toast.error('Audit export could not be downloaded');
		} finally {
			setExporting(false);
		}
	};

	const verifyAuditExport = async (file: File | null) => {
		if (!file) return;

		setVerifying(true);
		try {
			const body = new FormData();
			body.set('file', file);
			const response = await fetch('/api/audit/verify-export', {
				method: 'POST',
				body,
			});
			const payload = (await response.json().catch(() => ({}))) as {
				valid?: boolean;
				reason?: string;
				error?: string;
			};

			if (!response.ok) {
				throw new Error(payload.error || payload.reason || 'Verification failed');
			}

			if (payload.valid) {
				toast.success(payload.reason || 'Export is valid');
			} else {
				toast.error(payload.reason || 'Export has been changed');
			}
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : 'Export could not be verified',
			);
		} finally {
			setVerifying(false);
			if (verifyInputRef.current) verifyInputRef.current.value = '';
		}
	};

	const filteredLogs = logs.filter((log) => {
		if (!search) return true;
		const searchLower = search.toLowerCase();
		return (
			log.user_email?.toLowerCase().includes(searchLower) ||
			log.entity_name?.toLowerCase().includes(searchLower) ||
			log.action?.toLowerCase().includes(searchLower)
		);
	});

	const formatDate = (dateStr: string) => {
		const date = new Date(dateStr);
		const now = new Date();
		const diff = now.getTime() - date.getTime();
		const minutes = Math.floor(diff / 60000);
		const hours = Math.floor(diff / 3600000);
		const days = Math.floor(diff / 86400000);

		if (minutes < 1) return 'Just now';
		if (minutes < 60) return `${minutes}m ago`;
		if (hours < 24) return `${hours}h ago`;
		if (days < 7) return `${days}d ago`;
		return date.toLocaleDateString('en-GB', {
			day: 'numeric',
			month: 'short',
			year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
		});
	};

	const getActionColor = (action: string) => {
		if (action.includes('approved') || action.includes('completed'))
			return 'text-ok bg-ok-50';
		if (
			action.includes('rejected') ||
			action.includes('deleted') ||
			action.includes('failed') ||
			action.includes('removed')
		)
			return 'text-danger bg-danger-50';
		if (action.includes('created') || action.includes('uploaded'))
			return 'text-brand-700 bg-brand-50';
		if (action.includes('updated') || action.includes('toggled'))
			return 'text-warn bg-warn-50';
		return 'text-slate-500 bg-surface-muted';
	};

	const label = (value: string | null) =>
		value ? value.replace(/_/g, ' ').replace(/^\w/, (char) => char.toUpperCase()) : 'Unspecified';

	const cqcCoverage = ['safe', 'effective', 'caring', 'responsive', 'well_led'].map(
		(key) => ({
			key,
			count: logs.filter((log) => log.cqc_key_question === key).length,
		}),
	);

	return (
		<div className='min-h-full'>
			{/* Page header */}
			<div className='border-b border-line bg-white px-6 py-5 lg:px-8'>
				<div className='mx-auto flex max-w-7xl flex-col gap-4 sm:flex-row sm:items-start sm:justify-between'>
					<div>
						<h1 className='text-[22px] font-semibold tracking-tight text-ink'>Audit Logs</h1>
						<p className='mt-0.5 text-[13px] text-slate-500'>
							Track governance, staffing, billing, and compliance evidence for CQC inspection.
						</p>
					</div>
					<div className='flex flex-wrap gap-2'>
						<input
							ref={verifyInputRef}
							type='file'
							accept='.csv,.xlsx'
							className='hidden'
							onChange={(event) =>
								verifyAuditExport(event.currentTarget.files?.[0] ?? null)
							}
						/>
						<Button
							type='button'
							variant='outline'
							size='sm'
							className='h-9 text-[13.5px]'
							onClick={() => exportAuditLogs('csv')}
							disabled={exporting}>
							<Download className='mr-2 h-3.5 w-3.5' />
							{exporting ? 'Exporting...' : 'Export CSV'}
						</Button>
						{capabilities.excelExport && (
							<Button
								type='button'
								variant='outline'
								size='sm'
								className='h-9 text-[13.5px]'
								onClick={() => exportAuditLogs('xlsx')}
								disabled={exporting}>
								<Download className='mr-2 h-3.5 w-3.5' />
								Export Excel
							</Button>
						)}
						<Button
							type='button'
							variant='outline'
							size='sm'
							className='h-9 text-[13.5px]'
							onClick={() => verifyInputRef.current?.click()}
							disabled={verifying}>
							<ShieldCheck className='mr-2 h-3.5 w-3.5' />
							{verifying ? 'Verifying...' : 'Verify export'}
						</Button>
					</div>
				</div>
			</div>

			<div className='mx-auto max-w-7xl space-y-6 px-6 py-6 lg:px-8'>
				<p className='text-[13px] text-slate-500'>
					Tamper-evident exports include a CareComply signature. Use Verify
					export to confirm a downloaded file has not changed.
				</p>

				{!capabilities.advancedAudit && (
					<div className='flex items-start gap-3 rounded-xl border border-warn/30 bg-warn-50 px-4 py-3.5'>
						<AlertCircle className='mt-0.5 h-4 w-4 shrink-0 text-warn' />
						<p className='text-[13px] text-slate-700'>
							Starter includes 90-day basic audit logs with CSV export. Upgrade
							to Pro for full CQC filters, evidence summaries, and Excel export.
						</p>
					</div>
				)}

				{capabilities.advancedAudit && (
					<div className='grid gap-4 sm:grid-cols-3 md:grid-cols-5'>
						{cqcCoverage.map((item) => (
							<div
								key={item.key}
								className='rounded-xl border border-line bg-white p-4 shadow-card'>
								<div className='flex items-center gap-3'>
									<ShieldCheck className='h-5 w-5 text-brand-700' />
									<div>
										<p className='text-[11.5px] font-semibold uppercase tracking-[0.10em] text-slate-400'>
											{label(item.key)}
										</p>
										<p className='text-[22px] font-semibold leading-none tracking-tight text-ink'>
											{item.count}
										</p>
									</div>
								</div>
							</div>
						))}
					</div>
				)}

				{/* Filters */}
				<div className='flex flex-wrap items-center gap-3'>
					<div className='relative min-w-[200px] flex-1 max-w-sm'>
						<Search className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400' />
						<Input
							placeholder='Search by user, action, or entity...'
							className='h-9 pl-9 text-[13.5px]'
							value={search}
							onChange={(e) => setSearch(e.target.value)}
						/>
					</div>
					<Select
						value={entityFilter}
						onValueChange={(v) => {
							setEntityFilter(v);
							setPage(1);
						}}>
						<SelectTrigger className='h-9 w-[160px] text-[13.5px]'>
							<History className='mr-1.5 h-3.5 w-3.5 text-slate-400' />
							<SelectValue placeholder='Filter by type' />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value='all'>All Activities</SelectItem>
							<SelectItem value='carer'>Carers</SelectItem>
							<SelectItem value='document'>Documents</SelectItem>
							<SelectItem value='reminder'>Reminders</SelectItem>
							<SelectItem value='email'>Emails</SelectItem>
							<SelectItem value='user'>Users</SelectItem>
							<SelectItem value='billing'>Billing</SelectItem>
							<SelectItem value='document_type'>Requirements</SelectItem>
							<SelectItem value='team_member'>Team Members</SelectItem>
						</SelectContent>
					</Select>
					{capabilities.advancedAudit && (
						<Select value={categoryFilter} onValueChange={(v) => { setCategoryFilter(v); setPage(1); }}>
							<SelectTrigger className='h-9 w-[140px] text-[13.5px]'>
								<SelectValue placeholder='Category' />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value='all'>All Categories</SelectItem>
								<SelectItem value='billing'>Billing</SelectItem>
								<SelectItem value='documents'>Documents</SelectItem>
								<SelectItem value='governance'>Governance</SelectItem>
								<SelectItem value='onboarding'>Onboarding</SelectItem>
								<SelectItem value='staffing'>Staffing</SelectItem>
							</SelectContent>
						</Select>
					)}
					{capabilities.advancedAudit && (
						<Select value={severityFilter} onValueChange={(v) => { setSeverityFilter(v); setPage(1); }}>
							<SelectTrigger className='h-9 w-[130px] text-[13.5px]'>
								<SelectValue placeholder='Severity' />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value='all'>All Severity</SelectItem>
								<SelectItem value='info'>Info</SelectItem>
								<SelectItem value='warning'>Warning</SelectItem>
								<SelectItem value='critical'>Critical</SelectItem>
							</SelectContent>
						</Select>
					)}
					{capabilities.advancedAudit && (
						<Select value={cqcFilter} onValueChange={(v) => { setCqcFilter(v); setPage(1); }}>
							<SelectTrigger className='h-9 w-[120px] text-[13.5px]'>
								<SelectValue placeholder='CQC' />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value='all'>All CQC</SelectItem>
								<SelectItem value='safe'>Safe</SelectItem>
								<SelectItem value='effective'>Effective</SelectItem>
								<SelectItem value='caring'>Caring</SelectItem>
								<SelectItem value='responsive'>Responsive</SelectItem>
								<SelectItem value='well_led'>Well-led</SelectItem>
							</SelectContent>
						</Select>
					)}
					{capabilities.advancedAudit && (
						<>
							<Input
								type='date'
								value={dateFrom}
								onChange={(event) => { setDateFrom(event.target.value); setPage(1); }}
								className='h-9 w-[140px] text-[13.5px]'
							/>
							<Input
								type='date'
								value={dateTo}
								onChange={(event) => { setDateTo(event.target.value); setPage(1); }}
								className='h-9 w-[140px] text-[13.5px]'
							/>
						</>
					)}
				</div>

				{/* Logs table */}
				<div className='overflow-hidden rounded-xl border border-line bg-white shadow-card'>
					{/* Table header */}
					<div className='border-b border-line bg-surface-page px-5 py-2.5'>
						<div className='grid grid-cols-[140px_1fr_1fr_1fr] gap-4'>
							<span className='text-[11.5px] font-semibold uppercase tracking-[0.10em] text-slate-400'>
								Time
							</span>
							<span className='text-[11.5px] font-semibold uppercase tracking-[0.10em] text-slate-400'>
								User
							</span>
							<span className='text-[11.5px] font-semibold uppercase tracking-[0.10em] text-slate-400'>
								Action
							</span>
							<span className='text-[11.5px] font-semibold uppercase tracking-[0.10em] text-slate-400'>
								Entity
							</span>
						</div>
					</div>

					{loading ? (
						<div className='divide-y divide-line'>
							{[1, 2, 3, 4, 5].map((i) => (
								<div key={i} className='grid grid-cols-[140px_1fr_1fr_1fr] gap-4 px-5 py-4 animate-pulse'>
									<div className='h-3.5 w-16 rounded bg-surface-muted' />
									<div className='flex items-center gap-2'>
										<div className='h-7 w-7 rounded-full bg-surface-muted' />
										<div className='h-3.5 w-28 rounded bg-surface-muted' />
									</div>
									<div className='flex items-center gap-2'>
										<div className='h-7 w-7 rounded-lg bg-surface-muted' />
										<div className='h-3.5 w-24 rounded bg-surface-muted' />
									</div>
									<div className='h-3.5 w-20 rounded bg-surface-muted' />
								</div>
							))}
						</div>
					) : filteredLogs.length > 0 ? (
						<>
							<div className='divide-y divide-line'>
								{filteredLogs.map((log) => {
									const ActionIcon = ACTION_ICONS[log.action] || History;
									const EntityIcon = ENTITY_ICONS[log.entity_type] || FileText;
									const actionColor = getActionColor(log.action);

									return (
										<div
											key={log.id}
											className='grid grid-cols-[140px_1fr_1fr_1fr] items-center gap-4 px-5 py-3.5 transition-colors hover:bg-surface-page'>
											{/* Time */}
											<div>
												<p className='text-[13px] font-medium text-ink'>
													{formatDate(log.created_at)}
												</p>
												<p className='font-mono text-[10.5px] text-slate-400'>
													{new Date(log.created_at).toLocaleTimeString('en-GB', {
														hour: '2-digit',
														minute: '2-digit',
													})}
												</p>
											</div>
											{/* User */}
											<div className='flex items-center gap-2 min-w-0'>
												<div className='flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-muted'>
													<User className='h-3.5 w-3.5 text-slate-400' />
												</div>
												<span className='truncate text-[13px] text-ink'>
													{log.user_email || 'System'}
												</span>
											</div>
											{/* Action */}
											<div className='flex items-center gap-2 min-w-0'>
												<div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${actionColor}`}>
													<ActionIcon className='h-3.5 w-3.5' />
												</div>
												<div className='min-w-0'>
													<span className='truncate text-[13px] text-ink'>
														{ACTION_LABELS[log.action] || log.action}
													</span>
													{capabilities.advancedAudit && log.cqc_key_question && (
														<p className='text-[11px] text-slate-400'>
															{label(log.cqc_key_question)} &middot; {label(log.category)}
														</p>
													)}
												</div>
											</div>
											{/* Entity */}
											<div className='min-w-0'>
												{log.entity_name && (
													<div className='flex items-center gap-2'>
														<EntityIcon className='h-3.5 w-3.5 shrink-0 text-slate-400' />
														<span className='truncate text-[13px] text-ink'>
															{log.entity_name}
														</span>
													</div>
												)}
												{capabilities.fullDetails &&
													log.details &&
													Object.keys(log.details).length > 0 && (
														<div className='mt-1 space-y-0.5'>
															{Object.entries(log.details)
																.filter(([key]) => !['user_agent'].includes(key))
																.slice(0, 2)
																.map(([key, value]) => (
																	<p key={key} className='truncate text-[11px] text-slate-400'>
																		<span className='font-medium'>{label(key)}:</span>{' '}
																		{typeof value === 'object'
																			? JSON.stringify(value)
																			: String(value)}
																	</p>
																))}
														</div>
													)}
											</div>
										</div>
									);
								})}
							</div>

							{/* Pagination */}
							<div className='flex items-center justify-between border-t border-line px-5 py-3'>
								<p className='text-[12.5px] text-slate-500'>
									Showing {(page - 1) * pageSize + 1}–
									{Math.min(page * pageSize, (page - 1) * pageSize + filteredLogs.length)}{' '}
									results
								</p>
								<div className='flex items-center gap-2'>
									<Button
										variant='outline'
										size='sm'
										className='h-8 text-[12.5px]'
										onClick={() => setPage((p) => Math.max(1, p - 1))}
										disabled={page <= 1}>
										<ChevronLeft className='h-3.5 w-3.5' />
										Previous
									</Button>
									<Button
										variant='outline'
										size='sm'
										className='h-8 text-[12.5px]'
										onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
										disabled={page >= totalPages}>
										Next
										<ChevronRight className='h-3.5 w-3.5' />
									</Button>
								</div>
							</div>
						</>
					) : (
						<div className='flex flex-col items-center justify-center py-20 text-center'>
							<div className='flex h-14 w-14 items-center justify-center rounded-full bg-surface-muted'>
								<History className='h-6 w-6 text-slate-400' />
							</div>
							<p className='mt-4 text-[15px] font-semibold text-ink'>No activity yet</p>
							<p className='mt-2 max-w-sm text-[13.5px] leading-snug text-slate-500'>
								Actions performed in your organization will appear here.
							</p>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}

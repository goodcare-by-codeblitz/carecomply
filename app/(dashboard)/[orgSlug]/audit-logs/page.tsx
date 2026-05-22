'use client';

import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
	CardDescription,
} from '@/components/ui/card';
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
} from 'lucide-react';
import { useRef, useState, useEffect } from 'react';
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
		if (action.includes('approved') || action.includes('completed')) return 'text-green-600 bg-green-50';
		if (action.includes('rejected') || action.includes('deleted') || action.includes('failed') || action.includes('removed'))
			return 'text-red-600 bg-red-50';
		if (action.includes('created') || action.includes('uploaded'))
			return 'text-blue-600 bg-blue-50';
		if (action.includes('updated') || action.includes('toggled'))
			return 'text-amber-600 bg-amber-50';
		return 'text-muted-foreground bg-muted';
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
		<div className='p-8 max-w-7xl mx-auto'>
			{/* Page header */}
			<div className='mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between'>
				<div>
					<h1 className='text-2xl font-semibold tracking-tight'>Audit Logs</h1>
					<p className='text-muted-foreground mt-1'>
						Track governance, staffing, billing, and compliance evidence for
						CQC inspection.
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
						onClick={() => exportAuditLogs('csv')}
						disabled={exporting}>
						<Download className='mr-2 h-4 w-4' />
						{exporting ? 'Exporting...' : 'Export CSV'}
					</Button>
					{capabilities.excelExport && (
						<Button
							type='button'
							variant='outline'
							onClick={() => exportAuditLogs('xlsx')}
							disabled={exporting}>
							<Download className='mr-2 h-4 w-4' />
							Export Excel
						</Button>
					)}
					<Button
						type='button'
						variant='outline'
						onClick={() => verifyInputRef.current?.click()}
						disabled={verifying}>
						<ShieldCheck className='mr-2 h-4 w-4' />
						{verifying ? 'Verifying...' : 'Verify export'}
					</Button>
				</div>
			</div>

			<p className='mb-6 text-sm text-muted-foreground'>
				Tamper-evident exports include a CareComply signature. Use Verify
				export to confirm a downloaded file has not changed.
			</p>

			{!capabilities.advancedAudit && (
				<Card className='mb-6 border-amber-200 bg-amber-50/50'>
					<CardContent className='py-4 text-sm text-amber-900'>
						Starter includes 90-day basic audit logs with CSV export. Upgrade
						to Pro for full CQC filters, evidence summaries, and Excel export.
					</CardContent>
				</Card>
			)}

			{capabilities.advancedAudit && (
				<div className='mb-6 grid gap-3 md:grid-cols-5'>
					{cqcCoverage.map((item) => (
						<Card key={item.key}>
							<CardContent className='flex items-center gap-3 p-4'>
								<ShieldCheck className='h-5 w-5 text-muted-foreground' />
								<div>
									<p className='text-xs text-muted-foreground'>{label(item.key)}</p>
									<p className='text-lg font-semibold'>{item.count}</p>
								</div>
							</CardContent>
						</Card>
					))}
				</div>
			)}

			{/* Filters */}
			<div className='grid gap-4 mb-6 lg:grid-cols-[minmax(0,1fr)_repeat(5,160px)]'>
				<div className='relative flex-1 max-w-md'>
					<Search className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground' />
					<Input
						placeholder='Search by user, action, or entity...'
						className='pl-10 h-11'
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
					<SelectTrigger className='w-40 h-11'>
						<History className='w-4 h-4 mr-2' />
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
					<SelectTrigger className='h-11'>
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
					<SelectTrigger className='h-11'>
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
					<SelectTrigger className='h-11'>
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
						<Input type='date' value={dateFrom} onChange={(event) => { setDateFrom(event.target.value); setPage(1); }} className='h-11' />
						<Input type='date' value={dateTo} onChange={(event) => { setDateTo(event.target.value); setPage(1); }} className='h-11' />
					</>
				)}
			</div>

			{/* Logs table */}
			<Card>
				<CardHeader>
					<CardTitle className='text-base'>Activity History</CardTitle>
					<CardDescription>
						{totalPages > 0 && `Page ${page} of ${totalPages}`}
					</CardDescription>
				</CardHeader>
				<CardContent>
					{loading ? (
						<div className='flex items-center justify-center py-12'>
							<div className='w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin' />
						</div>
					) : filteredLogs.length > 0 ? (
						<>
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead className='w-40'>Time</TableHead>
										<TableHead>User</TableHead>
										<TableHead>Action</TableHead>
										{capabilities.advancedAudit && <TableHead>CQC</TableHead>}
										<TableHead>Entity</TableHead>
										{capabilities.fullDetails && (
											<TableHead className='hidden md:table-cell'>
												Details
											</TableHead>
										)}
									</TableRow>
								</TableHeader>
								<TableBody>
									{filteredLogs.map((log) => {
										const ActionIcon = ACTION_ICONS[log.action] || History;
										const EntityIcon =
											ENTITY_ICONS[log.entity_type] || FileText;
										const actionColor = getActionColor(log.action);

										return (
											<TableRow key={log.id}>
												<TableCell className='font-mono text-xs text-muted-foreground'>
													<div>
														<span className='font-medium text-foreground'>
															{formatDate(log.created_at)}
														</span>
														<br />
														<span className='text-[10px]'>
															{new Date(log.created_at).toLocaleTimeString(
																'en-GB',
																{
																	hour: '2-digit',
																	minute: '2-digit',
																},
															)}
														</span>
													</div>
												</TableCell>
												<TableCell>
													<div className='flex items-center gap-2'>
														<div className='w-7 h-7 rounded-full bg-muted flex items-center justify-center'>
															<User className='w-3.5 h-3.5 text-muted-foreground' />
														</div>
														<span className='text-sm truncate max-w-[150px]'>
															{log.user_email || 'System'}
														</span>
													</div>
												</TableCell>
												<TableCell>
													<div className='flex items-center gap-2'>
														<div
															className={`w-7 h-7 rounded-lg flex items-center justify-center ${actionColor}`}>
															<ActionIcon className='w-3.5 h-3.5' />
														</div>
														<span className='text-sm'>
															{ACTION_LABELS[log.action] || log.action}
														</span>
													</div>
												</TableCell>
												{capabilities.advancedAudit && (
													<TableCell>
														<div className='space-y-1 text-xs'>
															<div className='font-medium'>{label(log.cqc_key_question)}</div>
															<div className='text-muted-foreground'>
																{label(log.category)} &middot; {label(log.severity)}
															</div>
														</div>
													</TableCell>
												)}
												<TableCell>
													{log.entity_name && (
														<div className='flex items-center gap-2'>
															<EntityIcon className='w-4 h-4 text-muted-foreground' />
															<span className='text-sm truncate max-w-[200px]'>
																{log.entity_name}
															</span>
														</div>
													)}
												</TableCell>
												{capabilities.fullDetails && (
													<TableCell className='hidden md:table-cell'>
														{log.details &&
															Object.keys(log.details).length > 0 && (
																<div className='max-w-md space-y-1 text-xs'>
																	{Object.entries(log.details)
																		.filter(([key]) => !['user_agent'].includes(key))
																		.slice(0, 4)
																		.map(([key, value]) => (
																			<div key={key} className='truncate'>
																				<span className='font-medium'>
																					{label(key)}:
																				</span>{' '}
																				{typeof value === 'object'
																					? JSON.stringify(value)
																					: String(value)}
																			</div>
																		))}
																</div>
															)}
													</TableCell>
												)}
											</TableRow>
										);
									})}
								</TableBody>
							</Table>

							{/* Pagination */}
							<div className='flex items-center justify-between mt-6 pt-4 border-t'>
								<p className='text-sm text-muted-foreground'>
									Showing {(page - 1) * pageSize + 1} to{' '}
									{Math.min(
										page * pageSize,
										(page - 1) * pageSize + filteredLogs.length,
									)}{' '}
									results
								</p>
								<div className='flex items-center gap-2'>
									<Button
										variant='outline'
										size='sm'
										onClick={() => setPage((p) => Math.max(1, p - 1))}
										disabled={page <= 1}>
										<ChevronLeft className='w-4 h-4' />
										Previous
									</Button>
									<Button
										variant='outline'
										size='sm'
										onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
										disabled={page >= totalPages}>
										Next
										<ChevronRight className='w-4 h-4' />
									</Button>
								</div>
							</div>
						</>
					) : (
						<div className='text-center py-12'>
							<History className='w-12 h-12 text-muted-foreground/50 mx-auto mb-4' />
							<h3 className='text-lg font-medium mb-2'>No activity yet</h3>
							<p className='text-sm text-muted-foreground max-w-sm mx-auto'>
								Actions performed in your organization will appear here.
							</p>
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
}

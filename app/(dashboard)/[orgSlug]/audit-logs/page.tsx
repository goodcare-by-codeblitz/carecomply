'use client';

import { createClient } from '@/lib/supabase/client';
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
} from 'lucide-react';
import { useState, useEffect } from 'react';
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
import { getCurrentOrgBySlug, isMissingRelationError } from '@/lib/orgs';

type AuditLog = {
	id: string;
	user_email: string;
	action: string;
	entity_type: string;
	entity_id: string | null;
	entity_name: string | null;
	details: Record<string, unknown>;
	ip_address: string | null;
	created_at: string;
};

const ACTION_ICONS: Record<string, typeof FileText> = {
	'carer.created': Plus,
	'carer.updated': Edit,
	'carer.deleted': Trash2,
	'carer.invited': Mail,
	'document.uploaded': Upload,
	'document.approved': CheckCircle,
	'document.rejected': XCircle,
	'document.deleted': Trash2,
	'document.viewed': Eye,
	'reminder.created': Plus,
	'reminder.updated': Edit,
	'reminder.deleted': Trash2,
	'reminder.toggled': Zap,
	'email.sent': Mail,
	'settings.updated': Settings,
	'user.login': User,
	'user.logout': User,
};

const ACTION_LABELS: Record<string, string> = {
	'carer.created': 'Created carer',
	'carer.updated': 'Updated carer',
	'carer.deleted': 'Deleted carer',
	'carer.invited': 'Invited carer',
	'document.uploaded': 'Uploaded document',
	'document.approved': 'Approved document',
	'document.rejected': 'Rejected document',
	'document.deleted': 'Deleted document',
	'document.viewed': 'Viewed document',
	'reminder.created': 'Created reminder',
	'reminder.updated': 'Updated reminder',
	'reminder.deleted': 'Deleted reminder',
	'reminder.toggled': 'Toggled reminder',
	'email.sent': 'Sent email',
	'settings.updated': 'Updated settings',
	'user.login': 'Logged in',
	'user.logout': 'Logged out',
};

const ENTITY_ICONS: Record<string, typeof FileText> = {
	carer: Users,
	document: FileText,
	reminder: Zap,
	organization: Settings,
	user: User,
	email: Mail,
};

export default function AuditLogsPage() {
	const { orgSlug } = useParams<{ orgSlug: string }>();
	const [logs, setLogs] = useState<AuditLog[]>([]);
	const [loading, setLoading] = useState(true);
	const [search, setSearch] = useState('');
	const [entityFilter, setEntityFilter] = useState<string>('all');
	const [page, setPage] = useState(1);
	const [totalPages, setTotalPages] = useState(1);
	const pageSize = 20;

	useEffect(() => {
		fetchLogs();
	}, [page, entityFilter, orgSlug]);

	const fetchLogs = async () => {
		setLoading(true);
		const supabase = createClient();
		const {
			data: { user },
		} = await supabase.auth.getUser();

		if (!user) {
			setLoading(false);
			return;
		}

		const organization = await getCurrentOrgBySlug(supabase, user.id, orgSlug);

		if (!organization?.id) {
			setLogs([]);
			setTotalPages(1);
			setLoading(false);
			return;
		}

		let query = supabase
			.from('audit_logs')
			.select('*', { count: 'exact' })
			.eq('organization_id', organization.id)
			.order('created_at', { ascending: false })
			.range((page - 1) * pageSize, page * pageSize - 1);

		if (entityFilter !== 'all') {
			query = query.eq('entity_type', entityFilter);
		}

		const { data, error, count } = await query;

		if (isMissingRelationError(error)) {
			setLogs([]);
			setTotalPages(1);
		} else if (!error) {
			setLogs(data || []);
			setTotalPages(Math.ceil((count || 0) / pageSize));
		}
		setLoading(false);
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
		if (action.includes('approved')) return 'text-green-600 bg-green-50';
		if (action.includes('rejected') || action.includes('deleted'))
			return 'text-red-600 bg-red-50';
		if (action.includes('created') || action.includes('uploaded'))
			return 'text-blue-600 bg-blue-50';
		if (action.includes('updated') || action.includes('toggled'))
			return 'text-amber-600 bg-amber-50';
		return 'text-muted-foreground bg-muted';
	};

	return (
		<div className='p-8 max-w-7xl mx-auto'>
			{/* Page header */}
			<div className='mb-8'>
				<h1 className='text-2xl font-semibold tracking-tight'>Audit Logs</h1>
				<p className='text-muted-foreground mt-1'>
					Track all actions performed in your organization.
				</p>
			</div>

			{/* Filters */}
			<div className='flex flex-col sm:flex-row gap-4 mb-6'>
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
					</SelectContent>
				</Select>
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
										<TableHead>Entity</TableHead>
										<TableHead className='hidden md:table-cell'>
											Details
										</TableHead>
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
												<TableCell className='hidden md:table-cell'>
													{log.details &&
														Object.keys(log.details).length > 0 && (
															<code className='text-xs bg-muted px-2 py-1 rounded'>
																{JSON.stringify(log.details).slice(0, 50)}
																{JSON.stringify(log.details).length > 50 &&
																	'...'}
															</code>
														)}
												</TableCell>
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

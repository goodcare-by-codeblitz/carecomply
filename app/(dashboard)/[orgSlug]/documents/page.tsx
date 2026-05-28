'use client';

import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { FileText, Search, Filter } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { getCurrentOrgBySlug } from '@/lib/orgs';
import { DocumentManagerActions } from '@/components/document-manager-actions';
// import { DocumentViewer } from '@/components/document-viewer'

interface Document {
	id: string;
	file_name: string;
	file_path: string;
	status: string;
	expiry_date: string | null;
	uploaded_at: string;
	carer_id: string;
	document_type_id: string;
	superseded_at: string | null;
	carers: { full_name: string } | null;
	document_types: { name: string } | null;
}

interface Carer {
	id: string;
	full_name: string;
}

interface DocumentType {
	id: string;
	name: string;
	expiry_months: number | null;
	documents: { count: number }[];
}

export default function DocumentsPage() {
	const { orgSlug } = useParams<{ orgSlug: string }>();
	const [documents, setDocuments] = useState<Document[]>([]);
	const [carers, setCarers] = useState<Carer[]>([]);
	const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([]);
	const [selectedCarer, setSelectedCarer] = useState<string>('all');
	const [selectedStatus, setSelectedStatus] = useState<string>('all');
	const [searchQuery, setSearchQuery] = useState('');
	const [loading, setLoading] = useState(true);
	// const [viewerOpen, setViewerOpen] = useState(false);
	// const [viewerDoc, setViewerDoc] = useState<Document | null>(null);

	useEffect(() => {
		fetchData();
	}, [orgSlug]);

	const fetchData = async () => {
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
			setLoading(false);
			return;
		}

		const [docsRes, carersRes, typesRes] = await Promise.all([
			supabase
				.from('documents')
				.select('*, carers!inner(full_name, organization_id), document_types(name)')
				.eq('carers.organization_id', organization.id)
				.order('uploaded_at', { ascending: false }),
			supabase
				.from('carers')
				.select('id, full_name')
				.eq('organization_id', organization.id)
				.order('full_name'),
			supabase
				.from('document_types')
				.select('*, documents(count)')
				.eq('organization_id', organization.id),
		]);

		if (docsRes.data) setDocuments(docsRes.data);
		if (carersRes.data) setCarers(carersRes.data);
		if (typesRes.data) setDocumentTypes(typesRes.data);
		setLoading(false);
	};

	const filteredDocuments = documents.filter((doc) => {
		const matchesCarer =
			selectedCarer === 'all' || doc.carer_id === selectedCarer;
		const matchesStatus =
			selectedStatus === 'all'
				? doc.status !== 'obsolete'
				: doc.status === selectedStatus;
		const matchesSearch =
			searchQuery === '' ||
			doc.file_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
			doc.carers?.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
			doc.document_types?.name
				.toLowerCase()
				.includes(searchQuery.toLowerCase());

		return matchesCarer && matchesStatus && matchesSearch;
	});
	const currentDocumentCountByType = documents.reduce<Record<string, number>>(
		(counts, doc) => {
			if (doc.status === 'obsolete') return counts;
			counts[doc.document_type_id] = (counts[doc.document_type_id] ?? 0) + 1;
			return counts;
		},
		{},
	);

	const docStatusCls = (s: string) => {
		if (s === 'approved') return 'bg-ok-50 text-ok';
		if (s === 'pending')  return 'bg-warn-50 text-warn';
		if (s === 'rejected') return 'bg-danger-50 text-danger';
		if (s === 'expired')  return 'bg-danger-50 text-danger';
		if (s === 'obsolete') return 'bg-surface-muted text-slate-500';
		return 'bg-surface-muted text-slate-500';
	};

	const expiryBadgeCls = (days: number) => {
		if (days <= 0)  return 'bg-danger-50 text-danger';
		if (days <= 30) return 'bg-warn-50 text-warn';
		return 'bg-surface-muted text-slate-500';
	};

	return (
		<div className='min-h-full'>
			{/* Page header */}
			<div className='border-b border-line bg-white px-6 py-5 lg:px-8'>
				<div className='mx-auto max-w-7xl'>
					<h1 className='text-[22px] font-semibold tracking-tight text-ink'>Documents</h1>
					<p className='mt-0.5 text-[13px] text-slate-500'>
						View and manage all compliance documents across your carers.
					</p>
				</div>
			</div>

			<div className='mx-auto max-w-7xl px-6 py-6 lg:px-8'>
				{/* Document type stat cards */}
				{loading ? (
					<div className='mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
						{[1, 2, 3, 4].map((i) => (
							<div key={i} className='animate-pulse rounded-xl border border-line bg-white p-5 shadow-card'>
								<div className='h-3 w-24 rounded bg-surface-muted' />
								<div className='mt-3 h-7 w-10 rounded bg-surface-muted' />
								<div className='mt-2 h-3 w-32 rounded bg-surface-muted' />
							</div>
						))}
					</div>
				) : documentTypes && documentTypes.length > 0 ? (
					<div className='mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
						{documentTypes.slice(0, 4).map((type) => (
							<div key={type.id} className='rounded-xl border border-line bg-white p-5 shadow-card'>
								<p className='text-[11.5px] font-semibold uppercase tracking-[0.10em] text-slate-400'>
									{type.name}
								</p>
								<p className='mt-2 text-[28px] font-semibold leading-none tracking-tight text-ink'>
									{currentDocumentCountByType[type.id] ?? 0}
								</p>
								<p className='mt-1.5 text-[12px] text-slate-400'>
									{type.expiry_months
										? `Expires every ${type.expiry_months} months`
										: 'No expiry'}
								</p>
							</div>
						))}
					</div>
				) : null}

				{/* Filters */}
				<div className='mb-4 flex flex-wrap items-center gap-3'>
					<div className='relative min-w-[200px] flex-1 max-w-sm'>
						<Search className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400' />
						<Input
							placeholder='Search documents...'
							className='h-9 pl-9 text-[13.5px]'
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
						/>
					</div>

					<Select value={selectedCarer} onValueChange={setSelectedCarer}>
						<SelectTrigger className='h-9 w-[190px] text-[13.5px]'>
							<Filter className='mr-1.5 h-3.5 w-3.5 text-slate-400' />
							<SelectValue placeholder='Filter by carer' />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value='all'>All Carers</SelectItem>
							{carers.map((carer) => (
								<SelectItem key={carer.id} value={carer.id}>
									{carer.full_name}
								</SelectItem>
							))}
						</SelectContent>
					</Select>

					<Select value={selectedStatus} onValueChange={setSelectedStatus}>
						<SelectTrigger className='h-9 w-[150px] text-[13.5px]'>
							<SelectValue placeholder='Status' />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value='all'>All Status</SelectItem>
							<SelectItem value='pending'>Pending</SelectItem>
							<SelectItem value='approved'>Approved</SelectItem>
							<SelectItem value='rejected'>Rejected</SelectItem>
							<SelectItem value='expired'>Expired</SelectItem>
							<SelectItem value='obsolete'>History</SelectItem>
						</SelectContent>
					</Select>

					{(selectedCarer !== 'all' || selectedStatus !== 'all' || searchQuery) && (
						<Button
							variant='ghost'
							size='sm'
							className='h-9 text-[13.5px]'
							onClick={() => {
								setSelectedCarer('all');
								setSelectedStatus('all');
								setSearchQuery('');
							}}>
							Clear filters
						</Button>
					)}
				</div>

				{/* Documents list */}
				<div className='overflow-hidden rounded-xl border border-line bg-white shadow-card'>
					{/* Table header */}
					<div className='flex items-center gap-4 border-b border-line bg-surface-page px-5 py-2.5'>
						<span className='flex-1 text-[11.5px] font-semibold uppercase tracking-[0.10em] text-slate-400'>
							{selectedCarer !== 'all'
								? `Documents · ${carers.find((c) => c.id === selectedCarer)?.full_name}`
								: 'All Documents'}
							<span className='ml-1.5 font-normal normal-case text-slate-400'>
								({filteredDocuments.length})
							</span>
						</span>
					</div>

					{loading ? (
						<div className='divide-y divide-line'>
							{[1, 2, 3, 4, 5].map((i) => (
								<div key={i} className='flex items-center gap-4 px-5 py-4 animate-pulse'>
									<div className='h-9 w-9 rounded-lg bg-surface-muted' />
									<div className='flex-1 space-y-2'>
										<div className='h-3.5 w-36 rounded bg-surface-muted' />
										<div className='h-3 w-52 rounded bg-surface-muted' />
									</div>
									<div className='h-5 w-16 rounded-full bg-surface-muted' />
									<div className='h-5 w-20 rounded-full bg-surface-muted' />
								</div>
							))}
						</div>
					) : filteredDocuments.length > 0 ? (
						<div className='divide-y divide-line'>
							{filteredDocuments.map((doc) => {
								const daysUntilExpiry = doc.expiry_date
									? Math.ceil(
											(new Date(doc.expiry_date).getTime() - Date.now()) /
												(1000 * 60 * 60 * 24),
										)
									: null;

								return (
									<div
										key={doc.id}
										className='flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-surface-page'>
										{/* Icon */}
										<div className='flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line bg-white'>
											<FileText className='h-4 w-4 text-slate-400' />
										</div>
										{/* Info */}
										<div className='min-w-0 flex-1'>
											<p className='truncate text-[13.5px] font-medium text-ink'>
												{doc.document_types?.name ?? 'Document'}
											</p>
											<p className='truncate text-[12px] text-slate-400'>
												{doc.carers?.full_name} · {doc.file_name}
											</p>
										</div>
										{/* Expiry */}
										{daysUntilExpiry !== null && (
											<span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums ${expiryBadgeCls(daysUntilExpiry)}`}>
												{daysUntilExpiry <= 0 ? 'Expired' : `${daysUntilExpiry}d`}
											</span>
										)}
										{/* Status */}
										<span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${docStatusCls(doc.status)}`}>
											{doc.status === 'obsolete'
												? 'History'
												: doc.status.charAt(0).toUpperCase() + doc.status.slice(1)}
										</span>
										{/* Date */}
										<p className='hidden shrink-0 text-[12px] text-slate-400 sm:block'>
											{new Date(doc.uploaded_at).toLocaleDateString('en-GB', {
												day: 'numeric', month: 'short', year: 'numeric',
											})}
										</p>
										{/* Actions */}
										<Button variant='ghost' size='sm' className='h-7 shrink-0 text-[12.5px]' asChild>
											<a
												href={`/api/documents/file?documentId=${encodeURIComponent(doc.id)}`}
												target='_blank'
												rel='noopener noreferrer'>
												View
											</a>
										</Button>
										<DocumentManagerActions
											documentId={doc.id}
											status={doc.status}
											expiryDate={doc.expiry_date}
											fileName={doc.file_name}
											onChanged={fetchData}
										/>
									</div>
								);
							})}
						</div>
					) : (
						<div className='flex flex-col items-center justify-center py-20 text-center'>
							<div className='flex h-14 w-14 items-center justify-center rounded-full bg-surface-muted'>
								<FileText className='h-6 w-6 text-slate-400' />
							</div>
							<p className='mt-4 text-[15px] font-semibold text-ink'>
								{documents.length === 0 ? 'No documents yet' : 'No matching documents'}
							</p>
							<p className='mt-2 max-w-sm text-[13.5px] text-slate-500 leading-snug'>
								{documents.length === 0
									? 'Documents will appear here once carers upload their compliance files.'
									: 'Try adjusting your filters to find what you\'re looking for.'}
							</p>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}

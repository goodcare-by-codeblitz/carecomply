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

	return (
		<div className='p-8 max-w-7xl mx-auto'>
			{/* Page header */}
			<div className='flex items-center justify-between mb-8'>
				<div>
					<h1 className='text-2xl font-semibold tracking-tight'>Documents</h1>
					<p className='text-muted-foreground mt-1'>
						View and manage all compliance documents across your carers.
					</p>
				</div>
			</div>

			{/* Document type stats */}
			{loading ? (
				<div className='grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8'>
					{[1, 2, 3, 4].map((i) => (
						<Card key={i}>
							<CardContent className='p-5 animate-pulse'>
								<div className='h-4 bg-muted rounded w-24 mb-2' />
								<div className='h-8 bg-muted rounded w-12 mb-2' />
								<div className='h-3 bg-muted rounded w-32' />
							</CardContent>
						</Card>
					))}
				</div>
			) : documentTypes && documentTypes.length > 0 ? (
				<div className='grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8'>
					{documentTypes.slice(0, 4).map((type) => (
						<Card key={type.id}>
							<CardContent className='p-5'>
								<p className='text-sm text-muted-foreground'>{type.name}</p>
								<p className='text-2xl font-semibold mt-1'>
									{currentDocumentCountByType[type.id] ?? 0}
								</p>
								<p className='text-xs text-muted-foreground mt-1'>
									{type.expiry_months
										? `Expires every ${type.expiry_months} months`
										: 'No expiry'}
								</p>
							</CardContent>
						</Card>
					))}
				</div>
			) : null}

			{/* Filters */}
			<div className='flex flex-wrap gap-4 mb-6'>
				<div className='relative flex-1 min-w-[200px] max-w-md'>
					<Search className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground' />
					<Input
						placeholder='Search documents...'
						className='pl-10 h-11'
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
					/>
				</div>

				<Select value={selectedCarer} onValueChange={setSelectedCarer}>
					<SelectTrigger className='w-[200px] h-11'>
						<Filter className='w-4 h-4 mr-2 text-muted-foreground' />
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
					<SelectTrigger className='w-[160px] h-11'>
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

				{(selectedCarer !== 'all' ||
					selectedStatus !== 'all' ||
					searchQuery) && (
					<Button
						variant='ghost'
						onClick={() => {
							setSelectedCarer('all');
							setSelectedStatus('all');
							setSearchQuery('');
						}}>
						Clear filters
					</Button>
				)}
			</div>

			{/* Documents table */}
			<Card>
				<CardHeader>
					<CardTitle className='text-base'>
						{selectedCarer !== 'all'
							? `Documents for ${carers.find((c) => c.id === selectedCarer)?.full_name}`
							: 'All Documents'}
						<span className='text-muted-foreground font-normal ml-2'>
							({filteredDocuments.length})
						</span>
					</CardTitle>
				</CardHeader>
				<CardContent>
					{loading ? (
						<div className='space-y-3'>
							{[1, 2, 3, 4, 5].map((i) => (
								<div
									key={i}
									className='flex items-center justify-between p-4 rounded-xl bg-muted/30 border border-border animate-pulse'>
									<div className='flex items-center gap-4'>
										<div className='w-10 h-10 rounded-lg bg-muted' />
										<div className='space-y-2'>
											<div className='h-4 bg-muted rounded w-32' />
											<div className='h-3 bg-muted rounded w-48' />
										</div>
									</div>
									<div className='flex items-center gap-4'>
										<div className='h-5 bg-muted rounded-full w-16' />
										<div className='h-5 bg-muted rounded-full w-20' />
										<div className='h-3 bg-muted rounded w-20' />
										<div className='h-8 w-8 bg-muted rounded' />
									</div>
								</div>
							))}
						</div>
					) : filteredDocuments.length > 0 ? (
						<div className='space-y-3'>
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
										className='flex items-center justify-between p-4 rounded-xl bg-muted/30 border border-border'>
										<div className='flex items-center gap-4'>
											<div className='w-10 h-10 rounded-lg bg-background border border-border flex items-center justify-center'>
												<FileText className='w-5 h-5 text-muted-foreground' />
											</div>
											<div>
												<p className='font-medium text-sm'>
													{doc.document_types?.name}
												</p>
												<p className='text-xs text-muted-foreground'>
													{doc.carers?.full_name} &middot; {doc.file_name}
												</p>
											</div>
										</div>
										<div className='flex items-center gap-4'>
											{daysUntilExpiry !== null && (
												<span
													className={`text-xs px-2.5 py-1 rounded-full font-medium ${
														daysUntilExpiry <= 0
															? 'bg-red-50 text-red-700'
															: daysUntilExpiry <= 30
																? 'bg-amber-50 text-amber-700'
																: 'bg-muted text-muted-foreground'
													}`}>
													{daysUntilExpiry <= 0
														? 'Expired'
														: `${daysUntilExpiry} days`}
												</span>
											)}
											<span
												className={`text-xs px-2.5 py-1 rounded-full font-medium ${
													doc.status === 'approved'
														? 'bg-green-50 text-green-700'
														: doc.status === 'pending'
															? 'bg-amber-50 text-amber-700'
															: doc.status === 'rejected'
																? 'bg-red-50 text-red-700'
																: 'bg-muted text-muted-foreground'
												}`}>
												{doc.status === 'obsolete'
													? 'History'
													: doc.status.charAt(0).toUpperCase() +
														doc.status.slice(1)}
											</span>
											<p className='text-xs text-muted-foreground'>
												{new Date(doc.uploaded_at).toLocaleDateString()}
											</p>
											<Button variant='ghost' size='sm' asChild>
												<a
													href={`/api/documents/file?documentId=${encodeURIComponent(
														doc.id,
													)}`}
													target='_blank'
													rel='noopener noreferrer'>
													View
												</a>
											</Button>
										</div>
									</div>
								);
							})}
						</div>
					) : (
						<div className='text-center py-12'>
							<FileText className='w-12 h-12 text-muted-foreground/50 mx-auto mb-4' />
							<h3 className='text-lg font-medium mb-2'>
								{documents.length === 0
									? 'No documents yet'
									: 'No matching documents'}
							</h3>
							<p className='text-sm text-muted-foreground max-w-sm mx-auto'>
								{documents.length === 0
									? 'Documents will appear here once carers upload their compliance files.'
									: "Try adjusting your filters to find what you're looking for."}
							</p>
						</div>
					)}
				</CardContent>
			</Card>

			{/* Document Viewer */}
			{/* <DocumentViewer
        open={viewerOpen}
        onOpenChange={setViewerOpen}
        document={viewerDoc}
      /> */}
		</div>
	);
}

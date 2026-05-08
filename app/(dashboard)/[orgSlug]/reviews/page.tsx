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
import { Textarea } from '@/components/ui/textarea';
import {
	Search,
	CheckCircle,
	XCircle,
	Clock,
	ChevronRight,
	AlertCircle,
	Filter,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { z } from 'zod';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { getCurrentOrgBySlug } from '@/lib/orgs';
// import { DocumentViewer } from '@/components/document-viewer'

const rejectionSchema = z.object({
	reason: z
		.string()
		.min(10, 'Please provide a detailed reason (at least 10 characters)'),
});

type Document = {
	id: string;
	file_name: string;
	file_path: string;
	status: string;
	expiry_date: string | null;
	uploaded_at: string;
	rejection_reason: string | null;
	review_notes: string | null;
	reviewed_at: string | null;
	reviewed_by: string | null;
	carers: {
		id: string;
		full_name: string;
		email: string;
	};
	document_type: {
		id: string;
		name: string;
	} | null;
};

type ReviewResponse = {
	ok?: boolean;
	document?: Pick<
		Document,
		| 'id'
		| 'status'
		| 'reviewed_at'
		| 'reviewed_by'
		| 'rejection_reason'
		| 'review_notes'
	>;
	error?: string;
	emailWarning?: string | null;
};

const UNKNOWN_DOCUMENT_TYPE = 'Unknown document type';

export default function ReviewsPage() {
	const { orgSlug } = useParams<{ orgSlug: string }>();
	const [documents, setDocuments] = useState<Document[]>([]);
	const [loading, setLoading] = useState(true);
	const [filter, setFilter] = useState<
		'all' | 'pending' | 'approved' | 'rejected'
	>('pending');
	const [search, setSearch] = useState('');
	const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
	const [reviewAction, setReviewAction] = useState<'approve' | 'reject' | null>(
		null,
	);
	const [rejectionReason, setRejectionReason] = useState('');
	const [reviewNotes, setReviewNotes] = useState('');
	const [submitting, setSubmitting] = useState(false);
	const [errors, setErrors] = useState<{ reason?: string }>({});
	// const [viewerOpen, setViewerOpen] = useState(false)
	// const [viewerDoc, setViewerDoc] = useState<Document | null>(null)

	const fetchDocuments = useCallback(async () => {
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
			setDocuments([]);
			setLoading(false);
			return;
		}

		let query = supabase
			.from('documents')
			.select(
				'*, carers!inner(id, full_name, email, organization_id), document_type:document_types!documents_document_type_id_fkey(id, name)',
			)
			.eq('carers.organization_id', organization.id)
			.neq('status', 'obsolete')
			.order('uploaded_at', { ascending: false });

		if (filter !== 'all') {
			query = query.eq('status', filter);
		}

		const { data, error } = await query;

		if (error) {
			toast.error('Failed to load documents');
		} else {
			setDocuments(data || []);
		}
		setLoading(false);
	}, [filter, orgSlug]);

	useEffect(() => {
		fetchDocuments();
	}, [fetchDocuments]);

	const handleReview = async () => {
		if (!selectedDoc || !reviewAction) return;

		if (reviewAction === 'reject') {
			const result = rejectionSchema.safeParse({ reason: rejectionReason });
			if (!result.success) {
				setErrors({ reason: result.error.issues[0].message });
				return;
			}
		}

		setSubmitting(true);

		try {
			const response = await fetch('/api/documents/review', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					documentId: selectedDoc.id,
					action: reviewAction,
					rejectionReason:
						reviewAction === 'reject' ? rejectionReason : undefined,
					reviewNotes: reviewNotes || undefined,
				}),
			});
			const contentType = response.headers.get('content-type') ?? '';
			if (!contentType.includes('application/json')) {
				throw new Error(
					response.redirected
						? 'Your session may have expired. Please sign in again and retry the review.'
						: 'The review endpoint returned an unexpected non-JSON response. Please refresh and try again.',
				);
			}

			const payload = (await response.json()) as ReviewResponse;

			if (!response.ok) {
				throw new Error(payload.error ?? 'Failed to submit review');
			}

			if (payload.error) {
				throw new Error(payload.error);
			}

			const updatedDocument = payload.document ?? {
				id: selectedDoc.id,
				status: reviewAction === 'approve' ? 'approved' : 'rejected',
				reviewed_at: new Date().toISOString(),
				reviewed_by: null,
				rejection_reason: reviewAction === 'reject' ? rejectionReason : null,
				review_notes: reviewNotes || null,
			};

			toast.success(
				reviewAction === 'approve'
					? 'Document approved successfully'
					: 'Document rejected and carer notified',
			);
			if (payload.emailWarning) {
				toast.warning(payload.emailWarning);
			}

			setDocuments((currentDocuments) => {
				if (filter === 'pending') {
					return currentDocuments.filter(
						(doc) => doc.id !== updatedDocument.id,
					);
				}

				return currentDocuments.map((doc) =>
					doc.id === updatedDocument.id ? { ...doc, ...updatedDocument } : doc,
				);
			});

			setSelectedDoc(null);
			setReviewAction(null);
			setRejectionReason('');
			setReviewNotes('');
			setErrors({});
			await fetchDocuments();
		} catch (err) {
			toast.error(
				'Failed to submit review',
				err instanceof Error ? { description: err.message } : undefined,
			);
		} finally {
			setSubmitting(false);
		}
	};

	const filteredDocs = documents.filter((doc) => {
		if (!search) return true;
		const searchLower = search.toLowerCase();
		return (
			doc.carers?.full_name?.toLowerCase().includes(searchLower) ||
			(doc.document_type?.name ?? UNKNOWN_DOCUMENT_TYPE)
				.toLowerCase()
				.includes(searchLower) ||
			doc.file_name?.toLowerCase().includes(searchLower)
		);
	});

	const pendingCount = documents.filter((d) => d.status === 'pending').length;

	return (
		<div className='p-8 max-w-7xl mx-auto'>
			{/* Page header */}
			<div className='flex items-center justify-between mb-8'>
				<div>
					<h1 className='text-2xl font-semibold tracking-tight'>
						Document Reviews
					</h1>
					<p className='text-muted-foreground mt-1'>
						Review, approve, or reject compliance documents submitted by carers.
					</p>
				</div>
				{pendingCount > 0 && (
					<div className='flex items-center gap-2 px-4 py-2 rounded-full bg-amber-50 border border-amber-200'>
						<Clock className='w-4 h-4 text-amber-600' />
						<span className='text-sm font-medium text-amber-700'>
							{pendingCount} pending review{pendingCount !== 1 ? 's' : ''}
						</span>
					</div>
				)}
			</div>

			{/* Filters */}
			<div className='flex flex-col sm:flex-row gap-4 mb-6'>
				<div className='relative flex-1 max-w-md'>
					<Search className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground' />
					<Input
						placeholder='Search by carer name, document type...'
						className='pl-10 h-11'
						value={search}
						onChange={(e) => setSearch(e.target.value)}
					/>
				</div>
				<Select
					value={filter}
					onValueChange={(v) => setFilter(v as typeof filter)}>
					<SelectTrigger className='w-[180px] h-11'>
						<Filter className='w-4 h-4 mr-2' />
						<SelectValue placeholder='Filter by status' />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value='all'>All Documents</SelectItem>
						<SelectItem value='pending'>Pending Review</SelectItem>
						<SelectItem value='approved'>Approved</SelectItem>
						<SelectItem value='rejected'>Rejected</SelectItem>
					</SelectContent>
				</Select>
			</div>

			{/* Documents list */}
			<Card>
				<CardHeader>
					<CardTitle className='text-base'>
						{filter === 'all'
							? 'All Documents'
							: filter === 'pending'
								? 'Pending Reviews'
								: filter === 'approved'
									? 'Approved Documents'
									: 'Rejected Documents'}
					</CardTitle>
					<CardDescription>Click on a document to review it</CardDescription>
				</CardHeader>
				<CardContent>
					{loading ? (
						<div className='flex items-center justify-center py-12'>
							<div className='w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin' />
						</div>
					) : filteredDocs.length > 0 ? (
						<div className='space-y-3'>
							{filteredDocs.map((doc) => (
								<button
									key={doc.id}
									onClick={() => {
										setSelectedDoc(doc);
										setReviewNotes(doc.review_notes || '');
										setRejectionReason(doc.rejection_reason || '');
									}}
									className='w-full flex items-center justify-between p-4 rounded-xl bg-muted/30 border border-border hover:bg-muted/50 transition-colors text-left'>
									<div className='flex items-center gap-4'>
										<div
											className={`w-10 h-10 rounded-lg flex items-center justify-center ${
												doc.status === 'pending'
													? 'bg-amber-50 border border-amber-200'
													: doc.status === 'approved'
														? 'bg-green-50 border border-green-200'
														: 'bg-red-50 border border-red-200'
											}`}>
											{doc.status === 'pending' ? (
												<Clock className='w-5 h-5 text-amber-600' />
											) : doc.status === 'approved' ? (
												<CheckCircle className='w-5 h-5 text-green-600' />
											) : (
												<XCircle className='w-5 h-5 text-red-600' />
											)}
										</div>
										<div>
											<p className='font-medium text-sm'>
												{doc.document_type?.name ?? UNKNOWN_DOCUMENT_TYPE}
											</p>
											<p className='text-xs text-muted-foreground'>
												{doc.carers?.full_name} &middot; Uploaded{' '}
												{new Date(doc.uploaded_at).toLocaleDateString()}
											</p>
										</div>
									</div>
									<div className='flex items-center gap-3'>
										<span
											className={`text-xs px-2.5 py-1 rounded-full font-medium ${
												doc.status === 'approved'
													? 'bg-green-50 text-green-700'
													: doc.status === 'pending'
														? 'bg-amber-50 text-amber-700'
														: 'bg-red-50 text-red-700'
											}`}>
											{doc.status.charAt(0).toUpperCase() + doc.status.slice(1)}
										</span>
										<ChevronRight className='w-4 h-4 text-muted-foreground' />
									</div>
								</button>
							))}
						</div>
					) : (
						<div className='text-center py-12'>
							<CheckCircle className='w-12 h-12 text-green-500/50 mx-auto mb-4' />
							<h3 className='text-lg font-medium mb-2'>
								{filter === 'pending' ? 'All caught up!' : 'No documents found'}
							</h3>
							<p className='text-sm text-muted-foreground max-w-sm mx-auto'>
								{filter === 'pending'
									? 'There are no documents waiting for review.'
									: 'No documents match your current filters.'}
							</p>
						</div>
					)}
				</CardContent>
			</Card>

			{/* Review Dialog */}
			<Dialog
				open={!!selectedDoc}
				onOpenChange={(open) => !open && setSelectedDoc(null)}>
				<DialogContent className='max-w-2xl'>
					<DialogHeader>
						<DialogTitle>Review Document</DialogTitle>
						<DialogDescription>
							Review the document and approve or reject it
						</DialogDescription>
					</DialogHeader>

					{selectedDoc && (
						<div className='space-y-6'>
							{/* Document info */}
							<div className='grid grid-cols-2 gap-4 p-4 rounded-lg bg-muted/50'>
								<div>
									<p className='text-xs text-muted-foreground mb-1'>
										Document Type
									</p>
									<p className='font-medium'>
										{selectedDoc.document_type?.name ?? UNKNOWN_DOCUMENT_TYPE}
									</p>
								</div>
								<div>
									<p className='text-xs text-muted-foreground mb-1'>Carer</p>
									<p className='font-medium'>{selectedDoc.carers?.full_name}</p>
								</div>
								<div>
									<p className='text-xs text-muted-foreground mb-1'>File</p>
									<p className='font-medium text-sm truncate'>
										{selectedDoc.file_name}
									</p>
								</div>
								<div>
									<p className='text-xs text-muted-foreground mb-1'>
										Expiry Date
									</p>
									<p className='font-medium'>
										{selectedDoc.expiry_date
											? new Date(selectedDoc.expiry_date).toLocaleDateString()
											: 'No expiry'}
									</p>
								</div>
							</div>

							<Button variant='outline' className='w-full' asChild>
								<a
									href={`/api/documents/file?documentId=${encodeURIComponent(
										selectedDoc.id,
									)}`}
									target='_blank'
									rel='noopener noreferrer'>
									View Document
								</a>
							</Button>

							{/* Previous rejection reason if any */}
							{selectedDoc.status === 'rejected' &&
								selectedDoc.rejection_reason && (
									<div className='p-4 rounded-lg bg-red-50 border border-red-200'>
										<div className='flex items-start gap-2'>
											<AlertCircle className='w-4 h-4 text-red-600 mt-0.5' />
											<div>
												<p className='text-sm font-medium text-red-800'>
													Previous Rejection Reason
												</p>
												<p className='text-sm text-red-700 mt-1'>
													{selectedDoc.rejection_reason}
												</p>
											</div>
										</div>
									</div>
								)}

							{/* Review notes */}
							<div className='space-y-2'>
								<Label htmlFor='notes'>Review Notes (optional)</Label>
								<Textarea
									id='notes'
									placeholder='Add any notes about this review...'
									value={reviewNotes}
									onChange={(e) => setReviewNotes(e.target.value)}
									rows={2}
								/>
							</div>

							{/* Action buttons */}
							{selectedDoc.status === 'pending' && !reviewAction && (
								<div className='flex gap-3'>
									<Button
										className='flex-1 bg-green-600 hover:bg-green-700'
										onClick={() => setReviewAction('approve')}>
										<CheckCircle className='w-4 h-4 mr-2' />
										Approve Document
									</Button>
									<Button
										variant='destructive'
										className='flex-1'
										onClick={() => setReviewAction('reject')}>
										<XCircle className='w-4 h-4 mr-2' />
										Reject Document
									</Button>
								</div>
							)}

							{/* Rejection reason input */}
							{reviewAction === 'reject' && (
								<div className='space-y-4 p-4 rounded-lg border border-red-200 bg-red-50'>
									<div className='space-y-2'>
										<Label htmlFor='reason' className='text-red-800'>
											Rejection Reason <span className='text-red-600'>*</span>
										</Label>
										<Textarea
											id='reason'
											placeholder='Explain why this document is being rejected and what the carer needs to do to fix it...'
											value={rejectionReason}
											onChange={(e) => {
												setRejectionReason(e.target.value);
												if (errors.reason) setErrors({});
											}}
											rows={3}
											className={errors.reason ? 'border-red-500' : ''}
										/>
										{errors.reason && (
											<p className='text-xs text-red-600'>{errors.reason}</p>
										)}
									</div>
									<p className='text-xs text-red-700'>
										The carer will receive an email with this reason and a link
										to upload a new document.
									</p>
								</div>
							)}

							{/* Confirm action */}
							{reviewAction && (
								<DialogFooter>
									<Button
										variant='outline'
										onClick={() => {
											setReviewAction(null);
											setRejectionReason('');
											setErrors({});
										}}>
										Cancel
									</Button>
									<Button
										onClick={handleReview}
										disabled={submitting}
										className={
											reviewAction === 'approve'
												? 'bg-green-600 hover:bg-green-700'
												: ''
										}
										variant={
											reviewAction === 'reject' ? 'destructive' : 'default'
										}>
										{submitting ? (
											<div className='w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2' />
										) : null}
										Confirm{' '}
										{reviewAction === 'approve' ? 'Approval' : 'Rejection'}
									</Button>
								</DialogFooter>
							)}

							{/* Already reviewed */}
							{selectedDoc.status !== 'pending' && (
								<div className='flex items-center justify-between p-4 rounded-lg bg-muted/50'>
									<div>
										<p className='text-sm font-medium'>
											This document was {selectedDoc.status}
										</p>
										<p className='text-xs text-muted-foreground mt-1'>
											No further action needed
										</p>
									</div>
									<Link href={`/${orgSlug}/carers/${selectedDoc.carers?.id}`}>
										<Button variant='outline' size='sm'>
											View Carer Profile
										</Button>
									</Link>
								</div>
							)}
						</div>
					)}
				</DialogContent>
			</Dialog>

			{/* Document Viewer */}
			{/* <DocumentViewer
        open={viewerOpen}
        onOpenChange={setViewerOpen}
        document={viewerDoc}
      /> */}
		</div>
	);
}

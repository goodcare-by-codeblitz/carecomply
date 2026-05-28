'use client';

import { createClient } from '@/lib/supabase/client';
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
		<div className='min-h-full'>
			{/* Page header */}
			<div className='border-b border-line bg-white px-6 py-5 lg:px-8'>
				<div className='mx-auto max-w-7xl flex items-center justify-between'>
					<div>
						<h1 className='text-[22px] font-semibold tracking-tight text-ink'>
							Document Reviews
						</h1>
						<p className='mt-0.5 text-[13px] text-slate-500'>
							Review, approve, or reject compliance documents submitted by carers.
						</p>
					</div>
					{pendingCount > 0 && (
						<div className='flex items-center gap-2 rounded-full border border-warn/30 bg-warn-50 px-3.5 py-1.5'>
							<Clock className='h-3.5 w-3.5 text-warn' />
							<span className='text-[12.5px] font-medium text-warn'>
								{pendingCount} pending review{pendingCount !== 1 ? 's' : ''}
							</span>
						</div>
					)}
				</div>
			</div>

			<div className='mx-auto max-w-7xl px-6 py-6 lg:px-8'>
				{/* Filters */}
				<div className='mb-5 flex flex-col gap-3 sm:flex-row'>
					<div className='relative flex-1 max-w-md'>
						<Search className='absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400' />
						<Input
							placeholder='Search by carer name, document type...'
							className='h-9 pl-9 text-[13.5px]'
							value={search}
							onChange={(e) => setSearch(e.target.value)}
						/>
					</div>
					<Select
						value={filter}
						onValueChange={(v) => setFilter(v as typeof filter)}>
						<SelectTrigger className='h-9 w-[180px] text-[13.5px]'>
							<Filter className='h-3.5 w-3.5 mr-2' />
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

				{/* Documents panel */}
				<div className='overflow-hidden rounded-xl border border-line bg-white shadow-card'>
					<div className='border-b border-line bg-surface-page px-5 py-3.5'>
						<h2 className='text-[14px] font-semibold text-ink'>
							{filter === 'all'
								? 'All Documents'
								: filter === 'pending'
									? 'Pending Reviews'
									: filter === 'approved'
										? 'Approved Documents'
										: 'Rejected Documents'}
						</h2>
						<p className='mt-0.5 text-[12.5px] text-slate-500'>
							Click on a document to review it
						</p>
					</div>
					<div className='p-4'>
						{loading ? (
							<div className='flex items-center justify-center py-12'>
								<div className='h-5 w-5 rounded-full border-2 border-brand border-t-transparent animate-spin' />
							</div>
						) : filteredDocs.length > 0 ? (
							<div className='space-y-2'>
								{filteredDocs.map((doc) => (
									<button
										key={doc.id}
										onClick={() => {
											setSelectedDoc(doc);
											setReviewNotes(doc.review_notes || '');
											setRejectionReason(doc.rejection_reason || '');
										}}
										className='w-full flex items-center justify-between p-4 rounded-xl border border-line bg-surface-muted/30 hover:bg-surface-muted/60 transition-colors text-left'>
										<div className='flex items-center gap-4'>
											<div
												className={`h-10 w-10 rounded-lg flex items-center justify-center ${
													doc.status === 'pending'
														? 'bg-warn-50 border border-warn/30'
														: doc.status === 'approved'
															? 'bg-ok-50 border border-ok/30'
															: 'bg-danger-50 border border-danger/30'
												}`}>
												{doc.status === 'pending' ? (
													<Clock className='h-5 w-5 text-warn' />
												) : doc.status === 'approved' ? (
													<CheckCircle className='h-5 w-5 text-ok' />
												) : (
													<XCircle className='h-5 w-5 text-danger' />
												)}
											</div>
											<div>
												<p className='text-[13.5px] font-medium text-ink'>
													{doc.document_type?.name ?? UNKNOWN_DOCUMENT_TYPE}
												</p>
												<p className='text-[12px] text-slate-500'>
													{doc.carers?.full_name} &middot; Uploaded{' '}
													{new Date(doc.uploaded_at).toLocaleDateString()}
												</p>
											</div>
										</div>
										<div className='flex items-center gap-3'>
											<span
												className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
													doc.status === 'approved'
														? 'bg-ok-50 text-ok'
														: doc.status === 'pending'
															? 'bg-warn-50 text-warn'
															: 'bg-danger-50 text-danger'
												}`}>
												{doc.status.charAt(0).toUpperCase() + doc.status.slice(1)}
											</span>
											<ChevronRight className='h-4 w-4 text-slate-400' />
										</div>
									</button>
								))}
							</div>
						) : (
							<div className='py-12 text-center'>
								<div className='mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-surface-muted'>
									<CheckCircle className='h-6 w-6 text-slate-400' />
								</div>
								<h3 className='text-[14px] font-semibold text-ink mb-1'>
									{filter === 'pending' ? 'All caught up!' : 'No documents found'}
								</h3>
								<p className='text-[13px] text-slate-500 max-w-sm mx-auto'>
									{filter === 'pending'
										? 'There are no documents waiting for review.'
										: 'No documents match your current filters.'}
								</p>
							</div>
						)}
					</div>
				</div>
			</div>

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
						<div className='space-y-5'>
							{/* Document info */}
							<div className='grid grid-cols-2 gap-4 rounded-xl bg-surface-muted/50 p-4'>
								<div>
									<p className='text-[12px] text-slate-500 mb-1'>Document Type</p>
									<p className='text-[13.5px] font-medium text-ink'>
										{selectedDoc.document_type?.name ?? UNKNOWN_DOCUMENT_TYPE}
									</p>
								</div>
								<div>
									<p className='text-[12px] text-slate-500 mb-1'>Carer</p>
									<p className='text-[13.5px] font-medium text-ink'>
										{selectedDoc.carers?.full_name}
									</p>
								</div>
								<div>
									<p className='text-[12px] text-slate-500 mb-1'>File</p>
									<p className='text-[13px] font-medium text-ink truncate'>
										{selectedDoc.file_name}
									</p>
								</div>
								<div>
									<p className='text-[12px] text-slate-500 mb-1'>Expiry Date</p>
									<p className='text-[13.5px] font-medium text-ink'>
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

							{/* Previous rejection reason */}
							{selectedDoc.status === 'rejected' &&
								selectedDoc.rejection_reason && (
									<div className='rounded-xl border border-danger/30 bg-danger-50 p-4'>
										<div className='flex items-start gap-2'>
											<AlertCircle className='h-4 w-4 text-danger mt-0.5 shrink-0' />
											<div>
												<p className='text-[13px] font-medium text-danger'>
													Previous Rejection Reason
												</p>
												<p className='text-[12.5px] text-danger/80 mt-1'>
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
										className='flex-1'
										onClick={() => setReviewAction('approve')}>
										<CheckCircle className='h-4 w-4 mr-2' />
										Approve Document
									</Button>
									<Button
										variant='destructive'
										className='flex-1'
										onClick={() => setReviewAction('reject')}>
										<XCircle className='h-4 w-4 mr-2' />
										Reject Document
									</Button>
								</div>
							)}

							{/* Rejection reason input */}
							{reviewAction === 'reject' && (
								<div className='space-y-3 rounded-xl border border-danger/30 bg-danger-50 p-4'>
									<div className='space-y-2'>
										<Label htmlFor='reason' className='text-danger'>
											Rejection Reason <span className='text-danger'>*</span>
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
											className={errors.reason ? 'border-danger' : ''}
										/>
										{errors.reason && (
											<p className='text-[12px] text-danger'>{errors.reason}</p>
										)}
									</div>
									<p className='text-[12px] text-danger/80'>
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
										variant={reviewAction === 'reject' ? 'destructive' : 'default'}>
										{submitting ? (
											<div className='h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin mr-2' />
										) : null}
										Confirm{' '}
										{reviewAction === 'approve' ? 'Approval' : 'Rejection'}
									</Button>
								</DialogFooter>
							)}

							{/* Already reviewed */}
							{selectedDoc.status !== 'pending' && (
								<div className='flex items-center justify-between rounded-xl bg-surface-muted/50 p-4'>
									<div>
										<p className='text-[13.5px] font-medium text-ink'>
											This document was {selectedDoc.status}
										</p>
										<p className='text-[12px] text-slate-500 mt-0.5'>
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
		</div>
	);
}

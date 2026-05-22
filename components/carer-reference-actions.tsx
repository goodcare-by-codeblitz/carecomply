'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle, ExternalLink, RefreshCw, Send, XCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

type ReferenceAction = 'approve' | 'reject';

export type CarerReferenceForActions = {
	id: string;
	full_name: string;
	organization: string | null;
	email: string;
	phone: string;
	relationship: string;
	notes: string | null;
	reference_type: string;
	status: string;
	request_sent_at: string | null;
	request_attempted_at: string | null;
	request_error: string | null;
	response_received_at: string | null;
	response_payload: Record<string, unknown> | null;
	response_url: string | null;
	reviewed_at: string | null;
	review_notes: string | null;
};

type CarerReferenceActionsProps = {
	reference: CarerReferenceForActions;
};

function formatDate(value: string | null) {
	if (!value) return 'Not recorded';
	return new Date(value).toLocaleString();
}

function PayloadPreview({ payload }: { payload: Record<string, unknown> | null }) {
	if (!payload || Object.keys(payload).length === 0) {
		return (
			<p className='text-sm text-muted-foreground'>
				No structured response payload was provided.
			</p>
		);
	}

	return (
		<div className='max-h-56 overflow-auto rounded-md border bg-muted/30 p-3'>
			<dl className='space-y-2'>
				{Object.entries(payload).map(([key, value]) => (
					<div key={key} className='grid gap-1 sm:grid-cols-3'>
						<dt className='text-xs font-medium text-muted-foreground'>
							{key}
						</dt>
						<dd className='break-words text-sm sm:col-span-2'>
							{typeof value === 'object'
								? JSON.stringify(value, null, 2)
								: String(value)}
						</dd>
					</div>
				))}
			</dl>
		</div>
	);
}

export function CarerReferenceActions({
	reference,
}: CarerReferenceActionsProps) {
	const router = useRouter();
	const [isReviewOpen, setIsReviewOpen] = useState(false);
	const [reviewNotes, setReviewNotes] = useState(reference.review_notes ?? '');
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [isRequesting, setIsRequesting] = useState(false);

	const canReview = reference.status === 'responded';
	const canRequest = !['responded', 'approved', 'rejected'].includes(
		reference.status,
	);
	const requestLabel =
		reference.status === 'requested' ? 'Resend request' : 'Send request';

	const requestReference = async () => {
		setIsRequesting(true);
		try {
			const response = await fetch('/api/references/request', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ referenceId: reference.id }),
			});
			const payload = (await response.json()) as {
				ok?: boolean;
				error?: string | null;
			};

			if (!response.ok) {
				throw new Error(payload.error ?? 'Reference request could not be sent');
			}

			if (payload.ok === false) {
				toast.warning(payload.error ?? 'Reference request could not be queued');
			} else {
				toast.success('Reference request queued');
			}

			router.refresh();
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: 'Reference request could not be sent',
			);
		} finally {
			setIsRequesting(false);
		}
	};

	const submitReview = async (action: ReferenceAction) => {
		setIsSubmitting(true);
		try {
			const response = await fetch('/api/references/review', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					referenceId: reference.id,
					action,
					reviewNotes: reviewNotes || undefined,
				}),
			});
			const payload = (await response.json()) as { error?: string };

			if (!response.ok) {
				throw new Error(payload.error ?? 'Reference review could not be saved');
			}

			toast.success(
				action === 'approve' ? 'Reference approved' : 'Reference rejected',
			);
			setIsReviewOpen(false);
			router.refresh();
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: 'Reference review could not be saved',
			);
		} finally {
			setIsSubmitting(false);
		}
	};

	if (canRequest) {
		return (
			<Button
				type='button'
				size='sm'
				variant='outline'
				disabled={isRequesting}
				onClick={requestReference}>
				{reference.status === 'requested' ? (
					<RefreshCw className='mr-2 h-4 w-4' />
				) : (
					<Send className='mr-2 h-4 w-4' />
				)}
				{isRequesting ? 'Sending...' : requestLabel}
			</Button>
		);
	}

	if (!canReview) {
		return <span className='text-xs text-muted-foreground'>Reviewed</span>;
	}

	return (
		<>
			<Button
				type='button'
				size='sm'
				onClick={() => setIsReviewOpen(true)}>
				Review
			</Button>
			<Dialog open={isReviewOpen} onOpenChange={setIsReviewOpen}>
				<DialogContent className='max-w-3xl'>
					<DialogHeader>
						<DialogTitle>Review Reference Response</DialogTitle>
						<DialogDescription>
							Check the referee response before approving this reference.
						</DialogDescription>
					</DialogHeader>

					<div className='space-y-5'>
						<div className='grid gap-4 rounded-lg border bg-muted/30 p-4 sm:grid-cols-2'>
							<div>
								<p className='text-xs text-muted-foreground'>Referee</p>
								<p className='font-medium'>{reference.full_name}</p>
								<p className='text-sm text-muted-foreground'>
									{reference.email}
								</p>
								<p className='text-sm text-muted-foreground'>
									{reference.phone}
								</p>
							</div>
							<div>
								<p className='text-xs text-muted-foreground'>Reference</p>
								<p className='font-medium capitalize'>
									{reference.reference_type}
								</p>
								<p className='text-sm text-muted-foreground'>
									{reference.relationship}
								</p>
								{reference.organization && (
									<p className='text-sm text-muted-foreground'>
										{reference.organization}
									</p>
								)}
							</div>
							<div>
								<p className='text-xs text-muted-foreground'>Status</p>
								<Badge variant='outline' className='mt-1 capitalize'>
									{reference.status}
								</Badge>
							</div>
							<div>
								<p className='text-xs text-muted-foreground'>
									Response received
								</p>
								<p className='text-sm'>
									{formatDate(reference.response_received_at)}
								</p>
							</div>
						</div>

						{reference.response_url && (
							<Button type='button' variant='outline' asChild>
								<a
									href={reference.response_url}
									target='_blank'
									rel='noopener noreferrer'>
									<ExternalLink className='mr-2 h-4 w-4' />
									Open submission
								</a>
							</Button>
						)}

						<div className='space-y-2'>
							<Label>Submitted response</Label>
							<PayloadPreview payload={reference.response_payload} />
						</div>

						{reference.notes && (
							<div className='space-y-1 rounded-md border p-3'>
								<p className='text-xs font-medium text-muted-foreground'>
									Carer notes
								</p>
								<p className='text-sm'>{reference.notes}</p>
							</div>
						)}

						<div className='space-y-2'>
							<Label htmlFor={`review-notes-${reference.id}`}>
								Review notes (optional)
							</Label>
							<Textarea
								id={`review-notes-${reference.id}`}
								value={reviewNotes}
								onChange={(event) => setReviewNotes(event.target.value)}
								placeholder='Add notes about the reference response...'
								rows={3}
							/>
						</div>
					</div>

					<DialogFooter>
						<Button
							type='button'
							variant='outline'
							onClick={() => setIsReviewOpen(false)}
							disabled={isSubmitting}>
							Close
						</Button>
						<Button
							type='button'
							variant='destructive'
							onClick={() => submitReview('reject')}
							disabled={isSubmitting}>
							<XCircle className='mr-2 h-4 w-4' />
							Reject
						</Button>
						<Button
							type='button'
							className='bg-green-600 hover:bg-green-700'
							onClick={() => submitReview('approve')}
							disabled={isSubmitting}>
							<CheckCircle className='mr-2 h-4 w-4' />
							Approve
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}

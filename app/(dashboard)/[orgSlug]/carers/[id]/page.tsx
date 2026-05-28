import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
	ArrowLeft,
	Mail,
	Phone,
	FileText,
	MessageSquareQuote,
} from 'lucide-react';
import Link from 'next/link';
import { DocumentUploader } from '@/components/document-uploader';
import { DocumentManagerActions } from '@/components/document-manager-actions';
import { InviteLinkCard } from '@/components/invite-link-card';
import { CarerStatusActions } from '@/components/carer-status-actions';
import { CarerProfileCard } from '@/components/carer-profile-card';
import {
	CarerReferenceActions,
	type CarerReferenceForActions,
} from '@/components/carer-reference-actions';
import { resolveOrgAccess } from '@/lib/orgs';
import { isInvitationSetupMissing } from '@/lib/invitations';

interface CarerPageProps {
	params: Promise<{ id: string; orgSlug: string }>;
}

function formatReferenceStatus(status: string | null) {
	if (!status) return 'Pending';
	return status.replace(/_/g, ' ').replace(/^\w/, (char) => char.toUpperCase());
}

function referenceStatusClass(status: string | null) {
	if (status === 'approved') return 'bg-ok-50 text-ok';
	if (status === 'responded') return 'bg-brand-50 text-brand-700';
	if (status === 'requested') return 'bg-warn-50 text-warn';
	if (status === 'rejected') return 'bg-danger-50 text-danger';
	return 'bg-surface-muted text-slate-600';
}

function carerStatusClass(status: string) {
	if (status === 'active') return 'bg-ok-50 text-ok';
	if (status === 'pending') return 'bg-warn-50 text-warn';
	if (status === 'expired') return 'bg-danger-50 text-danger';
	if (status === 'on_leave') return 'bg-brand-50 text-brand-700';
	if (status === 'suspended') return 'bg-danger-50 text-danger';
	if (status === 'former') return 'bg-surface-muted text-slate-600';
	return 'bg-surface-muted text-slate-600';
}

function docStatusClass(status: string) {
	if (status === 'approved') return 'bg-ok-50 text-ok';
	if (status === 'pending') return 'bg-warn-50 text-warn';
	if (status === 'rejected') return 'bg-danger-50 text-danger';
	return 'bg-surface-muted text-slate-600';
}

function formatDate(value: string | null) {
	if (!value) return '-';
	return new Date(value).toLocaleDateString();
}

export default async function CarerPage({ params }: CarerPageProps) {
	const { id, orgSlug } = await params;
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		notFound();
	}

	const currentOrg = await resolveOrgAccess(supabase, user.id, orgSlug);

	if (!currentOrg) {
		notFound();
	}

	const { data: carer } = await supabase
		.from('carers')
		.select('*')
		.eq('id', id)
		.eq('organization_id', currentOrg.id)
		.single();

	if (!carer) {
		notFound();
	}

	const { data: invitation, error: invitationError } = await supabase
		.from('organization_invitations')
		.select('id, token, expires_at, status')
		.eq('organization_id', currentOrg.id)
		.eq('invite_type', 'carer')
		.eq('carer_id', carer.id)
		.order('created_at', { ascending: false })
		.limit(1)
		.maybeSingle();

	if (invitationError && !isInvitationSetupMissing(invitationError)) {
		console.error('Failed to load carer invitation:', invitationError);
	}

	const { data: documents } = await supabase
		.from('documents')
		.select('*, document_types(name, description)')
		.eq('carer_id', id)
		.order('uploaded_at', { ascending: false });

	const { data: references } = await supabase
		.from('carer_references')
		.select(
			'id, full_name, organization, email, phone, relationship, notes, reference_type, status, request_sent_at, request_attempted_at, request_error, response_received_at, response_payload, response_url, reviewed_at, review_notes',
		)
		.eq('carer_id', id)
		.order('created_at', { ascending: true });

	const { data: documentTypes } = await supabase
		.from('document_types')
		.select('*')
		.eq('organization_id', currentOrg.id)
		.order('name');

	const initials = carer.full_name
		.split(' ')
		.map((n: string) => n[0])
		.join('')
		.toUpperCase();
	const currentDocuments = (documents ?? []).filter(
		(doc) => doc.status !== 'obsolete',
	);
	const historicalDocuments = (documents ?? []).filter(
		(doc) => doc.status === 'obsolete',
	);

	return (
		<div className='min-h-full'>
			{/* Page header */}
			<div className='border-b border-line bg-white px-6 py-5 lg:px-8'>
				<div className='mx-auto max-w-7xl'>
					<Link
						href={`/${orgSlug}/carers`}
						className='inline-flex items-center gap-1.5 text-[13px] text-slate-500 hover:text-ink mb-3 transition-colors'>
						<ArrowLeft className='h-3.5 w-3.5' />
						Back to carers
					</Link>
					<div className='flex items-start justify-between'>
						<div className='flex items-center gap-4'>
							<div className='flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50'>
								<span className='text-[18px] font-semibold text-brand-700'>
									{initials}
								</span>
							</div>
							<div>
								<h1 className='text-[22px] font-semibold tracking-tight text-ink'>
									{carer.full_name}
								</h1>
								<div className='flex items-center gap-4 mt-1 text-[13px] text-slate-500'>
									<span className='flex items-center gap-1.5'>
										<Mail className='h-3.5 w-3.5' />
										{carer.email}
									</span>
									{carer.phone && (
										<span className='flex items-center gap-1.5'>
											<Phone className='h-3.5 w-3.5' />
											{carer.phone}
										</span>
									)}
								</div>
							</div>
						</div>
						<div className='flex flex-col items-end gap-2.5'>
							<span
								className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[12px] font-semibold ${carerStatusClass(carer.status)}`}>
								{carer.status
									.replace(/_/g, ' ')
									.replace(/^\w/, (char: string) => char.toUpperCase())}
							</span>
							<CarerStatusActions carerId={carer.id} status={carer.status} />
						</div>
					</div>
				</div>
			</div>

			<div className='mx-auto max-w-7xl px-6 py-6 lg:px-8'>
				<div className='space-y-6'>
					<CarerProfileCard carer={carer} />

					{/* Documents */}
					<div className='overflow-hidden rounded-xl border border-line bg-white shadow-card'>
						<div className='border-b border-line bg-surface-page px-5 py-3.5'>
							<h2 className='text-[14px] font-semibold text-ink'>Documents</h2>
							<p className='mt-0.5 text-[12.5px] text-slate-500'>
								Uploaded compliance documents for this carer
							</p>
						</div>
						<div className='p-4'>
							{currentDocuments.length > 0 ? (
								<div className='space-y-2'>
									{currentDocuments.map((doc) => (
										<div
											key={doc.id}
											className='flex items-center justify-between rounded-xl border border-line bg-surface-muted/30 p-4'>
											<div className='flex items-center gap-3'>
												<div className='flex h-10 w-10 items-center justify-center rounded-lg border border-line bg-white'>
													<FileText className='h-5 w-5 text-slate-400' />
												</div>
												<div>
													<p className='text-[13.5px] font-medium text-ink'>
														{doc.document_types?.name}
													</p>
													<p className='text-[12px] text-slate-500'>
														{doc.file_name}
													</p>
												</div>
											</div>
											<div className='flex items-center gap-3'>
												{doc.expiry_date && (
													<span className='text-[12px] text-slate-500'>
														Expires{' '}
														{new Date(doc.expiry_date).toLocaleDateString()}
													</span>
												)}
												<span
													className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${docStatusClass(doc.status)}`}>
													{doc.status.charAt(0).toUpperCase() +
														doc.status.slice(1)}
												</span>
												<Button variant='ghost' size='sm' asChild>
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
												/>
											</div>
										</div>
									))}
								</div>
							) : (
								<div className='py-8 text-center'>
									<div className='mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-surface-muted'>
										<FileText className='h-5 w-5 text-slate-400' />
									</div>
									<p className='text-[13px] text-slate-500'>
										No documents uploaded yet
									</p>
								</div>
							)}
						</div>
					</div>

					{/* Document History */}
					{historicalDocuments.length > 0 && (
						<div className='overflow-hidden rounded-xl border border-line bg-white shadow-card'>
							<div className='border-b border-line bg-surface-page px-5 py-3.5'>
								<h2 className='text-[14px] font-semibold text-ink'>
									Document History
								</h2>
								<p className='mt-0.5 text-[12.5px] text-slate-500'>
									Superseded documents retained for audit history
								</p>
							</div>
							<div className='space-y-2 p-4'>
								{historicalDocuments.map((doc) => (
									<div
										key={doc.id}
										className='flex items-center justify-between rounded-xl border border-line bg-surface-muted/30 p-4'>
										<div className='flex items-center gap-3'>
											<div className='flex h-10 w-10 items-center justify-center rounded-lg border border-line bg-white'>
												<FileText className='h-5 w-5 text-slate-400' />
											</div>
											<div>
												<p className='text-[13.5px] font-medium text-ink'>
													{doc.document_types?.name}
												</p>
												<p className='text-[12px] text-slate-500'>
													{doc.file_name}
												</p>
											</div>
										</div>
										<div className='flex items-center gap-3'>
											<span className='inline-flex items-center rounded-full bg-surface-muted px-2.5 py-0.5 text-[11px] font-semibold text-slate-600'>
												History
											</span>
											<Button variant='ghost' size='sm' asChild>
												<a
													href={`/api/documents/file?documentId=${encodeURIComponent(doc.id)}`}
													target='_blank'
													rel='noopener noreferrer'>
													View
												</a>
											</Button>
										</div>
									</div>
								))}
							</div>
						</div>
					)}

					{/* References */}
					<div className='overflow-hidden rounded-xl border border-line bg-white shadow-card'>
						<div className='border-b border-line bg-surface-page px-5 py-3.5'>
							<h2 className='text-[14px] font-semibold text-ink'>References</h2>
							<p className='mt-0.5 text-[12.5px] text-slate-500'>
								Referee details, response status, and admin review decisions
							</p>
						</div>
						<div className='p-4'>
							{references && references.length > 0 ? (
								<div className='space-y-2'>
									{/* Header row */}
									<div className='hidden grid-cols-[100px_1fr_120px_110px_100px_100px_1fr_80px] gap-3 px-3 lg:grid'>
										{['Type', 'Referee', 'Relationship', 'Status', 'Requested', 'Responded', 'Request issue', ''].map(
											(h) => (
												<span key={h} className='text-[11px] font-semibold uppercase tracking-wide text-slate-400'>
													{h}
												</span>
											),
										)}
									</div>
									{references.map((reference) => (
										<div
											key={reference.id}
											className='rounded-xl border border-line bg-surface-muted/30 p-3'>
											{/* Mobile layout */}
											<div className='flex items-start justify-between gap-3 lg:hidden'>
												<div>
													<div className='flex items-center gap-2 mb-1'>
														<span className='text-[11px] font-semibold uppercase text-slate-400'>
															{reference.reference_type}
														</span>
														<span
															className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${referenceStatusClass(reference.status)}`}>
															{formatReferenceStatus(reference.status)}
														</span>
													</div>
													<p className='text-[13.5px] font-medium text-ink'>
														{reference.full_name}
													</p>
													{reference.organization && (
														<p className='text-[12px] text-slate-500'>
															{reference.organization}
														</p>
													)}
													<p className='text-[12px] text-slate-500'>
														{reference.email}
													</p>
													{reference.relationship && (
														<p className='text-[12px] text-slate-500'>
															{reference.relationship}
														</p>
													)}
												</div>
												<CarerReferenceActions
													reference={reference as CarerReferenceForActions}
												/>
											</div>
											{/* Desktop grid layout */}
											<div className='hidden grid-cols-[100px_1fr_120px_110px_100px_100px_1fr_80px] gap-3 items-start lg:grid'>
												<span className='text-[13px] capitalize text-ink'>
													{reference.reference_type}
												</span>
												<div>
													<p className='text-[13.5px] font-medium text-ink'>
														{reference.full_name}
													</p>
													{reference.organization && (
														<p className='text-[12px] text-slate-500'>
															{reference.organization}
														</p>
													)}
													<p className='text-[12px] text-slate-500'>
														{reference.email}
													</p>
													{reference.phone && (
														<p className='text-[12px] text-slate-500'>
															{reference.phone}
														</p>
													)}
												</div>
												<span className='text-[13px] text-slate-600'>
													{reference.relationship}
												</span>
												<span
													className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${referenceStatusClass(reference.status)}`}>
													{formatReferenceStatus(reference.status)}
												</span>
												<span className='text-[12.5px] text-slate-500'>
													{formatDate(reference.request_sent_at)}
												</span>
												<span className='text-[12.5px] text-slate-500'>
													{formatDate(reference.response_received_at)}
												</span>
												<span className='text-[12px] text-slate-500 whitespace-normal'>
													{reference.request_error || '-'}
												</span>
												<div className='flex justify-end'>
													<CarerReferenceActions
														reference={reference as CarerReferenceForActions}
													/>
												</div>
											</div>
										</div>
									))}
								</div>
							) : (
								<div className='py-8 text-center'>
									<div className='mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-surface-muted'>
										<MessageSquareQuote className='h-5 w-5 text-slate-400' />
									</div>
									<p className='text-[13px] text-slate-500'>
										No references submitted yet
									</p>
								</div>
							)}
						</div>
					</div>

					<div className='grid items-stretch gap-6 lg:grid-cols-2'>
						<InviteLinkCard
							inviteId={invitation?.id}
							inviteToken={invitation?.token}
							inviteExpiresAt={invitation?.expires_at}
							inviteStatus={invitation?.status}
							carerName={carer.full_name}
							carerEmail={carer.email}
							className='h-full'
						/>

						<div className='overflow-hidden rounded-xl border border-line bg-white shadow-card h-full'>
							<div className='border-b border-line bg-surface-page px-5 py-3.5'>
								<h2 className='text-[14px] font-semibold text-ink'>
									Upload Document
								</h2>
								<p className='mt-0.5 text-[12.5px] text-slate-500'>
									Add a new compliance document for this carer
								</p>
							</div>
							<div className='p-5'>
								<DocumentUploader
									carerId={carer.id}
									documentTypes={documentTypes || []}
								/>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}

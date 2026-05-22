import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
	CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@/components/ui/table';
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
	if (status === 'approved')
		return 'bg-green-50 text-green-700 border-green-200';
	if (status === 'responded') return 'bg-blue-50 text-blue-700 border-blue-200';
	if (status === 'requested')
		return 'bg-amber-50 text-amber-700 border-amber-200';
	if (status === 'rejected') return 'bg-red-50 text-red-700 border-red-200';
	return 'bg-muted text-muted-foreground';
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
		<div className='p-8 max-w-7xl mx-auto'>
			{/* Back link */}
			<Link
				href={`/${orgSlug}/carers`}
				className='inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors'>
				<ArrowLeft className='w-4 h-4' />
				Back to carers
			</Link>

			{/* Header */}
			<div className='flex items-start justify-between mb-8'>
				<div className='flex items-center gap-5'>
					<div className='w-16 h-16 rounded-2xl bg-muted flex items-center justify-center'>
						<span className='text-xl font-semibold'>{initials}</span>
					</div>
					<div>
						<h1 className='text-2xl font-semibold tracking-tight'>
							{carer.full_name}
						</h1>
						<div className='flex items-center gap-4 mt-2 text-sm text-muted-foreground'>
							<span className='flex items-center gap-1.5'>
								<Mail className='w-4 h-4' />
								{carer.email}
							</span>
							{carer.phone && (
								<span className='flex items-center gap-1.5'>
									<Phone className='w-4 h-4' />
									{carer.phone}
								</span>
							)}
						</div>
					</div>
				</div>
				<div className='flex flex-col items-end gap-3'>
					<span
						className={`text-sm px-3 py-1.5 rounded-full font-medium ${
							carer.status === 'active'
								? 'bg-green-50 text-green-700'
								: carer.status === 'pending'
									? 'bg-amber-50 text-amber-700'
									: carer.status === 'expired'
										? 'bg-red-50 text-red-700'
										: carer.status === 'on_leave'
											? 'bg-blue-50 text-blue-700'
											: carer.status === 'suspended'
												? 'bg-red-50 text-red-700'
												: carer.status === 'former'
													? 'bg-slate-100 text-slate-700'
													: 'bg-muted text-muted-foreground'
						}`}>
						{carer.status
							.replace(/_/g, ' ')
							.replace(/^\w/, (char: string) => char.toUpperCase())}
					</span>
					<CarerStatusActions carerId={carer.id} status={carer.status} />
				</div>
			</div>

			<div className='space-y-6'>
				<CarerProfileCard carer={carer} />

				{/* Documents list */}
				<div>
					<Card>
						<CardHeader>
							<CardTitle className='text-base'>Documents</CardTitle>
							<CardDescription>
								Uploaded compliance documents for this carer
							</CardDescription>
						</CardHeader>
						<CardContent>
							{currentDocuments.length > 0 ? (
								<div className='space-y-3'>
									{currentDocuments.map((doc) => (
										<div
											key={doc.id}
											className='flex items-center justify-between p-4 rounded-xl bg-muted/50 border border-border'>
											<div className='flex items-center gap-3'>
												<div className='w-10 h-10 rounded-lg bg-background border border-border flex items-center justify-center'>
													<FileText className='w-5 h-5 text-muted-foreground' />
												</div>
												<div>
													<p className='font-medium text-sm'>
														{doc.document_types?.name}
													</p>
													<p className='text-xs text-muted-foreground'>
														{doc.file_name}
													</p>
												</div>
											</div>
											<div className='flex items-center gap-3'>
												{doc.expiry_date && (
													<span className='text-xs text-muted-foreground'>
														Expires{' '}
														{new Date(doc.expiry_date).toLocaleDateString()}
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
								<div className='text-center py-8'>
									<FileText className='w-10 h-10 text-muted-foreground/50 mx-auto mb-3' />
									<p className='text-sm text-muted-foreground'>
										No documents uploaded yet
									</p>
								</div>
							)}
						</CardContent>
					</Card>
					{historicalDocuments.length > 0 && (
						<Card className='mt-6'>
							<CardHeader>
								<CardTitle className='text-base'>Document History</CardTitle>
								<CardDescription>
									Superseded documents retained for audit history
								</CardDescription>
							</CardHeader>
							<CardContent>
								<div className='space-y-3'>
									{historicalDocuments.map((doc) => (
										<div
											key={doc.id}
											className='flex items-center justify-between p-4 rounded-xl bg-muted/30 border border-border'>
											<div className='flex items-center gap-3'>
												<div className='w-10 h-10 rounded-lg bg-background border border-border flex items-center justify-center'>
													<FileText className='w-5 h-5 text-muted-foreground' />
												</div>
												<div>
													<p className='font-medium text-sm'>
														{doc.document_types?.name}
													</p>
													<p className='text-xs text-muted-foreground'>
														{doc.file_name}
													</p>
												</div>
											</div>
											<div className='flex items-center gap-3'>
												<span className='text-xs px-2.5 py-1 rounded-full font-medium bg-muted text-muted-foreground'>
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
							</CardContent>
						</Card>
					)}

					<Card className='mt-6'>
						<CardHeader>
							<CardTitle className='text-base'>References</CardTitle>
							<CardDescription>
								Referee details, response status, and admin review decisions
							</CardDescription>
						</CardHeader>
						<CardContent>
							{references && references.length > 0 ? (
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>Type</TableHead>
											<TableHead>Referee</TableHead>
											<TableHead>Relationship</TableHead>
											<TableHead>Status</TableHead>
											<TableHead>Requested</TableHead>
											<TableHead>Responded</TableHead>
											<TableHead>Request issue</TableHead>
											<TableHead className='text-right'>Review</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{references.map((reference) => (
											<TableRow key={reference.id}>
												<TableCell className='capitalize'>
													{reference.reference_type}
												</TableCell>
												<TableCell>
													<div className='space-y-1'>
														<p className='font-medium'>{reference.full_name}</p>
														{reference.organization && (
															<p className='text-xs text-muted-foreground'>
																{reference.organization}
															</p>
														)}
														<p className='text-xs text-muted-foreground'>
															{reference.email}
														</p>
														<p className='text-xs text-muted-foreground'>
															{reference.phone}
														</p>
													</div>
												</TableCell>
												<TableCell>{reference.relationship}</TableCell>
												<TableCell>
													<Badge
														variant='outline'
														className={referenceStatusClass(reference.status)}>
														{formatReferenceStatus(reference.status)}
													</Badge>
												</TableCell>
												<TableCell>
													{formatDate(reference.request_sent_at)}
												</TableCell>
												<TableCell>
													{formatDate(reference.response_received_at)}
												</TableCell>
												<TableCell className='max-w-[220px] whitespace-normal text-muted-foreground'>
													{reference.request_error || '-'}
												</TableCell>
												<TableCell className='text-right'>
													<CarerReferenceActions
														reference={reference as CarerReferenceForActions}
													/>
												</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>
							) : (
								<div className='text-center py-8'>
									<MessageSquareQuote className='w-10 h-10 text-muted-foreground/50 mx-auto mb-3' />
									<p className='text-sm text-muted-foreground'>
										No references submitted yet
									</p>
								</div>
							)}
						</CardContent>
					</Card>
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

					<Card className='h-full'>
						<CardHeader>
							<CardTitle className='text-base'>Upload Document</CardTitle>
							<CardDescription>
								Add a new compliance document for this carer
							</CardDescription>
						</CardHeader>
						<CardContent>
							<DocumentUploader
								carerId={carer.id}
								documentTypes={documentTypes || []}
							/>
						</CardContent>
					</Card>
				</div>
			</div>
		</div>
	);
}

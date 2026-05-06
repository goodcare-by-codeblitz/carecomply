'use client';

import { Button } from '@/components/ui/button';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { onboardingDocumentSchema } from '@/lib/validations';
import {
	AlertCircle,
	CheckCircle2,
	Clock,
	FileText,
	Loader2,
	Plus,
	Shield,
	Trash2,
	Upload,
	X,
} from 'lucide-react';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

type Carer = {
	id: string;
	full_name: string;
	email: string;
	phone: string | null;
	onboarding_progress: number | null;
};

type Organization = {
	name: string;
	slug: string;
} | null;

type DocumentType = {
	id: string;
	name: string;
	description: string | null;
	is_required: boolean;
	expiry_months: number | null;
};

type UploadedDoc = {
	id: string;
	document_type_id: string;
	file_name: string;
	file_size: number | null;
	status: string;
	expiry_date: string | null;
	uploaded_at: string;
	rejection_reason: string | null;
};

type ReferenceRow = {
	id?: string;
	fullName: string;
	email: string;
	phone: string;
	relationship: string;
	notes: string;
};

type OnboardingPayload = {
	organization: Organization;
	carer: Carer;
	documentTypes: DocumentType[];
	documents: UploadedDoc[];
	references: Array<{
		id: string;
		full_name: string;
		email: string;
		phone: string;
		relationship: string;
		notes: string | null;
	}>;
};

const emptyReference = (): ReferenceRow => ({
	fullName: '',
	email: '',
	phone: '',
	relationship: '',
	notes: '',
});

export function OnboardingClient() {
	const { token } = useParams<{ token: string }>();
	const [carer, setCarer] = useState<Carer | null>(null);
	const [carerPhone, setCarerPhone] = useState('');
	const [organization, setOrganization] = useState<Organization>(null);
	const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([]);
	const [uploadedDocs, setUploadedDocs] = useState<UploadedDoc[]>([]);
	const [references, setReferences] = useState<ReferenceRow[]>([
		emptyReference(),
	]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const [selectedType, setSelectedType] = useState('');
	const [expiryDate, setExpiryDate] = useState('');
	const [file, setFile] = useState<File | null>(null);
	const [isDragging, setIsDragging] = useState(false);
	const [isUploading, setIsUploading] = useState(false);
	const [isSavingReferences, setIsSavingReferences] = useState(false);
	const [validationErrors, setValidationErrors] = useState<
		Record<string, string>
	>({});
	const fileInputRef = useRef<HTMLInputElement>(null);

	const loadOnboarding = useCallback(async () => {
		setLoading(true);
		setError(null);

		try {
			const response = await fetch(
				`/api/onboarding/details?token=${encodeURIComponent(token)}`,
			);
			const payload = (await response.json()) as
				| OnboardingPayload
				| { error?: string };

			if (!response.ok) {
				const errorPayload = payload as { error?: string };
				setError(errorPayload.error ?? 'This onboarding link is not valid.');
				return;
			}

			const data = payload as OnboardingPayload;
			setCarer(data.carer);
			setCarerPhone(data.carer.phone ?? '');
			setOrganization(data.organization);
			setDocumentTypes(data.documentTypes);
			setUploadedDocs(data.documents);
			setReferences(
				data.references.length > 0
					? data.references.map((reference) => ({
							id: reference.id,
							fullName: reference.full_name,
							email: reference.email,
							phone: reference.phone,
							relationship: reference.relationship,
							notes: reference.notes ?? '',
						}))
					: [emptyReference()],
			);
		} catch (err) {
			console.error(err);
			setError('Something went wrong. Please try again later.');
		} finally {
			setLoading(false);
		}
	}, [token]);

	useEffect(() => {
		loadOnboarding();
	}, [loadOnboarding]);

	const getDocTypeById = (id: string) => documentTypes.find((type) => type.id === id);
	const getDocStatus = (id: string) =>
		uploadedDocs.find((doc) => doc.document_type_id === id);
	const isDocTypeUploaded = (id: string) =>
		uploadedDocs.some(
			(doc) => doc.document_type_id === id && doc.status !== 'rejected',
		);
	const rejectedDocs = uploadedDocs.filter((doc) => doc.status === 'rejected');
	const requiredTypes = documentTypes.filter((type) => type.is_required);
	const uploadedRequiredCount = requiredTypes.filter((type) =>
		isDocTypeUploaded(type.id),
	).length;
	const progress =
		requiredTypes.length > 0
			? Math.round((uploadedRequiredCount / requiredTypes.length) * 100)
			: 100;
	const selectedDocumentType = selectedType
		? getDocTypeById(selectedType)
		: null;
	const selectedTypeHasExistingDoc = selectedType
		? Boolean(getDocStatus(selectedType))
		: false;
	const hasAllRequiredDocuments = progress === 100;

	const documentOptions = documentTypes.map((type) => {
		const latest = getDocStatus(type.id);
		const suffix =
			latest?.status === 'rejected'
				? ' (re-upload)'
				: latest
					? ' (replace)'
					: '';
		return {
			...type,
			label: `${type.name}${type.is_required ? ' *' : ''}${suffix}`,
		};
	});

	const handleUpload = async () => {
		const result = onboardingDocumentSchema.safeParse({
			documentTypeId: selectedType,
			expiryDate: expiryDate || undefined,
		});

		if (!result.success) {
			const errors: Record<string, string> = {};
			result.error.issues.forEach((err) => {
				if (err.path[0]) {
					errors[err.path[0] as string] = err.message;
				}
			});
			setValidationErrors(errors);
			return;
		}

		if (!file) {
			toast.error('Please select a file to upload');
			return;
		}

		setIsUploading(true);
		setValidationErrors({});

		try {
			const formData = new FormData();
			formData.append('token', token);
			formData.append('file', file);
			formData.append('documentTypeId', selectedType);
			if (expiryDate) {
				formData.append('expiryDate', expiryDate);
			}

			const response = await fetch('/api/onboarding/upload', {
				method: 'POST',
				body: formData,
			});
			const payload = (await response.json()) as {
				document?: UploadedDoc;
				progress?: number;
				error?: string;
			};

			if (!response.ok || !payload.document) {
				throw new Error(payload.error || 'Upload failed');
			}

			setUploadedDocs((prev) => [payload.document!, ...prev]);
			setCarer((prev) =>
				prev ? { ...prev, onboarding_progress: payload.progress ?? progress } : prev,
			);
			toast.success('Document uploaded successfully');
			setFile(null);
			setSelectedType('');
			setExpiryDate('');
			if (fileInputRef.current) {
				fileInputRef.current.value = '';
			}
		} catch (err) {
			console.error(err);
			toast.error(
				err instanceof Error ? err.message : 'Failed to upload document',
			);
		} finally {
			setIsUploading(false);
		}
	};

	const updateReference = (
		index: number,
		field: keyof ReferenceRow,
		value: string,
	) => {
		setReferences((current) =>
			current.map((reference, refIndex) =>
				refIndex === index ? { ...reference, [field]: value } : reference,
			),
		);
	};

	const saveReferences = async () => {
		setIsSavingReferences(true);

		try {
			const response = await fetch('/api/onboarding/references', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					token,
					carerPhone,
					references: references.map(({ fullName, email, phone, relationship, notes }) => ({
						fullName,
						email,
						phone,
						relationship,
						notes,
					})),
				}),
			});
			const payload = (await response.json()) as {
				references?: OnboardingPayload['references'];
				carerPhone?: string | null;
				error?: string;
			};

			if (!response.ok || !payload.references) {
				throw new Error(payload.error || 'References could not be saved');
			}

			setReferences(
				payload.references.map((reference) => ({
					id: reference.id,
					fullName: reference.full_name,
					email: reference.email,
					phone: reference.phone,
					relationship: reference.relationship,
					notes: reference.notes ?? '',
				})),
			);
			setCarer((prev) =>
				prev ? { ...prev, phone: payload.carerPhone ?? null } : prev,
			);
			toast.success('Reference details saved');
		} catch (err) {
			console.error(err);
			toast.error(
				err instanceof Error ? err.message : 'Reference details could not be saved',
			);
		} finally {
			setIsSavingReferences(false);
		}
	};

	if (loading) {
		return (
			<div className='min-h-screen bg-background flex items-center justify-center'>
				<Loader2 className='w-8 h-8 animate-spin text-muted-foreground' />
			</div>
		);
	}

	if (error) {
		return (
			<div className='min-h-screen bg-background flex items-center justify-center p-6'>
				<Card className='max-w-md w-full'>
					<CardContent className='pt-8 text-center'>
						<div className='w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4'>
							<AlertCircle className='w-6 h-6 text-destructive' />
						</div>
						<h2 className='text-lg font-semibold mb-2'>Link Not Valid</h2>
						<p className='text-muted-foreground'>{error}</p>
					</CardContent>
				</Card>
			</div>
		);
	}

	return (
		<div className='min-h-screen bg-background'>
			<header className='border-b bg-card'>
				<div className='max-w-5xl mx-auto px-6 py-6'>
					<div className='flex items-center gap-3 mb-1'>
						<Shield className='w-6 h-6 text-primary' />
						<span className='text-lg font-semibold'>CareComply</span>
					</div>
					<p className='text-sm text-muted-foreground'>
						{organization?.name
							? `${organization.name} onboarding portal`
							: 'Compliance document portal'}
					</p>
				</div>
			</header>

			<main className='max-w-5xl mx-auto px-6 py-10 space-y-8'>
				<section className='grid gap-4 lg:grid-cols-[1fr_320px] lg:items-start'>
					<div>
						<h1 className='text-2xl font-semibold tracking-tight mb-2'>
							Welcome, {carer?.full_name}
						</h1>
						<p className='text-muted-foreground'>
							Upload your required compliance documents and keep your reference
							details up to date while this onboarding link is active.
						</p>
					</div>
					<Card>
						<CardHeader className='pb-3'>
							<CardTitle className='text-base'>Your Details</CardTitle>
						</CardHeader>
						<CardContent className='space-y-3 text-sm'>
							<div>
								<p className='text-muted-foreground'>Name</p>
								<p className='font-medium'>{carer?.full_name}</p>
							</div>
							<div>
								<p className='text-muted-foreground'>Email</p>
								<p className='font-medium'>{carer?.email}</p>
							</div>
							<div className='space-y-2'>
								<Label htmlFor='carer-phone'>Phone</Label>
								<Input
									id='carer-phone'
									type='tel'
									value={carerPhone}
									onChange={(event) => setCarerPhone(event.target.value)}
								/>
							</div>
						</CardContent>
					</Card>
				</section>

				{hasAllRequiredDocuments && (
					<Card className='border-green-200 bg-green-50/50'>
						<CardContent className='py-4 flex gap-3'>
							<CheckCircle2 className='w-5 h-5 text-green-600 shrink-0 mt-0.5' />
							<div>
								<p className='font-medium text-green-800'>
									All required documents submitted
								</p>
								<p className='text-sm text-green-700'>
									You can still upload replacements or update details until this
									link expires.
								</p>
							</div>
						</CardContent>
					</Card>
				)}

				{rejectedDocs.length > 0 && (
					<Card className='border-red-200 bg-red-50/50'>
						<CardContent className='py-5'>
							<div className='flex gap-3'>
								<AlertCircle className='w-5 h-5 text-red-600 shrink-0 mt-0.5' />
								<div className='space-y-3'>
									<div>
										<p className='font-medium text-red-800'>Action Required</p>
										<p className='text-sm text-red-700'>
											Some documents were rejected and need to be re-uploaded.
										</p>
									</div>
									{rejectedDocs.map((doc) => {
										const docType = getDocTypeById(doc.document_type_id);
										return (
											<div
												key={doc.id}
												className='bg-white rounded-lg p-3 border border-red-200'>
												<p className='text-sm font-medium text-red-800'>
													{docType?.name ?? 'Document'}
												</p>
												<p className='text-sm text-red-700 mt-1'>
													{doc.rejection_reason || 'Please upload a new copy.'}
												</p>
											</div>
										);
									})}
								</div>
							</div>
						</CardContent>
					</Card>
				)}

				<Card>
					<CardContent className='py-5'>
						<div className='flex items-center justify-between mb-3'>
							<span className='text-sm font-medium'>Your Progress</span>
							<span className='text-sm text-muted-foreground'>
								{uploadedRequiredCount} of {requiredTypes.length} required
								documents
							</span>
						</div>
						<div className='h-2 bg-muted rounded-full overflow-hidden'>
							<div
								className='h-full bg-primary transition-all duration-500'
								style={{ width: `${progress}%` }}
							/>
						</div>
					</CardContent>
				</Card>

				<div className='grid lg:grid-cols-5 gap-8'>
					<div className='lg:col-span-2 space-y-3'>
						<h2 className='text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4'>
							Required Documents
						</h2>
						{documentTypes.map((docType) => {
							const isUploaded = isDocTypeUploaded(docType.id);
							const docStatus = getDocStatus(docType.id);
							const isRejected = docStatus?.status === 'rejected';
							return (
								<div
									key={docType.id}
									className={cn(
										'flex items-center gap-3 p-3 rounded-lg border transition-colors',
										isRejected
											? 'bg-red-50/50 border-red-200'
											: isUploaded
												? 'bg-green-50/50 border-green-200'
												: 'bg-card hover:bg-muted/30',
									)}>
									{isRejected ? (
										<AlertCircle className='w-5 h-5 text-red-600 shrink-0' />
									) : isUploaded ? (
										<CheckCircle2 className='w-5 h-5 text-green-600 shrink-0' />
									) : (
										<div className='w-5 h-5 rounded-full border-2 border-muted-foreground/30 shrink-0' />
									)}
									<div className='min-w-0 flex-1'>
										<p className='text-sm font-medium truncate'>
											{docType.name}
											{docType.is_required && (
												<span className='text-destructive ml-1'>*</span>
											)}
										</p>
										<p className='text-xs text-muted-foreground flex items-center gap-1 mt-0.5'>
											{isRejected ? (
												'Needs re-upload'
											) : docStatus ? (
												`${docStatus.status} - ${new Date(
													docStatus.uploaded_at,
												).toLocaleDateString()}`
											) : docType.expiry_months ? (
												<>
													<Clock className='w-3 h-3' />
													Expires every {docType.expiry_months} months
												</>
											) : (
												'Not submitted'
											)}
										</p>
									</div>
								</div>
							);
						})}
					</div>

					<Card className='lg:col-span-3'>
						<CardHeader>
							<CardTitle className='text-lg'>Upload Document</CardTitle>
							<CardDescription>
								Select a document type and upload a file for review.
							</CardDescription>
						</CardHeader>
						<CardContent className='space-y-5'>
							<div className='space-y-2'>
								<Label>Document Type *</Label>
								<Select
									value={selectedType}
									onValueChange={(value) => {
										setSelectedType(value);
										setValidationErrors((prev) => {
											const next = { ...prev };
											delete next.documentTypeId;
											return next;
										});
									}}>
									<SelectTrigger
										className={cn(
											'h-11',
											validationErrors.documentTypeId && 'border-destructive',
										)}>
										<SelectValue placeholder='Select document type...' />
									</SelectTrigger>
									<SelectContent>
										{documentOptions.map((type) => (
											<SelectItem key={type.id} value={type.id}>
												{type.label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
								{validationErrors.documentTypeId && (
									<p className='text-xs text-destructive'>
										{validationErrors.documentTypeId}
									</p>
								)}
							</div>

							{selectedDocumentType?.expiry_months && (
								<div className='space-y-2'>
									<Label>Expiry Date</Label>
									<Input
										type='date'
										value={expiryDate}
										onChange={(event) => setExpiryDate(event.target.value)}
										className='h-11'
									/>
									<p className='text-xs text-muted-foreground'>
										Enter the expiry date shown on your document.
									</p>
								</div>
							)}

							<div className='space-y-2'>
								<Label>File *</Label>
								<div
									onDragOver={(event) => {
										event.preventDefault();
										setIsDragging(true);
									}}
									onDragLeave={(event) => {
										event.preventDefault();
										setIsDragging(false);
									}}
									onDrop={(event) => {
										event.preventDefault();
										setIsDragging(false);
										setFile(event.dataTransfer.files[0] ?? null);
									}}
									onClick={() => fileInputRef.current?.click()}
									className={cn(
										'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors',
										isDragging
											? 'border-primary bg-primary/5'
											: 'border-border hover:border-muted-foreground/50',
										file &&
											'border-solid border-muted-foreground/30 bg-muted/30',
									)}>
									<input
										ref={fileInputRef}
										type='file'
										className='hidden'
										onChange={(event) => setFile(event.target.files?.[0] ?? null)}
										accept='.pdf,.jpg,.jpeg,.png,.doc,.docx'
									/>

									{file ? (
										<div className='flex items-center justify-center gap-3'>
											<FileText className='w-10 h-10 text-muted-foreground' />
											<div className='text-left min-w-0'>
												<p className='text-sm font-medium truncate max-w-[220px]'>
													{file.name}
												</p>
												<p className='text-xs text-muted-foreground'>
													{(file.size / 1024 / 1024).toFixed(2)} MB
												</p>
											</div>
											<Button
												variant='ghost'
												size='icon'
												className='ml-2'
												onClick={(event) => {
													event.stopPropagation();
													setFile(null);
													if (fileInputRef.current) {
														fileInputRef.current.value = '';
													}
												}}>
												<X className='w-4 h-4' />
											</Button>
										</div>
									) : (
										<>
											<Upload className='w-10 h-10 text-muted-foreground mx-auto mb-3' />
											<p className='text-sm font-medium'>
												Drop your file here or click to browse
											</p>
											<p className='text-xs text-muted-foreground mt-1'>
												Supports PDF, JPG, PNG, DOC and DOCX up to 10MB
											</p>
										</>
									)}
								</div>
							</div>

							<Button
								onClick={handleUpload}
								className='w-full h-11'
								disabled={!file || !selectedType || isUploading}>
								{isUploading ? (
									<>
										<Loader2 className='w-4 h-4 mr-2 animate-spin' />
										Uploading...
									</>
								) : (
									<>
										<Upload className='w-4 h-4 mr-2' />
										{selectedTypeHasExistingDoc
											? 'Upload Replacement'
											: 'Upload Document'}
									</>
								)}
							</Button>
						</CardContent>
					</Card>
				</div>

				<Card>
					<CardHeader>
						<CardTitle className='text-lg'>Reference Details</CardTitle>
						<CardDescription>
							Add referee contact details for your agency to review.
						</CardDescription>
					</CardHeader>
					<CardContent className='space-y-6'>
						{references.map((reference, index) => (
							<div key={reference.id ?? index} className='space-y-4 rounded-lg border p-4'>
								<div className='flex items-center justify-between gap-3'>
									<p className='text-sm font-medium'>Reference {index + 1}</p>
									<Button
										type='button'
										variant='ghost'
										size='icon'
										disabled={references.length === 1}
										onClick={() =>
											setReferences((current) =>
												current.filter((_, refIndex) => refIndex !== index),
											)
										}>
										<Trash2 className='w-4 h-4' />
									</Button>
								</div>
								<div className='grid gap-4 sm:grid-cols-2'>
									<div className='space-y-2'>
										<Label>Name *</Label>
										<Input
											value={reference.fullName}
											onChange={(event) =>
												updateReference(index, 'fullName', event.target.value)
											}
										/>
									</div>
									<div className='space-y-2'>
										<Label>Relationship *</Label>
										<Input
											value={reference.relationship}
											onChange={(event) =>
												updateReference(
													index,
													'relationship',
													event.target.value,
												)
											}
										/>
									</div>
									<div className='space-y-2'>
										<Label>Email *</Label>
										<Input
											type='email'
											value={reference.email}
											onChange={(event) =>
												updateReference(index, 'email', event.target.value)
											}
										/>
									</div>
									<div className='space-y-2'>
										<Label>Phone *</Label>
										<Input
											type='tel'
											value={reference.phone}
											onChange={(event) =>
												updateReference(index, 'phone', event.target.value)
											}
										/>
									</div>
								</div>
								<div className='space-y-2'>
									<Label>Notes</Label>
									<Textarea
										value={reference.notes}
										onChange={(event) =>
											updateReference(index, 'notes', event.target.value)
										}
										rows={2}
									/>
								</div>
							</div>
						))}

						<div className='flex flex-col gap-3 sm:flex-row'>
							<Button
								type='button'
								variant='outline'
								onClick={() =>
									setReferences((current) => [...current, emptyReference()])
								}>
								<Plus className='w-4 h-4 mr-2' />
								Add Reference
							</Button>
							<Button
								type='button'
								className='sm:ml-auto'
								disabled={isSavingReferences}
								onClick={saveReferences}>
								{isSavingReferences ? 'Saving...' : 'Save References'}
							</Button>
						</div>
					</CardContent>
				</Card>
			</main>
		</div>
	);
}

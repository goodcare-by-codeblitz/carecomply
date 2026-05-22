'use client';

import { Button } from '@/components/ui/button';
import { PersonDetailsForm } from '@/components/carer-profile-card';
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
import type { PersonDetailsInput } from '@/lib/person-profile';
import {
	AlertCircle,
	CheckCircle2,
	Clock,
	FileText,
	Loader2,
	Shield,
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
	address_line1: string | null;
	address_line2: string | null;
	city: string | null;
	county: string | null;
	postcode: string | null;
	emergency_contact_name: string | null;
	emergency_contact_relationship: string | null;
	emergency_contact_phone: string | null;
	emergency_contact_email: string | null;
	onboarding_progress: number | null;
};

type Organization = {
	name: string;
	slug: string;
	required_work_references_count?: number | null;
	required_character_references_count?: number | null;
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
	organization: string;
	email: string;
	phone: string;
	relationship: string;
	notes: string;
	referenceType: 'work' | 'character';
};

type ApiReference = {
	id: string;
	full_name: string;
	organization: string | null;
	email: string;
	phone: string;
	relationship: string;
	notes: string | null;
	reference_type: string;
};

type OnboardingPayload = {
	organization: Organization;
	carer: Carer;
	documentTypes: DocumentType[];
	documents: UploadedDoc[];
	references: ApiReference[];
};

const emptyReference = (referenceType: 'work' | 'character'): ReferenceRow => ({
	fullName: '',
	organization: '',
	email: '',
	phone: '',
	relationship: '',
	notes: '',
	referenceType,
});

function mapApiRef(ref: ApiReference, referenceType: 'work' | 'character'): ReferenceRow {
	return {
		id: ref.id,
		fullName: ref.full_name,
		organization: ref.organization ?? '',
		email: ref.email,
		phone: ref.phone,
		relationship: ref.relationship,
		notes: ref.notes ?? '',
		referenceType,
	};
}

function isDocumentUnexpired(document: Pick<UploadedDoc, 'expiry_date'>) {
	if (!document.expiry_date) return true;

	const today = new Date();
	today.setHours(0, 0, 0, 0);
	const expiryDate = new Date(document.expiry_date);
	expiryDate.setHours(0, 0, 0, 0);

	return expiryDate >= today;
}

export function OnboardingClient() {
	const { token } = useParams<{ token: string }>();
	const [carer, setCarer] = useState<Carer | null>(null);
	const [carerPhone, setCarerPhone] = useState('');
	const [profileForm, setProfileForm] = useState<PersonDetailsInput>({
		phone: '',
		addressLine1: '',
		addressLine2: '',
		city: '',
		county: '',
		postcode: '',
		emergencyContactName: '',
		emergencyContactRelationship: '',
		emergencyContactPhone: '',
		emergencyContactEmail: '',
	});
	const [organization, setOrganization] = useState<Organization>(null);
	const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([]);
	const [uploadedDocs, setUploadedDocs] = useState<UploadedDoc[]>([]);
	const [workReferences, setWorkReferences] = useState<ReferenceRow[]>([]);
	const [characterReferences, setCharacterReferences] = useState<ReferenceRow[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const [selectedType, setSelectedType] = useState('');
	const [expiryDate, setExpiryDate] = useState('');
	const [file, setFile] = useState<File | null>(null);
	const [isDragging, setIsDragging] = useState(false);
	const [isUploading, setIsUploading] = useState(false);
	const [isSavingWorkRefs, setIsSavingWorkRefs] = useState(false);
	const [isSavingCharRefs, setIsSavingCharRefs] = useState(false);
	const [isSavingProfile, setIsSavingProfile] = useState(false);
	const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
	const fileInputRef = useRef<HTMLInputElement>(null);

	const loadOnboarding = useCallback(async () => {
		setLoading(true);
		setError(null);

		try {
			const response = await fetch(
				`/api/onboarding/details?token=${encodeURIComponent(token)}`,
			);
			const payload = (await response.json()) as OnboardingPayload | { error?: string };

			if (!response.ok) {
				const errorPayload = payload as { error?: string };
				setError(errorPayload.error ?? 'This onboarding link is not valid.');
				return;
			}

			const data = payload as OnboardingPayload;
			const reqWork = data.organization?.required_work_references_count ?? 0;
			const reqChar = data.organization?.required_character_references_count ?? 0;

			const savedWork = data.references.filter((r) => r.reference_type === 'work');
			const savedChar = data.references.filter((r) => r.reference_type === 'character');

			setCarer(data.carer);
			setCarerPhone(data.carer.phone ?? '');
			setProfileForm({
				phone: data.carer.phone ?? '',
				addressLine1: data.carer.address_line1 ?? '',
				addressLine2: data.carer.address_line2 ?? '',
				city: data.carer.city ?? '',
				county: data.carer.county ?? '',
				postcode: data.carer.postcode ?? '',
				emergencyContactName: data.carer.emergency_contact_name ?? '',
				emergencyContactRelationship:
					data.carer.emergency_contact_relationship ?? '',
				emergencyContactPhone: data.carer.emergency_contact_phone ?? '',
				emergencyContactEmail: data.carer.emergency_contact_email ?? '',
			});
			setOrganization(data.organization);
			setDocumentTypes(data.documentTypes);
			setUploadedDocs(data.documents);
			setWorkReferences(
				Array.from({ length: reqWork }, (_, i) =>
					savedWork[i] ? mapApiRef(savedWork[i], 'work') : emptyReference('work'),
				),
			);
			setCharacterReferences(
				Array.from({ length: reqChar }, (_, i) =>
					savedChar[i] ? mapApiRef(savedChar[i], 'character') : emptyReference('character'),
				),
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

	// Document helpers
	const documentsByType = uploadedDocs.reduce<Record<string, UploadedDoc[]>>(
		(groups, doc) => {
			if (doc.status === 'obsolete') return groups;
			groups[doc.document_type_id] = groups[doc.document_type_id] ?? [];
			groups[doc.document_type_id].push(doc);
			return groups;
		},
		{},
	);
	const getDocTypeById = (id: string) => documentTypes.find((type) => type.id === id);
	const getDocsForType = (id: string) => documentsByType[id] ?? [];
	const getEffectiveDocStatus = (id: string) => {
		const docs = getDocsForType(id);
		const approvedDoc = docs.find(
			(doc) => doc.status === 'approved' && isDocumentUnexpired(doc),
		);
		if (approvedDoc) return approvedDoc;
		return docs.find((doc) => doc.status !== 'rejected') ?? docs[0] ?? null;
	};
	const isDocTypeCompliant = (id: string) =>
		getDocsForType(id).some(
			(doc) => doc.status === 'approved' && isDocumentUnexpired(doc),
		);
	const isDocTypeSubmitted = (id: string) =>
		getDocsForType(id).some((doc) => doc.status === 'pending');

	const rejectedDocs = uploadedDocs.filter((doc) => doc.status === 'rejected');
	const requiredTypes = documentTypes.filter((type) => type.is_required);
	const uploadedRequiredCount = requiredTypes.filter((type) =>
		isDocTypeCompliant(type.id),
	).length;

	// Reference compliance
	const reqWork = organization?.required_work_references_count ?? 0;
	const reqChar = organization?.required_character_references_count ?? 0;
	const workSaved = workReferences.filter((r) => r.id).length;
	const charSaved = characterReferences.filter((r) => r.id).length;
	const workComplete = reqWork > 0 && workSaved >= reqWork;
	const charComplete = reqChar > 0 && charSaved >= reqChar;

	const totalRequired =
		requiredTypes.length + (reqWork > 0 ? 1 : 0) + (reqChar > 0 ? 1 : 0);
	const completedCount =
		uploadedRequiredCount + (workComplete ? 1 : 0) + (charComplete ? 1 : 0);
	const progress = totalRequired > 0 ? Math.round((completedCount / totalRequired) * 100) : 100;
	const hasAllRequiredDocuments = progress === 100;

	const selectedDocumentType = selectedType ? getDocTypeById(selectedType) : null;
	const selectedTypeHasExistingDoc = selectedType
		? getDocsForType(selectedType).length > 0
		: false;

	const documentOptions = documentTypes.map((type) => {
		const latest = getEffectiveDocStatus(type.id);
		const suffix =
			latest?.status === 'rejected'
				? ' (re-upload)'
				: getDocsForType(type.id).length > 0
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
			const uploadPayload = (await response.json()) as {
				document?: UploadedDoc;
				progress?: number;
				error?: string;
			};

			if (!response.ok || !uploadPayload.document) {
				throw new Error(uploadPayload.error || 'Upload failed');
			}

			setUploadedDocs((prev) => [uploadPayload.document!, ...prev]);
			setCarer((prev) =>
				prev ? { ...prev, onboarding_progress: uploadPayload.progress ?? progress } : prev,
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
			toast.error(err instanceof Error ? err.message : 'Failed to upload document');
		} finally {
			setIsUploading(false);
		}
	};

	const updateRef = (
		type: 'work' | 'character',
		index: number,
		field: keyof ReferenceRow,
		value: string,
	) => {
		const setter = type === 'work' ? setWorkReferences : setCharacterReferences;
		setter((current) =>
			current.map((ref, i) => (i === index ? { ...ref, [field]: value } : ref)),
		);
	};

	const saveReferences = async (
		type: 'work' | 'character',
		refs: ReferenceRow[],
	) => {
		const setIsSaving = type === 'work' ? setIsSavingWorkRefs : setIsSavingCharRefs;
		setIsSaving(true);

		try {
			const response = await fetch('/api/onboarding/references', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					token,
					carerPhone,
					references: refs.map(({ fullName, organization: org, email, phone, relationship, notes, referenceType }) => ({
						fullName,
						organization: org,
						email,
						phone,
						relationship,
						notes,
						referenceType,
					})),
				}),
			});
			const refPayload = (await response.json()) as {
				references?: ApiReference[];
				carerPhone?: string | null;
				error?: string;
			};

			if (!response.ok || !refPayload.references) {
				throw new Error(refPayload.error || 'References could not be saved');
			}

			const saved = refPayload.references.filter((r) => r.reference_type === type);
			const setter = type === 'work' ? setWorkReferences : setCharacterReferences;
			const req = type === 'work' ? reqWork : reqChar;

			setter(
				Array.from({ length: req }, (_, i) =>
					saved[i] ? mapApiRef(saved[i], type) : emptyReference(type),
				),
			);
			setCarer((prev) => (prev ? { ...prev, phone: refPayload.carerPhone ?? null } : prev));
			toast.success(
				type === 'work' ? 'Work references saved' : 'Character references saved',
			);
		} catch (err) {
			console.error(err);
			toast.error(err instanceof Error ? err.message : 'References could not be saved');
		} finally {
			setIsSaving(false);
		}
	};

	const updateProfileField = (field: keyof PersonDetailsInput, value: string) => {
		setProfileForm((current) => ({ ...current, [field]: value }));
		if (field === 'phone') setCarerPhone(value);
	};

	const saveProfile = async () => {
		setIsSavingProfile(true);
		try {
			const response = await fetch('/api/onboarding/profile', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ token, ...profileForm }),
			});
			const payload = (await response.json()) as {
				carer?: Partial<Carer>;
				error?: string;
			};
			if (!response.ok || !payload.carer) {
				throw new Error(payload.error || 'Profile details could not be saved.');
			}
			setCarer((current) => (current ? { ...current, ...payload.carer } : current));
			setCarerPhone(payload.carer.phone ?? '');
			toast.success('Profile details saved');
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : 'Profile details could not be saved.',
			);
		} finally {
			setIsSavingProfile(false);
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
								<PersonDetailsForm form={profileForm} onChange={updateProfileField} />
								<Button
									type='button'
									className='w-full'
									disabled={isSavingProfile}
									onClick={saveProfile}>
									{isSavingProfile ? 'Saving...' : 'Save details'}
								</Button>
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
									All requirements completed
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
								{completedCount} of {totalRequired} required{' '}
								{totalRequired > requiredTypes.length ? 'items' : 'documents'}
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
							Required Items
						</h2>
						{documentTypes.map((docType) => {
							const isUploaded = isDocTypeCompliant(docType.id);
							const docStatus = getEffectiveDocStatus(docType.id);
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
												: isDocTypeSubmitted(docType.id)
													? 'bg-amber-50/50 border-amber-200'
													: 'bg-card hover:bg-muted/30',
									)}>
									{isRejected ? (
										<AlertCircle className='w-5 h-5 text-red-600 shrink-0' />
									) : isUploaded ? (
										<CheckCircle2 className='w-5 h-5 text-green-600 shrink-0' />
									) : isDocTypeSubmitted(docType.id) ? (
										<Clock className='w-5 h-5 text-amber-500 shrink-0' />
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
											) : docStatus?.status === 'pending' ? (
												`Under review – submitted ${new Date(docStatus.uploaded_at).toLocaleDateString()}`
											) : docStatus?.status === 'approved' ? (
												`Approved – ${new Date(docStatus.uploaded_at).toLocaleDateString()}`
											) : docStatus ? (
												`${docStatus.status} – ${new Date(docStatus.uploaded_at).toLocaleDateString()}`
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

						{reqWork > 0 && (
							<div
								className={cn(
									'flex items-center gap-3 p-3 rounded-lg border transition-colors',
									workComplete
										? 'bg-green-50/50 border-green-200'
										: workSaved > 0
											? 'bg-amber-50/50 border-amber-200'
											: 'bg-card hover:bg-muted/30',
								)}>
								{workComplete ? (
									<CheckCircle2 className='w-5 h-5 text-green-600 shrink-0' />
								) : workSaved > 0 ? (
									<Clock className='w-5 h-5 text-amber-500 shrink-0' />
								) : (
									<div className='w-5 h-5 rounded-full border-2 border-muted-foreground/30 shrink-0' />
								)}
								<div className='min-w-0 flex-1'>
									<p className='text-sm font-medium'>
										Work References
										<span className='text-destructive ml-1'>*</span>
									</p>
									<p className='text-xs text-muted-foreground mt-0.5'>
										{workComplete
											? `${workSaved} of ${reqWork} saved`
											: workSaved > 0
												? `${workSaved} of ${reqWork} saved – add more below`
												: `${reqWork} required – complete the form below`}
									</p>
								</div>
							</div>
						)}

						{reqChar > 0 && (
							<div
								className={cn(
									'flex items-center gap-3 p-3 rounded-lg border transition-colors',
									charComplete
										? 'bg-green-50/50 border-green-200'
										: charSaved > 0
											? 'bg-amber-50/50 border-amber-200'
											: 'bg-card hover:bg-muted/30',
								)}>
								{charComplete ? (
									<CheckCircle2 className='w-5 h-5 text-green-600 shrink-0' />
								) : charSaved > 0 ? (
									<Clock className='w-5 h-5 text-amber-500 shrink-0' />
								) : (
									<div className='w-5 h-5 rounded-full border-2 border-muted-foreground/30 shrink-0' />
								)}
								<div className='min-w-0 flex-1'>
									<p className='text-sm font-medium'>
										Character References
										<span className='text-destructive ml-1'>*</span>
									</p>
									<p className='text-xs text-muted-foreground mt-0.5'>
										{charComplete
											? `${charSaved} of ${reqChar} saved`
											: charSaved > 0
												? `${charSaved} of ${reqChar} saved – add more below`
												: `${reqChar} required – complete the form below`}
									</p>
								</div>
							</div>
						)}
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

							<div className='space-y-2'>
								<Label>Expiry Date</Label>
								<Input
									type='date'
									value={expiryDate}
									onChange={(event) => setExpiryDate(event.target.value)}
									className='h-11'
									disabled={!selectedDocumentType}
								/>
								<p className='text-xs text-muted-foreground'>
									{!selectedDocumentType
										? 'Select a document type first, then add an expiry date if one applies.'
										: selectedDocumentType.expiry_months
											? 'Enter the expiry date shown on your document.'
											: 'Leave this blank if the document does not have an expiry date.'}
								</p>
							</div>

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
										file && 'border-solid border-muted-foreground/30 bg-muted/30',
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
										{selectedTypeHasExistingDoc ? 'Upload Replacement' : 'Upload Document'}
									</>
								)}
							</Button>
						</CardContent>
					</Card>
				</div>

				{reqWork > 0 && (
					<ReferenceCard
						title='Work References'
						description={`Provide ${reqWork} work reference${reqWork > 1 ? 's' : ''} from previous employers or colleagues.`}
						references={workReferences}
						isSaving={isSavingWorkRefs}
						onUpdate={(index, field, value) => updateRef('work', index, field, value)}
						onSave={() => saveReferences('work', workReferences)}
					/>
				)}

				{reqChar > 0 && (
					<ReferenceCard
						title='Character References'
						description={`Provide ${reqChar} character reference${reqChar > 1 ? 's' : ''} from someone who can vouch for your character.`}
						references={characterReferences}
						isSaving={isSavingCharRefs}
						onUpdate={(index, field, value) => updateRef('character', index, field, value)}
						onSave={() => saveReferences('character', characterReferences)}
					/>
				)}
			</main>
		</div>
	);
}

type ReferenceCardProps = {
	title: string;
	description: string;
	references: ReferenceRow[];
	isSaving: boolean;
	onUpdate: (index: number, field: keyof ReferenceRow, value: string) => void;
	onSave: () => void;
};

function ReferenceCard({
	title,
	description,
	references,
	isSaving,
	onUpdate,
	onSave,
}: ReferenceCardProps) {
	return (
		<Card>
			<CardHeader>
				<CardTitle className='text-lg'>{title}</CardTitle>
				<CardDescription>{description}</CardDescription>
			</CardHeader>
			<CardContent className='space-y-6'>
				{references.map((reference, index) => (
					<div
						key={reference.id ?? index}
						className='space-y-4 rounded-lg border p-4'>
						<p className='text-sm font-medium'>Reference {index + 1}</p>
						<div className='grid gap-4 sm:grid-cols-2'>
							<div className='space-y-2'>
								<Label>Name *</Label>
								<Input
									value={reference.fullName}
									onChange={(e) => onUpdate(index, 'fullName', e.target.value)}
								/>
							</div>
							<div className='space-y-2'>
								<Label>Organisation</Label>
								<Input
									value={reference.organization}
									placeholder='e.g. ABC Care Home'
									onChange={(e) => onUpdate(index, 'organization', e.target.value)}
								/>
							</div>
							<div className='space-y-2'>
								<Label>Relationship *</Label>
								<Input
									value={reference.relationship}
									onChange={(e) => onUpdate(index, 'relationship', e.target.value)}
								/>
							</div>
							<div className='space-y-2'>
								<Label>Email *</Label>
								<Input
									type='email'
									value={reference.email}
									onChange={(e) => onUpdate(index, 'email', e.target.value)}
								/>
							</div>
							<div className='space-y-2'>
								<Label>Phone *</Label>
								<Input
									type='tel'
									value={reference.phone}
									onChange={(e) => onUpdate(index, 'phone', e.target.value)}
								/>
							</div>
						</div>
						<div className='space-y-2'>
							<Label>Notes</Label>
							<Textarea
								value={reference.notes}
								onChange={(e) => onUpdate(index, 'notes', e.target.value)}
								rows={2}
							/>
						</div>
					</div>
				))}

				<div className='flex justify-end'>
					<Button type='button' disabled={isSaving} onClick={onSave}>
						{isSaving ? 'Saving...' : `Save ${title}`}
					</Button>
				</div>
			</CardContent>
		</Card>
	);
}

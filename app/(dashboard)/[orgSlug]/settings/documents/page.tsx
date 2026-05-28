'use client';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { getCurrentOrgBySlug } from '@/lib/orgs';
import { createClient } from '@/lib/supabase/client';
import { useOrgStore } from '@/stores/auth-store';
import { FileCheck2, Loader2, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

type DocumentType = {
	id: string;
	name: string;
	description: string | null;
	is_required: boolean;
	expiry_months: number | null;
	created_at: string | null;
};

type FormState = {
	id?: string;
	name: string;
	description: string;
	isRequired: boolean;
	expiryMonths: string;
};

const emptyForm: FormState = {
	name: '',
	description: '',
	isRequired: true,
	expiryMonths: '',
};

async function readJsonResponse<T>(response: Response): Promise<T> {
	const contentType = response.headers.get('content-type') ?? '';

	if (!contentType.includes('application/json')) {
		throw new Error('Document requirement request failed.');
	}

	return (await response.json()) as T;
}

export default function DocumentSettingsPage() {
	const { orgSlug } = useParams<{ orgSlug: string }>();
	const router = useRouter();
	const storeOrg = useOrgStore((state) => state.getCurrentOrgFromSlug(orgSlug));
	const updateOrganization = useOrgStore((state) => state.updateOrganization);
	const [organization, setOrganization] = useState(storeOrg ?? null);
	const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([]);
	const [form, setForm] = useState<FormState>(emptyForm);
	const [isLoading, setIsLoading] = useState(false);
	const [isSaving, setIsSaving] = useState(false);
	const [deletingId, setDeletingId] = useState<string | null>(null);

	const [requireWork, setRequireWork] = useState(false);
	const [workCount, setWorkCount] = useState('2');
	const [requireChar, setRequireChar] = useState(false);
	const [charCount, setCharCount] = useState('2');
	const [isSavingRefs, setIsSavingRefs] = useState(false);

	useEffect(() => {
		if (storeOrg) {
			setOrganization(storeOrg);
			seedRefSettings(storeOrg.required_work_references_count, storeOrg.required_character_references_count);
			return;
		}

		const fetchOrganization = async () => {
			const supabase = createClient();
			const {
				data: { user },
			} = await supabase.auth.getUser();

			if (!user) {
				router.push('/auth/login');
				return;
			}

			const org = await getCurrentOrgBySlug(supabase, user.id, orgSlug);
			setOrganization(org);
			if (org) {
				seedRefSettings(org.required_work_references_count, org.required_character_references_count);
			}
		};

		fetchOrganization();
	}, [orgSlug, router, storeOrg]);

	function seedRefSettings(
		workCount_: number | null | undefined,
		charCount_: number | null | undefined,
	) {
		setRequireWork((workCount_ ?? 0) > 0);
		if (workCount_) setWorkCount(String(workCount_));
		setRequireChar((charCount_ ?? 0) > 0);
		if (charCount_) setCharCount(String(charCount_));
	}

	const loadDocumentTypes = useCallback(async () => {
		if (!organization) return;

		setIsLoading(true);
		try {
			const response = await fetch(
				`/api/settings/document-types?orgId=${encodeURIComponent(
					organization.id,
				)}`,
			);
			const payload = await readJsonResponse<{
				documentTypes?: DocumentType[];
				error?: string;
			}>(response);

			if (!response.ok) {
				throw new Error(payload.error || 'Document requirements could not load');
			}

			setDocumentTypes(payload.documentTypes ?? []);
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: 'Document requirements could not load',
			);
		} finally {
			setIsLoading(false);
		}
	}, [organization]);

	useEffect(() => {
		loadDocumentTypes();
	}, [loadDocumentTypes]);

	const resetForm = () => setForm(emptyForm);

	const editDocumentType = (documentType: DocumentType) => {
		setForm({
			id: documentType.id,
			name: documentType.name,
			description: documentType.description ?? '',
			isRequired: documentType.is_required,
			expiryMonths: documentType.expiry_months
				? String(documentType.expiry_months)
				: '',
		});
	};

	const saveDocumentType = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (!organization) return;

		const name = form.name.trim();
		if (!name) {
			toast.error('Document name is required');
			return;
		}

		const expiryMonths = form.expiryMonths.trim()
			? Number(form.expiryMonths)
			: null;

		if (
			expiryMonths !== null &&
			(!Number.isInteger(expiryMonths) || expiryMonths <= 0)
		) {
			toast.error('Expiry cycle must be a positive number of months');
			return;
		}

		setIsSaving(true);
		try {
			const response = await fetch('/api/settings/document-types', {
				method: form.id ? 'PATCH' : 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					id: form.id,
					orgId: organization.id,
					name,
					description: form.description.trim(),
					isRequired: form.isRequired,
					expiryMonths,
				}),
			});
			const payload = await readJsonResponse<{
				documentType?: DocumentType;
				error?: string;
			}>(response);

			if (!response.ok || !payload.documentType) {
				throw new Error(payload.error || 'Document requirement could not save');
			}

			setDocumentTypes((current) =>
				form.id
					? current.map((type) =>
							type.id === payload.documentType!.id
								? payload.documentType!
								: type,
						)
					: [...current, payload.documentType!].sort((a, b) =>
							a.name.localeCompare(b.name),
						),
			);
			resetForm();
			toast.success(form.id ? 'Requirement updated' : 'Requirement created');
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: 'Document requirement could not save',
			);
		} finally {
			setIsSaving(false);
		}
	};

	const saveReferenceRequirements = async () => {
		if (!organization) return;

		const workVal = requireWork ? Math.max(1, Math.min(5, parseInt(workCount) || 2)) : null;
		const charVal = requireChar ? Math.max(1, Math.min(5, parseInt(charCount) || 2)) : null;

		setIsSavingRefs(true);
		try {
			const response = await fetch('/api/settings/organization', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'reference_requirements',
					orgId: organization.id,
					requiredWorkReferencesCount: workVal,
					requiredCharacterReferencesCount: charVal,
				}),
			});
			const payload = await readJsonResponse<{
				organization?: typeof organization;
				error?: string;
			}>(response);

			if (!response.ok || !payload.organization) {
				throw new Error(
					payload.error || 'Reference requirements could not be saved',
				);
			}

			toast.success('Reference requirements updated');
			updateOrganization(organization.id, {
				required_work_references_count: workVal,
				required_character_references_count: charVal,
			});
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: 'Reference requirements could not be saved',
			);
		} finally {
			setIsSavingRefs(false);
			return;
		}
	};

	const deleteDocumentType = async (documentType: DocumentType) => {
		if (!organization) return;

		setDeletingId(documentType.id);
		try {
			const response = await fetch('/api/settings/document-types', {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					orgId: organization.id,
					id: documentType.id,
				}),
			});
			const payload = await readJsonResponse<{ error?: string }>(response);

			if (!response.ok) {
				throw new Error(payload.error || 'Document requirement could not delete');
			}

			setDocumentTypes((current) =>
				current.filter((type) => type.id !== documentType.id),
			);
			if (form.id === documentType.id) resetForm();
			toast.success('Requirement deleted');
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: 'Document requirement could not delete',
			);
		} finally {
			setDeletingId(null);
		}
	};

	return (
		<div className='space-y-6'>
			{/* Create / edit form */}
			<div className='overflow-hidden rounded-xl border border-line bg-white shadow-card'>
				<div className='border-b border-line bg-surface-page px-5 py-3.5'>
					<p className='text-[14px] font-semibold text-ink'>Carer Document Requirements</p>
					<p className='mt-0.5 text-[12.5px] text-slate-500'>
						Define the documents carers must upload during onboarding.
					</p>
				</div>
				<div className='p-5'>
					<form
						onSubmit={saveDocumentType}
						className='rounded-xl border border-line p-4'>
						<div className='grid gap-4 md:grid-cols-2'>
							<div className='space-y-2'>
								<Label htmlFor='document-name' className='text-[13px] font-medium text-ink'>
									Document name
								</Label>
								<Input
									id='document-name'
									value={form.name}
									onChange={(event) =>
										setForm((current) => ({
											...current,
											name: event.target.value,
										}))
									}
									placeholder='DBS certificate'
									className='text-[13.5px]'
								/>
							</div>
							<div className='space-y-2'>
								<Label htmlFor='expiry-months' className='text-[13px] font-medium text-ink'>
									Expiry cycle months
								</Label>
								<Input
									id='expiry-months'
									type='number'
									min='1'
									value={form.expiryMonths}
									onChange={(event) =>
										setForm((current) => ({
											...current,
											expiryMonths: event.target.value,
										}))
									}
									placeholder='12'
									className='text-[13.5px]'
								/>
							</div>
						</div>
						<div className='mt-4 space-y-2'>
							<Label htmlFor='document-description' className='text-[13px] font-medium text-ink'>
								Description
							</Label>
							<Textarea
								id='document-description'
								value={form.description}
								onChange={(event) =>
									setForm((current) => ({
										...current,
										description: event.target.value,
									}))
								}
								placeholder='Optional guidance shown to admins'
								rows={3}
								className='text-[13.5px]'
							/>
						</div>
						<label className='mt-4 flex items-center gap-3 text-[13px] text-ink'>
							<Checkbox
								checked={form.isRequired}
								onCheckedChange={(value) =>
									setForm((current) => ({
										...current,
										isRequired: value === true,
									}))
								}
							/>
							Required for onboarding completion
						</label>
						<div className='mt-4 flex flex-col gap-2 sm:flex-row'>
							<Button type='submit' disabled={isSaving}>
								{isSaving ? (
									<Loader2 className='mr-2 h-4 w-4 animate-spin' />
								) : (
									<Plus className='mr-2 h-4 w-4' />
								)}
								{form.id ? 'Update requirement' : 'Create requirement'}
							</Button>
							{form.id && (
								<Button type='button' variant='outline' onClick={resetForm}>
									<X className='mr-2 h-4 w-4' />
									Cancel edit
								</Button>
							)}
						</div>
					</form>
				</div>
			</div>

			{/* Configured document types */}
			<div className='overflow-hidden rounded-xl border border-line bg-white shadow-card'>
				<div className='border-b border-line bg-surface-page px-5 py-2.5'>
					<span className='text-[11.5px] font-semibold uppercase tracking-[0.10em] text-slate-400'>
						Configured Requirements
					</span>
					<span className='ml-1.5 text-[11.5px] font-normal text-slate-400'>
						— These document types appear in the carer onboarding portal.
					</span>
				</div>
				<div className='p-5'>
					{isLoading ? (
						<div className='flex justify-center py-8'>
							<Loader2 className='h-6 w-6 animate-spin text-slate-400' />
						</div>
					) : documentTypes.length > 0 ? (
						<div className='space-y-3'>
							{documentTypes.map((documentType) => (
								<div
									key={documentType.id}
									className='flex flex-col gap-4 rounded-xl border border-line p-4 sm:flex-row sm:items-center sm:justify-between'>
									<div className='min-w-0'>
										<div className='flex flex-wrap items-center gap-2'>
											<FileCheck2 className='h-4 w-4 text-slate-400' />
											<p className='text-[13.5px] font-medium text-ink'>{documentType.name}</p>
											{documentType.is_required && (
												<span className='inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold bg-brand-50 text-brand-700'>
													Required
												</span>
											)}
											{documentType.expiry_months && (
												<span className='inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold bg-surface-muted text-slate-600'>
													Expires every {documentType.expiry_months} months
												</span>
											)}
										</div>
										{documentType.description && (
											<p className='mt-1 text-[12.5px] text-slate-400'>
												{documentType.description}
											</p>
										)}
									</div>
									<div className='flex gap-2'>
										<Button
											type='button'
											variant='outline'
											size='sm'
											className='h-7 text-[12.5px]'
											onClick={() => editDocumentType(documentType)}>
											<Pencil className='mr-1.5 h-3.5 w-3.5' />
											Edit
										</Button>
										<Button
											type='button'
											variant='outline'
											size='sm'
											className='h-7 text-[12.5px]'
											disabled={deletingId === documentType.id}
											onClick={() => deleteDocumentType(documentType)}>
											{deletingId === documentType.id ? (
												<Loader2 className='mr-1.5 h-3.5 w-3.5 animate-spin' />
											) : (
												<Trash2 className='mr-1.5 h-3.5 w-3.5' />
											)}
											Delete
										</Button>
									</div>
								</div>
							))}
						</div>
					) : (
						<div className='rounded-xl border border-dashed border-line p-8 text-center'>
							<p className='text-[13px] text-slate-400'>
								No document requirements have been configured yet.
							</p>
						</div>
					)}
				</div>
			</div>

			{/* Reference requirements */}
			<div className='overflow-hidden rounded-xl border border-line bg-white shadow-card'>
				<div className='border-b border-line bg-surface-page px-5 py-3.5'>
					<p className='text-[14px] font-semibold text-ink'>Reference Requirements</p>
					<p className='mt-0.5 text-[12.5px] text-slate-500'>
						Configure how many work and character references carers must submit during
						onboarding. Each required type counts toward their compliance progress.
					</p>
				</div>
				<div className='space-y-5 p-5'>
					<div className='space-y-4 rounded-xl border border-line p-4'>
						<div className='flex items-center justify-between'>
							<div>
								<p className='text-[13.5px] font-medium text-ink'>Work References</p>
								<p className='text-[12px] text-slate-400'>
									References from previous employers or professional contacts.
								</p>
							</div>
							<Switch checked={requireWork} onCheckedChange={setRequireWork} />
						</div>
						{requireWork && (
							<div className='space-y-2'>
								<Label htmlFor='work-ref-count' className='text-[13px] font-medium text-ink'>
									Number required
								</Label>
								<Input
									id='work-ref-count'
									type='number'
									min='1'
									max='5'
									value={workCount}
									onChange={(e) => setWorkCount(e.target.value)}
									className='w-24 text-[13.5px]'
								/>
							</div>
						)}
					</div>

					<div className='space-y-4 rounded-xl border border-line p-4'>
						<div className='flex items-center justify-between'>
							<div>
								<p className='text-[13.5px] font-medium text-ink'>Character References</p>
								<p className='text-[12px] text-slate-400'>
									References from someone who can vouch for the carer&apos;s character.
								</p>
							</div>
							<Switch checked={requireChar} onCheckedChange={setRequireChar} />
						</div>
						{requireChar && (
							<div className='space-y-2'>
								<Label htmlFor='char-ref-count' className='text-[13px] font-medium text-ink'>
									Number required
								</Label>
								<Input
									id='char-ref-count'
									type='number'
									min='1'
									max='5'
									value={charCount}
									onChange={(e) => setCharCount(e.target.value)}
									className='w-24 text-[13.5px]'
								/>
							</div>
						)}
					</div>

					<Button type='button' disabled={isSavingRefs} onClick={saveReferenceRequirements}>
						{isSavingRefs && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
						Save reference requirements
					</Button>
				</div>
			</div>
		</div>
	);
}

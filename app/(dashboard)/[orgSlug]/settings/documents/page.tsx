'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
	const [organization, setOrganization] = useState(storeOrg ?? null);
	const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([]);
	const [form, setForm] = useState<FormState>(emptyForm);
	const [isLoading, setIsLoading] = useState(false);
	const [isSaving, setIsSaving] = useState(false);
	const [deletingId, setDeletingId] = useState<string | null>(null);

	useEffect(() => {
		if (storeOrg) {
			setOrganization(storeOrg);
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

			setOrganization(await getCurrentOrgBySlug(supabase, user.id, orgSlug));
		};

		fetchOrganization();
	}, [orgSlug, router, storeOrg]);

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
			<Card>
				<CardHeader>
					<CardTitle>Carer Document Requirements</CardTitle>
					<CardDescription>
						Define the documents carers must upload during onboarding.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<form
						onSubmit={saveDocumentType}
						className='grid gap-4 rounded-md border p-4'>
						<div className='grid gap-4 md:grid-cols-2'>
							<div className='space-y-2'>
								<Label htmlFor='document-name'>Document name</Label>
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
								/>
							</div>
							<div className='space-y-2'>
								<Label htmlFor='expiry-months'>Expiry cycle months</Label>
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
								/>
							</div>
						</div>
						<div className='space-y-2'>
							<Label htmlFor='document-description'>Description</Label>
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
							/>
						</div>
						<label className='flex items-center gap-3 text-sm'>
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
						<div className='flex flex-col gap-2 sm:flex-row'>
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
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Configured Requirements</CardTitle>
					<CardDescription>
						These document types appear in the carer onboarding portal.
					</CardDescription>
				</CardHeader>
				<CardContent>
					{isLoading ? (
						<div className='flex justify-center py-8'>
							<Loader2 className='h-6 w-6 animate-spin text-muted-foreground' />
						</div>
					) : documentTypes.length > 0 ? (
						<div className='space-y-3'>
							{documentTypes.map((documentType) => (
								<div
									key={documentType.id}
									className='flex flex-col gap-4 rounded-md border p-4 sm:flex-row sm:items-center sm:justify-between'>
									<div className='min-w-0'>
										<div className='flex flex-wrap items-center gap-2'>
											<FileCheck2 className='h-4 w-4 text-muted-foreground' />
											<p className='font-medium'>{documentType.name}</p>
											{documentType.is_required && <Badge>Required</Badge>}
											{documentType.expiry_months && (
												<Badge variant='outline'>
													Expires every {documentType.expiry_months} months
												</Badge>
											)}
										</div>
										{documentType.description && (
											<p className='mt-1 text-sm text-muted-foreground'>
												{documentType.description}
											</p>
										)}
									</div>
									<div className='flex gap-2'>
										<Button
											type='button'
											variant='outline'
											size='sm'
											onClick={() => editDocumentType(documentType)}>
											<Pencil className='mr-2 h-4 w-4' />
											Edit
										</Button>
										<Button
											type='button'
											variant='outline'
											size='sm'
											disabled={deletingId === documentType.id}
											onClick={() => deleteDocumentType(documentType)}>
											{deletingId === documentType.id ? (
												<Loader2 className='mr-2 h-4 w-4 animate-spin' />
											) : (
												<Trash2 className='mr-2 h-4 w-4' />
											)}
											Delete
										</Button>
									</div>
								</div>
							))}
						</div>
					) : (
						<div className='rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground'>
							No document requirements have been configured yet.
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
}

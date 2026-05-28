'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
	getCurrentOrgBySlug,
	getOrgInitials,
	getOrgLogoSrc,
	isMissingColumnOrBucketError,
	type UserOrganization,
} from '@/lib/orgs';
import { createClient } from '@/lib/supabase/client';
import { useOrgStore } from '@/stores/auth-store';
import { Building2, ImageUp, Loader2 } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

const LOGO_BUCKET = 'organization-assets';
const MAX_LOGO_SIZE = 2 * 1024 * 1024;

async function readJsonResponse<T>(response: Response): Promise<T> {
	const contentType = response.headers.get('content-type') ?? '';
	if (!contentType.includes('application/json')) {
		throw new Error('Organization settings request failed.');
	}

	return (await response.json()) as T;
}

export default function SettingsProfilePage() {
	const { orgSlug } = useParams<{ orgSlug: string }>();
	const router = useRouter();
	const storeOrg = useOrgStore((state) => state.getCurrentOrgFromSlug(orgSlug));
	const updateOrganization = useOrgStore((state) => state.updateOrganization);
	const [organization, setOrganization] = useState<UserOrganization | null>(
		storeOrg ?? null,
	);
	const [name, setName] = useState(storeOrg?.name ?? '');
	const [isLoading, setIsLoading] = useState(!storeOrg);
	const [isSavingName, setIsSavingName] = useState(false);
	const [isUploadingLogo, setIsUploadingLogo] = useState(false);

	useEffect(() => {
		if (storeOrg) {
			setOrganization(storeOrg);
			setName(storeOrg.name);
			setIsLoading(false);
			return;
		}

		const fetchOrganization = async () => {
			setIsLoading(true);
			const supabase = createClient();
			const {
				data: { user },
			} = await supabase.auth.getUser();

			if (!user) {
				router.push('/auth/login');
				return;
			}

			const currentOrg = await getCurrentOrgBySlug(supabase, user.id, orgSlug);
			setOrganization(currentOrg);
			setName(currentOrg?.name ?? '');
			setIsLoading(false);
		};

		fetchOrganization();
	}, [orgSlug, router, storeOrg]);

	const handleSaveName = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (!organization) return;

		const nextName = name.trim();
		if (!nextName) {
			toast.error('Organization name is required');
			return;
		}

		setIsSavingName(true);
		let data: UserOrganization | null = null;

		try {
			const response = await fetch('/api/settings/organization', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'profile',
					orgId: organization.id,
					name: nextName,
				}),
			});
			const payload = await readJsonResponse<{
				organization?: UserOrganization;
				error?: string;
			}>(response);

			if (!response.ok || !payload.organization) {
				throw new Error(payload.error || 'Failed to update organization profile');
			}

			data = payload.organization;
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: 'Failed to update organization profile',
			);
			setIsSavingName(false);
			return;
		}

		setIsSavingName(false);
		if (!data) return;

		const updatedOrg = {
			...organization,
			name: data.name,
			logo_url: data.logo_url ?? organization.logo_url ?? null,
			logo_path: data.logo_path ?? organization.logo_path ?? null,
		};

		setOrganization(updatedOrg);
		updateOrganization(organization.id, updatedOrg);
		toast.success('Organization profile updated');
		router.refresh();
	};

	const handleLogoChange = async (
		event: React.ChangeEvent<HTMLInputElement>,
	) => {
		const file = event.target.files?.[0];
		event.target.value = '';

		if (!file || !organization) return;

		if (!file.type.startsWith('image/')) {
			toast.error('Choose an image file');
			return;
		}

		if (file.size > MAX_LOGO_SIZE) {
			toast.error('Logo must be 2MB or smaller');
			return;
		}

		setIsUploadingLogo(true);
		const supabase = createClient();
		const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-');
		const logoPath = `${organization.id}/logo/${Date.now()}-${safeName}`;

		const { error: uploadError } = await supabase.storage
			.from(LOGO_BUCKET)
			.upload(logoPath, file, { upsert: true });

		if (uploadError) {
			setIsUploadingLogo(false);
			toast.error(
				isMissingColumnOrBucketError(uploadError)
					? 'Organization logo storage is not set up yet'
					: 'Failed to upload logo',
			);
			return;
		}

		const {
			data: { publicUrl },
		} = supabase.storage.from(LOGO_BUCKET).getPublicUrl(logoPath);

		let data: UserOrganization | null = null;

		try {
			const response = await fetch('/api/settings/organization', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'logo',
					orgId: organization.id,
					logoPath,
					logoUrl: publicUrl,
				}),
			});
			const payload = await readJsonResponse<{
				organization?: UserOrganization;
				error?: string;
			}>(response);

			if (!response.ok || !payload.organization) {
				throw new Error(payload.error || 'Failed to save logo');
			}

			data = payload.organization;
		} catch (error) {
			setIsUploadingLogo(false);
			toast.error(
				error instanceof Error && isMissingColumnOrBucketError(error)
					? 'Logo columns are not set up on organizations yet'
					: error instanceof Error
						? error.message
						: 'Failed to save logo',
			);
			return;
		}

		setIsUploadingLogo(false);
		if (!data) return;

		const updatedOrg = {
			...organization,
			logo_url: data.logo_url ?? publicUrl,
			logo_path: data.logo_path ?? logoPath,
		};

		setOrganization(updatedOrg);
		updateOrganization(organization.id, updatedOrg);
		toast.success('Organization logo updated');
		router.refresh();
	};

	if (isLoading) {
		return (
			<div className='flex min-h-[360px] items-center justify-center'>
				<Loader2 className='h-8 w-8 animate-spin text-slate-400' />
			</div>
		);
	}

	if (!organization) {
		return (
			<div className='overflow-hidden rounded-xl border border-line bg-white shadow-card'>
				<div className='py-12 text-center'>
					<Building2 className='mx-auto mb-3 h-10 w-10 text-slate-300' />
					<p className='text-[13.5px] text-slate-500'>
						Organization profile could not be loaded.
					</p>
				</div>
			</div>
		);
	}

	const logoSrc = getOrgLogoSrc(organization);

	return (
		<div className='space-y-6'>
			{/* Logo card */}
			<div className='overflow-hidden rounded-xl border border-line bg-white shadow-card'>
				<div className='border-b border-line bg-surface-page px-5 py-3.5'>
					<p className='text-[14px] font-semibold text-ink'>Logo</p>
					<p className='mt-0.5 text-[12.5px] text-slate-500'>
						Upload a square logo for navigation and workspace pages.
					</p>
				</div>
				<div className='space-y-5 p-5'>
					<div className='flex items-center gap-4'>
						<div className='flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl border border-line bg-surface-muted'>
							{logoSrc ? (
								<img
									src={logoSrc}
									alt={`${organization.name} logo`}
									className='h-full w-full object-cover'
								/>
							) : (
								<span className='text-lg font-semibold text-ink'>
									{getOrgInitials(organization.name)}
								</span>
							)}
						</div>
						<div>
							<p className='text-[13.5px] font-medium text-ink'>{organization.name}</p>
							<p className='text-[12px] text-slate-400'>Used in the app navigation.</p>
						</div>
					</div>

					<div className='space-y-2'>
						<Label htmlFor='org-logo' className='text-[13px] font-medium text-ink'>
							Upload logo
						</Label>
						<div className='flex items-center gap-3'>
							<Input
								id='org-logo'
								type='file'
								accept='image/*'
								onChange={handleLogoChange}
								disabled={isUploadingLogo}
								className='text-[13.5px]'
							/>
							<Button
								type='button'
								variant='outline'
								disabled={isUploadingLogo}
								onClick={() => document.getElementById('org-logo')?.click()}
								className='shrink-0'>
								{isUploadingLogo ? (
									<Loader2 className='mr-2 h-4 w-4 animate-spin' />
								) : (
									<ImageUp className='mr-2 h-4 w-4' />
								)}
								Upload
							</Button>
						</div>
					</div>
				</div>
			</div>

			{/* Organization profile card */}
			<div className='overflow-hidden rounded-xl border border-line bg-white shadow-card'>
				<div className='border-b border-line bg-surface-page px-5 py-3.5'>
					<p className='text-[14px] font-semibold text-ink'>Organization Profile</p>
					<p className='mt-0.5 text-[12.5px] text-slate-500'>
						This branding appears in navigation and workspace pages.
					</p>
				</div>
				<div className='p-5'>
					<form onSubmit={handleSaveName} className='space-y-4'>
						<div className='space-y-2'>
							<Label htmlFor='org-name' className='text-[13px] font-medium text-ink'>
								Organization name
							</Label>
							<Input
								id='org-name'
								value={name}
								onChange={(event) => setName(event.target.value)}
								placeholder='Your organization name'
								className='text-[13.5px]'
							/>
						</div>
						<div className='space-y-2'>
							<Label className='text-[13px] font-medium text-ink'>Organization slug</Label>
							<Input
								value={organization.slug}
								readOnly
								className='bg-surface-muted/50 text-slate-500'
							/>
						</div>
						<Button
							type='submit'
							disabled={isSavingName}
							className='text-[13.5px]'>
							{isSavingName ? 'Saving...' : 'Save profile'}
						</Button>
					</form>
				</div>
			</div>
		</div>
	);
}

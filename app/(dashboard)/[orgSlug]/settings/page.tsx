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
		const supabase = createClient();
		const { data, error } = await supabase
			.from('organizations')
			.update({ name: nextName })
			.eq('id', organization.id)
			.select('*')
			.single();

		setIsSavingName(false);

		if (error) {
			toast.error('Failed to update organization profile');
			return;
		}

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

		const { data, error: updateError } = await supabase
			.from('organizations')
			.update({ logo_path: logoPath, logo_url: publicUrl })
			.eq('id', organization.id)
			.select('*')
			.single();

		setIsUploadingLogo(false);

		if (updateError) {
			toast.error(
				isMissingColumnOrBucketError(updateError)
					? 'Logo columns are not set up on organizations yet'
					: 'Failed to save logo',
			);
			return;
		}

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
				<Loader2 className='h-8 w-8 animate-spin text-muted-foreground' />
			</div>
		);
	}

	if (!organization) {
		return (
			<Card>
				<CardContent className='py-12 text-center'>
					<Building2 className='mx-auto mb-3 h-10 w-10 text-muted-foreground/60' />
					<p className='text-sm text-muted-foreground'>
						Organization profile could not be loaded.
					</p>
				</CardContent>
			</Card>
		);
	}

	const logoSrc = getOrgLogoSrc(organization);

	return (
		<div className='space-y-6'>
			<Card>
				<CardHeader>
					<CardTitle>Logo</CardTitle>
					<CardDescription>
						Upload a square logo for navigation and workspace pages.
					</CardDescription>
				</CardHeader>
				<CardContent className='space-y-5'>
					<div className='flex items-center gap-4'>
						<div className='flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl border bg-muted'>
							{logoSrc ? (
								<img
									src={logoSrc}
									alt={`${organization.name} logo`}
									className='h-full w-full object-cover'
								/>
							) : (
								<span className='text-lg font-semibold'>
									{getOrgInitials(organization.name)}
								</span>
							)}
						</div>
						<div>
							<p className='text-sm font-medium'>{organization.name}</p>
							<p className='text-xs text-muted-foreground'>
								Used in the app navigation.
							</p>
						</div>
					</div>

					<div className='space-y-2'>
						<Label htmlFor='org-logo'>Upload logo</Label>
						<div className='flex items-center gap-3'>
							<Input
								id='org-logo'
								type='file'
								accept='image/*'
								onChange={handleLogoChange}
								disabled={isUploadingLogo}
							/>
							<Button
								type='button'
								variant='outline'
								disabled={isUploadingLogo}
								onClick={() => document.getElementById('org-logo')?.click()}>
								{isUploadingLogo ? (
									<Loader2 className='mr-2 h-4 w-4 animate-spin' />
								) : (
									<ImageUp className='mr-2 h-4 w-4' />
								)}
								Upload
							</Button>
						</div>
					</div>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Organization Profile</CardTitle>
					<CardDescription>
						This branding appears in navigation and workspace pages.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<form onSubmit={handleSaveName} className='space-y-4'>
						<div className='space-y-2'>
							<Label htmlFor='org-name'>Organization name</Label>
							<Input
								id='org-name'
								value={name}
								onChange={(event) => setName(event.target.value)}
								placeholder='Your organization name'
							/>
						</div>
						<div className='space-y-2'>
							<Label>Organization slug</Label>
							<Input value={organization.slug} readOnly className='bg-muted/50' />
						</div>
						<Button type='submit' disabled={isSavingName}>
							{isSavingName ? 'Saving...' : 'Save profile'}
						</Button>
					</form>
				</CardContent>
			</Card>
		</div>
	);
}

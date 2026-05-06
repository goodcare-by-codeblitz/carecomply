import { Button } from '@/components/ui/button';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui/card';
import { getUserOrganizationsResult } from '@/lib/orgs';
import { createClient } from '@/lib/supabase/server';
import { Building2 } from 'lucide-react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';

async function selectOrganization(formData: FormData) {
	'use server';

	const slug = formData.get('slug');
	if (typeof slug !== 'string' || !slug) {
		redirect('/select-org');
	}

	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		redirect('/auth/login');
	}

	const organizationsResult = await getUserOrganizationsResult(supabase, user.id);

	if (!organizationsResult.ok) {
		redirect('/select-org?error=org_lookup_failed');
	}

	const organizations = organizationsResult.organizations;
	const organization = organizations.find((org) => org.slug === slug);

	if (!organization) {
		redirect('/select-org');
	}

	const cookieStore = await cookies();
	cookieStore.set('current_org_slug', organization.slug, {
		path: '/',
		sameSite: 'lax',
		httpOnly: true,
	});

	redirect(`/${organization.slug}/dashboard`);
}

async function SelectOrgContent() {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		redirect('/auth/login');
	}

	const organizationsResult = await getUserOrganizationsResult(supabase, user.id);

	if (!organizationsResult.ok) {
		return (
			<main className='min-h-screen bg-background flex items-center justify-center p-6'>
				<Card className='w-full max-w-lg'>
					<CardHeader>
						<CardTitle className='text-2xl'>Organizations unavailable</CardTitle>
						<CardDescription>
							Your organizations could not be loaded. Please refresh and try
							again.
						</CardDescription>
					</CardHeader>
				</Card>
			</main>
		);
	}

	const organizations = organizationsResult.organizations;

	if (organizations.length === 0) {
		redirect('/create-org');
	}

	if (organizations.length === 1) {
		redirect(`/${organizations[0].slug}/dashboard`);
	}

	return (
		<main className='min-h-screen bg-background flex items-center justify-center p-6'>
			<div className='w-full max-w-lg'>
				<Card>
					<CardHeader>
						<CardTitle className='text-2xl'>Select organization</CardTitle>
						<CardDescription>
							Choose the workspace you want to open.
						</CardDescription>
					</CardHeader>
					<CardContent className='space-y-3'>
						{organizations.map((organization) => (
							<form key={organization.id} action={selectOrganization}>
								<input type='hidden' name='slug' value={organization.slug} />
								<Button
									type='submit'
									variant='outline'
									className='h-auto w-full justify-start gap-3 p-4'>
									<span className='flex h-10 w-10 items-center justify-center rounded-md bg-muted'>
										<Building2 className='h-5 w-5 text-muted-foreground' />
									</span>
									<span className='text-left'>
										<span className='block font-medium'>
											{organization.name}
										</span>
										<span className='block text-xs text-muted-foreground'>
											/{organization.slug}
										</span>
									</span>
								</Button>
							</form>
						))}
					</CardContent>
				</Card>
			</div>
		</main>
	);
}

export default function SelectOrgPage() {
	return (
		<Suspense fallback={<main className='min-h-screen bg-background' />}>
			<SelectOrgContent />
		</Suspense>
	);
}

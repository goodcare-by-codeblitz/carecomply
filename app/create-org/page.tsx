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
	isKnownBillingPlan,
	normalizeBillingPlan,
	type BillingInterval,
} from '@/lib/billing';
import { initOrgStore } from '@/lib/init-org';
import {
	getSlugTakenErrorMessage,
	slugify,
	validateOrganizationSlug,
} from '@/lib/slug';
import { createClient } from '@/lib/supabase/client';
import { useSlugAvailability } from '@/lib/use-slug-availability';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

export default function CreateOrgPage() {
	const [orgName, setOrgName] = useState('');
	const [orgSlug, setOrgSlug] = useState('');
	const [orgSlugTouched, setOrgSlugTouched] = useState(false);
	const [billingPlan, setBillingPlan] = useState('starter');
	const [billingInterval, setBillingInterval] = useState('monthly');
	const [error, setError] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const router = useRouter();

	useEffect(() => {
		const params = new URLSearchParams(window.location.search);
		const orgNameParam = params.get('orgName');
		const orgSlugParam = params.get('orgSlug');
		const planParam = params.get('plan');
		const intervalParam = params.get('interval');

		if (orgNameParam) setOrgName(orgNameParam);
		if (orgSlugParam) {
			setOrgSlug(slugify(orgSlugParam));
			setOrgSlugTouched(true);
		}
		if (planParam) {
			setBillingPlan(
				isKnownBillingPlan(planParam) ? normalizeBillingPlan(planParam) : 'starter',
			);
		}
		if (intervalParam === 'monthly' || intervalParam === 'yearly') {
			setBillingInterval(intervalParam satisfies BillingInterval);
		}
	}, []);

	const resolvedSlug = useMemo(
		() => slugify(orgSlug || orgName),
		[orgName, orgSlug],
	);
	const slugAvailability = useSlugAvailability(resolvedSlug);

	useEffect(() => {
		if (orgSlugTouched) return;
		setOrgSlug(slugify(orgName));
	}, [orgName, orgSlugTouched]);

	const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setError(null);

		const slugValidationMessage = validateOrganizationSlug(resolvedSlug);
		if (slugValidationMessage) {
			setError(slugValidationMessage);
			return;
		}

		if (slugAvailability.status === 'taken') {
			setError('That organization slug is already taken. Choose another one.');
			return;
		}

		setIsLoading(true);

		try {
			const supabase = createClient();
			const {
				data: { user },
			} = await supabase.auth.getUser();

			if (!user) {
				router.push('/auth/login');
				return;
			}

			const { error: orgError } = await supabase.rpc(
				'create_organization_with_roles',
				{
					p_user_id: user.id,
					org_name: orgName,
					org_slug: resolvedSlug,
					p_billing_plan: billingPlan,
					p_billing_interval: billingInterval,
				},
			);

			if (orgError) {
				const shouldTryLegacyCreate =
					orgError.message?.includes('Invalid billing plan') ||
					orgError.message?.includes('Could not find the function') ||
					orgError.code === 'PGRST202';

				if (!shouldTryLegacyCreate) throw orgError;

				const { error: legacyOrgError } = await supabase.rpc(
					'create_organization_with_roles',
					{
						p_user_id: user.id,
						org_name: orgName,
						org_slug: resolvedSlug,
					},
				);

				if (legacyOrgError) throw legacyOrgError;
			}

			document.cookie = `current_org_slug=${resolvedSlug}; path=/; samesite=lax`;
			await initOrgStore();
			router.push(`/${resolvedSlug}/dashboard`);
		} catch (error: unknown) {
			setError(
				getSlugTakenErrorMessage(error) ??
					(error instanceof Error
						? error.message
						: 'Unable to create organization'),
			);
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<main className='min-h-screen bg-background flex items-center justify-center p-6'>
			<div className='w-full max-w-md'>
				<Card>
					<CardHeader>
						<CardTitle className='text-2xl'>Create organization</CardTitle>
						<CardDescription>
							Create a workspace before opening your dashboard.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<form onSubmit={handleSubmit} className='space-y-5'>
							<div className='space-y-2'>
								<Label htmlFor='org-name'>Organization name</Label>
								<Input
									id='org-name'
									required
									value={orgName}
									onChange={(event) => setOrgName(event.target.value)}
									placeholder='Acme Care'
								/>
							</div>
							<div className='space-y-2'>
								<Label htmlFor='org-slug'>Organization slug</Label>
								<Input
									id='org-slug'
									value={orgSlug}
									onChange={(event) => {
										setOrgSlugTouched(true);
										setOrgSlug(slugify(event.target.value));
									}}
									placeholder={slugify(orgName) || 'acme-care'}
								/>
								<p
									className={cn(
										'text-xs',
										slugAvailability.status === 'available' &&
											'text-green-600',
										(slugAvailability.status === 'taken' ||
											slugAvailability.status === 'invalid' ||
											slugAvailability.status === 'error') &&
											'text-destructive',
										(slugAvailability.status === 'idle' ||
											slugAvailability.status === 'checking') &&
											'text-muted-foreground',
									)}>
									{slugAvailability.message ??
										`Your dashboard will live at /${resolvedSlug || 'acme-care'}.`}
								</p>
								{slugAvailability.suggestions.length > 0 && (
									<div className='flex flex-wrap gap-2'>
										{slugAvailability.suggestions.map((suggestion) => (
											<Button
												key={suggestion}
												type='button'
												variant='outline'
												size='sm'
												onClick={() => {
													setOrgSlugTouched(true);
													setOrgSlug(suggestion);
												}}>
												{suggestion}
											</Button>
										))}
									</div>
								)}
							</div>
							{error && <p className='text-sm text-destructive'>{error}</p>}
							<Button
								type='submit'
								className='w-full'
								disabled={
									isLoading ||
									slugAvailability.status === 'checking' ||
									slugAvailability.status === 'taken' ||
									slugAvailability.status === 'invalid'
								}>
								{isLoading ? 'Creating...' : 'Create organization'}
							</Button>
						</form>
					</CardContent>
				</Card>
			</div>
		</main>
	);
}

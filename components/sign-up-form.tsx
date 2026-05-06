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
import { initOrgStore } from '@/lib/init-org';
import { initProfile } from '@/lib/init-profile';
import type { BillingInterval, PricingPlan } from '@/lib/billing';
import {
	getSlugTakenErrorMessage,
	slugify,
	validateOrganizationSlug,
} from '@/lib/slug';
import { createClient } from '@/lib/supabase/client';
import { useSlugAvailability } from '@/lib/use-slug-availability';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
// import { signupSchema, type SignupInput } from '@/lib/validations';

const PENDING_CREATE_ORG_KEY = 'carecomply_pending_create_org';

export function SignUpForm({
	className,
	selectedPlan,
	selectedInterval,
	...props
}: React.ComponentPropsWithoutRef<'div'> & {
	selectedPlan: PricingPlan;
	selectedInterval: BillingInterval;
}) {
	const [email, setEmail] = useState('');
	const [orgName, setOrgName] = useState('');
	const [orgSlug, setOrgSlug] = useState('');
	const [orgSlugTouched, setOrgSlugTouched] = useState(false);
	const [fullName, setFullName] = useState('');
	const [password, setPassword] = useState('');
	const [repeatPassword, setRepeatPassword] = useState('');
	const [error, setError] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const router = useRouter();
	const resolvedSlug = useMemo(
		() => slugify(orgSlug || orgName),
		[orgName, orgSlug],
	);
	const slugAvailability = useSlugAvailability(resolvedSlug);

	useEffect(() => {
		if (orgSlugTouched) return;
		setOrgSlug(slugify(orgName));
	}, [orgName, orgSlugTouched]);

	const handleExistingAccount = () => {
		const normalizedEmail = email.trim().toLowerCase();
		const params = new URLSearchParams({
			email: normalizedEmail,
			next: 'create-org',
		});

		localStorage.setItem(
			PENDING_CREATE_ORG_KEY,
			JSON.stringify({
				email: normalizedEmail,
				orgName,
				orgSlug: resolvedSlug,
				plan: selectedPlan.id,
				interval: selectedInterval,
			}),
		);

		router.push(`/auth/login?${params.toString()}`);
	};

	const handleSignUp = async (e: React.SubmitEvent<HTMLFormElement>) => {
		e.preventDefault();
		const supabase = createClient();
		setIsLoading(true);
		setError(null);

		if (password !== repeatPassword) {
			setError('Passwords do not match');
			setIsLoading(false);
			return;
		}

		const slugValidationMessage = validateOrganizationSlug(resolvedSlug);
		if (slugValidationMessage) {
			setError(slugValidationMessage);
			setIsLoading(false);
			return;
		}

		if (slugAvailability.status === 'taken') {
			setError('That organization slug is already taken. Choose another one.');
			setIsLoading(false);
			return;
		}

		try {
			const { data: profileData } = await supabase
				.from('profiles')
				.select('id')
				.eq('email', email)
				.maybeSingle();

			if (profileData) {
				handleExistingAccount();
				return;
			}

			const { error, data } = await supabase.auth.signUp({
				email,
				password,
				options: {
					data: {
						full_name: fullName,
					},
					emailRedirectTo: `${window.location.origin}/auth/login`,
				},
			});

			if (error && error?.code === 'user_already_exists') {
				handleExistingAccount();
				return;
			}
			const { error: orgError } = await supabase.rpc(
				'create_organization_with_roles',
				{
					p_user_id: data.user?.id,
					org_name: orgName,
					org_slug: resolvedSlug,
					p_billing_plan: selectedPlan.id,
					p_billing_interval: selectedInterval,
				},
			);

			if (orgError) throw orgError;

			await initProfile();
			await initOrgStore();

			// router.push('/auth/sign-up-success');
			document.cookie = `current_org_slug=${resolvedSlug}; path=/; samesite=lax`;
			router.push(`/${resolvedSlug}/dashboard`);
		} catch (error: unknown) {
			console.log(error);
			setError(
				getSlugTakenErrorMessage(error) ??
					(error instanceof Error ? error.message : 'An error occurred'),
			);
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<div className={cn('flex flex-col gap-6', className)} {...props}>
			<Card>
				<CardHeader>
					<CardTitle className='text-2xl'>Sign up</CardTitle>
					<CardDescription>
						Create a new account on {selectedPlan.name}
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div className='mb-6 rounded-md border bg-muted/40 p-4'>
						<div className='flex items-center justify-between gap-4'>
							<div>
								<p className='text-sm font-medium'>{selectedPlan.name}</p>
								<p className='text-xs text-muted-foreground'>
									{selectedPlan.description}
								</p>
							</div>
							<p className='text-sm font-semibold'>
								{selectedPlan.monthlyPrice === null
									? 'Contact us'
									: `£${
											selectedInterval === 'monthly'
												? selectedPlan.monthlyPrice
												: selectedPlan.yearlyPrice
										}/${selectedInterval === 'monthly' ? 'mo' : 'yr'}`}
							</p>
						</div>
					</div>
					<form onSubmit={handleSignUp}>
						<div className='flex flex-col gap-6'>
							<div className='grid gap-2'>
								<Label htmlFor='email'>Email</Label>
								<Input
									id='email'
									type='email'
									placeholder='m@example.com'
									required
									value={email}
									onChange={(e) => setEmail(e.target.value)}
								/>
							</div>
							<div className='grid gap-2'>
								<Label htmlFor='full-name'>Full Name</Label>
								<Input
									id='full-name'
									type='text'
									placeholder='John Doe'
									required
									value={fullName}
									onChange={(e) => setFullName(e.target.value)}
								/>
							</div>

							<div className='grid gap-2'>
								<Label htmlFor='org-name'>Organization Name</Label>
								<Input
									id='org-name'
									type='text'
									placeholder='Acme Inc.'
									required
									value={orgName}
									onChange={(e) => setOrgName(e.target.value)}
								/>
							</div>
							<div className='grid gap-2'>
								<Label htmlFor='org-slug'>Organization Slug</Label>
								<Input
									id='org-slug'
									type='text'
									placeholder='acme-inc'
									required
									value={orgSlug}
									onChange={(e) => {
										setOrgSlugTouched(true);
										setOrgSlug(slugify(e.target.value));
									}}
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
										`Your dashboard will live at /${resolvedSlug || 'acme-inc'}.`}
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

							<div className='grid gap-2'>
								<div className='flex items-center'>
									<Label htmlFor='password'>Password</Label>
								</div>
								<Input
									id='password'
									type='password'
									required
									value={password}
									onChange={(e) => setPassword(e.target.value)}
								/>
							</div>
							<div className='grid gap-2'>
								<div className='flex items-center'>
									<Label htmlFor='repeat-password'>Confirm Password</Label>
								</div>
								<Input
									id='repeat-password'
									type='password'
									required
									value={repeatPassword}
									onChange={(e) => setRepeatPassword(e.target.value)}
								/>
							</div>
							{error && <p className='text-sm text-red-500'>{error}</p>}
							<Button
								type='submit'
								className='w-full'
								disabled={
									isLoading ||
									slugAvailability.status === 'checking' ||
									slugAvailability.status === 'taken' ||
									slugAvailability.status === 'invalid'
								}>
								{isLoading ? 'Creating an account...' : 'Sign up'}
							</Button>
						</div>
						<div className='mt-4 text-center text-sm'>
							Already have an account?{' '}
							<Link href='/auth/login' className='underline underline-offset-4'>
								Login
							</Link>
						</div>
					</form>
				</CardContent>
			</Card>
		</div>
	);
}

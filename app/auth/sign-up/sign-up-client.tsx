'use client';

import ContainerBox from '@/components/shared/page-container';
import { SignUpForm } from '@/components/sign-up-form';
import { getPricingPlan, type BillingInterval } from '@/lib/billing';
import { Check, Loader2, Shield } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';

export function SignUpClient() {
	const searchParams = useSearchParams();
	const router = useRouter();
	const selectedPlan = getPricingPlan(searchParams.get('plan') ?? '');
	const selectedInterval: BillingInterval =
		searchParams.get('interval') === 'yearly' ? 'yearly' : 'monthly';

	useEffect(() => {
		if (!selectedPlan) {
			router.replace('/pricing');
		}
	}, [router, selectedPlan]);

	if (!selectedPlan) {
		return (
			<div className='flex min-h-screen items-center justify-center'>
				<Loader2 className='h-8 w-8 animate-spin text-muted-foreground' />
			</div>
		);
	}

	const features = [
		'Automated compliance reminders',
		'Document expiry tracking',
		'Carer onboarding portal',
		'Real-time compliance dashboard',
		'Secure document storage',
		'Customizable compliance checklists',
		'Multi-user access with role-based permissions',
	];

	return (
		<div className='min-h-screen relative flex flex-row'>
			<div className='bg-foreground w-1/2 min-h-full absolute top-0 left-0 bottom-0' />
			<ContainerBox className='flex-1  flex flex-col lg:flex-row mx-auto'>
				<div className='hidden lg:flex lg:w-1/2  relative overflow-hidden'>
					<div className='absolute inset-0 bg-linear-to-br from-foreground via-foreground to-muted-foreground/20' />
					<div className='relative z-10 flex flex-col justify-between p-12 text-background'>
						<div className='flex items-center gap-3'>
							<div className='w-10 h-10 rounded-xl bg-background/10 flex items-center justify-center'>
								<Shield className='w-5 h-5' />
							</div>
							<span className='text-xl font-semibold tracking-tight'>
								CareComply
							</span>
						</div>
						<div className='max-w-md'>
							<h1 className='text-4xl font-semibold tracking-tight leading-tight mb-8'>
								Start your free trial today.
							</h1>
							<ul className='space-y-4'>
								{features.map((feature, i) => (
									<li key={i} className='flex items-center gap-3'>
										<div className='w-5 h-5 rounded-full bg-background/20 flex items-center justify-center'>
											<Check className='w-3 h-3' />
										</div>
										<span className='text-background/80'>{feature}</span>
									</li>
								))}
							</ul>
						</div>
						<p className='text-background/50 text-sm'>
							No credit card required
						</p>
					</div>
				</div>

				<div className='flex-1 flex lg:w-full items-center justify-center p-8 '>
					<div className='w-full max-w-xl'>
						<div className='lg:hidden flex items-center gap-3 mb-12'>
							<div className='w-10 h-10 rounded-xl bg-foreground flex items-center justify-center'>
								<Shield className='w-5 h-5 text-background' />
							</div>
							<span className='text-xl font-semibold tracking-tight'>
								CareComply
							</span>
						</div>

						<div className='mb-8'>
							<h2 className='text-2xl font-semibold tracking-tight mb-2'>
								Create your account
							</h2>
							<p className='text-muted-foreground'>
								Get started with {selectedPlan.name}
							</p>
							<p className='mt-2 text-sm text-muted-foreground'>
								<Link href='/pricing' className='underline underline-offset-4'>
									Change plan
								</Link>
							</p>
						</div>

						<div className=' '>
							<SignUpForm
								className='w-full'
								selectedPlan={selectedPlan}
								selectedInterval={selectedInterval}
							/>
						</div>

						<p className='mt-5 text-center text-xs text-muted-foreground leading-relaxed'>
							By creating an account, you agree to our
							<Link
								href='/terms'
								className='underline underline-offset-4 hover:text-foreground'>
								Terms of Service
							</Link>{' '}
							and{' '}
							<Link
								href='/privacy'
								className='underline underline-offset-4 hover:text-foreground'>
								Privacy Policy
							</Link>
						</p>

						<p className='mt-6 text-center text-sm text-muted-foreground'>
							Already have an account?
							<Link
								href='/auth/login'
								className='font-medium text-foreground hover:underline underline-offset-4'>
								Sign in
							</Link>
						</p>
					</div>
				</div>
			</ContainerBox>
		</div>
	);
}

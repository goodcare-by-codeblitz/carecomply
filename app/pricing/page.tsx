import { PricingPlans } from '@/components/pricing-plans';
import { Button } from '@/components/ui/button';
import { Shield } from 'lucide-react';
import Link from 'next/link';

export default function PricingPage() {
	return (
		<div className='min-h-screen bg-background'>
			<nav className='border-b border-border/50'>
				<div className='mx-auto flex h-16 max-w-6xl items-center justify-between px-6'>
					<Link href='/' className='flex items-center gap-2.5'>
						<div className='flex h-9 w-9 items-center justify-center rounded-lg bg-foreground'>
							<Shield className='h-4.5 w-4.5 text-background' />
						</div>
						<span className='text-lg font-semibold tracking-tight'>
							CareComply
						</span>
					</Link>
					<div className='flex items-center gap-3'>
						<Button variant='ghost' asChild className='h-9'>
							<Link href='/auth/login'>Sign in</Link>
						</Button>
						<Button asChild className='h-9'>
							<Link href='/auth/sign-up'>Get started</Link>
						</Button>
					</div>
				</div>
			</nav>

			<main className='mx-auto max-w-6xl px-6 py-16 lg:py-20'>
				<div className='mx-auto mb-12 max-w-3xl text-center'>
					<p className='mb-3 text-sm font-medium text-muted-foreground'>
						Pricing
					</p>
					<h1 className='text-4xl font-semibold tracking-tight lg:text-5xl'>
						Choose the compliance plan that fits your care team.
					</h1>
					<p className='mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground'>
						Start with core document tracking, then scale into reminders,
						reviews, audit visibility, automations, and enterprise support.
					</p>
				</div>

				<PricingPlans context='public' />
			</main>
		</div>
	);
}

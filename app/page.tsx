import { AuthButton } from '@/components/auth-button';
import { Button } from '@/components/ui/button';
import { ArrowRight, Bell, FileCheck, Shield, Users } from 'lucide-react';
import Link from 'next/link';
import { Suspense } from 'react';

export default function LandingPage() {
	const features = [
		{
			icon: FileCheck,
			title: 'Document Tracking',
			description:
				'Automatically track document expiry dates and compliance status for all your carers.',
		},
		{
			icon: Bell,
			title: 'Smart Reminders',
			description:
				'Set up automated email and SMS reminders before documents expire.',
		},
		{
			icon: Users,
			title: 'Carer Portal',
			description:
				'Self-service portal for carers to upload and manage their own documents.',
		},
	];

	return (
		<div className='min-h-screen bg-background'>
			{/* Navigation */}
			<nav className='border-b border-border/50'>
				<div className='max-w-6xl mx-auto px-6 h-16 flex items-center justify-between'>
					<div className='flex items-center gap-2.5'>
						<div className='w-9 h-9 rounded-lg bg-foreground flex items-center justify-center'>
							<Shield className='w-4.5 h-4.5 text-background' />
						</div>
						<span className='text-lg font-semibold tracking-tight'>
							CareComply
						</span>
					</div>
					<div className='flex items-center gap-3'>
						<Button variant='ghost' asChild className='h-9'>
							<Link href='/pricing'>Pricing</Link>
						</Button>
						<Suspense fallback='Loading...'>
							<AuthButton />
						</Suspense>
					</div>
				</div>
			</nav>

			{/* Hero */}
			<section className='py-24 lg:py-32'>
				<div className='max-w-6xl mx-auto px-6'>
					<div className='max-w-3xl'>
						<h1 className='text-4xl lg:text-5xl font-semibold tracking-tight leading-[1.15] mb-6 text-balance'>
							Compliance management for care agencies, simplified.
						</h1>
						<p className='text-lg lg:text-xl text-muted-foreground leading-relaxed mb-10 max-w-2xl'>
							Stop chasing paperwork. CareComply automates document tracking,
							sends timely reminders, and keeps your team compliant with less
							effort.
						</p>
						<div className='flex flex-col sm:flex-row gap-4'>
							<Button size='lg' asChild className='h-12 px-8 text-base'>
								<Link href='/pricing'>
									Start free trial
									<ArrowRight className='ml-2 w-4 h-4' />
								</Link>
							</Button>
							<Button
								size='lg'
								variant='outline'
								asChild
								className='h-12 px-8 text-base'>
								<Link href='/pricing'>View pricing</Link>
							</Button>
						</div>
					</div>
				</div>
			</section>

			{/* Features */}
			<section className='py-24 border-t border-border/50'>
				<div className='max-w-6xl mx-auto px-6'>
					<div className='mb-16'>
						<h2 className='text-2xl lg:text-3xl font-semibold tracking-tight mb-4'>
							Everything you need to stay compliant
						</h2>
						<p className='text-muted-foreground text-lg max-w-2xl'>
							A complete platform designed specifically for care agencies and
							domiciliary care providers.
						</p>
					</div>

					<div className='grid md:grid-cols-3 gap-8'>
						{features.map((feature, i) => (
							<div
								key={i}
								className='p-6 rounded-2xl border border-border/50 bg-card'>
								<div className='w-12 h-12 rounded-xl bg-muted flex items-center justify-center mb-5'>
									<feature.icon className='w-6 h-6 text-foreground' />
								</div>
								<h3 className='text-lg font-semibold mb-2'>{feature.title}</h3>
								<p className='text-muted-foreground leading-relaxed'>
									{feature.description}
								</p>
							</div>
						))}
					</div>
				</div>
			</section>

			{/* Social proof */}
			<section className='py-24 border-t border-border/50'>
				<div className='max-w-6xl mx-auto px-6'>
					<div className='grid lg:grid-cols-3 gap-12 lg:gap-16'>
						<div className='text-center'>
							<div className='text-4xl font-semibold mb-2'>500+</div>
							<p className='text-muted-foreground'>Care agencies</p>
						</div>
						<div className='text-center'>
							<div className='text-4xl font-semibold mb-2'>25,000+</div>
							<p className='text-muted-foreground'>Carers managed</p>
						</div>
						<div className='text-center'>
							<div className='text-4xl font-semibold mb-2'>99.2%</div>
							<p className='text-muted-foreground'>Compliance rate</p>
						</div>
					</div>
				</div>
			</section>

			{/* CTA */}
			<section className='py-24 border-t border-border/50'>
				<div className='max-w-6xl mx-auto px-6 text-center'>
					<h2 className='text-2xl lg:text-3xl font-semibold tracking-tight mb-4'>
						Ready to simplify compliance?
					</h2>
					<p className='text-muted-foreground text-lg mb-8 max-w-xl mx-auto'>
						Join hundreds of care agencies who trust CareComply to keep their
						teams compliant.
					</p>
					<Button size='lg' asChild className='h-12 px-8 text-base'>
						<Link href='/pricing'>
							See plans
							<ArrowRight className='ml-2 w-4 h-4' />
						</Link>
					</Button>
				</div>
			</section>

			{/* Footer */}
			<footer className='py-8 border-t border-border/50'>
				<div className='max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4'>
					<div className='flex items-center gap-2'>
						<Shield className='w-4 h-4 text-muted-foreground' />
						<span className='text-sm text-muted-foreground'>CareComply</span>
					</div>
					<p className='text-sm text-muted-foreground'>
						2024 CareComply. All rights reserved.
					</p>
				</div>
			</footer>
		</div>
	);
}

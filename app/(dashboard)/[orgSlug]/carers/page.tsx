import { createClient } from '@/lib/supabase/server';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Search, Users } from 'lucide-react';
import Link from 'next/link';
// import { AddCarerButton, AddFirstCarerButton } from '@/components/carer-actions'
import { Suspense } from 'react';
import { resolveOrgAccess } from '@/lib/orgs';
import { notFound, redirect } from 'next/navigation';

function CarersListSkeleton() {
	return (
		<div className='grid gap-4'>
			{[1, 2, 3, 4].map((i) => (
				<Card key={i}>
					<CardContent className='p-5'>
						<div className='flex items-center justify-between animate-pulse'>
							<div className='flex items-center gap-4'>
								<div className='w-12 h-12 rounded-full bg-muted' />
								<div className='space-y-2'>
									<div className='h-4 bg-muted rounded w-32' />
									<div className='h-3 bg-muted rounded w-48' />
								</div>
							</div>
							<div className='flex items-center gap-4'>
								<div className='space-y-1 text-right'>
									<div className='h-4 bg-muted rounded w-12 ml-auto' />
									<div className='h-3 bg-muted rounded w-16' />
								</div>
								<div className='h-6 bg-muted rounded-full w-16' />
							</div>
						</div>
					</CardContent>
				</Card>
			))}
		</div>
	);
}

async function CarersList({ orgSlug }: { orgSlug: string }) {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) redirect('/auth/login');

	const currentOrg = await resolveOrgAccess(supabase, user.id, orgSlug);
	if (!currentOrg) notFound();

	const { data: carers } = await supabase
		.from('carers')
		.select('*, documents(count)')
		.eq('organization_id', currentOrg.id)
		.order('created_at', { ascending: false });

	if (!carers || carers.length === 0) {
		return (
			<Card>
				<CardContent className='py-16 text-center'>
					<div className='w-16 h-16 rounded-full bg-muted mx-auto mb-4 flex items-center justify-center'>
						<Users className='w-8 h-8 text-muted-foreground' />
					</div>
					<h3 className='text-lg font-medium mb-2'>No carers yet</h3>
					<p className='text-sm text-muted-foreground mb-6 max-w-sm mx-auto'>
						Get started by adding your first carer. You can then upload their
						compliance documents and track their status.
					</p>
					{/* <AddFirstCarerButton /> */}
				</CardContent>
			</Card>
		);
	}

	return (
		<div className='grid gap-4'>
			{carers.map((carer) => (
				<Link key={carer.id} href={`/${orgSlug}/carers/${carer.id}`}>
					<Card className='hover:bg-muted/50 transition-colors cursor-pointer'>
						<CardContent className='p-5'>
							<div className='flex items-center justify-between'>
								<div className='flex items-center gap-4'>
									<div className='w-12 h-12 rounded-full bg-muted flex items-center justify-center'>
										<span className='text-sm font-semibold'>
											{carer.full_name
												.split(' ')
												.map((n: string) => n[0])
												.join('')
												.toUpperCase()}
										</span>
									</div>
									<div>
										<h3 className='font-medium'>{carer.full_name}</h3>
										<p className='text-sm text-muted-foreground'>
											{carer.email}
										</p>
									</div>
								</div>
								<div className='flex items-center gap-4'>
									<div className='text-right'>
										<p className='text-sm font-medium'>
											{carer.onboarding_progress}%
										</p>
										<p className='text-xs text-muted-foreground'>Complete</p>
									</div>
									<span
										className={`text-xs px-3 py-1.5 rounded-full font-medium ${
											carer.status === 'active'
												? 'bg-green-50 text-green-700'
												: carer.status === 'pending'
													? 'bg-amber-50 text-amber-700'
													: carer.status === 'expired'
														? 'bg-red-50 text-red-700'
														: 'bg-muted text-muted-foreground'
										}`}>
										{carer.status.charAt(0).toUpperCase() +
											carer.status.slice(1)}
									</span>
								</div>
							</div>
						</CardContent>
					</Card>
				</Link>
			))}
		</div>
	);
}

export default async function CarersPage({
	params,
}: {
	params: Promise<{ orgSlug: string }>;
}) {
	const { orgSlug } = await params;

	return (
		<div className='p-8 max-w-7xl mx-auto'>
			{/* Page header */}
			<div className='flex items-center justify-between mb-8'>
				<div>
					<h1 className='text-2xl font-semibold tracking-tight'>Carers</h1>
					<p className='text-muted-foreground mt-1'>
						Manage your care workers and their compliance documents.
					</p>
				</div>
				{/* <AddCarerButton /> */}
			</div>

			{/* Search */}
			<div className='mb-6'>
				<div className='relative max-w-md'>
					<Search className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground' />
					<Input placeholder='Search carers...' className='pl-10 h-11' />
				</div>
			</div>

			{/* Carers list */}
			<Suspense fallback={<CarersListSkeleton />}>
				<CarersList orgSlug={orgSlug} />
			</Suspense>
		</div>
	);
}

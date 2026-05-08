import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getOrgScopedDashboardData } from '@/lib/dashboard-data';
import { getCurrentOrgBySlug } from '@/lib/orgs';
import { createClient } from '@/lib/supabase/server';
import {
	AlertTriangle,
	ArrowRight,
	ClipboardCheck,
	FileCheck,
	Plus,
	Users,
} from 'lucide-react';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

type DashboardPageProps = {
	params: Promise<{ orgSlug: string }>;
};

function statusClass(status: string) {
	switch (status) {
		case 'active':
		case 'approved':
			return 'bg-green-50 text-green-700';
		case 'pending':
			return 'bg-amber-50 text-amber-700';
		case 'on_leave':
			return 'bg-blue-50 text-blue-700';
		case 'expired':
		case 'rejected':
			return 'bg-red-50 text-red-700';
		default:
			return 'bg-muted text-muted-foreground';
	}
}

function formatStatus(status: string) {
	return status.replace(/_/g, ' ').replace(/^\w/, (char) => char.toUpperCase());
}

function initials(name: string) {
	return name
		.split(' ')
		.map((part) => part[0])
		.join('')
		.slice(0, 2)
		.toUpperCase();
}

function getTimeGreeting(date = new Date()) {
	const hour = date.getHours();

	if (hour < 12) return 'Good morning';
	if (hour < 18) return 'Good afternoon';
	return 'Good evening';
}

export default async function DashboardPage({ params }: DashboardPageProps) {
	const { orgSlug } = await params;
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		redirect('/auth/login');
	}

	const currentOrg = await getCurrentOrgBySlug(supabase, user.id, orgSlug);

	if (!currentOrg) {
		notFound();
	}

	const { data: profile } = await supabase
		.from('profiles')
		.select('full_name, email')
		.eq('id', user.id)
		.maybeSingle();

	const displayName =
		profile?.full_name?.trim() || profile?.email || user.email || 'there';
	const greeting = getTimeGreeting();

	const { stats, recentCarers, expiringDocs } = await getOrgScopedDashboardData(
		supabase,
		currentOrg,
	);

	const statCards = [
		{
			title: 'Total Carers',
			value: stats.totalCarers,
			icon: Users,
			description: 'Registered in this organization',
		},
		{
			title: 'Active',
			value: stats.activeCarers,
			icon: FileCheck,
			description: 'Fully compliant',
		},
		{
			title: 'Pending Reviews',
			value: stats.pendingReviews,
			icon: ClipboardCheck,
			description: 'Need your review',
			href: '/reviews',
			highlight: stats.pendingReviews > 0,
		},
		{
			title: 'Expiring Soon',
			value: stats.expiringSoon,
			icon: AlertTriangle,
			description: 'Within 30 days',
			href: '/documents',
			highlight: stats.expiringSoon > 0,
		},
	];

	return (
		<div className='p-8 max-w-7xl mx-auto'>
			<div className='flex items-center gap-4 mb-8 pb-6 justify-between'>
				<div>
					<h2 className='text-lg font-semibold'>
						{greeting}, {displayName}
					</h2>
					<p className='text-sm text-muted-foreground'>
						Here is what needs attention in {currentOrg.name}.
					</p>
				</div>
			</div>

			<div className='flex items-center justify-between mb-8'>
				<div>
					<h1 className='text-2xl font-semibold tracking-tight'>Dashboard</h1>
					<p className='text-muted-foreground mt-1'>
						Welcome back. Here&apos;s an overview of your compliance status.
					</p>
				</div>
				<Button asChild>
					<Link href={`/${orgSlug}/carers/new`}>
						<Plus className='w-4 h-4 mr-2' />
						Add Carer
					</Link>
				</Button>
			</div>

			<div className='grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8'>
				{statCards.map((stat) => {
					const cardContent = (
						<Card
							className={`${stat.highlight ? 'border-amber-200 bg-amber-50/50' : ''} ${stat.href ? 'hover:shadow-md transition-shadow cursor-pointer' : ''}`}>
							<CardContent className='p-6'>
								<div className='flex items-center justify-between'>
									<div>
										<p className='text-sm text-muted-foreground'>
											{stat.title}
										</p>
										<p
											className={`text-3xl font-semibold mt-1 ${stat.highlight ? 'text-amber-700' : ''}`}>
											{stat.value}
										</p>
										<p className='text-xs text-muted-foreground mt-1'>
											{stat.description}
										</p>
									</div>
									<div
										className={`w-12 h-12 rounded-xl flex items-center justify-center ${stat.highlight ? 'bg-amber-100' : 'bg-muted'}`}>
										<stat.icon
											className={`w-6 h-6 ${stat.highlight ? 'text-amber-600' : 'text-muted-foreground'}`}
										/>
									</div>
								</div>
							</CardContent>
						</Card>
					);

					return stat.href ? (
						<Link
							key={stat.title}
							href={`/${orgSlug}${stat.href}`}
							className='block'>
							{cardContent}
						</Link>
					) : (
						<div key={stat.title}>{cardContent}</div>
					);
				})}
			</div>

			<div className='grid gap-6 lg:grid-cols-2'>
				<Card>
					<CardHeader className='flex flex-row items-center justify-between pb-2'>
						<CardTitle className='text-base font-semibold'>
							Recent Carers
						</CardTitle>
						<Button variant='ghost' size='sm' asChild>
							<Link
								href={`/${orgSlug}/carers`}
								className='text-muted-foreground'>
								View all
								<ArrowRight className='w-4 h-4 ml-1' />
							</Link>
						</Button>
					</CardHeader>
					<CardContent>
						{recentCarers.length > 0 ? (
							<div className='space-y-4'>
								{recentCarers.map((carer) => (
									<Link
										key={carer.id}
										href={`/${orgSlug}/carers/${carer.id}`}
										className='flex items-center justify-between rounded-lg p-2 transition-colors hover:bg-muted/50'>
										<div className='flex items-center gap-3'>
											<div className='w-10 h-10 rounded-full bg-muted flex items-center justify-center'>
												<span className='text-sm font-medium'>
													{initials(carer.full_name)}
												</span>
											</div>
											<div>
												<p className='text-sm font-medium'>{carer.full_name}</p>
												<p className='text-xs text-muted-foreground'>
													{carer.email}
												</p>
											</div>
										</div>
										<div className='text-right'>
											<span
												className={`text-xs px-2 py-1 rounded-full ${statusClass(carer.status)}`}>
												{formatStatus(carer.status)}
											</span>
											<p className='text-xs text-muted-foreground mt-2'>
												{carer.onboarding_progress ?? 0}% approved
											</p>
										</div>
									</Link>
								))}
							</div>
						) : (
							<div className='text-center py-8'>
								<Users className='w-10 h-10 text-muted-foreground/50 mx-auto mb-3' />
								<p className='text-sm text-muted-foreground mb-4'>
									No carers yet
								</p>
								<Button size='sm' asChild>
									<Link href={`/${orgSlug}/carers/new`}>
										Add your first carer
									</Link>
								</Button>
							</div>
						)}
					</CardContent>
				</Card>

				<Card>
					<CardHeader className='flex flex-row items-center justify-between pb-2'>
						<CardTitle className='text-base font-semibold'>
							Expiring Documents
						</CardTitle>
						<Button variant='ghost' size='sm' asChild>
							<Link
								href={`/${orgSlug}/documents`}
								className='text-muted-foreground'>
								View all
								<ArrowRight className='w-4 h-4 ml-1' />
							</Link>
						</Button>
					</CardHeader>
					<CardContent>
						{expiringDocs.length > 0 ? (
							<div className='space-y-4'>
								{expiringDocs.map((doc) => {
									const daysUntil = Math.ceil(
										(new Date(doc.expiry_date).getTime() - Date.now()) /
											(1000 * 60 * 60 * 24),
									);

									return (
										<div
											key={doc.id}
											className='flex items-center justify-between rounded-lg p-2'>
											<div>
												<p className='text-sm font-medium'>
													{doc.document_types?.name ?? 'Document'}
												</p>
												<p className='text-xs text-muted-foreground'>
													{doc.carers?.full_name ?? 'Unknown carer'} &middot;{' '}
													{doc.file_name}
												</p>
											</div>
											<span
												className={`text-xs px-2 py-1 rounded-full ${
													daysUntil <= 7
														? 'bg-red-50 text-red-700'
														: 'bg-amber-50 text-amber-700'
												}`}>
												{daysUntil <= 0 ? 'Expired' : `${daysUntil} days`}
											</span>
										</div>
									);
								})}
							</div>
						) : (
							<div className='text-center py-8'>
								<FileCheck className='w-10 h-10 text-muted-foreground/50 mx-auto mb-3' />
								<p className='text-sm text-muted-foreground'>
									No documents expiring soon
								</p>
							</div>
						)}
					</CardContent>
				</Card>
			</div>
		</div>
	);
}

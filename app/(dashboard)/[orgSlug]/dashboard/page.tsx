import { getOrgScopedDashboardData } from '@/lib/dashboard-data';
import { getCurrentOrgBySlug } from '@/lib/orgs';
import { createClient } from '@/lib/supabase/server';
import {
	AlertTriangle,
	ArrowRight,
	CheckCircle2,
	ClipboardCheck,
	Clock,
	FileCheck,
	Plus,
	TrendingUp,
	Users,
} from 'lucide-react';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

type DashboardPageProps = {
	params: Promise<{ orgSlug: string }>;
};

function getTimeGreeting(date = new Date()) {
	const h = date.getHours();
	if (h < 12) return 'Good morning';
	if (h < 18) return 'Good afternoon';
	return 'Good evening';
}

function initials(name: string) {
	return name
		.split(' ')
		.map((p) => p[0])
		.join('')
		.slice(0, 2)
		.toUpperCase();
}

function StatusBadge({ status }: { status: string }) {
	const map: Record<string, string> = {
		active:   'bg-ok-50 text-ok',
		approved: 'bg-ok-50 text-ok',
		pending:  'bg-warn-50 text-warn',
		on_leave: 'bg-brand-50 text-brand-700',
		expired:  'bg-danger-50 text-danger',
		rejected: 'bg-danger-50 text-danger',
		suspended:'bg-danger-50 text-danger',
	};
	const cls = map[status] ?? 'bg-surface-muted text-slate-600';
	const label = status.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
	return (
		<span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums ${cls}`}>
			{label}
		</span>
	);
}

function MetricCard({
	label,
	value,
	description,
	icon: Icon,
	tone = 'neutral',
	href,
}: {
	label: string;
	value: number | string;
	description: string;
	icon: typeof Users;
	tone?: 'neutral' | 'ok' | 'warn' | 'danger' | 'brand';
	href?: string;
}) {
	const iconStyles: Record<string, string> = {
		neutral: 'bg-surface-muted text-slate-500',
		ok:      'bg-ok-50 text-ok',
		warn:    'bg-warn-50 text-warn',
		danger:  'bg-danger-50 text-danger',
		brand:   'bg-brand-50 text-brand-700',
	};
	const valueStyles: Record<string, string> = {
		neutral: 'text-ink',
		ok:      'text-ok',
		warn:    'text-warn',
		danger:  'text-danger',
		brand:   'text-brand-700',
	};

	const inner = (
		<div className={`group relative overflow-hidden rounded-xl border border-line bg-white p-5 shadow-card transition-shadow ${href ? 'hover:shadow-lift cursor-pointer' : ''}`}>
			<div className='flex items-start justify-between gap-3'>
				<div className='min-w-0 flex-1'>
					<p className='text-[12px] font-semibold uppercase tracking-[0.10em] text-slate-400'>
						{label}
					</p>
					<p className={`mt-2 text-[32px] font-semibold leading-none tracking-tight ${valueStyles[tone]}`}>
						{value}
					</p>
					<p className='mt-2 text-[13px] text-slate-500 leading-snug'>
						{description}
					</p>
				</div>
				<div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${iconStyles[tone]}`}>
					<Icon className='h-5 w-5' />
				</div>
			</div>
			{href && (
				<div className='mt-4 flex items-center gap-1 text-[12.5px] font-medium text-brand-700 opacity-0 transition-opacity group-hover:opacity-100'>
					View all <ArrowRight className='h-3.5 w-3.5' />
				</div>
			)}
		</div>
	);

	return href ? (
		<Link href={href} className='block'>
			{inner}
		</Link>
	) : (
		<div>{inner}</div>
	);
}

export default async function DashboardPage({ params }: DashboardPageProps) {
	const { orgSlug } = await params;
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) redirect('/auth/login');

	const currentOrg = await getCurrentOrgBySlug(supabase, user.id, orgSlug);
	if (!currentOrg) notFound();

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

	const complianceScore =
		stats.totalCarers > 0
			? Math.round((stats.activeCarers / stats.totalCarers) * 100)
			: 100;

	const hasUrgentItems = stats.pendingReviews > 0 || stats.expiringSoon > 0;

	return (
		<div className='min-h-full'>
			{/* ── Page header ─────────────────────────────────────── */}
			<div className='border-b border-line bg-white px-6 py-5 lg:px-8'>
				<div className='mx-auto flex max-w-7xl items-center justify-between gap-4'>
					<div>
						<p className='text-[13px] text-slate-500'>
							{greeting}, <span className='font-medium text-ink'>{displayName}</span>
						</p>
						<h1 className='mt-0.5 text-[22px] font-semibold tracking-tight text-ink'>
							{currentOrg.name}
						</h1>
					</div>
					<Link
						href={`/${orgSlug}/carers/new`}
						className='inline-flex h-9 items-center gap-2 rounded-lg bg-ink px-4 text-[13.5px] font-medium text-white transition-opacity hover:opacity-80'>
						<Plus className='h-4 w-4' />
						Add Carer
					</Link>
				</div>
			</div>

			<div className='mx-auto max-w-7xl px-6 py-7 lg:px-8'>

				{/* ── Urgent alert banner ─────────────────────────── */}
				{hasUrgentItems && (
					<div className='mb-7 flex items-start gap-3 rounded-xl border border-warn/30 bg-warn-50 px-4 py-3.5'>
						<AlertTriangle className='mt-0.5 h-4 w-4 shrink-0 text-warn' />
						<div className='min-w-0 flex-1'>
							<p className='text-[13.5px] font-semibold text-ink'>
								Action needed
							</p>
							<p className='mt-0.5 text-[13px] text-slate-600'>
								{[
									stats.pendingReviews > 0 &&
										`${stats.pendingReviews} document${stats.pendingReviews !== 1 ? 's' : ''} awaiting review`,
									stats.expiringSoon > 0 &&
										`${stats.expiringSoon} document${stats.expiringSoon !== 1 ? 's' : ''} expiring within 30 days`,
								]
									.filter(Boolean)
									.join(' · ')}
							</p>
						</div>
						<div className='flex shrink-0 items-center gap-2'>
							{stats.pendingReviews > 0 && (
								<Link
									href={`/${orgSlug}/reviews`}
									className='inline-flex h-7 items-center rounded-md border border-warn/40 bg-white px-3 text-[12.5px] font-medium text-warn transition-colors hover:bg-warn-50'>
									Review
								</Link>
							)}
							{stats.expiringSoon > 0 && (
								<Link
									href={`/${orgSlug}/documents`}
									className='inline-flex h-7 items-center rounded-md border border-warn/40 bg-white px-3 text-[12.5px] font-medium text-warn transition-colors hover:bg-warn-50'>
									Documents
								</Link>
							)}
						</div>
					</div>
				)}

				{/* ── Metric grid ─────────────────────────────────── */}
				<div className='grid grid-cols-2 gap-4 lg:grid-cols-4'>
					<MetricCard
						label='Total Carers'
						value={stats.totalCarers}
						description='Registered in this organisation'
						icon={Users}
						tone='neutral'
					/>
					<MetricCard
						label='Active'
						value={stats.activeCarers}
						description='Fully compliant carers'
						icon={CheckCircle2}
						tone='ok'
					/>
					<MetricCard
						label='Pending Reviews'
						value={stats.pendingReviews}
						description={stats.pendingReviews > 0 ? 'Need your attention' : 'Review queue clear'}
						icon={ClipboardCheck}
						tone={stats.pendingReviews > 0 ? 'warn' : 'neutral'}
						href={stats.pendingReviews > 0 ? `/${orgSlug}/reviews` : undefined}
					/>
					<MetricCard
						label='Expiring Soon'
						value={stats.expiringSoon}
						description='Documents within 30 days'
						icon={AlertTriangle}
						tone={stats.expiringSoon > 0 ? 'danger' : 'neutral'}
						href={stats.expiringSoon > 0 ? `/${orgSlug}/documents` : undefined}
					/>
				</div>

				{/* ── Compliance score strip ───────────────────────── */}
				<div className='mt-4 flex items-center gap-4 rounded-xl border border-line bg-white px-5 py-4 shadow-card'>
					<div className='flex items-center gap-3 min-w-0'>
						<div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 text-[13px] font-bold tabular-nums ${
							complianceScore >= 90
								? 'border-ok text-ok'
								: complianceScore >= 70
								? 'border-warn text-warn'
								: 'border-danger text-danger'
						}`}>
							{complianceScore}%
						</div>
						<div className='min-w-0'>
							<p className='text-[13.5px] font-semibold text-ink leading-none'>
								Compliance score
							</p>
							<p className='mt-0.5 text-[12px] text-slate-500 leading-none'>
								{stats.activeCarers} of {stats.totalCarers} carers fully compliant
							</p>
						</div>
					</div>
					{/* Score bar */}
					<div className='flex-1 hidden sm:block'>
						<div className='h-2 w-full overflow-hidden rounded-full bg-surface-muted'>
							<div
								className={`h-full rounded-full transition-all ${
									complianceScore >= 90
										? 'bg-ok'
										: complianceScore >= 70
										? 'bg-warn'
										: 'bg-danger'
								}`}
								style={{ width: `${complianceScore}%` }}
							/>
						</div>
					</div>
					<div className='flex shrink-0 items-center gap-1.5 text-[12.5px] text-slate-400'>
						<TrendingUp className='h-3.5 w-3.5' />
						<span>Organisation overview</span>
					</div>
				</div>

				{/* ── Lower panels ────────────────────────────────── */}
				<div className='mt-6 grid gap-5 lg:grid-cols-2'>

					{/* Recent Carers */}
					<div className='rounded-xl border border-line bg-white shadow-card'>
						<div className='flex items-center justify-between border-b border-line px-5 py-3.5'>
							<div>
								<h2 className='text-[14px] font-semibold text-ink'>Recent Carers</h2>
								<p className='text-[12px] text-slate-400'>Latest additions to the team</p>
							</div>
							<Link
								href={`/${orgSlug}/carers`}
								className='inline-flex items-center gap-1 text-[12.5px] font-medium text-brand-700 hover:text-brand-800 transition-colors'>
								View all
								<ArrowRight className='h-3.5 w-3.5' />
							</Link>
						</div>

						<div className='divide-y divide-line'>
							{recentCarers.length > 0 ? (
								recentCarers.map((carer) => (
									<Link
										key={carer.id}
										href={`/${orgSlug}/carers/${carer.id}`}
										className='flex items-center gap-3.5 px-5 py-3.5 transition-colors hover:bg-surface-page group'>
										{/* Avatar */}
										<div className='flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700'>
											<span className='text-[12px] font-bold'>{initials(carer.full_name)}</span>
										</div>
										{/* Info */}
										<div className='min-w-0 flex-1'>
											<p className='truncate text-[13.5px] font-medium text-ink'>
												{carer.full_name}
											</p>
											<p className='truncate text-[12px] text-slate-400'>
												{carer.email}
											</p>
										</div>
										{/* Status + progress */}
										<div className='shrink-0 text-right'>
											<StatusBadge status={carer.status} />
											<div className='mt-1.5 flex items-center justify-end gap-1'>
												<div className='h-1 w-16 overflow-hidden rounded-full bg-surface-muted'>
													<div
														className='h-full rounded-full bg-ok transition-all'
														style={{ width: `${carer.onboarding_progress ?? 0}%` }}
													/>
												</div>
												<span className='text-[11px] tabular-nums text-slate-400'>
													{carer.onboarding_progress ?? 0}%
												</span>
											</div>
										</div>
									</Link>
								))
							) : (
								<div className='flex flex-col items-center justify-center py-12 text-center'>
									<div className='flex h-12 w-12 items-center justify-center rounded-full bg-surface-muted'>
										<Users className='h-5 w-5 text-slate-400' />
									</div>
									<p className='mt-3 text-[14px] font-medium text-ink'>No carers yet</p>
									<p className='mt-1 text-[13px] text-slate-500'>
										Add your first carer to get started.
									</p>
									<Link
										href={`/${orgSlug}/carers/new`}
										className='mt-4 inline-flex h-8 items-center gap-1.5 rounded-lg bg-ink px-3.5 text-[13px] font-medium text-white hover:opacity-80 transition-opacity'>
										<Plus className='h-3.5 w-3.5' />
										Add carer
									</Link>
								</div>
							)}
						</div>
					</div>

					{/* Expiring Documents */}
					<div className='rounded-xl border border-line bg-white shadow-card'>
						<div className='flex items-center justify-between border-b border-line px-5 py-3.5'>
							<div>
								<h2 className='text-[14px] font-semibold text-ink'>Expiring Documents</h2>
								<p className='text-[12px] text-slate-400'>Next 30 days</p>
							</div>
							<Link
								href={`/${orgSlug}/documents`}
								className='inline-flex items-center gap-1 text-[12.5px] font-medium text-brand-700 hover:text-brand-800 transition-colors'>
								View all
								<ArrowRight className='h-3.5 w-3.5' />
							</Link>
						</div>

						<div className='divide-y divide-line'>
							{expiringDocs.length > 0 ? (
								expiringDocs.map((doc) => {
									const daysUntil = Math.ceil(
										(new Date(doc.expiry_date).getTime() - Date.now()) /
											(1000 * 60 * 60 * 24),
									);
									const isUrgent = daysUntil <= 7;
									const isCritical = daysUntil <= 0;

									return (
										<div
											key={doc.id}
											className='flex items-center gap-3.5 px-5 py-3.5 hover:bg-surface-page transition-colors'>
											{/* Icon */}
											<div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${isUrgent ? 'bg-danger-50' : 'bg-warn-50'}`}>
												<Clock className={`h-4 w-4 ${isUrgent ? 'text-danger' : 'text-warn'}`} />
											</div>
											{/* Info */}
											<div className='min-w-0 flex-1'>
												<p className='truncate text-[13.5px] font-medium text-ink'>
													{doc.document_types?.name ?? 'Document'}
												</p>
												<p className='truncate text-[12px] text-slate-400'>
													{doc.carers?.full_name ?? 'Unknown carer'}
												</p>
											</div>
											{/* Countdown */}
											<div className='shrink-0'>
												<span
													className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold tabular-nums ${
														isCritical
															? 'bg-danger-50 text-danger'
															: isUrgent
															? 'bg-danger-50 text-danger'
															: 'bg-warn-50 text-warn'
													}`}>
													{isCritical ? 'Expired' : `${daysUntil}d`}
												</span>
											</div>
										</div>
									);
								})
							) : (
								<div className='flex flex-col items-center justify-center py-12 text-center'>
									<div className='flex h-12 w-12 items-center justify-center rounded-full bg-ok-50'>
										<FileCheck className='h-5 w-5 text-ok' />
									</div>
									<p className='mt-3 text-[14px] font-medium text-ink'>
										No documents expiring soon
									</p>
									<p className='mt-1 text-[13px] text-slate-500'>
										All documents are up to date.
									</p>
								</div>
							)}
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}

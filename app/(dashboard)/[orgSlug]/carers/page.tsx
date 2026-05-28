import { createClient } from '@/lib/supabase/server';
import { UserPlus, Users } from 'lucide-react';
import Link from 'next/link';
import { Suspense } from 'react';
import { resolveOrgAccess } from '@/lib/orgs';
import { notFound, redirect } from 'next/navigation';
import { Plus } from 'lucide-react';

/* ─── Status helpers ──────────────────────────────────────────────── */
function statusConfig(status: string | null) {
	switch (status) {
		case 'active':    return { cls: 'bg-ok-50 text-ok',         label: 'Active' };
		case 'pending':   return { cls: 'bg-warn-50 text-warn',      label: 'Pending' };
		case 'on_leave':  return { cls: 'bg-brand-50 text-brand-700',label: 'On leave' };
		case 'expired':   return { cls: 'bg-danger-50 text-danger',  label: 'Expired' };
		case 'suspended': return { cls: 'bg-danger-50 text-danger',  label: 'Suspended' };
		case 'former':    return { cls: 'bg-surface-muted text-slate-600', label: 'Former' };
		default:          return { cls: 'bg-surface-muted text-slate-500', label: 'Unknown' };
	}
}

function carerInitials(name: string) {
	return name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase();
}

/* ─── Skeleton ────────────────────────────────────────────────────── */
function CarersListSkeleton() {
	return (
		<div className='divide-y divide-line'>
			{[1, 2, 3, 4, 5].map((i) => (
				<div key={i} className='flex items-center gap-4 px-5 py-4 animate-pulse'>
					<div className='h-9 w-9 rounded-full bg-surface-muted' />
					<div className='flex-1 space-y-2'>
						<div className='h-3.5 w-36 rounded bg-surface-muted' />
						<div className='h-3 w-48 rounded bg-surface-muted' />
					</div>
					<div className='h-3 w-10 rounded bg-surface-muted' />
					<div className='h-6 w-16 rounded-full bg-surface-muted' />
				</div>
			))}
		</div>
	);
}

/* ─── Carers list ─────────────────────────────────────────────────── */
async function CarersList({
	orgSlug,
	view,
}: {
	orgSlug: string;
	view: 'current' | 'former';
}) {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) redirect('/auth/login');

	const currentOrg = await resolveOrgAccess(supabase, user.id, orgSlug);
	if (!currentOrg) notFound();

	let query = supabase
		.from('carers')
		.select('*, documents(count)')
		.eq('organization_id', currentOrg.id)
		.order('created_at', { ascending: false });

	query = view === 'former'
		? query.eq('status', 'former')
		: query.neq('status', 'former');

	const { data: carers } = await query;

	if (!carers || carers.length === 0) {
		return (
			<div className='flex flex-col items-center justify-center py-20 text-center'>
				<div className='flex h-14 w-14 items-center justify-center rounded-full bg-surface-muted'>
					<Users className='h-6 w-6 text-slate-400' />
				</div>
				<h3 className='mt-4 text-[15px] font-semibold text-ink'>
					{view === 'former' ? 'No former employees' : 'No carers yet'}
				</h3>
				<p className='mt-2 max-w-sm text-[13.5px] text-slate-500 leading-snug'>
					{view === 'former'
						? 'Carers moved from the current team will appear here with their compliance history intact.'
						: 'Add your first carer to begin tracking their compliance documents and references.'}
				</p>
				{view !== 'former' && (
					<Link
						href={`/${orgSlug}/carers/new`}
						className='mt-5 inline-flex h-9 items-center gap-2 rounded-lg bg-ink px-4 text-[13.5px] font-medium text-white transition-opacity hover:opacity-80'>
						<UserPlus className='h-4 w-4' />
						Add first carer
					</Link>
				)}
			</div>
		);
	}

	return (
		<div className='divide-y divide-line'>
			{carers.map((carer) => {
				const { cls, label } = statusConfig(carer.status);
				const progress = carer.onboarding_progress ?? 0;

				return (
					<Link
						key={carer.id}
						href={`/${orgSlug}/carers/${carer.id}`}
						className='flex items-center gap-4 px-5 py-4 transition-colors hover:bg-surface-page group'>
						{/* Avatar */}
						<div className='flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700'>
							<span className='text-[11px] font-bold'>{carerInitials(carer.full_name)}</span>
						</div>
						{/* Name + email */}
						<div className='min-w-0 flex-1'>
							<p className='truncate text-[13.5px] font-medium text-ink'>
								{carer.full_name}
							</p>
							<p className='truncate text-[12px] text-slate-400'>{carer.email}</p>
						</div>
						{/* Progress */}
						<div className='hidden items-center gap-2 sm:flex'>
							<div className='h-1.5 w-20 overflow-hidden rounded-full bg-surface-muted'>
								<div
									className='h-full rounded-full bg-ok transition-all'
									style={{ width: `${progress}%` }}
								/>
							</div>
							<span className='w-8 text-right text-[11.5px] tabular-nums text-slate-400'>
								{progress}%
							</span>
						</div>
						{/* Status pill */}
						<span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${cls}`}>
							{label}
						</span>
						{/* Hover arrow */}
						<span className='hidden text-[12px] text-slate-300 group-hover:text-slate-500 transition-colors md:block'>
							→
						</span>
					</Link>
				);
			})}
		</div>
	);
}

/* ─── Page ────────────────────────────────────────────────────────── */
export default async function CarersPage({
	params,
	searchParams,
}: {
	params: Promise<{ orgSlug: string }>;
	searchParams: Promise<{ view?: string }>;
}) {
	const { orgSlug } = await params;
	const { view: rawView } = await searchParams;
	const view = rawView === 'former' ? 'former' : 'current';

	return (
		<div className='min-h-full'>
			{/* Page header */}
			<div className='border-b border-line bg-white px-6 py-5 lg:px-8'>
				<div className='mx-auto flex max-w-7xl items-center justify-between gap-4'>
					<div>
						<h1 className='text-[22px] font-semibold tracking-tight text-ink'>Carers</h1>
						<p className='mt-0.5 text-[13px] text-slate-500'>
							Manage your care workers and their compliance documents.
						</p>
					</div>
					<Link
						href={`/${orgSlug}/carers/new`}
						className='inline-flex h-9 items-center gap-2 rounded-lg bg-ink px-4 text-[13.5px] font-medium text-white transition-opacity hover:opacity-80'>
						<Plus className='h-4 w-4' />
						Add Carer
					</Link>
				</div>
			</div>

			<div className='mx-auto max-w-7xl px-6 py-6 lg:px-8'>
				{/* Toolbar */}
				<div className='mb-4 flex items-center justify-between gap-3'>
					<div className='flex rounded-lg border border-line bg-white p-1 text-[13px]'>
						<Link
							href={`/${orgSlug}/carers`}
							className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
								view === 'current'
									? 'bg-ink text-white'
									: 'text-slate-600 hover:bg-surface-muted hover:text-ink'
							}`}>
							Current
						</Link>
						<Link
							href={`/${orgSlug}/carers?view=former`}
							className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
								view === 'former'
									? 'bg-ink text-white'
									: 'text-slate-600 hover:bg-surface-muted hover:text-ink'
							}`}>
							Former
						</Link>
					</div>
				</div>

				{/* Table card */}
				<div className='overflow-hidden rounded-xl border border-line bg-white shadow-card'>
					{/* Table header */}
					<div className='flex items-center gap-4 border-b border-line bg-surface-page px-5 py-2.5'>
						<span className='flex-1 text-[11.5px] font-semibold uppercase tracking-[0.10em] text-slate-400'>
							Carer
						</span>
						<span className='hidden w-28 text-[11.5px] font-semibold uppercase tracking-[0.10em] text-slate-400 sm:block'>
							Progress
						</span>
						<span className='w-20 text-[11.5px] font-semibold uppercase tracking-[0.10em] text-slate-400'>
							Status
						</span>
						<span className='hidden w-5 md:block' />
					</div>
					<Suspense fallback={<CarersListSkeleton />}>
						<CarersList orgSlug={orgSlug} view={view} />
					</Suspense>
				</div>
			</div>
		</div>
	);
}

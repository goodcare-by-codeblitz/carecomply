'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Suspense } from 'react';
import { cn } from '@/lib/utils';
import { Bell, ArrowLeft, Shield } from 'lucide-react';

const adminNav = [
	{ label: 'Reminders', href: '/admin/reminders', icon: Bell },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
	const pathname = usePathname();

	return (
		<div className='min-h-screen bg-surface-page'>
			{/* Top bar */}
			<div className='sticky top-0 z-40 border-b border-line bg-white'>
				<div className='mx-auto flex h-14 max-w-7xl items-center gap-4 px-6'>
					<Link
						href='/'
						className='flex items-center gap-1.5 text-[13px] text-slate-500 transition-colors hover:text-ink'>
						<ArrowLeft className='h-3.5 w-3.5' />
						Back to app
					</Link>
					<div className='h-4 w-px bg-line' />
					<div className='flex items-center gap-2'>
						<div className='flex h-6 w-6 items-center justify-center rounded-md bg-ink'>
							<Shield className='h-3.5 w-3.5 text-white' />
						</div>
						<span className='text-[13.5px] font-semibold text-ink'>
							Platform Admin
						</span>
					</div>
					<div className='ml-auto flex items-center gap-1'>
						{adminNav.map((item) => {
							const isActive = pathname.startsWith(item.href);
							const Icon = item.icon;
							return (
								<Link
									key={item.href}
									href={item.href}
									className={cn(
										'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors',
										isActive
											? 'bg-brand-50 text-brand-700'
											: 'text-slate-600 hover:bg-surface-muted hover:text-ink',
									)}>
									<Icon className='h-3.5 w-3.5' />
									{item.label}
								</Link>
							);
						})}
					</div>
				</div>
			</div>

			<Suspense
				fallback={
					<div className='flex min-h-[60vh] items-center justify-center'>
						<div className='h-6 w-6 animate-spin rounded-full border-2 border-brand border-t-transparent' />
					</div>
				}>
				{children}
			</Suspense>
		</div>
	);
}

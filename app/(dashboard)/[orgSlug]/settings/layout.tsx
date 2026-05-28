'use client';

import { cn } from '@/lib/utils';
import { CreditCard, FileCheck2, Settings, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

const settingsNav = [
	{ name: 'Profile', href: '/settings', icon: Settings },
	{ name: 'Billing', href: '/settings/billing', icon: CreditCard },
	{ name: 'Roles', href: '/settings/roles', icon: ShieldCheck },
	{ name: 'Documents', href: '/settings/documents', icon: FileCheck2 },
];

export default function SettingsLayout({ children }: { children: ReactNode }) {
	const { orgSlug } = useParams<{ orgSlug: string }>();
	const pathname = usePathname();

	return (
		<div className='min-h-full'>
			<div className='border-b border-line bg-white px-6 py-5 lg:px-8'>
				<div className='mx-auto max-w-6xl'>
					<h1 className='text-[22px] font-semibold tracking-tight text-ink'>Settings</h1>
					<p className='mt-0.5 text-[13px] text-slate-500'>
						Manage organization configuration, billing, roles, and onboarding requirements.
					</p>
				</div>
			</div>

			<div className='mx-auto max-w-6xl px-6 py-6 lg:px-8'>
				<div className='grid gap-8 lg:grid-cols-[220px_1fr]'>
					<nav className='space-y-0.5 lg:sticky lg:top-8 lg:self-start'>
						{settingsNav.map((item) => {
							const href = `/${orgSlug}${item.href}`;
							const isActive =
								pathname === href ||
								(item.href !== '/settings' && pathname.startsWith(`${href}/`));

							return (
								<Link
									key={item.name}
									href={href}
									className={cn(
										'flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13.5px] transition-colors',
										isActive
											? 'bg-brand-50 font-semibold text-brand-700'
											: 'font-medium text-slate-600 hover:bg-surface-muted hover:text-ink',
									)}>
									<item.icon
										className={cn(
											'h-[14px] w-[14px]',
											isActive ? 'text-brand-700' : 'text-slate-400',
										)}
									/>
									{item.name}
								</Link>
							);
						})}
					</nav>
					<div className='min-w-0'>{children}</div>
				</div>
			</div>
		</div>
	);
}

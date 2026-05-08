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
		<div className='p-8 max-w-6xl mx-auto'>
			<div className='mb-8'>
				<h1 className='text-2xl font-semibold tracking-tight'>Settings</h1>
				<p className='text-muted-foreground mt-1'>
					Manage organization configuration, billing, roles, and onboarding
					requirements.
				</p>
			</div>

			<div className='grid gap-8 lg:grid-cols-[220px_1fr]'>
				<nav className='space-y-1 lg:sticky lg:top-8 lg:self-start'>
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
									'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
									isActive
										? 'bg-foreground text-background'
										: 'text-muted-foreground hover:bg-muted hover:text-foreground',
								)}>
								<item.icon className='h-4 w-4' />
								{item.name}
							</Link>
						);
					})}
				</nav>
				<div className='min-w-0'>{children}</div>
			</div>
		</div>
	);
}

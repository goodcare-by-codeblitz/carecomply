'use client';

import DropDown from '@/components/shared/drop-down';
import { Button } from '@/components/ui/button';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PERMISSIONS, type PermissionKey } from '@/lib/permissions';
import { getOrgInitials, getOrgLogoSrc } from '@/lib/orgs';
import { cn } from '@/lib/utils';
import { useOrgStore } from '@/stores/auth-store';
import {
	Bell,
	ClipboardCheck,
	FileText,
	History,
	LayoutDashboard,
	Menu,
	Settings,
	ShieldCheck,
	Users,
	UsersRound,
	Zap,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ReactNode } from 'react';
import { ThemeSwitcher } from '../theme-switcher';

interface NavItem {
	name: string;
	href: string;
	icon: typeof LayoutDashboard;
	permission?: PermissionKey;
}

const navigationGroups: { label: string; items: NavItem[] }[] = [
	{
		label: 'Overview',
		items: [{ name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard }],
	},
	{
		label: 'Compliance',
		items: [
			{ name: 'Carers', href: '/carers', icon: Users, permission: PERMISSIONS.CARERS_VIEW },
			{ name: 'Documents', href: '/documents', icon: FileText, permission: PERMISSIONS.DOCUMENTS_VIEW },
			{ name: 'Reviews', href: '/reviews', icon: ClipboardCheck, permission: PERMISSIONS.DOCUMENTS_REVIEW },
			{ name: 'Automations', href: '/automations', icon: Zap, permission: PERMISSIONS.AUTOMATIONS_VIEW },
		],
	},
	{
		label: 'Organization',
		items: [
			{ name: 'Team', href: '/team', icon: UsersRound, permission: PERMISSIONS.TEAM_VIEW },
			{ name: 'Audit Logs', href: '/audit-logs', icon: History, permission: PERMISSIONS.AUDIT_VIEW },
			{ name: 'Settings', href: '/settings', icon: Settings, permission: PERMISSIONS.SETTINGS_VIEW },
		],
	},
];

export function DashboardShell({
	children,
	orgSlug,
}: {
	children: ReactNode;
	orgSlug: string;
}) {
	const pathname = usePathname();
	const currentOrg = useOrgStore((s) => s.getCurrentOrgFromSlug(orgSlug));
	const isOrgStoreLoaded = useOrgStore((s) => s.isLoaded);
	const membership = useOrgStore((s) =>
		currentOrg ? s.getMembershipForOrg(currentOrg.id) : null,
	);
	const currentRole = useOrgStore((s) =>
		membership?.role_id ? s.roles[membership.role_id] : null,
	);

	const orgName = currentOrg?.name ?? orgSlug;
	const logoSrc = getOrgLogoSrc(currentOrg);

	const allowedPermissionCodes = new Set(
		currentRole?.role_permissions
			.map((rp) => rp.permissions?.code)
			.filter((code): code is PermissionKey => Boolean(code)) ?? [],
	);

	const canViewItem = (item: NavItem) => {
		if (!item.permission) return true;
		if (!isOrgStoreLoaded) return true;
		return allowedPermissionCodes.has(item.permission);
	};

	const visibleGroups = navigationGroups
		.map((g) => ({ ...g, items: g.items.filter(canViewItem) }))
		.filter((g) => g.items.length > 0);

	const renderNavItem = (item: NavItem, mobile = false) => {
		const href = `/${orgSlug}${item.href}`;
		const isActive = pathname === href || pathname.startsWith(href + '/');

		return (
			<Link
				key={item.name}
				href={href}
				className={cn(
					'flex items-center gap-2.5 rounded-md text-[13.5px] transition-colors duration-100',
					mobile ? 'h-10 px-3' : 'h-8 px-3',
					isActive
						? 'bg-brand-50 text-brand-700 font-semibold'
						: 'text-slate-600 hover:bg-surface-muted hover:text-ink font-medium',
				)}>
				<item.icon
					className={cn(
						'shrink-0',
						isActive ? 'text-brand-700' : 'text-slate-400',
						mobile ? 'h-[15px] w-[15px]' : 'h-[14px] w-[14px]',
					)}
				/>
				<span>{item.name}</span>
			</Link>
		);
	};

	return (
		<div className='min-h-screen bg-surface-page md:grid md:grid-cols-[240px_1fr]'>

			{/* ── Desktop Sidebar ─────────────────────────────────── */}
			<aside className='hidden border-r border-line bg-white md:sticky md:top-0 md:flex md:h-screen md:flex-col'>

				{/* Org identity header */}
				<Link
					href={`/${orgSlug}/dashboard`}
					className='flex h-14 shrink-0 items-center gap-3 border-b border-line px-4 transition-colors hover:bg-surface-muted/30'>
					<div className='flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-line bg-surface-muted'>
						{logoSrc ? (
							<img
								src={logoSrc}
								alt={`${orgName} logo`}
								className='h-full w-full object-cover'
							/>
						) : (
							<span className='text-[11px] font-bold text-ink'>
								{getOrgInitials(orgName)}
							</span>
						)}
					</div>
					<div className='min-w-0 flex-1'>
						<div className='truncate text-[13.5px] font-semibold leading-none text-ink'>
							{orgName}
						</div>
						<div className='mt-0.5 text-[11px] leading-none text-slate-400'>
							Workspace
						</div>
					</div>
				</Link>

				{/* Navigation */}
				<nav className='no-scrollbar flex-1 overflow-y-auto px-2 py-4'>
					<div className='space-y-5'>
						{visibleGroups.map((group) => (
							<div key={group.label}>
								<p className='mb-1.5 px-3 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-slate-400'>
									{group.label}
								</p>
								<div className='space-y-0.5'>
									{group.items.map((item) => renderNavItem(item))}
								</div>
							</div>
						))}
					</div>
				</nav>

				{/* Sidebar footer */}
				<div className='shrink-0 border-t border-line px-3 pb-3 pt-2.5'>
					<DropDown orgSlug={orgSlug} />
					<div className='mt-2.5 flex items-center gap-2 px-1'>
						<div className='flex h-5 w-5 shrink-0 items-center justify-center rounded bg-ink'>
							<ShieldCheck className='h-3 w-3 text-white' />
						</div>
						<span className='text-[11.5px] font-medium text-slate-400'>
							CareComply
						</span>
					</div>
				</div>
			</aside>

			{/* ── Main content column ──────────────────────────────── */}
			<div className='flex min-w-0 flex-col'>

				{/* Desktop top bar */}
				<header className='sticky top-0 z-40 hidden h-14 shrink-0 items-center justify-end border-b border-line bg-white px-5 md:flex'>
					<div className='flex items-center gap-1'>
						<ThemeSwitcher />
						<Button variant='ghost' size='icon' className='relative h-8 w-8'>
							<Bell className='h-4 w-4' />
							<span className='absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-danger' />
						</Button>
					</div>
				</header>

				{/* Mobile header */}
				<header className='sticky top-0 z-50 border-b border-line bg-white/95 backdrop-blur md:hidden'>
					<div className='flex h-14 items-center justify-between px-4'>
						<Link
							href={`/${orgSlug}/dashboard`}
							className='flex min-w-0 items-center gap-2.5'>
							<div className='flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-line bg-surface-muted'>
								{logoSrc ? (
									<img
										src={logoSrc}
										alt={`${orgName} logo`}
										className='h-full w-full object-cover'
									/>
								) : (
									<span className='text-[11px] font-bold text-ink'>
										{getOrgInitials(orgName)}
									</span>
								)}
							</div>
							<span className='truncate text-[13.5px] font-semibold text-ink'>
								{orgName}
							</span>
						</Link>

						<div className='flex items-center gap-1'>
							<ThemeSwitcher />
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<Button variant='outline' size='icon' className='h-8 w-8'>
										<Menu className='h-4 w-4' />
									</Button>
								</DropdownMenuTrigger>
								<DropdownMenuContent align='end' className='w-64'>
									{visibleGroups.map((group) => (
										<div key={group.label}>
											<DropdownMenuLabel className='text-[10.5px] uppercase tracking-[0.12em] text-slate-400'>
												{group.label}
											</DropdownMenuLabel>
											{group.items.map((item) => (
												<DropdownMenuItem key={item.name} asChild>
													{renderNavItem(item, true)}
												</DropdownMenuItem>
											))}
											<DropdownMenuSeparator />
										</div>
									))}
									<div className='px-2 py-1'>
										<DropDown orgSlug={orgSlug} />
									</div>
								</DropdownMenuContent>
							</DropdownMenu>
						</div>
					</div>
				</header>

				<main className='min-w-0 flex-1'>{children}</main>
			</div>
		</div>
	);
}

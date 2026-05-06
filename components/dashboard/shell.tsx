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
	Shield,
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
			{
				name: 'Carers',
				href: '/carers',
				icon: Users,
				permission: PERMISSIONS.CARERS_VIEW,
			},
			{
				name: 'Documents',
				href: '/documents',
				icon: FileText,
				permission: PERMISSIONS.DOCUMENTS_VIEW,
			},
			{
				name: 'Reviews',
				href: '/reviews',
				icon: ClipboardCheck,
				permission: PERMISSIONS.DOCUMENTS_REVIEW,
			},
			{
				name: 'Automations',
				href: '/automations',
				icon: Zap,
				permission: PERMISSIONS.AUTOMATIONS_VIEW,
			},
		],
	},
	{
		label: 'Organization',
		items: [
			{
				name: 'Team',
				href: '/team',
				icon: UsersRound,
				permission: PERMISSIONS.TEAM_VIEW,
			},
			{
				name: 'Audit Logs',
				href: '/audit-logs',
				icon: History,
				permission: PERMISSIONS.AUDIT_VIEW,
			},
			{
				name: 'Settings',
				href: '/settings',
				icon: Settings,
				permission: PERMISSIONS.SETTINGS_VIEW,
			},
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
	const pathName = usePathname();
	const currentOrg = useOrgStore((state) =>
		state.getCurrentOrgFromSlug(orgSlug),
	);
	const isOrgStoreLoaded = useOrgStore((state) => state.isLoaded);
	const membership = useOrgStore((state) =>
		currentOrg ? state.getMembershipForOrg(currentOrg.id) : null,
	);
	const currentRole = useOrgStore((state) =>
		membership?.role_id ? state.roles[membership.role_id] : null,
	);
	const orgName = currentOrg?.name ?? orgSlug;
	const logoSrc = getOrgLogoSrc(currentOrg);
	const allowedPermissionCodes = new Set(
		currentRole?.role_permissions
			.map((rolePermission) => rolePermission.permissions?.code)
			.filter((code): code is PermissionKey => Boolean(code)) ?? [],
	);

	const canViewItem = (item: NavItem) => {
		if (!item.permission) return true;
		if (!isOrgStoreLoaded) return true;
		return allowedPermissionCodes.has(item.permission);
	};

	const visibleNavigationGroups = navigationGroups
		.map((group) => ({
			...group,
			items: group.items.filter(canViewItem),
		}))
		.filter((group) => group.items.length > 0);

	const renderNavItem = (item: NavItem, mobile = false) => {
		const href = `/${orgSlug}${item.href}`;
		const isActive = pathName === href || pathName.startsWith(href + '/');

		const className = cn(
			'flex items-center gap-3 rounded-md text-sm font-medium transition-colors',
			mobile ? 'px-2 py-2' : 'px-3 py-2',
			isActive
				? 'bg-foreground text-background'
				: 'text-muted-foreground hover:bg-muted hover:text-foreground',
		);

		return (
			<Link key={item.name} href={href} className={className}>
				<item.icon className='h-4 w-4 shrink-0' />
				<span>{item.name}</span>
			</Link>
		);
	};

	return (
		<div className='min-h-screen bg-background md:grid md:grid-cols-[260px_1fr]'>
			<aside className='hidden border-r bg-background md:sticky md:top-0 md:flex md:h-screen md:flex-col'>
				<div className='flex h-16 items-center border-b px-5'>
					<Link
						href={`/${orgSlug}/dashboard`}
						className='flex min-w-0 items-center gap-2.5'>
						<div className='flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted'>
							{logoSrc ? (
								<img
									src={logoSrc}
									alt={`${orgName} logo`}
									className='h-full w-full object-cover'
								/>
							) : (
								<span className='text-sm font-semibold'>
									{getOrgInitials(orgName)}
								</span>
							)}
						</div>
						<span className='truncate text-sm font-semibold'>{orgName}</span>
					</Link>
				</div>

				<nav className='flex-1 space-y-6 overflow-y-auto px-3 py-5'>
					{visibleNavigationGroups.map((group) => (
						<div key={group.label} className='space-y-2'>
							<p className='px-3 text-xs font-semibold uppercase text-muted-foreground'>
								{group.label}
							</p>
							<div className='space-y-1'>
								{group.items.map((item) => renderNavItem(item))}
							</div>
						</div>
					))}
				</nav>

				<div className='border-t p-3'>
					<div className='mb-3 flex items-center justify-between'>
						<ThemeSwitcher />
						<Button variant='ghost' size='icon' className='relative'>
							<Bell className='h-4 w-4' />
							<span className='absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-destructive' />
						</Button>
					</div>
					<DropDown orgSlug={orgSlug} />
					<div className='mt-4 flex items-center gap-2 px-2 text-xs text-muted-foreground'>
						<span className='flex h-5 w-5 items-center justify-center rounded bg-foreground'>
							<Shield className='h-3 w-3 text-background' />
						</span>
						<span>CareComply</span>
					</div>
				</div>
			</aside>

			<div className='min-w-0'>
				<header className='sticky top-0 z-50 border-b bg-background/95 backdrop-blur md:hidden'>
					<div className='flex h-16 items-center justify-between px-4'>
						<Link
							href={`/${orgSlug}/dashboard`}
							className='flex min-w-0 items-center gap-2.5'>
							<div className='flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted'>
								{logoSrc ? (
									<img
										src={logoSrc}
										alt={`${orgName} logo`}
										className='h-full w-full object-cover'
									/>
								) : (
									<span className='text-sm font-semibold'>{getOrgInitials(orgName)}</span>
								)}
							</div>
							<span className='truncate text-sm font-semibold'>{orgName}</span>
						</Link>

						<ThemeSwitcher />
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button variant='outline' size='icon'>
									<Menu className='h-4 w-4' />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align='end' className='w-64'>
								{visibleNavigationGroups.map((group) => (
									<div key={group.label}>
										<DropdownMenuLabel>{group.label}</DropdownMenuLabel>
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
				</header>

				<main className='min-w-0'>{children}</main>
			</div>
		</div>
	);
}

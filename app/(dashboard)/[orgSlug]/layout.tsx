import { DashboardShell } from '@/components/dashboard/shell';
import { DashboardStoreInitializer } from '@/components/dashboard/store-initializer';
import { Suspense } from 'react';

async function DashboardFrame({
	children,
	params,
}: {
	children: React.ReactNode;
	params: Promise<{ orgSlug: string }>;
}) {
	const { orgSlug } = await params;

	return (
		<DashboardShell orgSlug={orgSlug}>
			<DashboardStoreInitializer />
			{children}
		</DashboardShell>
	);
}

export default function DashboardLayout({
	children,
	params,
}: {
	children: React.ReactNode;
	params: Promise<{ orgSlug: string }>;
}) {
	return (
		<Suspense fallback={<div>Loading...</div>}>
			<DashboardFrame params={params}>{children}</DashboardFrame>
		</Suspense>
	);
}

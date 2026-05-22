import { getPlatformAccessForUser } from '@/lib/platform-admin';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { notFound, redirect } from 'next/navigation';
import { connection } from 'next/server';
import { ReminderOperationsClient } from './reminder-operations-client';

export default async function ReminderOperationsPage() {
	await connection();
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) redirect('/auth/login?next=admin');

	const admin = createAdminClient();
	const platformAccess = await getPlatformAccessForUser(admin, user.id);

	if (!platformAccess.canAccessAdmin) notFound();

	return <ReminderOperationsClient />;
}

import { useOrgStore } from '../stores/auth-store';
import { createClient } from './supabase/client';

import { Organization } from './types';

export async function initOrgStore() {
	const { setData } = useOrgStore.getState();

	const supabase = createClient();

	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) return;

	const { data } = await supabase
		.from('organizations')
		.select(
			`
			*,
			organization_memberships!inner(
				organization_id,
				user_id,
				deleted_at,
				status,
				roles(
					id,
					organization_id,
					name,
					description,
					is_system_role,
					role_permissions(
						id,
						permissions(
							id,
							code,
							name,
							description,
							category
						)
					)
				)
			)
		`,
		)
		.eq('organization_memberships.user_id', user.id)
		.is('organization_memberships.deleted_at', null)
		.in('organization_memberships.status', ['active', 'on_leave']);

	if (!data) return;
	// 🔥 critical fix for TS mismatch
	setData(data as unknown as Organization[]);
}

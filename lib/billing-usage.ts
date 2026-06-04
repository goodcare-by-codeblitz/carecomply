import type { createAdminClient } from '@/lib/supabase/admin';

export const BILLABLE_CARER_STATUSES = ['active', 'on_leave'] as const;

export type BillableCarerStatus = (typeof BILLABLE_CARER_STATUSES)[number];

export function isBillableCarerStatus(
	status: string | null | undefined,
): status is BillableCarerStatus {
	return status === 'active' || status === 'on_leave';
}

export function countActiveCarersFromStatuses(
	statuses: Array<string | null | undefined>,
) {
	return statuses.filter(isBillableCarerStatus).length;
}

export async function calculateActiveCarers(
	admin: ReturnType<typeof createAdminClient>,
	organizationId: string,
) {
	const { count, error } = await admin
		.from('carers')
		.select('id', { count: 'exact', head: true })
		.eq('organization_id', organizationId)
		.in('status', [...BILLABLE_CARER_STATUSES]);

	if (error) throw error;
	return count ?? 0;
}

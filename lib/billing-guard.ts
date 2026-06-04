import { evaluateBillingState, type BillingState } from '@/lib/billing-state';
import { captureBillingException } from '@/lib/billing-monitoring';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

type BillingRow = {
	plan: string | null;
	status: string | null;
	grace_period_ends_at: string | null;
};

export async function getOrganizationBillingState(
	organizationId: string,
): Promise<BillingState> {
	const admin = createAdminClient();
	const { data, error } = await admin
		.from('organization_billing')
		.select('plan, status, grace_period_ends_at')
		.eq('organization_id', organizationId)
		.maybeSingle();

	if (error) {
		captureBillingException(error, {
			operation: 'load_organization_billing_state',
			organizationId,
		});
		throw error;
	}

	return evaluateBillingState((data as BillingRow | null) ?? null);
}

export async function requireBillingCanModify(organizationId: string) {
	const state = await getOrganizationBillingState(organizationId);
	if (state.canModifyData) return { ok: true as const, state };

	return {
		ok: false as const,
		state,
		response: billingBlockedResponse(state),
	};
}

export function billingBlockedResponse(state: BillingState) {
	const status = state.isReadOnly ? 402 : 403;
	const message = state.isReadOnly
		? 'Your subscription is past due and the grace period has ended. This workspace is read-only until billing is updated.'
		: 'A current subscription is required before making changes.';

	return NextResponse.json(
		{
			error: message,
			billing: {
				status: state.status,
				reason: state.reason,
				isReadOnly: state.isReadOnly,
				gracePeriodEndsAt: state.gracePeriodEndsAt,
			},
		},
		{ status },
	);
}

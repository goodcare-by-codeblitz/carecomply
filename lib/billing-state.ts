import {
	normalizeBillingPlan,
	normalizeBillingStatus,
	type BillingPlan,
	type BillingStatus,
} from '@/lib/billing';

export const PAST_DUE_GRACE_DAYS = 7;

export type BillingAccessReason =
	| 'active'
	| 'trialing'
	| 'past_due_grace'
	| 'past_due_read_only'
	| 'canceled'
	| 'not_configured';

export type BillingStateInput = {
	plan?: string | null;
	status?: string | null;
	grace_period_ends_at?: string | null;
};

export type BillingState = {
	plan: BillingPlan;
	status: BillingStatus;
	reason: BillingAccessReason;
	canAccessApp: boolean;
	canModifyData: boolean;
	canUseProFeatures: boolean;
	isReadOnly: boolean;
	gracePeriodEndsAt: string | null;
	gracePeriodHasExpired: boolean;
};

export function getPastDueGracePeriodEnd(from = new Date()) {
	const expiresAt = new Date(from);
	expiresAt.setDate(expiresAt.getDate() + PAST_DUE_GRACE_DAYS);
	return expiresAt.toISOString();
}

export function evaluateBillingState(
	input: BillingStateInput | null | undefined,
	now = new Date(),
): BillingState {
	const plan = normalizeBillingPlan(input?.plan);
	const status = normalizeBillingStatus(input?.status);
	const gracePeriodEndsAt = input?.grace_period_ends_at ?? null;
	const graceEnd = gracePeriodEndsAt ? new Date(gracePeriodEndsAt) : null;
	const gracePeriodHasExpired =
		status === 'past_due' &&
		(!graceEnd || Number.isNaN(graceEnd.getTime()) || graceEnd <= now);

	if (status === 'trialing' || status === 'active') {
		return buildState({
			plan,
			status,
			reason: status,
			gracePeriodEndsAt,
			gracePeriodHasExpired: false,
			canAccessApp: true,
			canModifyData: true,
		});
	}

	if (status === 'past_due') {
		return buildState({
			plan,
			status,
			reason: gracePeriodHasExpired ? 'past_due_read_only' : 'past_due_grace',
			gracePeriodEndsAt,
			gracePeriodHasExpired,
			canAccessApp: true,
			canModifyData: !gracePeriodHasExpired,
		});
	}

	return buildState({
		plan,
		status,
		reason: status === 'canceled' ? 'canceled' : 'not_configured',
		gracePeriodEndsAt,
		gracePeriodHasExpired: false,
		canAccessApp: false,
		canModifyData: false,
	});
}

export function canAccessApp(input: BillingStateInput | null | undefined) {
	return evaluateBillingState(input).canAccessApp;
}

export function canModifyData(input: BillingStateInput | null | undefined) {
	return evaluateBillingState(input).canModifyData;
}

export function canUseProFeatures(input: BillingStateInput | null | undefined) {
	return evaluateBillingState(input).canUseProFeatures;
}

export function isReadOnly(input: BillingStateInput | null | undefined) {
	return evaluateBillingState(input).isReadOnly;
}

function buildState({
	plan,
	status,
	reason,
	gracePeriodEndsAt,
	gracePeriodHasExpired,
	canAccessApp,
	canModifyData,
}: {
	plan: BillingPlan;
	status: BillingStatus;
	reason: BillingAccessReason;
	gracePeriodEndsAt: string | null;
	gracePeriodHasExpired: boolean;
	canAccessApp: boolean;
	canModifyData: boolean;
}): BillingState {
	return {
		plan,
		status,
		reason,
		gracePeriodEndsAt,
		gracePeriodHasExpired,
		canAccessApp,
		canModifyData,
		canUseProFeatures: plan === 'pro' && canAccessApp,
		isReadOnly: canAccessApp && !canModifyData,
	};
}

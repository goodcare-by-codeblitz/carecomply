import type { BillingInterval, BillingPlan, BillingStatus } from '@/lib/billing';

export type PendingCheckoutInput = {
	sessionId?: string | null;
	sessionUrl?: string | null;
	plan?: string | null;
	interval?: string | null;
	expiresAt?: string | null;
};

export function getCheckoutIdempotencyKey({
	organizationId,
	plan,
	interval,
}: {
	organizationId: string;
	plan: BillingPlan;
	interval: BillingInterval;
}) {
	return `checkout:v2:${organizationId}:${plan}:${interval}`;
}

export function getCheckoutCustomerParams({
	stripeCustomerId,
	customerEmail,
}: {
	stripeCustomerId?: string | null;
	customerEmail?: string | null;
}) {
	if (stripeCustomerId) {
		return {
			customer: stripeCustomerId,
			customer_update: { address: 'auto' as const },
		};
	}

	return customerEmail ? { customer_email: customerEmail } : {};
}

export function canReusePendingCheckout(
	pending: PendingCheckoutInput,
	target: { plan: BillingPlan; interval: BillingInterval },
	now = new Date(),
) {
	if (
		!pending.sessionId ||
		!pending.sessionUrl ||
		pending.plan !== target.plan ||
		pending.interval !== target.interval
	) {
		return false;
	}

	if (!pending.expiresAt) return true;
	const expiresAt = new Date(pending.expiresAt);
	return !Number.isNaN(expiresAt.getTime()) && expiresAt > now;
}

export function blocksNewCheckout({
	status,
	stripeSubscriptionId,
}: {
	status?: BillingStatus | string | null;
	stripeSubscriptionId?: string | null;
}) {
	return Boolean(stripeSubscriptionId && status !== 'canceled');
}

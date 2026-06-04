import * as Sentry from '@sentry/nextjs';

type BillingContext = Record<string, string | number | boolean | null | undefined>;

export function captureBillingException(
	error: unknown,
	context: {
		operation: string;
		organizationId?: string | null;
		stripeEventId?: string | null;
		stripeSubscriptionId?: string | null;
		extra?: BillingContext;
	},
) {
	const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;
	if (!dsn) return;

	Sentry.withScope((scope) => {
		scope.setTag('area', 'billing');
		scope.setTag('operation', context.operation);
		if (context.organizationId) {
			scope.setContext('organization', { id: context.organizationId });
		}
		if (context.stripeEventId) {
			scope.setContext('stripe_event', { id: context.stripeEventId });
		}
		if (context.stripeSubscriptionId) {
			scope.setContext('stripe_subscription', {
				id: context.stripeSubscriptionId,
			});
		}
		if (context.extra) scope.setContext('billing', context.extra);
		Sentry.captureException(error);
	});
}

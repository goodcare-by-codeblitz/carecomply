import { NextResponse } from 'next/server';

export type BillingStripeFailureCode =
	| 'stripe_not_configured'
	| 'stripe_portal_session_failed'
	| 'stripe_checkout_session_failed'
	| 'stripe_subscription_update_failed'
	| 'stripe_checkout_sync_failed';

type BillingStripeFallback = {
	code: Exclude<BillingStripeFailureCode, 'stripe_not_configured'>;
	message: string;
};

type BillingStripeFailureOptions = {
	includeDebug?: boolean;
	environment?: string;
};

export type BillingStripeDebug = {
	type?: string;
	code?: string;
	param?: string;
	decline_code?: string;
	requestId?: string;
};

export function getBillingStripeFailure(
	error: unknown,
	fallback: BillingStripeFallback,
	options: BillingStripeFailureOptions = {},
) {
	const debug =
		options.includeDebug && options.environment !== 'production'
			? getSafeStripeErrorDebug(error)
			: undefined;

	if (isStripeConfigurationError(error)) {
		return {
			status: 501,
			body: {
				ok: false,
				code: 'stripe_not_configured' as const,
				message:
					'Stripe billing is not configured. Set STRIPE_SECRET_KEY before using billing actions.',
				...(debug ? { debug } : {}),
			},
		};
	}

	return {
		status: 502,
		body: {
			ok: false,
			code: fallback.code,
			message: fallback.message,
			...(debug ? { debug } : {}),
		},
	};
}

export function billingStripeErrorResponse(
	error: unknown,
	fallback: BillingStripeFallback,
	options?: BillingStripeFailureOptions,
) {
	const failure = getBillingStripeFailure(error, fallback, {
		environment: process.env.NODE_ENV,
		...options,
	});
	return NextResponse.json(failure.body, { status: failure.status });
}

export function getSafeStripeErrorDebug(error: unknown): BillingStripeDebug | null {
	if (!isRecord(error)) return null;

	const raw = isRecord(error.raw) ? error.raw : {};
	const debug = stripUndefined({
		type: getString(error.type) ?? getString(raw.type),
		code: getString(error.code) ?? getString(raw.code),
		param: getString(error.param) ?? getString(raw.param),
		decline_code:
			getString(error.decline_code) ?? getString(raw.decline_code),
		requestId:
			getString(error.requestId) ??
			getString(error.request_id) ??
			getString(raw.requestId) ??
			getString(raw.request_id),
	});

	return Object.keys(debug).length > 0 ? debug : null;
}

function isStripeConfigurationError(error: unknown) {
	if (!(error instanceof Error)) return false;

	const message = error.message.toLowerCase();
	return (
		message.includes('stripe_secret_key') ||
		message.includes('api key') ||
		message.includes('apikey')
	);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

function getString(value: unknown) {
	return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function stripUndefined<T extends Record<string, unknown>>(value: T) {
	return Object.fromEntries(
		Object.entries(value).filter(([, entry]) => entry !== undefined),
	) as Partial<T>;
}

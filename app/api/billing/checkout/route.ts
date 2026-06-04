import {
	getPricingPlan,
	getStripePriceEnvKey,
	getStripePriceId,
	getBillingEntitlements,
	type BillingInterval,
	type BillingPlan,
} from '@/lib/billing';
import { createUserAuditLog } from '@/lib/audit-server';
import {
	blocksNewCheckout,
	canReusePendingCheckout,
	getCheckoutCustomerParams,
	getCheckoutIdempotencyKey,
} from '@/lib/billing-checkout';
import { captureBillingException } from '@/lib/billing-monitoring';
import {
	billingStripeErrorResponse,
	getSafeStripeErrorDebug,
} from '@/lib/billing-stripe-errors';
import { PERMISSIONS } from '@/lib/permissions';
import { getStripe } from '@/lib/stripe';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import type Stripe from 'stripe';

type CheckoutRequest = {
	planId?: BillingPlan;
	interval?: BillingInterval;
	orgSlug?: string;
	orgId?: string;
};

export async function POST(request: Request) {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		return NextResponse.json(
			{ ok: false, message: 'Sign in before starting checkout.' },
			{ status: 401 },
		);
	}

	let payload: CheckoutRequest;

	try {
		payload = (await request.json()) as CheckoutRequest;
	} catch {
		return NextResponse.json(
			{ ok: false, message: 'Invalid checkout request.' },
			{ status: 400 },
		);
	}

	const plan = payload.planId ? getPricingPlan(payload.planId) : null;
	const interval = payload.interval ?? 'monthly';

	if (!plan) {
		return NextResponse.json(
			{ ok: false, message: 'Invalid billing plan.' },
			{ status: 400 },
		);
	}

	if (plan.isEnterprise) {
		return NextResponse.json(
			{ ok: false, message: 'Contact sales for custom pricing.' },
			{ status: 400 },
		);
	}

	if (interval !== 'monthly' && interval !== 'yearly') {
		return NextResponse.json(
			{ ok: false, message: 'Invalid billing interval.' },
			{ status: 400 },
		);
	}

	const priceId = getStripePriceId(plan.id, interval);
	const priceEnvKey = getStripePriceEnvKey(plan.id, interval);

	if (!priceId) {
		return NextResponse.json(
			{
				ok: false,
				message: `Stripe price is not configured for ${plan.name} ${interval}.`,
				stripePriceEnvKey: priceEnvKey,
			},
			{ status: 501 },
		);
	}

	const organization = await resolveOrganization(
		supabase,
		user.id,
		payload.orgId,
		payload.orgSlug,
	);

	if (!organization) {
		return NextResponse.json(
			{ ok: false, message: 'Organization was not found.' },
			{ status: 404 },
		);
	}

	const { data: canManageBilling } = await supabase.rpc('has_org_permission', {
		p_org_id: organization.id,
		p_permission_code: PERMISSIONS.BILLING_MANAGE,
	});

	if (!canManageBilling) {
		return NextResponse.json(
			{ ok: false, message: 'You do not have permission to manage billing.' },
			{ status: 403 },
		);
	}

	const { data: billing } = await supabase
		.from('organization_billing')
		.select('plan, interval, stripe_customer_id, stripe_subscription_id, status, pending_checkout_session_id, pending_checkout_url, pending_checkout_plan, pending_checkout_interval, pending_checkout_expires_at')
		.eq('organization_id', organization.id)
		.maybeSingle();
	const entitlements = getBillingEntitlements(billing?.plan, billing?.status);

	if (
		entitlements.plan === plan.id &&
		(entitlements.status === 'active' || entitlements.status === 'trialing')
	) {
		return NextResponse.json(
			{
				ok: true,
				unchanged: true,
				message: `You already have the ${plan.name} package.`,
			},
			{ status: 200 },
		);
	}

	if (
		blocksNewCheckout({
			stripeSubscriptionId: billing?.stripe_subscription_id,
			status: billing?.status,
		})
	) {
		return NextResponse.json(
			{
				ok: false,
				message:
					'This organization already has a subscription. Change the existing plan instead.',
				useSubscriptionChange: true,
			},
			{ status: 409 },
		);
	}

	const origin = new URL(request.url).origin;
	let stripe: Stripe;
	let pendingSession: Stripe.Checkout.Session | null;
	try {
		stripe = getStripe();
		pendingSession = await getReusablePendingSession({
			stripe,
			sessionId: billing?.pending_checkout_session_id,
			sessionUrl: billing?.pending_checkout_url,
			expiresAt: billing?.pending_checkout_expires_at,
			planId: billing?.pending_checkout_plan,
			interval: billing?.pending_checkout_interval,
			targetPlanId: plan.id,
			targetInterval: interval,
		});
	} catch (error) {
		captureBillingException(error, {
			operation: 'checkout_stripe_initialize',
			organizationId: organization.id,
			extra: { plan: plan.id, interval },
		});
		return billingStripeErrorResponse(error, {
			code: 'stripe_checkout_session_failed',
			message: 'Checkout could not be started.',
		});
	}

	if (pendingSession) {
		await createUserAuditLog({
			action: 'billing.checkout_started',
			entityType: 'billing',
			organizationId: organization.id,
			entityId: organization.id,
			entityName: `${plan.name} ${interval}`,
			details: {
				plan: plan.id,
				plan_name: plan.name,
				interval,
				stripe_checkout_session_id: pendingSession.id,
				stripe_customer_id: billing?.stripe_customer_id ?? null,
				stripe_price_id: priceId,
				permission_checked: PERMISSIONS.BILLING_MANAGE,
				outcome: 'pending_checkout_session_reused',
			},
			request,
		});

		return NextResponse.json({ ok: true, url: pendingSession.url, reused: true });
	}

	const price = await getCheckoutPrice(stripe, priceId);

	if (!price) {
		return NextResponse.json(
			{
				ok: false,
				message: `Stripe price ${priceId} could not be verified.`,
			},
			{ status: 501 },
		);
	}

	if (!price.active || price.type !== 'recurring') {
		return NextResponse.json(
			{
				ok: false,
				message: `Stripe price ${priceId} must be an active recurring price.`,
			},
			{ status: 501 },
		);
	}

	const idempotencyKey = getCheckoutIdempotencyKey({
		organizationId: organization.id,
		plan: plan.id,
		interval,
	});
	let session: Stripe.Checkout.Session;
	try {
		session = await stripe.checkout.sessions.create(
			{
				mode: 'subscription',
				...getCheckoutCustomerParams({
					stripeCustomerId: billing?.stripe_customer_id,
					customerEmail: user.email,
				}),
				client_reference_id: organization.id,
				line_items: [{ price: priceId, quantity: 1 }],
				allow_promotion_codes: true,
				billing_address_collection: 'auto',
				automatic_tax: { enabled: true },
				success_url: `${origin}/${organization.slug}/settings/billing?billing=success&session_id={CHECKOUT_SESSION_ID}`,
				cancel_url: `${origin}/${organization.slug}/settings/billing?billing=cancelled`,
				custom_text: {
					submit: {
						message:
							'CareComply will activate your organization subscription after Stripe confirms payment.',
					},
				},
				metadata: {
					organization_id: organization.id,
					user_id: user.id,
					plan: plan.id,
					interval,
				},
				subscription_data: {
					metadata: {
						organization_id: organization.id,
						user_id: user.id,
						plan: plan.id,
						interval,
					},
				},
			},
			{ idempotencyKey },
		);
	} catch (error) {
		const stripeDebug = getSafeStripeErrorDebug(error);
		captureBillingException(error, {
			operation: 'checkout_session_create',
			organizationId: organization.id,
			extra: { plan: plan.id, interval },
		});
		console.error('[billing-checkout] checkout session create failed', {
			operation: 'checkout_session_create',
			organizationId: organization.id,
			plan: plan.id,
			interval,
			stripe: stripeDebug,
		});
		return billingStripeErrorResponse(
			error,
			{
				code: 'stripe_checkout_session_failed',
				message: 'Checkout could not be started.',
			},
			{
				includeDebug: true,
			},
		);
	}

	const { error: pendingUpdateError } = await supabase
		.from('organization_billing')
		.update({
			pending_checkout_session_id: session.id,
			pending_checkout_url: session.url,
			pending_checkout_plan: plan.id,
			pending_checkout_interval: interval,
			pending_checkout_expires_at: session.expires_at
				? new Date(session.expires_at * 1000).toISOString()
				: null,
		})
		.eq('organization_id', organization.id);

	if (pendingUpdateError) {
		captureBillingException(pendingUpdateError, {
			operation: 'checkout_pending_session_store',
			organizationId: organization.id,
			extra: { stripe_checkout_session_id: session.id },
		});
		console.error('[billing-checkout] pending session could not be stored', {
			organizationId: organization.id,
			error: pendingUpdateError,
		});
	}

	await createUserAuditLog({
		action: 'billing.checkout_started',
		entityType: 'billing',
		organizationId: organization.id,
		entityId: organization.id,
		entityName: `${plan.name} ${interval}`,
		details: {
			plan: plan.id,
			plan_name: plan.name,
			interval,
			stripe_checkout_session_id: session.id,
			stripe_customer_id: billing?.stripe_customer_id ?? null,
			stripe_price_id: priceId,
			permission_checked: PERMISSIONS.BILLING_MANAGE,
			outcome: 'checkout_session_created',
		},
		request,
	});

	return NextResponse.json({ ok: true, url: session.url });
}

async function getCheckoutPrice(stripe: Stripe, priceId: string) {
	try {
		return await stripe.prices.retrieve(priceId);
	} catch {
		return null;
	}
}

async function getReusablePendingSession({
	stripe,
	sessionId,
	sessionUrl,
	expiresAt,
	planId,
	interval,
	targetPlanId,
	targetInterval,
}: {
	stripe: Stripe;
	sessionId?: string | null;
	sessionUrl?: string | null;
	expiresAt?: string | null;
	planId?: string | null;
	interval?: string | null;
	targetPlanId: BillingPlan;
	targetInterval: BillingInterval;
}) {
	if (
		!canReusePendingCheckout(
			{
				sessionId,
				sessionUrl,
				plan: planId,
				interval,
				expiresAt,
			},
			{ plan: targetPlanId, interval: targetInterval },
		)
	) {
		return null;
	}

	if (!sessionId) return null;

	try {
		const session = await stripe.checkout.sessions.retrieve(sessionId);
		if (session.status === 'open' && session.url) return session;
		return null;
	} catch (error) {
		captureBillingException(error, {
			operation: 'checkout_pending_session_retrieve',
			extra: { stripe_checkout_session_id: sessionId },
		});
		return null;
	}
}

async function resolveOrganization(
	supabase: Awaited<ReturnType<typeof createClient>>,
	userId: string,
	orgId?: string,
	orgSlug?: string,
) {
	let query = supabase
		.from('organizations')
		.select('id, slug, organization_memberships!inner(user_id, deleted_at)')
		.eq('organization_memberships.user_id', userId)
		.is('organization_memberships.deleted_at', null);

	if (orgId) {
		query = query.eq('id', orgId);
	} else if (orgSlug) {
		query = query.eq('slug', orgSlug);
	} else {
		return null;
	}

	const { data, error } = await query.maybeSingle();
	if (error || !data) return null;
	return { id: data.id as string, slug: data.slug as string };
}

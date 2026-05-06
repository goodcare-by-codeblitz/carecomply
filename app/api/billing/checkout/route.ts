import {
	getPricingPlan,
	getStripePriceEnvKey,
	getStripePriceId,
	type BillingInterval,
	type BillingPlan,
} from '@/lib/billing';
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
			{ ok: false, message: 'Contact sales for Guardian+ pricing.' },
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
		.select('stripe_customer_id, stripe_subscription_id, status')
		.eq('organization_id', organization.id)
		.maybeSingle();

	if (
		billing?.stripe_subscription_id &&
		billing.status !== 'canceled'
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
	const stripe = getStripe();
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

	const session = await stripe.checkout.sessions.create({
		mode: 'subscription',
		customer: billing?.stripe_customer_id ?? undefined,
		customer_email: billing?.stripe_customer_id ? undefined : user.email,
		client_reference_id: organization.id,
		line_items: [{ price: priceId, quantity: 1 }],
		allow_promotion_codes: true,
		billing_address_collection: 'auto',
		success_url: `${origin}/${organization.slug}/settings?billing=success`,
		cancel_url: `${origin}/${organization.slug}/settings?billing=cancelled`,
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
	});

	console.log('Created Stripe checkout session', session);
	return NextResponse.json({ ok: true, url: session.url });
}

async function getCheckoutPrice(stripe: Stripe, priceId: string) {
	try {
		return await stripe.prices.retrieve(priceId);
	} catch {
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

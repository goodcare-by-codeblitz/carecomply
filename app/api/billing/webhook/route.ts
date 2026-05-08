import {
	getPlanFromStripePriceId,
	type BillingInterval,
	type BillingPlan,
	type BillingStatus,
} from '@/lib/billing';
import { createSystemAuditLog } from '@/lib/audit-server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getStripe } from '@/lib/stripe';
import { NextResponse } from 'next/server';
import type Stripe from 'stripe';

export async function POST(request: Request) {
	const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

	if (!webhookSecret) {
		return NextResponse.json(
			{ ok: false, message: 'STRIPE_WEBHOOK_SECRET is not configured.' },
			{ status: 500 },
		);
	}

	const signature = request.headers.get('stripe-signature');

	if (!signature) {
		return NextResponse.json(
			{ ok: false, message: 'Missing Stripe signature.' },
			{ status: 400 },
		);
	}

	const body = await request.text();
	let event: Stripe.Event;

	try {
		const stripe = getStripe();
		event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
	} catch (error) {
		const message =
			error instanceof Error ? error.message : 'Invalid Stripe webhook.';

		console.error('[stripe-webhook] signature verification failed', {
			message,
		});

		return NextResponse.json(
			{
				ok: false,
				message,
			},
			{ status: message.includes('STRIPE_SECRET_KEY') ? 500 : 400 },
		);
	}

	try {
		console.info('[stripe-webhook] received', {
			eventId: event.id,
			eventType: event.type,
		});

		const supabase = createAdminClient();
		const inserted = await recordStripeEvent(supabase, event);

		if (inserted === 'processed_duplicate') {
			console.info('[stripe-webhook] duplicate already processed', {
				eventId: event.id,
				eventType: event.type,
			});
			return NextResponse.json({ ok: true, duplicate: true });
		}

		switch (event.type) {
			case 'checkout.session.completed':
				await handleCheckoutCompleted(
					supabase,
					event.data.object as Stripe.Checkout.Session,
				);
				break;
			case 'customer.subscription.created':
			case 'customer.subscription.updated':
			case 'customer.subscription.deleted':
				await handleSubscriptionEvent(
					supabase,
					event.data.object as Stripe.Subscription,
				);
				break;
			case 'invoice.payment_failed':
				await handleInvoicePaymentFailed(
					supabase,
					event.data.object as Stripe.Invoice,
				);
				break;
			default:
				break;
		}

		const { error: processedError } = await supabase
			.from('stripe_events')
			.update({ processed_at: new Date().toISOString() })
			.eq('id', event.id);

		if (processedError) {
			console.error('[stripe-webhook] failed to mark event processed', {
				eventId: event.id,
				eventType: event.type,
				error: processedError,
			});
			return NextResponse.json(
				{ ok: false, message: 'Stripe event processed but could not be marked complete.' },
				{ status: 500 },
			);
		}

		return NextResponse.json({ ok: true });
	} catch (error) {
		console.error('[stripe-webhook] processing failed', {
			eventId: event.id,
			eventType: event.type,
			error,
		});

		return NextResponse.json(
			{
				ok: false,
				message:
					error instanceof Error
						? error.message
						: 'Stripe webhook processing failed.',
			},
			{ status: 500 },
		);
	}
}

async function recordStripeEvent(
	supabase: ReturnType<typeof createAdminClient>,
	event: Stripe.Event,
) {
	const { error: eventInsertError } = await supabase.from('stripe_events').insert({
		id: event.id,
		type: event.type,
		payload: event as unknown as Record<string, unknown>,
	});

	if (!eventInsertError) return 'inserted';

	if (eventInsertError.code === '23505') {
		const { data: existingEvent, error: existingEventError } = await supabase
			.from('stripe_events')
			.select('processed_at')
			.eq('id', event.id)
			.maybeSingle();

		if (existingEventError) {
			console.error('[stripe-webhook] failed to read duplicate event', {
				eventId: event.id,
				eventType: event.type,
				error: existingEventError,
			});
			throw existingEventError;
		}

		return existingEvent?.processed_at ? 'processed_duplicate' : 'retry_duplicate';
	}

	console.error('[stripe-webhook] failed to record event', {
		eventId: event.id,
		eventType: event.type,
		error: eventInsertError,
	});
	throw eventInsertError;
}

async function handleCheckoutCompleted(
	supabase: ReturnType<typeof createAdminClient>,
	session: Stripe.Checkout.Session,
) {
	const organizationId = session.metadata?.organization_id;
	if (!organizationId) return;

	const plan = getBillingPlan(session.metadata?.plan);
	const interval = getBillingInterval(session.metadata?.interval);
	const subscriptionId = getStripeId(session.subscription);

	await upsertOrganizationBilling(supabase, organizationId, {
		...(plan ? { plan } : {}),
		...(interval ? { interval } : {}),
		stripe_customer_id: getStripeId(session.customer),
		stripe_subscription_id: subscriptionId,
	});

	if (!subscriptionId) return;

	await createSystemAuditLog({
		action: 'billing.checkout_completed',
		entityType: 'billing',
		organizationId,
		entityId: organizationId,
		entityName: 'Stripe Checkout',
		source: 'stripe_webhook',
		details: {
			stripe_checkout_session_id: session.id,
			stripe_customer_id: getStripeId(session.customer),
			stripe_subscription_id: subscriptionId,
			plan,
			interval,
			outcome: 'checkout_completed',
		},
	});

	const subscription = await getStripe().subscriptions.retrieve(subscriptionId);
	await handleSubscriptionEvent(supabase, subscription);
}

async function handleSubscriptionEvent(
	supabase: ReturnType<typeof createAdminClient>,
	subscription: Stripe.Subscription,
) {
	const sub = subscription as Stripe.Subscription & {
		current_period_start?: number;
		current_period_end?: number;
		trial_start?: number | null;
	};
	const priceId = subscription.items.data[0]?.price.id ?? null;
	const planFromPrice = getPlanFromStripePriceId(priceId);
	const organizationId =
		subscription.metadata?.organization_id ??
		(await findOrganizationIdForSubscription(supabase, subscription));

	if (!organizationId) return;

	const plan = getBillingPlan(subscription.metadata?.plan) ?? planFromPrice?.plan;
	const interval =
		getBillingInterval(subscription.metadata?.interval) ?? planFromPrice?.interval;

	await upsertOrganizationBilling(supabase, organizationId, {
		...(plan ? { plan } : {}),
		...(interval ? { interval } : {}),
		status: mapSubscriptionStatus(subscription.status),
		stripe_customer_id: getStripeId(subscription.customer),
		stripe_subscription_id: subscription.id,
		stripe_price_id: priceId,
		current_period_start: fromStripeTimestamp(sub.current_period_start),
		current_period_end: fromStripeTimestamp(sub.current_period_end),
		trial_start: fromStripeTimestamp(sub.trial_start),
		trial_end: fromStripeTimestamp(subscription.trial_end),
		cancel_at_period_end: subscription.cancel_at_period_end,
	});

	await createSystemAuditLog({
		action: 'billing.subscription_updated',
		entityType: 'billing',
		organizationId,
		entityId: organizationId,
		entityName: subscription.id,
		source: 'stripe_webhook',
		details: {
			stripe_subscription_id: subscription.id,
			stripe_customer_id: getStripeId(subscription.customer),
			stripe_price_id: priceId,
			plan,
			interval,
			status: mapSubscriptionStatus(subscription.status),
			cancel_at_period_end: subscription.cancel_at_period_end,
			current_period_start: fromStripeTimestamp(sub.current_period_start),
			current_period_end: fromStripeTimestamp(sub.current_period_end),
			outcome: 'organization_billing_upserted',
		},
	});
}

async function handleInvoicePaymentFailed(
	supabase: ReturnType<typeof createAdminClient>,
	invoice: Stripe.Invoice,
) {
	const subscriptionId = getStripeId(
		(invoice as Stripe.Invoice & { subscription?: string | Stripe.Subscription })
			.subscription,
	);

	if (!subscriptionId) return;

	const { error } = await supabase
		.from('organization_billing')
		.update({ status: 'past_due' satisfies BillingStatus })
		.eq('stripe_subscription_id', subscriptionId);

	if (error) throw error;

	const { data: billing } = await supabase
		.from('organization_billing')
		.select('organization_id')
		.eq('stripe_subscription_id', subscriptionId)
		.maybeSingle();

	if (billing?.organization_id) {
		await createSystemAuditLog({
			action: 'billing.invoice_payment_failed',
			entityType: 'billing',
			organizationId: billing.organization_id,
			entityId: billing.organization_id,
			entityName: invoice.id ?? subscriptionId,
			source: 'stripe_webhook',
			severity: 'warning',
			details: {
				stripe_invoice_id: invoice.id,
				stripe_subscription_id: subscriptionId,
				amount_due: invoice.amount_due,
				currency: invoice.currency,
				outcome: 'billing_marked_past_due',
			},
		});
	}
}

async function upsertOrganizationBilling(
	supabase: ReturnType<typeof createAdminClient>,
	organizationId: string,
	values: Partial<{
		plan: BillingPlan;
		interval: BillingInterval;
		status: BillingStatus;
		stripe_customer_id: string | null;
		stripe_subscription_id: string | null;
		stripe_price_id: string | null;
		current_period_start: string | null;
		current_period_end: string | null;
		trial_start: string | null;
		trial_end: string | null;
		cancel_at_period_end: boolean;
	}>,
) {
	const { error } = await supabase.from('organization_billing').upsert(
		{
			organization_id: organizationId,
			plan: values.plan ?? 'carecore',
			interval: values.interval ?? 'monthly',
			status: values.status ?? 'trialing',
			...values,
		},
		{ onConflict: 'organization_id' },
	);

	if (error) {
		console.error('[stripe-webhook] failed to upsert organization billing', {
			organizationId,
			error,
		});
		throw error;
	}
}

async function findOrganizationIdForSubscription(
	supabase: ReturnType<typeof createAdminClient>,
	subscription: Stripe.Subscription,
) {
	const { data } = await supabase
		.from('organization_billing')
		.select('organization_id')
		.or(
			`stripe_subscription_id.eq.${subscription.id},stripe_customer_id.eq.${getStripeId(
				subscription.customer,
			)}`,
		)
		.maybeSingle();

	return data?.organization_id as string | undefined;
}

function mapSubscriptionStatus(status: Stripe.Subscription.Status): BillingStatus {
	switch (status) {
		case 'trialing':
			return 'trialing';
		case 'active':
			return 'active';
		case 'past_due':
			return 'past_due';
		case 'canceled':
		case 'unpaid':
			return 'canceled';
		default:
			return 'past_due';
	}
}

function fromStripeTimestamp(timestamp: number | null | undefined) {
	return timestamp ? new Date(timestamp * 1000).toISOString() : null;
}

function getStripeId(value: string | { id: string } | null | undefined) {
	if (!value) return null;
	return typeof value === 'string' ? value : value.id;
}

function getBillingPlan(value: string | null | undefined): BillingPlan | null {
	if (
		value === 'carecore' ||
		value === 'safetrack' ||
		value === 'complipro' ||
		value === 'guardian_plus'
	) {
		return value;
	}

	return null;
}

function getBillingInterval(
	value: string | null | undefined,
): BillingInterval | null {
	if (value === 'monthly' || value === 'yearly') return value;
	return null;
}

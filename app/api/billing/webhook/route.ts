import {
	getPlanFromStripePriceId,
	getPricingPlan,
	isKnownBillingPlan,
	normalizeBillingPlan,
	type BillingInterval,
	type BillingPlan,
	type BillingStatus,
} from '@/lib/billing';
import { createSystemAuditLog } from '@/lib/audit-server';
import { captureBillingException } from '@/lib/billing-monitoring';
import { getPastDueGracePeriodEnd } from '@/lib/billing-state';
import { addNotificationKey } from '@/lib/billing-webhook-state';
import { createAdminClient } from '@/lib/supabase/admin';
import { getStripe } from '@/lib/stripe';
import { renderEmailTemplate } from '@/emails/render';
import {
	PaymentFailed,
	PaymentActionRequired,
	SubscriptionCanceled,
	SubscriptionReceipt,
	TrialEnding,
} from '@/emails';
import { NextResponse } from 'next/server';
import { Resend } from 'resend';
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

	const supabase = createAdminClient();
	try {
		console.info('[stripe-webhook] received', {
			eventId: event.id,
			eventType: event.type,
		});

		const inserted = await claimStripeEvent(supabase, event);

		if (inserted === 'processed_duplicate') {
			console.info('[stripe-webhook] duplicate already processed', {
				eventId: event.id,
				eventType: event.type,
			});
			return NextResponse.json({ ok: true, duplicate: true });
		}

		if (inserted === 'processing_duplicate') {
			console.info('[stripe-webhook] duplicate currently processing', {
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
					event.id,
				);
				break;
			case 'invoice.paid':
				await handleInvoicePaid(
					supabase,
					event.data.object as Stripe.Invoice,
					event.id,
				);
				break;
			case 'invoice.payment_failed':
				await handleInvoicePaymentFailed(
					supabase,
					event.data.object as Stripe.Invoice,
					event.id,
				);
				break;
			case 'invoice.payment_action_required':
				await handlePaymentActionRequired(
					supabase,
					event.data.object as Stripe.Invoice,
					event.id,
				);
				break;
			case 'customer.subscription.trial_will_end':
				await handleTrialWillEnd(
					supabase,
					event.data.object as Stripe.Subscription,
					event.id,
				);
				break;
			default:
				break;
		}

		const { error: processedError } = await supabase
			.from('stripe_events')
			.update({
				processed_at: new Date().toISOString(),
				processing_status: 'processed',
				processing_completed_at: new Date().toISOString(),
				last_error: null,
			})
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
		await supabase
			.from('stripe_events')
			.update({
				processing_status: 'failed',
				failed_at: new Date().toISOString(),
				last_error:
					error instanceof Error ? error.message : 'Stripe webhook processing failed.',
			})
			.eq('id', event.id);
		captureBillingException(error, {
			operation: 'stripe_webhook_process',
			stripeEventId: event.id,
			extra: { eventType: event.type },
		});
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

async function claimStripeEvent(
	supabase: ReturnType<typeof createAdminClient>,
	event: Stripe.Event,
) {
	const { error: eventInsertError } = await supabase.from('stripe_events').insert({
		id: event.id,
		type: event.type,
		payload: event as unknown as Record<string, unknown>,
		processing_status: 'processing',
		processing_started_at: new Date().toISOString(),
		attempt_count: 1,
	});

	if (!eventInsertError) return 'inserted';

	if (eventInsertError.code === '23505') {
		const { data: existingEvent, error: existingEventError } = await supabase
			.from('stripe_events')
			.select('processed_at, processing_status, attempt_count')
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

		if (existingEvent?.processed_at || existingEvent?.processing_status === 'processed') {
			return 'processed_duplicate';
		}

		if (existingEvent?.processing_status === 'processing') {
			return 'processing_duplicate';
		}

		const { error: claimError } = await supabase
			.from('stripe_events')
			.update({
				processing_status: 'processing',
				processing_started_at: new Date().toISOString(),
				attempt_count: (existingEvent?.attempt_count ?? 0) + 1,
				last_error: null,
			})
			.eq('id', event.id)
			.in('processing_status', ['pending', 'failed']);

		if (claimError) throw claimError;
		return 'retry_duplicate';
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
		pending_checkout_session_id: null,
		pending_checkout_url: null,
		pending_checkout_plan: null,
		pending_checkout_interval: null,
		pending_checkout_expires_at: null,
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
	eventId?: string,
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

	const plan = planFromPrice?.plan ?? getBillingPlan(subscription.metadata?.plan);
	const interval =
		planFromPrice?.interval ?? getBillingInterval(subscription.metadata?.interval);

	const mappedStatus = mapSubscriptionStatus(subscription.status);

	await upsertOrganizationBilling(supabase, organizationId, {
		...(plan ? { plan } : {}),
		...(interval ? { interval } : {}),
		status: mappedStatus,
		stripe_customer_id: getStripeId(subscription.customer),
		stripe_subscription_id: subscription.id,
		stripe_price_id: priceId,
		current_period_start: fromStripeTimestamp(sub.current_period_start),
		current_period_end: fromStripeTimestamp(sub.current_period_end),
		trial_start: fromStripeTimestamp(sub.trial_start),
		trial_end: fromStripeTimestamp(subscription.trial_end),
		cancel_at_period_end: subscription.cancel_at_period_end,
		last_billing_state_change_at: new Date().toISOString(),
		...(mappedStatus === 'active' || mappedStatus === 'trialing'
			? { grace_period_ends_at: null }
			: {}),
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
			status: mappedStatus,
			cancel_at_period_end: subscription.cancel_at_period_end,
			current_period_start: fromStripeTimestamp(sub.current_period_start),
			current_period_end: fromStripeTimestamp(sub.current_period_end),
			outcome: 'organization_billing_upserted',
		},
	});

	if (mappedStatus === 'canceled') {
		await handleSubscriptionCanceled(supabase, organizationId, subscription, plan, eventId);
	}
}

async function handleSubscriptionCanceled(
	supabase: ReturnType<typeof createAdminClient>,
	organizationId: string,
	subscription: Stripe.Subscription,
	plan: BillingPlan | null,
	eventId?: string,
) {
	const orgInfo = await getBillingOrgInfo(supabase, organizationId);
	if (!orgInfo || orgInfo.recipients.length === 0) return;

	const priceId = subscription.items.data[0]?.price.id ?? null;
	const planFromPrice = getPlanFromStripePriceId(priceId);
	const planId = planFromPrice?.plan ?? plan;
	const pricingPlan = getPricingPlan(planId);
	const planName = `CareComply ${pricingPlan?.name ?? 'Starter'}`;

	// Use current_period_end as the access end date; fall back to today.
	const accessEndTimestamp =
		(subscription as Stripe.Subscription & { current_period_end?: number }).current_period_end;
	const accessEndDate = accessEndTimestamp
		? formatDate(accessEndTimestamp)
		: formatDate(Math.floor(Date.now() / 1000));

	const notificationKey = `customer.subscription.deleted:${subscription.id}`;
	if (eventId && !(await claimNotificationKey(supabase, eventId, notificationKey))) {
		return;
	}

	for (const recipient of orgInfo.recipients) {
		const html = await renderEmailTemplate(SubscriptionCanceled, {
			organizationName: orgInfo.orgName,
			recipientName: recipient.full_name ?? orgInfo.orgName,
			planName,
			accessEndDate,
			resubscribeUrl: orgInfo.orgBillingUrl,
			supportEmail: orgInfo.supportEmail,
		}).catch((err) => {
			console.error('[stripe-webhook] failed to render SubscriptionCanceled email', err);
			return null;
		});
		if (html) {
			await sendBillingEmail({
				to: recipient.email,
				subject: `Your CareComply subscription for ${orgInfo.orgName} has ended`,
				html,
				fromEmail: orgInfo.supportEmail,
			});
		}
	}
}

async function handleInvoicePaymentFailed(
	supabase: ReturnType<typeof createAdminClient>,
	invoice: Stripe.Invoice,
	eventId: string,
) {
	const subscriptionId = getStripeId(
		(invoice as Stripe.Invoice & { subscription?: string | Stripe.Subscription })
			.subscription,
	);

	if (!subscriptionId) return;

	const { data: existingBilling } = await supabase
		.from('organization_billing')
		.select('grace_period_ends_at')
		.eq('stripe_subscription_id', subscriptionId)
		.maybeSingle();

	const { error } = await supabase
		.from('organization_billing')
		.update({
			status: 'past_due' satisfies BillingStatus,
			grace_period_ends_at:
				existingBilling?.grace_period_ends_at ?? getPastDueGracePeriodEnd(),
			last_billing_state_change_at: new Date().toISOString(),
		})
		.eq('stripe_subscription_id', subscriptionId);

	if (error) throw error;

	const { data: billing } = await supabase
		.from('organization_billing')
		.select('organization_id, plan')
		.eq('stripe_subscription_id', subscriptionId)
		.maybeSingle();

	if (!billing?.organization_id) {
		console.warn('[stripe-webhook] handleInvoicePaymentFailed: no organization found', {
			subscriptionId,
			invoiceId: invoice.id,
		});
		return;
	}

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

	const orgInfo = await getBillingOrgInfo(supabase, billing.organization_id);
	if (!orgInfo) return;

	const inv = invoice as Stripe.Invoice & { next_payment_attempt?: number | null };
	const planName = getPlanDisplayName(billing.plan);
	const amount = formatStripeAmount(invoice.amount_due, invoice.currency);
	const failureDate = formatDate(Math.floor(Date.now() / 1000));
	const nextRetryDate = inv.next_payment_attempt
		? formatDate(inv.next_payment_attempt)
		: undefined;
	const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
	const portalUrl = `${appUrl}/${orgInfo.orgSlug}/settings/billing`;

	const notificationKey = `invoice.payment_failed:${invoice.id ?? subscriptionId}`;
	if (!(await claimNotificationKey(supabase, eventId, notificationKey))) return;

	for (const recipient of orgInfo.recipients) {
		const html = await renderEmailTemplate(PaymentFailed, {
			organizationName: orgInfo.orgName,
			recipientName: recipient.full_name ?? orgInfo.orgName,
			planName,
			amount,
			failureDate,
			nextRetryDate,
			portalUrl,
			supportEmail: orgInfo.supportEmail,
		}).catch((err) => {
			console.error('[stripe-webhook] failed to render PaymentFailed email', err);
			return null;
		});
		if (html) {
			await sendBillingEmail({
				to: recipient.email,
				subject: `Payment failed for ${orgInfo.orgName} — action required`,
				html,
				fromEmail: orgInfo.supportEmail,
			});
		}
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
	grace_period_ends_at: string | null;
	pending_checkout_session_id: string | null;
	pending_checkout_url: string | null;
	pending_checkout_plan: string | null;
	pending_checkout_interval: string | null;
	pending_checkout_expires_at: string | null;
	last_billing_state_change_at: string | null;
	}>,
) {
	const { error } = await supabase.from('organization_billing').upsert(
		{
			organization_id: organizationId,
			plan: values.plan ?? 'starter',
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
		case 'unpaid':
		case 'incomplete':
			return 'past_due';
		case 'canceled':
		case 'incomplete_expired':
			return 'canceled';
		case 'paused':
			return 'not_configured';
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
	return isKnownBillingPlan(value) ? normalizeBillingPlan(value) : null;
}

function getBillingInterval(
	value: string | null | undefined,
): BillingInterval | null {
	if (value === 'monthly' || value === 'yearly') return value;
	return null;
}

// ── New event handlers ────────────────────────────────────────────────────────

async function handleInvoicePaid(
	supabase: ReturnType<typeof createAdminClient>,
	invoice: Stripe.Invoice,
	eventId: string,
) {
	const subscriptionId = getStripeId(
		(invoice as Stripe.Invoice & { subscription?: string | Stripe.Subscription })
			.subscription,
	);
	if (!subscriptionId) return;

	const { data: billing } = await supabase
		.from('organization_billing')
		.select('organization_id, plan')
		.eq('stripe_subscription_id', subscriptionId)
		.maybeSingle();

	if (!billing?.organization_id) return;

	const { error: paidUpdateError } = await supabase
		.from('organization_billing')
		.update({
			status: 'active' satisfies BillingStatus,
			grace_period_ends_at: null,
			last_billing_state_change_at: new Date().toISOString(),
		})
		.eq('stripe_subscription_id', subscriptionId);

	if (paidUpdateError) throw paidUpdateError;

	const orgInfo = await getBillingOrgInfo(supabase, billing.organization_id);
	if (!orgInfo) return;

	const inv = invoice as Stripe.Invoice & {
		period_end?: number;
		next_payment_attempt?: number | null;
	};
	const planName = getPlanDisplayName(billing.plan);
	const amount = formatStripeAmount(invoice.amount_paid, invoice.currency);
	const billingDate = formatDate(Math.floor(Date.now() / 1000));
	const nextBillingDate = inv.period_end ? formatDate(inv.period_end) : 'your next billing date';
	const invoiceUrl = invoice.hosted_invoice_url ?? orgInfo.orgBillingUrl;
	const invoiceNumber = invoice.number ?? invoice.id ?? 'N/A';

	const notificationKey = `invoice.paid:${invoice.id ?? subscriptionId}`;
	if (!(await claimNotificationKey(supabase, eventId, notificationKey))) return;

	for (const recipient of orgInfo.recipients) {
		const html = await renderEmailTemplate(SubscriptionReceipt, {
			organizationName: orgInfo.orgName,
			recipientName: recipient.full_name ?? orgInfo.orgName,
			planName,
			invoiceNumber,
			amount,
			billingDate,
			nextBillingDate,
			invoiceUrl,
			supportEmail: orgInfo.supportEmail,
		}).catch((err) => {
			console.error('[stripe-webhook] failed to render SubscriptionReceipt email', err);
			return null;
		});
		if (html) {
			await sendBillingEmail({
				to: recipient.email,
				subject: `Your CareComply receipt — ${amount}`,
				html,
				fromEmail: orgInfo.supportEmail,
			});
		}
	}
}

async function handleTrialWillEnd(
	supabase: ReturnType<typeof createAdminClient>,
	subscription: Stripe.Subscription,
	eventId: string,
) {
	const organizationId =
		subscription.metadata?.organization_id ??
		(await findOrganizationIdForSubscription(supabase, subscription));
	if (!organizationId) return;

	const orgInfo = await getBillingOrgInfo(supabase, organizationId);
	if (!orgInfo) return;

	const trialEnd = subscription.trial_end;
	if (!trialEnd) return;

	const now = Math.floor(Date.now() / 1000);
	const daysRemaining = Math.max(1, Math.ceil((trialEnd - now) / 86400));
	const trialEndDate = formatDate(trialEnd);

	const priceId = subscription.items.data[0]?.price.id ?? null;
	const planFromPrice = getPlanFromStripePriceId(priceId);
	const planId = planFromPrice?.plan ?? normalizeBillingPlan(subscription.metadata?.plan);
	const pricingPlan = getPricingPlan(planId);
	const planName = `CareComply ${pricingPlan?.name ?? 'Starter'}`;
	const planPrice = pricingPlan?.monthlyPrice ? `£${pricingPlan.monthlyPrice}/month` : 'from £29/month';
	const upgradeUrl = orgInfo.orgBillingUrl;

	const notificationKey = `customer.subscription.trial_will_end:${subscription.id}`;
	if (!(await claimNotificationKey(supabase, eventId, notificationKey))) return;

	for (const recipient of orgInfo.recipients) {
		const html = await renderEmailTemplate(TrialEnding, {
			organizationName: orgInfo.orgName,
			recipientName: recipient.full_name ?? orgInfo.orgName,
			trialEndDate,
			daysRemaining,
			planName,
			planPrice,
			upgradeUrl,
			supportEmail: orgInfo.supportEmail,
		}).catch((err) => {
			console.error('[stripe-webhook] failed to render TrialEnding email', err);
			return null;
		});
		if (html) {
			await sendBillingEmail({
				to: recipient.email,
				subject: `Your CareComply trial ends in ${daysRemaining} day${daysRemaining === 1 ? '' : 's'}`,
				html,
				fromEmail: orgInfo.supportEmail,
			});
		}
	}
}

async function handlePaymentActionRequired(
	supabase: ReturnType<typeof createAdminClient>,
	invoice: Stripe.Invoice,
	eventId: string,
) {
	const hostedInvoiceUrl = invoice.hosted_invoice_url;
	if (!hostedInvoiceUrl) return;

	const subscriptionId = getStripeId(
		(invoice as Stripe.Invoice & { subscription?: string | Stripe.Subscription })
			.subscription,
	);
	if (!subscriptionId) return;

	const { data: billing } = await supabase
		.from('organization_billing')
		.select('organization_id, plan')
		.eq('stripe_subscription_id', subscriptionId)
		.maybeSingle();

	if (!billing?.organization_id) return;

	const orgInfo = await getBillingOrgInfo(supabase, billing.organization_id);
	if (!orgInfo) return;

	const planName = getPlanDisplayName(billing.plan);
	const amount = formatStripeAmount(invoice.amount_due, invoice.currency);

	const notificationKey = `invoice.payment_action_required:${invoice.id ?? subscriptionId}`;
	if (!(await claimNotificationKey(supabase, eventId, notificationKey))) return;

	for (const recipient of orgInfo.recipients) {
		const html = await renderEmailTemplate(PaymentActionRequired, {
			organizationName: orgInfo.orgName,
			recipientName: recipient.full_name ?? orgInfo.orgName,
			planName,
			amount,
			actionUrl: hostedInvoiceUrl,
			supportEmail: orgInfo.supportEmail,
		}).catch((err) => {
			console.error('[stripe-webhook] failed to render PaymentActionRequired email', err);
			return null;
		});
		if (html) {
			await sendBillingEmail({
				to: recipient.email,
				subject: `Action required — verify your ${amount} payment for ${orgInfo.orgName}`,
				html,
				fromEmail: orgInfo.supportEmail,
			});
		}
	}
}

async function claimNotificationKey(
	supabase: ReturnType<typeof createAdminClient>,
	eventId: string,
	key: string,
) {
	const { data, error } = await supabase
		.from('stripe_events')
		.select('notification_keys')
		.eq('id', eventId)
		.maybeSingle();

	if (error) throw error;
	const keys = (data?.notification_keys ?? []) as string[];
	const next = addNotificationKey(keys, key);
	if (!next.added) return false;

	const { error: updateError } = await supabase
		.from('stripe_events')
		.update({ notification_keys: next.keys })
		.eq('id', eventId);

	if (updateError) throw updateError;
	return true;
}

// ── Billing email helpers ─────────────────────────────────────────────────────

type BillingRecipient = { email: string; full_name: string | null };

type BillingOrgInfo = {
	orgName: string;
	orgSlug: string;
	orgBillingUrl: string;
	supportEmail: string;
	recipients: BillingRecipient[];
};

async function getBillingOrgInfo(
	supabase: ReturnType<typeof createAdminClient>,
	organizationId: string,
): Promise<BillingOrgInfo | null> {
	const { data: org } = await supabase
		.from('organizations')
		.select('name, slug')
		.eq('id', organizationId)
		.maybeSingle();

	if (!org) return null;

	const { data: memberships } = await supabase
		.from('organization_memberships')
		.select('user_id, roles!inner(name)')
		.eq('organization_id', organizationId)
		.is('deleted_at', null)
		.eq('status', 'active');

	const adminUserIds = Array.from(
		new Set(
			((memberships ?? []) as { user_id: string | null; roles: { name: string } | { name: string }[] | null }[])
				.filter((m) => {
					const role = Array.isArray(m.roles) ? m.roles[0] : m.roles;
					const name = role?.name?.toLowerCase();
					return name === 'admin' || name === 'manager';
				})
				.map((m) => m.user_id)
				.filter((id): id is string => Boolean(id)),
		),
	);

	const recipients: BillingRecipient[] = [];

	if (adminUserIds.length > 0) {
		const { data: profiles } = await supabase
			.from('profiles')
			.select('email, full_name')
			.in('id', adminUserIds);

		for (const p of profiles ?? []) {
			if (p.email) recipients.push({ email: p.email, full_name: p.full_name ?? null });
		}
	}

	const supportEmail = process.env.RESEND_FROM_EMAIL ?? 'support@carecomply.co.uk';
	const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';

	return {
		orgName: org.name,
		orgSlug: org.slug,
		orgBillingUrl: `${appUrl}/${org.slug}/settings/billing`,
		supportEmail,
		recipients,
	};
}

async function sendBillingEmail({
	to,
	subject,
	html,
	fromEmail,
}: {
	to: string;
	subject: string;
	html: string;
	fromEmail: string;
}) {
	const apiKey = process.env.RESEND_API_KEY;
	if (!apiKey) {
		console.warn('[stripe-webhook] RESEND_API_KEY not set, skipping billing email', { to, subject });
		return;
	}
	const resend = new Resend(apiKey);
	const { error } = await resend.emails.send({
		from: `CareComply <${fromEmail}>`,
		to,
		subject,
		html,
	});
	if (error) {
		console.error('[stripe-webhook] failed to send billing email', { to, subject, error });
	}
}

// ── Formatting helpers ────────────────────────────────────────────────────────

function formatStripeAmount(amount: number, currency: string): string {
	const pounds = (amount / 100).toFixed(2);
	const symbol = currency.toUpperCase() === 'GBP' ? '£' : `${currency.toUpperCase()} `;
	return `${symbol}${pounds}`;
}

function formatDate(unixSeconds: number): string {
	return new Intl.DateTimeFormat('en-GB', {
		day: 'numeric',
		month: 'long',
		year: 'numeric',
	}).format(new Date(unixSeconds * 1000));
}

function getPlanDisplayName(plan: string | null | undefined): string {
	const planId = normalizeBillingPlan(plan);
	const pricingPlan = getPricingPlan(planId);
	return `CareComply ${pricingPlan?.name ?? 'Starter'}`;
}

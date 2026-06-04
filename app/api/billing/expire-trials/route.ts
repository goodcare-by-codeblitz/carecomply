import { createAdminClient } from '@/lib/supabase/admin';
import { createSystemAuditLog } from '@/lib/audit-server';
import { renderEmailTemplate } from '@/emails/render';
import { TrialEnding } from '@/emails';
import { getPricingPlan, normalizeBillingPlan } from '@/lib/billing';
import { NextResponse } from 'next/server';
import { Resend } from 'resend';

type ExpiredOrg = {
	organization_id: string;
	plan: string | null;
	trial_end: string | null;
};

export async function POST(request: Request) {
	const configuredSecret =
		process.env.BILLING_WORKER_SECRET ?? process.env.REMINDER_WORKER_SECRET;
	const authorization = request.headers.get('authorization') ?? '';
	const providedSecret = authorization.startsWith('Bearer ')
		? authorization.slice('Bearer '.length)
		: request.headers.get('x-billing-worker-secret');

	if (!configuredSecret || providedSecret !== configuredSecret) {
		return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
	}

	const admin = createAdminClient();

	// Find all trials that have expired with no Stripe subscription linked.
	const { data: expired, error: queryError } = await admin
		.from('organization_billing')
		.select('organization_id, plan, trial_end')
		.eq('status', 'trialing')
		.lt('trial_end', new Date().toISOString())
		.is('stripe_subscription_id', null);

	if (queryError) {
		console.error('[expire-trials] failed to query expired trials', queryError);
		return NextResponse.json({ ok: false, error: queryError.message }, { status: 500 });
	}

	const expiredOrgs = (expired ?? []) as ExpiredOrg[];

	if (expiredOrgs.length === 0) {
		return NextResponse.json({ ok: true, expired: 0 });
	}

	const orgIds = expiredOrgs.map((o) => o.organization_id);

	// Expire them all in one update.
	const { error: updateError } = await admin
		.from('organization_billing')
		.update({
			status: 'not_configured',
			last_billing_state_change_at: new Date().toISOString(),
		})
		.in('organization_id', orgIds);

	if (updateError) {
		console.error('[expire-trials] failed to update expired trials', updateError);
		return NextResponse.json({ ok: false, error: updateError.message }, { status: 500 });
	}

	console.info('[expire-trials] expired trials', { count: expiredOrgs.length, orgIds });

	await Promise.allSettled(
		expiredOrgs.map((org) =>
			createSystemAuditLog({
				action: 'billing.subscription_updated',
				entityType: 'billing',
				organizationId: org.organization_id,
				entityId: org.organization_id,
				entityName: 'Trial expired',
				source: 'system',
				severity: 'warning',
				details: {
					plan: org.plan,
					trial_end: org.trial_end,
					before: { status: 'trialing' },
					after: { status: 'not_configured' },
					outcome: 'trial_expired_without_subscription',
				},
				request,
			}),
		),
	);

	// Send TrialEnding email to each org's admins.
	const emailResults = await Promise.allSettled(
		expiredOrgs.map((org) => sendTrialExpiredEmail(admin, org)),
	);

	const emailErrors = emailResults.filter((r) => r.status === 'rejected').length;
	if (emailErrors > 0) {
		console.error('[expire-trials] some trial expiry emails failed', { emailErrors });
	}

	return NextResponse.json({ ok: true, expired: expiredOrgs.length, emailErrors });
}

async function sendTrialExpiredEmail(
	admin: ReturnType<typeof createAdminClient>,
	org: ExpiredOrg,
) {
	const { data: orgData } = await admin
		.from('organizations')
		.select('name, slug')
		.eq('id', org.organization_id)
		.maybeSingle();

	if (!orgData) return;

	const { data: memberships } = await admin
		.from('organization_memberships')
		.select('user_id, roles!inner(name)')
		.eq('organization_id', org.organization_id)
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

	if (adminUserIds.length === 0) return;

	const { data: profiles } = await admin
		.from('profiles')
		.select('email, full_name')
		.in('id', adminUserIds);

	const recipients = (profiles ?? []).filter((p) => p.email);
	if (recipients.length === 0) return;

	const planId = normalizeBillingPlan(org.plan);
	const pricingPlan = getPricingPlan(planId);
	const planName = `CareComply ${pricingPlan?.name ?? 'Starter'}`;
	const planPrice = pricingPlan?.monthlyPrice ? `£${pricingPlan.monthlyPrice}/month` : 'from £29/month';

	const trialEndDate = org.trial_end
		? new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).format(
				new Date(org.trial_end),
			)
		: 'today';

	const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
	const upgradeUrl = `${appUrl}/${orgData.slug}/settings/billing`;
	const supportEmail = process.env.RESEND_FROM_EMAIL ?? 'support@carecomply.co.uk';
	const apiKey = process.env.RESEND_API_KEY;

	if (!apiKey) {
		console.warn('[expire-trials] RESEND_API_KEY not set, skipping email', {
			orgId: org.organization_id,
		});
		return;
	}

	const resend = new Resend(apiKey);

	for (const recipient of recipients) {
		const html = await renderEmailTemplate(TrialEnding, {
			organizationName: orgData.name,
			recipientName: recipient.full_name ?? orgData.name,
			trialEndDate,
			daysRemaining: 0,
			planName,
			planPrice,
			upgradeUrl,
			supportEmail,
		}).catch((err) => {
			console.error('[expire-trials] failed to render TrialEnding email', err);
			return null;
		});

		if (!html) continue;

		const { error } = await resend.emails.send({
			from: `CareComply <${supportEmail}>`,
			to: recipient.email,
			subject: `Your CareComply trial for ${orgData.name} has ended`,
			html,
		});

		if (error) {
			console.error('[expire-trials] failed to send email', {
				orgId: org.organization_id,
				to: recipient.email,
				error,
			});
		}
	}
}

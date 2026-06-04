import { PERMISSIONS } from '@/lib/permissions';
import { createUserAuditLog } from '@/lib/audit-server';
import { captureBillingException } from '@/lib/billing-monitoring';
import { billingStripeErrorResponse } from '@/lib/billing-stripe-errors';
import { createClient } from '@/lib/supabase/server';
import { getStripe } from '@/lib/stripe';
import { NextResponse } from 'next/server';

type PortalRequest = {
	orgId?: string;
	orgSlug?: string;
};

export async function POST(request: Request) {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		return NextResponse.json(
			{ ok: false, message: 'Sign in before opening the billing portal.' },
			{ status: 401 },
		);
	}

	let payload: PortalRequest;

	try {
		payload = (await request.json()) as PortalRequest;
	} catch {
		return NextResponse.json(
			{ ok: false, message: 'Invalid billing portal request.' },
			{ status: 400 },
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
		.select('stripe_customer_id')
		.eq('organization_id', organization.id)
		.maybeSingle();

	if (!billing?.stripe_customer_id) {
		return NextResponse.json(
			{ ok: false, message: 'No Stripe customer exists for this organization yet.' },
			{ status: 404 },
		);
	}

	const portalConfigId = process.env.STRIPE_BILLING_PORTAL_CONFIGURATION_ID;
	if (!portalConfigId) {
		return NextResponse.json(
			{
				ok: false,
				code: 'stripe_not_configured',
				message:
					'Billing portal is not configured. Set STRIPE_BILLING_PORTAL_CONFIGURATION_ID.',
			},
			{ status: 501 },
		);
	}

	const origin = new URL(request.url).origin;
	let session;
	try {
		const stripe = getStripe();
		session = await stripe.billingPortal.sessions.create({
			customer: billing.stripe_customer_id,
			configuration: portalConfigId,
			return_url: `${origin}/${organization.slug}/settings/billing`,
		});
	} catch (error) {
		captureBillingException(error, {
			operation: 'billing_portal_session_create',
			organizationId: organization.id,
			extra: { stripe_customer_id: billing.stripe_customer_id },
		});
		return billingStripeErrorResponse(error, {
			code: 'stripe_portal_session_failed',
			message: 'Billing portal could not be opened.',
		});
	}

	await createUserAuditLog({
		action: 'billing.portal_opened',
		entityType: 'billing',
		organizationId: organization.id,
		entityId: organization.id,
		entityName: 'Stripe Billing Portal',
		details: {
			stripe_customer_id: billing.stripe_customer_id,
			stripe_billing_portal_session_id: session.id,
			permission_checked: PERMISSIONS.BILLING_MANAGE,
			outcome: 'billing_portal_session_created',
		},
		request,
	});

	return NextResponse.json({ ok: true, url: session.url });
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

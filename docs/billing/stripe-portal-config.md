# Stripe Portal Configuration

CareComply relies on code-level authorization before opening Stripe Customer
Portal sessions, but Stripe Dashboard configuration still controls what users
can do once they are inside the portal.

## Required Portal Settings

- Enable payment method updates.
- Enable invoice history.
- Restrict product and price switching to CareComply Starter and Pro monthly or
  yearly prices only.
- Do not expose archived, test, legacy, or internal prices.
- Cancellation should be end-of-period unless a platform admin explicitly
  chooses immediate cancellation in Stripe.
- Portal return URL must point back to `/{orgSlug}/settings/billing`.
- Tax must remain controlled by Stripe Tax or the configured Stripe tax behavior;
  do not collect healthcare, document, reference, or carer compliance content in
  Stripe metadata.

## Operational Checks

- Verify `STRIPE_BILLING_PORTAL_CONFIGURATION_ID` points to the production
  configuration.
- Confirm all prices are GBP recurring Prices, not legacy Plans.
- Confirm monthly and yearly prices map to the environment variables used by
  `lib/billing.ts`.
- Confirm subscription updates and cancellations emit webhooks consumed by
  `/api/billing/webhook`.
- Confirm failed payments and payment action required events are enabled.

## Data Minimisation

Stripe metadata should contain only organization id, user id, billing plan, and
interval. Never send care records, documents, reference answers, clinical notes,
or compliance evidence to Stripe.

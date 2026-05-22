# CareComply docs coming soon

- This repository will contain the documentation for CareComply. We are currently in the process of creating the documentation, and it will be available soon. Please check back later for updates.

## Platform admin bootstrap

The first platform super admin is provisioned from server environment variables, not from committed seed credentials:

- `PLATFORM_SUPER_ADMIN_EMAIL`
- `PLATFORM_SUPER_ADMIN_PASSWORD`
- `PLATFORM_SUPER_ADMIN_NAME` optional

When the configured email logs in, the app creates or promotes that auth user, confirms the email, assigns the `platform_super_admin` role, and sends platform-only admins to `/admin/reminders`.

## Reminder worker configuration

Document expiry reminders are enqueued by Supabase `pg_cron` and delivered by the protected Next.js worker at `/api/reminders/worker`.

Required app environment variables:

- `REMINDER_WORKER_SECRET`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `NEXT_PUBLIC_APP_URL`

Required worker settings for `pg_cron` to call the worker are managed from the platform admin reminder dashboard. Local Supabase should use `http://host.docker.internal:3000/api/reminders/worker` as the worker URL because Postgres runs in Docker. Production reminder delivery needs a public deployed URL.

The legacy `app.reminder_worker_url` and `app.reminder_worker_secret` database settings are still read as a fallback, but new setup should use the dashboard-managed platform settings table.

## Reference chasing

Reference requests are queued and delivered by CareComply, not n8n. Referees receive token-protected links at `/reference/[token]`, and unanswered references are chased after 3, 7, and 14 days. The protected worker endpoint is `/api/references/worker` and requires `REFERENCE_WORKER_SECRET`.

Starter fixed reminders are intentionally sent only 30 days before expiry, 7 days before expiry, and on the expiry day. A 15 or 14 day reminder requires a Pro custom automation rule.

Authenticated users with audit or automation access can check delivery health with:

```text
/api/reminders/diagnostics?orgId=<organization-id>
```

Stripe pricing now uses:

- `STRIPE_PRICE_STARTER_MONTHLY`
- `STRIPE_PRICE_STARTER_YEARLY`
- `STRIPE_PRICE_PRO_MONTHLY`
- `STRIPE_PRICE_PRO_YEARLY`

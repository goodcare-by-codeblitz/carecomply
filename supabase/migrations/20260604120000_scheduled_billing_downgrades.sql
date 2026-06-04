alter table public.organization_billing
  add column if not exists scheduled_plan text,
  add column if not exists scheduled_interval text,
  add column if not exists scheduled_effective_at timestamptz,
  add column if not exists stripe_subscription_schedule_id text;

alter table public.organization_billing
  drop constraint if exists organization_billing_scheduled_plan_check,
  add constraint organization_billing_scheduled_plan_check
    check (scheduled_plan is null or scheduled_plan in ('starter', 'pro'));

alter table public.organization_billing
  drop constraint if exists organization_billing_scheduled_interval_check,
  add constraint organization_billing_scheduled_interval_check
    check (scheduled_interval is null or scheduled_interval in ('monthly', 'yearly'));

create index if not exists idx_organization_billing_subscription_schedule
on public.organization_billing (stripe_subscription_schedule_id)
where stripe_subscription_schedule_id is not null;

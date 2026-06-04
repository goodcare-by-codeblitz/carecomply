alter table public.organization_billing
  add column if not exists grace_period_ends_at timestamptz,
  add column if not exists pending_checkout_session_id text,
  add column if not exists pending_checkout_url text,
  add column if not exists pending_checkout_plan text,
  add column if not exists pending_checkout_interval text,
  add column if not exists pending_checkout_expires_at timestamptz,
  add column if not exists last_billing_state_change_at timestamptz;

alter table public.organization_billing
  drop constraint if exists organization_billing_pending_checkout_plan_check,
  add constraint organization_billing_pending_checkout_plan_check
    check (pending_checkout_plan is null or pending_checkout_plan in ('starter', 'pro'));

alter table public.organization_billing
  drop constraint if exists organization_billing_pending_checkout_interval_check,
  add constraint organization_billing_pending_checkout_interval_check
    check (pending_checkout_interval is null or pending_checkout_interval in ('monthly', 'yearly'));

create index if not exists idx_organization_billing_pending_checkout
on public.organization_billing (pending_checkout_session_id)
where pending_checkout_session_id is not null;

alter table public.stripe_events
  add column if not exists processing_status text not null default 'pending',
  add column if not exists processing_started_at timestamptz,
  add column if not exists processing_completed_at timestamptz,
  add column if not exists failed_at timestamptz,
  add column if not exists attempt_count integer not null default 0,
  add column if not exists last_error text,
  add column if not exists notification_keys text[] not null default '{}';

update public.stripe_events
set processing_status = case
  when processed_at is not null then 'processed'
  else processing_status
end;

alter table public.stripe_events
  drop constraint if exists stripe_events_processing_status_check,
  add constraint stripe_events_processing_status_check
    check (processing_status in ('pending', 'processing', 'processed', 'failed'));

create index if not exists idx_stripe_events_processing_status
on public.stripe_events (processing_status, received_at);

create table if not exists public.organization_usage_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  active_carers integer not null,
  snapshot_date date not null,
  created_at timestamptz not null default now(),
  constraint organization_usage_snapshots_active_carers_check check (active_carers >= 0),
  constraint organization_usage_snapshots_unique unique (organization_id, snapshot_date)
);

alter table public.organization_usage_snapshots enable row level security;

drop policy if exists "Billing and audit viewers can view usage snapshots"
on public.organization_usage_snapshots;
create policy "Billing and audit viewers can view usage snapshots"
on public.organization_usage_snapshots
for select
to authenticated
using (
  public.has_org_permission(organization_id, 'billing.view')
  or public.has_org_permission(organization_id, 'billing.manage')
  or public.has_org_permission(organization_id, 'audit.view')
);

grant select on table public.organization_usage_snapshots to authenticated;
grant select, insert, update, delete on table public.organization_usage_snapshots to service_role;

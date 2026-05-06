set check_function_bodies = on;

alter table if exists public.organizations
add column if not exists logo_url text;

alter table if exists public.organizations
add column if not exists logo_path text;

create table if not exists public.organization_billing (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  plan text not null default 'carecore',
  interval text not null default 'monthly',
  status text not null default 'trialing',
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  stripe_price_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  trial_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organization_billing_plan_check check (
    plan in ('carecore', 'safetrack', 'complipro', 'guardian_plus')
  ),
  constraint organization_billing_interval_check check (
    interval in ('monthly', 'yearly')
  ),
  constraint organization_billing_status_check check (
    status in ('not_configured', 'trialing', 'active', 'past_due', 'canceled')
  )
);

create table if not exists public.stripe_events (
  id text primary key,
  type text not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  payload jsonb not null
);

alter table public.organization_billing enable row level security;
alter table public.stripe_events enable row level security;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

create or replace function public.create_org_roles(org_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  admin_role_id uuid;
  manager_role_id uuid;
  viewer_role_id uuid;
begin
  insert into public.roles (organization_id, name, scope, is_system_role, description)
  values
    (org_id, 'admin', 'ORGANIZATION', true, 'Full org control'),
    (org_id, 'manager', 'ORGANIZATION', true, 'Manage operations'),
    (org_id, 'viewer', 'ORGANIZATION', true, 'Read only')
  on conflict (organization_id, name) do nothing;

  select id into admin_role_id
  from public.roles
  where organization_id = org_id
    and name = 'admin';

  select id into manager_role_id
  from public.roles
  where organization_id = org_id
    and name = 'manager';

  select id into viewer_role_id
  from public.roles
  where organization_id = org_id
    and name = 'viewer';

  insert into public.role_permissions (role_id, permission_id)
  select admin_role_id, id
  from public.permissions
  on conflict (role_id, permission_id) do nothing;

  insert into public.role_permissions (role_id, permission_id)
  select manager_role_id, id
  from public.permissions
  where code in ('carers.view', 'carers.create', 'documents.view')
  on conflict (role_id, permission_id) do nothing;

  insert into public.role_permissions (role_id, permission_id)
  select viewer_role_id, id
  from public.permissions
  where code in ('carers.view', 'documents.view')
  on conflict (role_id, permission_id) do nothing;
end;
$function$;

drop function if exists public.create_organization_with_roles(uuid, text, text);

create or replace function public.create_organization_with_roles(
  p_user_id uuid,
  org_name text,
  org_slug text,
  p_billing_plan text default 'carecore',
  p_billing_interval text default 'monthly'
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  org_id uuid;
  admin_role_id uuid;
  billing_plan text;
  billing_interval text;
begin
  billing_plan := coalesce(nullif(p_billing_plan, ''), 'carecore');
  billing_interval := coalesce(nullif(p_billing_interval, ''), 'monthly');

  if billing_plan not in ('carecore', 'safetrack', 'complipro', 'guardian_plus') then
    raise exception 'Invalid billing plan: %', billing_plan;
  end if;

  if billing_interval not in ('monthly', 'yearly') then
    raise exception 'Invalid billing interval: %', billing_interval;
  end if;

  insert into public.organizations (name, slug)
  values (org_name, org_slug)
  returning id into org_id;

  perform public.create_org_roles(org_id);

  select id into admin_role_id
  from public.roles
  where organization_id = org_id
    and name = 'admin';

  insert into public.organization_memberships (user_id, organization_id, role_id)
  values (p_user_id, org_id, admin_role_id)
  on conflict (user_id, organization_id) do nothing;

  insert into public.organization_billing (organization_id, plan, interval, status)
  values (org_id, billing_plan, billing_interval, 'trialing')
  on conflict (organization_id) do update
  set plan = excluded.plan,
      interval = excluded.interval,
      status = excluded.status;
end;
$function$;

create or replace function public.has_org_permission(
  p_org_id uuid,
  p_permission_code text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $function$
  select exists (
    select 1
    from public.organization_memberships om
    join public.roles r on r.id = om.role_id
    join public.role_permissions rp on rp.role_id = r.id
    join public.permissions p on p.id = rp.permission_id
    where om.user_id = auth.uid()
      and om.organization_id = p_org_id
      and r.organization_id = p_org_id
      and p.code = p_permission_code
  );
$function$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), new.email),
    new.email
  )
  on conflict (id) do nothing;

  return new;
end;
$function$;

drop trigger if exists set_organization_billing_updated_at on public.organization_billing;
create trigger set_organization_billing_updated_at
before update on public.organization_billing
for each row
execute function public.set_updated_at();

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

drop policy if exists "Members can view organization billing" on public.organization_billing;
create policy "Members can view organization billing"
on public.organization_billing
for select
to authenticated
using (
  public.has_org_permission(organization_id, 'billing.view')
  or public.has_org_permission(organization_id, 'billing.manage')
);

grant select on table public.organization_billing to authenticated;
grant select, insert, update, delete on table public.organization_billing to service_role;
grant select, insert, update, delete on table public.stripe_events to service_role;

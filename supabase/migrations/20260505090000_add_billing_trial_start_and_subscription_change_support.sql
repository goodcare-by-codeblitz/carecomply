set check_function_bodies = on;

alter table if exists public.organization_billing
add column if not exists trial_start timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'organizations_slug_format_check'
      and conrelid = 'public.organizations'::regclass
  ) then
    alter table public.organizations
    add constraint organizations_slug_format_check
    check (slug ~ '^[a-z]+(-[a-z]+)*$') not valid;
  end if;
end $$;

update public.organization_billing
set trial_start = coalesce(trial_start, created_at),
    trial_end = coalesce(trial_end, created_at + interval '14 days')
where status = 'trialing'
  and stripe_subscription_id is null;

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

  insert into public.organization_billing (
    organization_id,
    plan,
    interval,
    status,
    trial_start,
    trial_end
  )
  values (
    org_id,
    billing_plan,
    billing_interval,
    'trialing',
    now(),
    now() + interval '14 days'
  )
  on conflict (organization_id) do update
  set plan = excluded.plan,
      interval = excluded.interval,
      status = excluded.status,
      trial_start = excluded.trial_start,
      trial_end = excluded.trial_end;
end;
$function$;

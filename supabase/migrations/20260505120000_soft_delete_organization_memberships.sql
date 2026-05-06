alter table public.organization_memberships
add column if not exists updated_at timestamptz;

alter table public.organization_memberships
add column if not exists deleted_at timestamptz;

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
      and om.deleted_at is null
      and r.organization_id = p_org_id
      and p.code = p_permission_code
  );
$function$;

create or replace function public.is_org_member(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $function$
  select exists (
    select 1
    from public.organization_memberships om
    where om.user_id = auth.uid()
      and om.organization_id = p_org_id
      and om.deleted_at is null
  );
$function$;

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
  on conflict (user_id, organization_id) do update
  set role_id = excluded.role_id,
      deleted_at = null,
      updated_at = now();

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

drop policy if exists "Users can view own memberships" on public.organization_memberships;
create policy "Users can view own memberships"
on public.organization_memberships
for select
to authenticated
using (
  user_id = auth.uid()
  and deleted_at is null
);

drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile"
on public.profiles
for select
to authenticated
using (id = auth.uid());

drop policy if exists "Team viewers can view active organization memberships" on public.organization_memberships;
create policy "Team viewers can view active organization memberships"
on public.organization_memberships
for select
to authenticated
using (
  deleted_at is null
  and public.has_org_permission(organization_id, 'team.view')
);

drop policy if exists "Team viewers can view active teammate profiles" on public.profiles;
create policy "Team viewers can view active teammate profiles"
on public.profiles
for select
to authenticated
using (
  deleted_at is null
  and exists (
    select 1
    from public.organization_memberships target_membership
    where target_membership.user_id = profiles.id
      and target_membership.deleted_at is null
      and public.has_org_permission(target_membership.organization_id, 'team.view')
  )
);

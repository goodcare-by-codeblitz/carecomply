alter table public.carers
add column if not exists previous_status text;

alter table public.carers
drop constraint if exists carers_status_check;

alter table public.carers
add constraint carers_status_check check (
  status in ('pending', 'active', 'expired', 'incomplete', 'on_leave', 'suspended', 'former')
);

alter table public.organization_memberships
add column if not exists status text not null default 'active';

alter table public.organization_memberships
add column if not exists previous_status text;

alter table public.organization_memberships
add column if not exists status_changed_at timestamptz;

alter table public.organization_memberships
add column if not exists status_changed_by uuid references auth.users(id) on delete set null;

alter table public.organization_memberships
add column if not exists former_at timestamptz;

alter table public.organization_memberships
drop constraint if exists organization_memberships_status_check;

alter table public.organization_memberships
add constraint organization_memberships_status_check check (
  status in ('active', 'on_leave', 'suspended', 'former')
);

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
      and coalesce(om.status, 'active') in ('active', 'on_leave')
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
      and coalesce(om.status, 'active') in ('active', 'on_leave')
  );
$function$;

drop policy if exists "Users can view own memberships" on public.organization_memberships;
create policy "Users can view own memberships"
on public.organization_memberships
for select
to authenticated
using (
  user_id = auth.uid()
  and deleted_at is null
  and coalesce(status, 'active') in ('active', 'on_leave')
);

notify pgrst, 'reload schema';

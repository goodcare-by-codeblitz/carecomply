set check_function_bodies = on;

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
  );
$function$;

drop policy if exists "Authenticated users can view permissions" on public.permissions;
create policy "Authenticated users can view permissions"
on public.permissions
for select
to authenticated
using (true);

drop policy if exists "Users can view own memberships" on public.organization_memberships;
create policy "Users can view own memberships"
on public.organization_memberships
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Members can view organizations" on public.organizations;
create policy "Members can view organizations"
on public.organizations
for select
to authenticated
using (public.is_org_member(id));

drop policy if exists "Members can view organization roles" on public.roles;
create policy "Members can view organization roles"
on public.roles
for select
to authenticated
using (
  organization_id is not null
  and public.is_org_member(organization_id)
);

drop policy if exists "Members can view organization role permissions" on public.role_permissions;
create policy "Members can view organization role permissions"
on public.role_permissions
for select
to authenticated
using (
  exists (
    select 1
    from public.roles r
    where r.id = role_permissions.role_id
      and r.organization_id is not null
      and public.is_org_member(r.organization_id)
  )
);

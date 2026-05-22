create table if not exists public.platform_memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  constraint platform_memberships_unique_user unique (user_id)
);

with ranked_platform_roles as (
  select
    id,
    name,
    row_number() over (
      partition by name
      order by created_at asc nulls last, id asc
    ) as rank
  from public.roles
  where organization_id is null
    and scope = 'PLATFORM'
    and name in ('platform_super_admin', 'platform_admin', 'support')
)
delete from public.roles r
using ranked_platform_roles ranked
where r.id = ranked.id
  and ranked.rank > 1;

create unique index if not exists roles_unique_platform_name
on public.roles (name)
where organization_id is null
  and scope = 'PLATFORM';

insert into public.roles (organization_id, name, scope, is_system_role, description)
values
  (null, 'platform_super_admin', 'PLATFORM', true, 'Full platform control. Can manage all tenants, billing, and system settings.'),
  (null, 'platform_admin', 'PLATFORM', true, 'Can manage tenants and system operations but limited access to critical settings.'),
  (null, 'support', 'PLATFORM', true, 'Support role with read access and limited operational capabilities.')
on conflict (name) where organization_id is null and scope = 'PLATFORM'
do update set
  description = excluded.description,
  scope = excluded.scope,
  is_system_role = excluded.is_system_role;

alter table public.platform_memberships enable row level security;

grant select on table public.platform_memberships to authenticated;
grant select, insert, update, delete on table public.platform_memberships to service_role;

create policy "Users can view own platform membership"
on public.platform_memberships
for select
to authenticated
using (user_id = auth.uid());

insert into public.permissions (code, name, description, category)
values
  ('automations.view', 'View Automations', 'Can view reminder rules', 'Automations'),
  ('automations.manage', 'Manage Automations', 'Can create and edit reminder rules', 'Automations')
on conflict (code) do update
set name = excluded.name,
    description = excluded.description,
    category = excluded.category;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.code in ('automations.view', 'automations.manage')
where r.name = 'admin'
  and r.scope = 'ORGANIZATION'
on conflict (role_id, permission_id) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.code = 'automations.view'
where r.name = 'manager'
  and r.scope = 'ORGANIZATION'
on conflict (role_id, permission_id) do nothing;

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
  where code in (
    'carers.view',
    'carers.create',
    'documents.view',
    'documents.review',
    'automations.view'
  )
  on conflict (role_id, permission_id) do nothing;

  insert into public.role_permissions (role_id, permission_id)
  select viewer_role_id, id
  from public.permissions
  where code in ('carers.view', 'documents.view')
  on conflict (role_id, permission_id) do nothing;
end;
$function$;

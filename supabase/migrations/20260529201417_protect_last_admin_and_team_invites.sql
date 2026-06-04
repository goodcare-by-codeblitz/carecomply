create or replace function public.prevent_last_org_admin_removal()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  admin_role_id uuid;
  remaining_admin_count integer;
  old_counts_as_admin boolean;
  new_counts_as_admin boolean := false;
begin
  select id into admin_role_id
  from public.roles
  where organization_id = old.organization_id
    and name = 'admin';

  if admin_role_id is null then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  old_counts_as_admin :=
    old.role_id = admin_role_id
    and old.deleted_at is null
    and coalesce(old.status, 'active') in ('active', 'on_leave');

  if not old_counts_as_admin then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    new_counts_as_admin :=
      new.organization_id = old.organization_id
      and new.role_id = admin_role_id
      and new.deleted_at is null
      and coalesce(new.status, 'active') in ('active', 'on_leave');

    if new_counts_as_admin then
      return new;
    end if;
  end if;

  select count(*) into remaining_admin_count
  from public.organization_memberships om
  where om.organization_id = old.organization_id
    and om.id <> old.id
    and om.role_id = admin_role_id
    and om.deleted_at is null
    and coalesce(om.status, 'active') in ('active', 'on_leave');

  if remaining_admin_count < 1 then
    raise exception 'Every organization must have at least one active admin.'
      using errcode = 'check_violation';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$function$;

revoke all on function public.prevent_last_org_admin_removal()
from public, anon, authenticated;

drop trigger if exists prevent_last_org_admin_removal
on public.organization_memberships;

create trigger prevent_last_org_admin_removal
before update of organization_id, role_id, status, deleted_at
or delete on public.organization_memberships
for each row
execute function public.prevent_last_org_admin_removal();

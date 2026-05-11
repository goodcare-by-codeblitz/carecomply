-- FIX 1: Grant authenticated users table-level access to carers
-- (RLS policies exist but were gated before table-level check)
grant select, insert, update, delete on table public.carers to authenticated;

-- FIX 2: Enable RLS on organization_invitations (disabled by previous migration)
alter table public.organization_invitations enable row level security;

-- FIX 3: Grant authenticated users table-level access to organization_invitations
grant select, insert, update, delete on table public.organization_invitations to authenticated;

-- FIX 4: RLS policies for organization_invitations

-- Any org member can read invitations for their organization
create policy "Org members can view invitations"
on public.organization_invitations
for select
to authenticated
using (public.is_org_member(organization_id));

-- Users with team.invite can create team invites; users with carers.create can create carer invites
create policy "Authorized users can create invitations"
on public.organization_invitations
for insert
to authenticated
with check (
  (invite_type = 'team_member' and public.has_org_permission(organization_id, 'team.invite'))
  or (invite_type = 'carer' and public.has_org_permission(organization_id, 'carers.create'))
);

-- Users with team.invite can update invitations (revoke / reinvite)
create policy "Authorized users can update invitations"
on public.organization_invitations
for update
to authenticated
using (public.has_org_permission(organization_id, 'team.invite'))
with check (public.has_org_permission(organization_id, 'team.invite'));

-- Users with team.manage can delete invitation records
create policy "Authorized users can delete invitations"
on public.organization_invitations
for delete
to authenticated
using (public.has_org_permission(organization_id, 'team.manage'));

-- FIX 5: Add missing RLS policies for carer_references
-- (RLS was enabled in schema but no policies were ever created — all access was silently denied)
create policy "Members can view carer references"
on public.carer_references
for select
to authenticated
using (
  exists (
    select 1 from public.carers c
    where c.id = carer_references.carer_id
      and public.has_org_permission(c.organization_id, 'carers.view')
  )
);

create policy "Members can create carer references"
on public.carer_references
for insert
to authenticated
with check (
  exists (
    select 1 from public.carers c
    where c.id = carer_references.carer_id
      and public.has_org_permission(c.organization_id, 'carers.edit')
  )
);

create policy "Members can update carer references"
on public.carer_references
for update
to authenticated
using (
  exists (
    select 1 from public.carers c
    where c.id = carer_references.carer_id
      and public.has_org_permission(c.organization_id, 'carers.edit')
  )
)
with check (
  exists (
    select 1 from public.carers c
    where c.id = carer_references.carer_id
      and public.has_org_permission(c.organization_id, 'carers.edit')
  )
);

create policy "Members can delete carer references"
on public.carer_references
for delete
to authenticated
using (
  exists (
    select 1 from public.carers c
    where c.id = carer_references.carer_id
      and public.has_org_permission(c.organization_id, 'carers.delete')
  )
);

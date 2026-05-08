alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.permissions enable row level security;
alter table public.roles enable row level security;
alter table public.role_permissions enable row level security;
alter table public.organization_memberships enable row level security;
alter table public.carers enable row level security;
alter table public.carer_references enable row level security;
alter table public.document_types enable row level security;
alter table public.documents enable row level security;
alter table public.organization_billing enable row level security;
alter table public.stripe_events enable row level security;
alter table public.audit_logs enable row level security;

create policy "Authenticated users can view permissions"
on public.permissions
for select
to authenticated
using (true);

create policy "Users can view own memberships"
on public.organization_memberships
for select
to authenticated
using (
  user_id = auth.uid()
  and deleted_at is null
);

create policy "Users can view own profile"
on public.profiles
for select
to authenticated
using (id = auth.uid());

create policy "Team viewers can view active organization memberships"
on public.organization_memberships
for select
to authenticated
using (
  deleted_at is null
  and public.has_org_permission(organization_id, 'team.view')
);

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

create policy "Members can view organizations"
on public.organizations
for select
to authenticated
using (public.is_org_member(id));

create policy "Members can view organization roles"
on public.roles
for select
to authenticated
using (
  organization_id is not null
  and public.is_org_member(organization_id)
);

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

create policy "Members can create carers"
on public.carers
for insert
to authenticated
with check (public.has_org_permission(organization_id, 'carers.create'));

create policy "Members can delete carers"
on public.carers
for delete
to authenticated
using (public.has_org_permission(organization_id, 'carers.delete'));

create policy "Members can edit carers"
on public.carers
for update
to authenticated
using (public.has_org_permission(organization_id, 'carers.edit'))
with check (public.has_org_permission(organization_id, 'carers.edit'));

create policy "Members can view carers"
on public.carers
for select
to authenticated
using (public.has_org_permission(organization_id, 'carers.view'));

create policy "Document viewers can view organization document types"
on public.document_types
for select
to authenticated
using (
  public.has_org_permission(organization_id, 'documents.view')
  or public.has_org_permission(organization_id, 'documents.review')
);

create policy "Members can review documents"
on public.documents
for update
to authenticated
using (
  exists (
    select 1
    from public.carers c
    where c.id = documents.carer_id
      and public.has_org_permission(c.organization_id, 'documents.review')
  )
)
with check (
  exists (
    select 1
    from public.carers c
    where c.id = documents.carer_id
      and public.has_org_permission(c.organization_id, 'documents.review')
  )
);

create policy "Members can upload documents"
on public.documents
for insert
to authenticated
with check (
  exists (
    select 1
    from public.carers c
    where c.id = documents.carer_id
      and public.has_org_permission(c.organization_id, 'documents.upload')
  )
);

create policy "Members can view documents"
on public.documents
for select
to authenticated
using (
  exists (
    select 1
    from public.carers c
    where c.id = documents.carer_id
      and public.has_org_permission(c.organization_id, 'documents.view')
  )
);

create policy "Members can view organization billing"
on public.organization_billing
for select
to authenticated
using (
  public.has_org_permission(organization_id, 'billing.view')
  or public.has_org_permission(organization_id, 'billing.manage')
);

grant select on table public.document_types to authenticated;
grant select on table public.organization_billing to authenticated;
grant select, insert, update, delete on table public.organization_billing to service_role;
grant select, insert, update, delete on table public.stripe_events to service_role;

create policy "Audit viewers can view organization audit logs"
on public.audit_logs
for select
to authenticated
using (public.has_org_permission(organization_id, 'audit.view'));

grant select on table public.audit_logs to authenticated;
grant select, insert, update, delete on table public.audit_logs to service_role;

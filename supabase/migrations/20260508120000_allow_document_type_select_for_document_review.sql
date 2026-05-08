create policy "Document viewers can view organization document types"
on public.document_types
for select
to authenticated
using (
  public.has_org_permission(organization_id, 'documents.view')
  or public.has_org_permission(organization_id, 'documents.review')
);

grant select on table public.document_types to authenticated;

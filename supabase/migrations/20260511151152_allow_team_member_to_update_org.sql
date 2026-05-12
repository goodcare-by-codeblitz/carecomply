  create policy "Team Members can update Organization info"
  on "public"."organizations"
  as permissive
  for update
  to authenticated
with check (public.has_org_permission(id, 'organizations.edit'::text));




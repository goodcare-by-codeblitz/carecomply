drop policy if exists "Team Members can update Organization info" on "public"."organizations";

create policy "Team Members can update Organization info"
  on "public"."organizations"
  as permissive
  for update
  to authenticated
  using (public.has_org_permission(id, 'organizations.edit'::text))
  with check (public.has_org_permission(id, 'organizations.edit'::text));

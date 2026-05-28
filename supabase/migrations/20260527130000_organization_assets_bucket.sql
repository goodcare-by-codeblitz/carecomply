-- Create the organization-assets storage bucket for org logos.
-- Files are stored at {organization_id}/logo/{filename}.
-- Public URLs are used so logos can be shown in the nav without auth.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'organization-assets',
  'organization-assets',
  true,
  2097152, -- 2 MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Anyone can read (bucket is public, but policy is belt-and-suspenders).
drop policy if exists "Public can read organization assets" on storage.objects;
create policy "Public can read organization assets"
  on storage.objects
  for select
  to public
  using (bucket_id = 'organization-assets');

-- Any org member can upload/manage assets for their own org's folder.
-- The API route (/api/settings/organization) enforces settings.manage permission
-- before persisting the URL, so storage only needs a membership check.
drop policy if exists "Org admins can upload organization assets" on storage.objects;
create policy "Org admins can upload organization assets"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'organization-assets'
    and public.is_org_member(split_part(name, '/', 1)::uuid)
  );

drop policy if exists "Org admins can replace organization assets" on storage.objects;
create policy "Org admins can replace organization assets"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'organization-assets'
    and public.is_org_member(split_part(name, '/', 1)::uuid)
  );

drop policy if exists "Org admins can delete organization assets" on storage.objects;
create policy "Org admins can delete organization assets"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'organization-assets'
    and public.is_org_member(split_part(name, '/', 1)::uuid)
  );

notify pgrst, 'reload schema';

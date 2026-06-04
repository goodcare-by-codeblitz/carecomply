-- =============================================================================
-- SECURITY: RLS policy hardening
-- 2026-05-28
--
-- Fixes VULN-005: auth_audit_events INSERT policy WITH CHECK (true) allows
--   any authenticated user to fabricate login events for any other user,
--   poisoning the audit trail.
-- Fixes VULN-006: organization-assets storage bucket has no path enforcement
--   (any org member can upload anywhere) and allows SVG uploads (XSS risk
--   on the public bucket). Also upgrades write gate to settings.manage.
-- Fixes VULN-007: organization_invitations UPDATE policy allows anyone with
--   team.invite to rewrite any invitation field (email, token, expiry, etc.),
--   enabling invitation hijacking.
-- Fixes VULN-015: carer-documents storage upload policy used documents.edit
--   permission while the documents table INSERT RLS uses documents.upload —
--   mismatch that breaks uploads for non-admin roles (manager/viewer).
-- =============================================================================

-- =============================================================================
-- VULN-005: auth_audit_events — restrict INSERT to own user_id
-- =============================================================================

-- Drop the old WITH CHECK (true) policy that allowed fabricating events
-- for any user.
drop policy if exists "Authenticated users can insert auth audit events"
  on public.auth_audit_events;

-- New policy: callers may only insert events attributed to themselves, or
-- events with no user_id (system/pre-auth events like failed login attempts).
create policy "Users can insert own auth audit events"
  on public.auth_audit_events
  for insert
  to authenticated
  with check (
    user_id is null
    or user_id = (select auth.uid())
  );

-- =============================================================================
-- VULN-007: organization_invitations — restrict UPDATE to revoke-only
-- Anyone with team.manage can set status = 'revoked'. All other field
-- mutations must go through service_role API routes (which validate intent).
-- =============================================================================

drop policy if exists "Authorized users can update invitations"
  on public.organization_invitations;

create policy "Authorized users can revoke invitations"
  on public.organization_invitations
  for update
  to authenticated
  using (public.has_org_permission(organization_id, 'team.manage'))
  with check (
    public.has_org_permission(organization_id, 'team.manage')
    and status = 'revoked'
  );

-- =============================================================================
-- VULN-015: carer-documents — align upload permission to documents.upload
-- The table INSERT RLS uses documents.upload; the storage policy was using
-- documents.edit. This mismatch silently broke uploads for manager-role users
-- who have documents.upload but not documents.edit.
-- =============================================================================

drop policy if exists "Org members can upload carer documents" on storage.objects;
create policy "Org members can upload carer documents"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'carer-documents'
    and public.has_org_permission(
      (storage.foldername(name))[1]::uuid,
      'documents.upload'
    )
  );

-- =============================================================================
-- VULN-006: organization-assets — enforce path structure + require settings.manage
--
-- Problems fixed:
--   a) Any org member could write to arbitrary paths (only first path segment
--      was validated). Now enforces {org_id}/logo/{filename} pattern.
--   b) Any org member could upload (is_org_member check). Now requires
--      settings.manage permission (only admins).
--   c) SVG MIME type removed from bucket to prevent XSS on public bucket.
-- =============================================================================

drop policy if exists "Org admins can upload organization assets" on storage.objects;
create policy "Org admins can upload organization assets"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'organization-assets'
    and public.has_org_permission(
      split_part(name, '/', 1)::uuid,
      'settings.manage'
    )
    -- Enforce strict path: {org_id}/logo/{filename} — no subdirectories allowed
    and name ~ ('^' || split_part(name, '/', 1) || '/logo/[^/]+$')
  );

drop policy if exists "Org admins can replace organization assets" on storage.objects;
create policy "Org admins can replace organization assets"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'organization-assets'
    and public.has_org_permission(
      split_part(name, '/', 1)::uuid,
      'settings.manage'
    )
    and name ~ ('^' || split_part(name, '/', 1) || '/logo/[^/]+$')
  );

drop policy if exists "Org admins can delete organization assets" on storage.objects;
create policy "Org admins can delete organization assets"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'organization-assets'
    and public.has_org_permission(
      split_part(name, '/', 1)::uuid,
      'settings.manage'
    )
    and name ~ ('^' || split_part(name, '/', 1) || '/logo/[^/]+$')
  );

-- Remove SVG from organization-assets allowed MIME types.
-- SVG files can contain inline <script> tags and are executed by browsers
-- when loaded from a public bucket URL, creating a stored XSS vector.
update storage.buckets
set allowed_mime_types = array_remove(allowed_mime_types, 'image/svg+xml')
where id = 'organization-assets';

-- =============================================================================
-- Verify stripe_events is not accessible to anon/authenticated
-- (defence-in-depth — no RLS policies should exist for these roles)
-- =============================================================================
revoke all on table public.stripe_events from anon, authenticated;

notify pgrst, 'reload schema';

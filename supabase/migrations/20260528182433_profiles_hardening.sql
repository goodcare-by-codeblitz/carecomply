-- =============================================================================
-- SECURITY: Profiles table hardening
-- 2026-05-28
--
-- Fixes VULN-001: Any authenticated user could UPDATE their own profile row
--   and set is_super_admin = true, gaining platform admin access in the
--   application layer (lib/platform-admin.ts checks this column as fallback).
--
-- Fix strategy:
--   1. Trigger that blocks is_super_admin changes when the active PostgreSQL
--      role is 'authenticated'. service_role (bootstrap) is unaffected.
--   2. Update profiles UPDATE policy to use (SELECT auth.uid()) so it is
--      evaluated once per query rather than once per row.
-- =============================================================================

-- =============================================================================
-- STEP 1: Block is_super_admin self-escalation via trigger
-- The trigger is NOT SECURITY DEFINER so current_user reflects the actual
-- calling role ('authenticated' for API users, 'service_role' for admin ops).
-- =============================================================================

create or replace function public.prevent_super_admin_self_escalation()
returns trigger
language plpgsql
as $$
begin
  -- Only block changes made by the 'authenticated' role (regular app users).
  -- service_role (admin client / bootstrap) is allowed to set this field.
  if current_user = 'authenticated'
     and new.is_super_admin is distinct from old.is_super_admin
  then
    raise exception
      'is_super_admin cannot be modified directly. '
      'Use platform_memberships to grant platform access.';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_no_super_admin_escalation on public.profiles;
create trigger profiles_no_super_admin_escalation
  before update on public.profiles
  for each row
  execute function public.prevent_super_admin_self_escalation();

-- =============================================================================
-- STEP 2: Update profiles UPDATE policy to use (SELECT auth.uid())
-- This evaluates auth.uid() once per query rather than per row, which
-- improves performance on bulk updates and keeps the pattern consistent
-- with Supabase best practices.
-- =============================================================================

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles
  for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Also harden the SELECT policy for own profile (same per-row → per-query fix)
drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile"
  on public.profiles
  for select
  to authenticated
  using (id = (select auth.uid()));

-- =============================================================================
-- STEP 3: Update organization_memberships SELECT policy for own memberships
-- Same (SELECT auth.uid()) optimisation.
-- =============================================================================

drop policy if exists "Users can view own memberships" on public.organization_memberships;
create policy "Users can view own memberships"
  on public.organization_memberships
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    and deleted_at is null
    and coalesce(status, 'active') in ('active', 'on_leave')
  );

notify pgrst, 'reload schema';

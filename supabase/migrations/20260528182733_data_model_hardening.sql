-- =============================================================================
-- DATA MODEL: Schema and policy hardening
-- 2026-05-28
--
-- Fixes VULN-014: organization_memberships DELETE policy included
--   OR user_id = auth.uid(), allowing any user to hard-delete their own
--   membership row, destroying the audit trail for that membership.
--
-- Fixes VULN-016: reminder_logs has no organization_id column, forcing the
--   RLS SELECT policy to use a correlated EXISTS subquery to the carers table
--   on every row read. This is a sequential-scan trap at scale.
--   Fix: add organization_id directly, backfill, add index, rewrite policy.
--
-- Fixes PERF-005: enqueue_document_expiry_reminders() called
--   ensure_default_reminders(id) FROM organizations on every 5-minute cron
--   tick — O(n_orgs) UPSERTs before any actual work. ensure_default_reminders
--   is already called at org creation time via create_organization_with_roles,
--   so the per-run call is pure waste.
-- =============================================================================

-- =============================================================================
-- VULN-014: Remove self-delete from organization_memberships DELETE policy
-- Regular users who want to leave an org should use a dedicated API route
-- that performs a soft-delete (sets status = 'former', deleted_at = now()).
-- Hard-deletes are reserved for admins managing their org's membership list.
-- =============================================================================

drop policy if exists "Admins can remove team members" on public.organization_memberships;
create policy "Admins can remove team members"
  on public.organization_memberships
  for delete
  to authenticated
  using (
    public.has_org_permission(organization_id, 'team.manage')
  );

-- =============================================================================
-- VULN-016: Add organization_id to reminder_logs
-- Step 1: add nullable column
-- Step 2: backfill from the carers table
-- Step 3: make NOT NULL (safe after backfill — every reminder_log has a carer)
-- Step 4: add FK + index
-- Step 5: replace expensive correlated-subquery RLS with direct org check
-- =============================================================================

alter table public.reminder_logs
  add column if not exists organization_id uuid;

-- Backfill: resolve org from the carer on each log row.
-- Uses a JOIN rather than a subquery for better planner visibility.
update public.reminder_logs rl
set organization_id = c.organization_id
from public.carers c
where c.id = rl.carer_id
  and rl.organization_id is null;

-- Make NOT NULL now that all rows are filled.
alter table public.reminder_logs
  alter column organization_id set not null;

-- Add FK with cascade to match all other tenant-scoped tables.
alter table public.reminder_logs
  add constraint reminder_logs_organization_id_fkey
  foreign key (organization_id)
  references public.organizations(id)
  on delete cascade;

-- Index for the RLS policy and org-scoped queries.
create index if not exists idx_reminder_logs_org
  on public.reminder_logs (organization_id);

-- Replace the old correlated-subquery policy with a direct column check.
drop policy if exists "Automation viewers can view reminder logs" on public.reminder_logs;
create policy "Automation viewers can view reminder logs"
  on public.reminder_logs
  for select
  to authenticated
  using (
    public.has_org_permission(organization_id, 'automations.view')
  );

-- =============================================================================
-- PERF-005: Remove ensure_default_reminders() call from
--           enqueue_document_expiry_reminders()
--
-- The per-run ensure_default_reminders(id) FROM organizations call ran for
-- EVERY organization on every 5-minute cron tick — even organisations that
-- already had their defaults. ensure_default_reminders is idempotent (uses
-- ON CONFLICT DO NOTHING) but the iteration itself is wasteful overhead.
--
-- ensure_default_reminders() is correctly called in:
--   - create_organization_with_roles() at org creation time
--   - Migration backfills
-- It does not need to run every 5 minutes.
-- =============================================================================

create or replace function public.enqueue_document_expiry_reminders(
  p_run_date date default current_date
)
returns integer
language plpgsql
security definer
set search_path = public
as $function$
declare
  inserted_count integer := 0;
begin
  -- NOTE: ensure_default_reminders() is intentionally NOT called here.
  -- It was previously called for every org on every cron run (O(n_orgs)
  -- wasted UPSERTs). Defaults are seeded at org creation time instead.

  insert into public.reminder_jobs (
    organization_id,
    reminder_id,
    carer_id,
    document_id,
    recipient_type,
    recipient_email,
    recipient_name,
    due_on,
    idempotency_key,
    payload
  )
  select
    c.organization_id,
    r.id,
    c.id,
    d.id,
    r.recipient_type,
    case when r.recipient_type = 'carer' then c.email else null end,
    case when r.recipient_type = 'carer' then c.full_name else 'Management' end,
    p_run_date,
    concat_ws(':', r.id::text, d.id::text, r.recipient_type, p_run_date::text),
    jsonb_build_object(
      'carer_id', c.id,
      'document_id', d.id,
      'reminder_id', r.id,
      'carer_name', c.full_name,
      'carer_email', c.email,
      'document_type', dt.name,
      'document_type_id', dt.id,
      'expiry_date', d.expiry_date,
      'organization_name', o.name,
      'organization_slug', o.slug,
      'subject_template', r.subject_template,
      'message_template', r.message_template,
      'trigger_type', r.trigger_type,
      'trigger_days', r.trigger_days
      -- TODO (VULN-009): carer_name, carer_email, organization_name above are PII
      -- stored in plaintext JSONB. Future work: update the worker to resolve these
      -- at send time from the IDs, then remove the PII fields from the payload.
    )
  from public.documents d
  join public.carers c on c.id = d.carer_id
  join public.organizations o on o.id = c.organization_id
  join public.document_types dt on dt.id = d.document_type_id
  join public.reminders r on r.organization_id = c.organization_id
  left join public.organization_billing ob on ob.organization_id = c.organization_id
  where r.is_active = true
    and c.status = 'active'
    and d.status = 'approved'
    and d.superseded_by is null
    and d.expiry_date is not null
    and (r.document_type_id is null or r.document_type_id = d.document_type_id)
    and (
      r.min_plan = 'starter'
      or (
        r.min_plan = 'pro'
        and coalesce(ob.plan, 'starter') = 'pro'
        and coalesce(ob.status, 'trialing') in ('trialing', 'active')
      )
    )
    and (
      (r.trigger_type = 'days_before_expiry' and d.expiry_date = p_run_date + coalesce(r.trigger_days, 0))
      or (r.trigger_type = 'days_after_expiry' and d.expiry_date = p_run_date - coalesce(r.trigger_days, 0))
    )
    and (
      r.trigger_type <> 'days_after_expiry'
      or not exists (
        select 1
        from public.documents replacement
        where replacement.carer_id = d.carer_id
          and replacement.document_type_id = d.document_type_id
          and replacement.status = 'approved'
          and replacement.superseded_by is null
          and replacement.id <> d.id
          and replacement.uploaded_at > d.uploaded_at
          and (replacement.expiry_date is null or replacement.expiry_date >= p_run_date)
      )
    )
  on conflict (idempotency_key) do nothing;

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$function$;

-- Keep service_role-only execute grant in sync with the function replacement.
revoke execute on function public.enqueue_document_expiry_reminders(date)
  from public, anon, authenticated;
grant execute on function public.enqueue_document_expiry_reminders(date)
  to service_role;

notify pgrst, 'reload schema';

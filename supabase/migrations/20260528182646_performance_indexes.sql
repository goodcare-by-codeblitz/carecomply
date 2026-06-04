-- =============================================================================
-- PERFORMANCE: Missing indexes
-- 2026-05-28
--
-- PERF-001: organization_memberships — compound index for has_org_permission()
--   Called on every single RLS policy evaluation. The existing index
--   idx_org_memberships_user_active only covered (user_id, organization_id)
--   WHERE deleted_at IS NULL but did not filter on status, causing it to
--   return rows that the function then discards with the status check.
--
-- PERF-002: reminder_jobs — partial index for claim_reminder_jobs()
--   Worker claims filter WHERE status = 'queued'. Without a partial index
--   the planner scans all rows including 'sent'/'failed'/'skipped' noise.
--
-- PERF-003: reference_jobs — partial index for claim_reference_jobs()
--   Same pattern as reminder_jobs.
--
-- PERF-004: carer_references — partial index for enqueue_reference_chase_jobs()
--   Chase enqueue filters WHERE status = 'requested' AND request_sent_at IS NOT NULL.
--
-- PERF-005: documents — composite partial index for reminder pipeline
--   enqueue_document_expiry_reminders() joins documents filtering on
--   status = 'approved', superseded_by IS NULL, expiry_date IS NOT NULL.
--   The existing idx_documents_expiry only covers expiry_date; the planner
--   cannot use it efficiently when also filtering carer_id/document_type_id.
--
-- PERF-006 (via VULN-016 migration): reminder_logs org index — done separately.
--
-- PERF-008: documents DELETE policy — rewrite to consistent EXISTS pattern.
--   The previous policy used an inline scalar subquery
--   (SELECT organization_id FROM carers WHERE id = carer_id) inside
--   has_org_permission(), which forces a correlated per-row lookup with no
--   good index path. Rewritten to EXISTS + JOIN to match other document policies.
--
-- All indexes use IF NOT EXISTS so re-running is safe.
-- CONCURRENTLY is not available inside a transaction block, so these run
-- outside of one implicitly via the migration runner.
-- =============================================================================

-- PERF-001 — compound partial index for has_org_permission() / is_org_member()
-- Covers: WHERE user_id = $1 AND organization_id = $2 AND deleted_at IS NULL
--         AND status IN ('active', 'on_leave')
-- Replaces the less selective idx_org_memberships_user_active.
create index if not exists idx_org_memberships_uid_org_active
  on public.organization_memberships (user_id, organization_id)
  where deleted_at is null
    and status in ('active', 'on_leave');

-- PERF-002 — partial index for worker job claiming (reminder_jobs)
-- Covers: WHERE status = 'queued' AND next_attempt_at <= now() AND attempts < max_attempts
create index if not exists idx_reminder_jobs_queued
  on public.reminder_jobs (next_attempt_at, created_at)
  where status = 'queued';

-- PERF-003 — partial index for worker job claiming (reference_jobs)
-- Covers: WHERE status = 'queued' AND due_at <= now() AND attempts < max_attempts
create index if not exists idx_reference_jobs_queued
  on public.reference_jobs (due_at, created_at)
  where status = 'queued';

-- PERF-004 — partial index for reference chase enqueue
-- Covers: WHERE status = 'requested' AND request_sent_at IS NOT NULL
create index if not exists idx_carer_references_chase_eligible
  on public.carer_references (request_sent_at, chase_count)
  where status = 'requested'
    and request_sent_at is not null;

-- PERF-005 — composite partial index for document expiry reminder pipeline
-- Covers the main filter in enqueue_document_expiry_reminders():
--   WHERE status = 'approved' AND superseded_by IS NULL AND expiry_date IS NOT NULL
-- Including carer_id and document_type_id enables index-only scans for the
-- reminder JOIN conditions.
create index if not exists idx_documents_reminder_pipeline
  on public.documents (carer_id, document_type_id, expiry_date)
  where status = 'approved'
    and superseded_by is null
    and expiry_date is not null;

-- =============================================================================
-- PERF-008: Fix documents DELETE policy — replace inline scalar subquery with
-- EXISTS pattern for consistent, index-friendly evaluation.
-- =============================================================================

drop policy if exists "Members can delete documents" on public.documents;
create policy "Members can delete documents"
  on public.documents
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.carers c
      where c.id = documents.carer_id
        and public.has_org_permission(c.organization_id, 'documents.edit')
    )
  );

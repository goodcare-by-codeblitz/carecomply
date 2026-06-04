-- =============================================================================
-- SECURITY: Function grant hardening
-- 2026-05-28
--
-- Fixes VULN-002: get_platform_setting() exposes PII encryption key to all
--   authenticated users via the default PUBLIC EXECUTE grant.
-- Fixes VULN-003: reminder_delivery_diagnostics() leaks worker URL/secret.
-- Fixes VULN-004: 8 SECURITY DEFINER functions callable by all authenticated
--   users — includes job queue hijacking, cross-org org creation, billing
--   info leak, and reminder/reference spam vectors.
-- Fixes VULN-013: create_organization_with_roles() accepts arbitrary p_user_id
--   allowing one user to make any other user an org admin.
-- =============================================================================

-- =============================================================================
-- STEP 1: Revoke EXECUTE from PUBLIC / anon / authenticated on all
--         internal and worker functions
-- =============================================================================

-- get_platform_setting: reads raw values from platform_settings including the
-- PII encryption key. Must only be callable by SECURITY DEFINER functions
-- (pii_encrypt, pii_decrypt) which are themselves callable by authenticated.
revoke execute on function public.get_platform_setting(text)
  from public, anon, authenticated;
grant execute on function public.get_platform_setting(text)
  to service_role;

-- reminder_delivery_diagnostics: returns worker_url (full secret endpoint URL)
-- and worker secret configuration status. Platform support tool only.
revoke execute on function public.reminder_delivery_diagnostics(uuid)
  from public, anon, authenticated;
grant execute on function public.reminder_delivery_diagnostics(uuid)
  to service_role;

-- create_org_roles: creates system roles inside any given org. Internal only,
-- called exclusively by create_organization_with_roles.
revoke execute on function public.create_org_roles(uuid)
  from public, anon, authenticated;
grant execute on function public.create_org_roles(uuid)
  to service_role;

-- ensure_default_reminders: inserts system reminders into any org. Internal
-- only, called at org creation time and during migrations.
revoke execute on function public.ensure_default_reminders(uuid)
  from public, anon, authenticated;
grant execute on function public.ensure_default_reminders(uuid)
  to service_role;

-- enqueue_document_expiry_reminders: floods reminder_jobs across all orgs if
-- called by an attacker. Worker/cron function only.
revoke execute on function public.enqueue_document_expiry_reminders(date)
  from public, anon, authenticated;
grant execute on function public.enqueue_document_expiry_reminders(date)
  to service_role;

-- enqueue_reference_chase_jobs: same risk pattern as above.
revoke execute on function public.enqueue_reference_chase_jobs(timestamptz)
  from public, anon, authenticated;
grant execute on function public.enqueue_reference_chase_jobs(timestamptz)
  to service_role;

-- claim_reminder_jobs: allows stealing/locking jobs from the real worker,
-- causing reminder delivery failures. Worker function only.
revoke execute on function public.claim_reminder_jobs(text, integer)
  from public, anon, authenticated;
grant execute on function public.claim_reminder_jobs(text, integer)
  to service_role;

-- claim_reference_jobs: same risk as claim_reminder_jobs.
revoke execute on function public.claim_reference_jobs(text, integer)
  from public, anon, authenticated;
grant execute on function public.claim_reference_jobs(text, integer)
  to service_role;

-- call_reminder_worker: triggers the reminder HTTP worker. Internal only.
revoke execute on function public.call_reminder_worker()
  from public, anon, authenticated;
grant execute on function public.call_reminder_worker()
  to service_role;

-- run_document_reminder_pipeline: already revoked in a prior migration,
-- but re-stated here for completeness and auditability.
revoke execute on function public.run_document_reminder_pipeline(date)
  from public, anon, authenticated;
grant execute on function public.run_document_reminder_pipeline(date)
  to service_role;

-- =============================================================================
-- STEP 2: Fix organization_has_pro() — gate on org membership
-- Previously callable by any authenticated user to leak the billing tier of
-- any organization UUID. Now returns false for orgs the caller doesn't belong to.
-- =============================================================================

create or replace function public.organization_has_pro(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    -- Deny billing info to users who are not members of this org
    when not public.is_org_member(p_org_id) then false
    else coalesce((
      select ob.plan = 'pro'
        and coalesce(ob.status, 'trialing') in ('trialing', 'active')
      from public.organization_billing ob
      where ob.organization_id = p_org_id
    ), false)
  end;
$$;

-- =============================================================================
-- STEP 3: Fix create_organization_with_roles() — enforce caller = p_user_id
-- Previously accepted any UUID as p_user_id, allowing an attacker to make any
-- user the admin of a newly created organization.
-- auth.uid() returns NULL for service_role, so bootstrap flows are unaffected.
-- =============================================================================

create or replace function public.create_organization_with_roles(
  p_user_id uuid,
  org_name text,
  org_slug text,
  p_billing_plan text default 'starter',
  p_billing_interval text default 'monthly'
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  org_id uuid;
  admin_role_id uuid;
  billing_plan text;
  billing_interval text;
begin
  -- Enforce: the caller can only create an org for themselves.
  -- auth.uid() is NULL for service_role calls (admin bootstrap), so those
  -- are unaffected by this check.
  if auth.uid() is not null and p_user_id <> auth.uid() then
    raise exception 'Permission denied: cannot create organization for another user';
  end if;

  billing_plan := coalesce(nullif(p_billing_plan, ''), 'starter');
  billing_interval := coalesce(nullif(p_billing_interval, ''), 'monthly');

  if billing_plan not in ('starter', 'pro') then
    raise exception 'Invalid billing plan: %', billing_plan;
  end if;

  if billing_interval not in ('monthly', 'yearly') then
    raise exception 'Invalid billing interval: %', billing_interval;
  end if;

  insert into public.organizations (name, slug)
  values (org_name, org_slug)
  returning id into org_id;

  perform public.create_org_roles(org_id);

  select id into admin_role_id
  from public.roles
  where organization_id = org_id
    and name = 'admin';

  insert into public.organization_memberships (user_id, organization_id, role_id)
  values (p_user_id, org_id, admin_role_id)
  on conflict (user_id, organization_id) do update
  set role_id = excluded.role_id,
      status = 'active',
      previous_status = null,
      status_changed_at = now(),
      status_changed_by = null,
      former_at = null,
      deleted_at = null,
      updated_at = now();

  insert into public.organization_billing (
    organization_id,
    plan,
    interval,
    status,
    trial_start,
    trial_end
  )
  values (
    org_id,
    billing_plan,
    billing_interval,
    'trialing',
    now(),
    now() + interval '14 days'
  )
  on conflict (organization_id) do update
  set plan = excluded.plan,
      interval = excluded.interval,
      status = excluded.status,
      trial_start = excluded.trial_start,
      trial_end = excluded.trial_end;

  perform public.ensure_default_reminders(org_id);
end;
$function$;

-- =============================================================================
-- STEP 4: Redact worker_url from reminder_delivery_diagnostics() output
-- The function is already revoked above; this additionally removes the raw
-- worker_url value from the response so it cannot be retrieved even if the
-- grant is accidentally restored in future.
-- =============================================================================

create or replace function public.reminder_delivery_diagnostics(p_org_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $function$
declare
  settings_worker_url text := nullif(public.get_platform_setting('reminder_worker_url'), '');
  settings_worker_secret text := nullif(public.get_platform_setting('reminder_worker_secret'), '');
  legacy_worker_url text := nullif(current_setting('app.reminder_worker_url', true), '');
  legacy_worker_secret text := nullif(current_setting('app.reminder_worker_secret', true), '');
  worker_url text := coalesce(settings_worker_url, legacy_worker_url);
  worker_secret text := coalesce(settings_worker_secret, legacy_worker_secret);
  cron_jobs jsonb := '[]'::jsonb;
  cron_runs jsonb := '[]'::jsonb;
begin
  begin
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'jobid', jobid,
          'jobname', jobname,
          'schedule', schedule,
          'active', active,
          'command', command
        )
        order by jobname
      ),
      '[]'::jsonb
    )
    into cron_jobs
    from cron.job
    where jobname in (
      'carecomply-enqueue-document-expiry-reminders',
      'carecomply-call-reminder-worker',
      'carecomply-run-document-reminder-pipeline'
    );
  exception when others then
    cron_jobs := jsonb_build_array(
      jsonb_build_object('warning', 'Cron jobs could not be read by diagnostics.')
    );
  end;

  begin
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'jobid', details.jobid,
          'jobname', jobs.jobname,
          'status', details.status,
          'return_message', details.return_message,
          'start_time', details.start_time,
          'end_time', details.end_time
        )
        order by details.start_time desc
      ),
      '[]'::jsonb
    )
    into cron_runs
    from cron.job_run_details details
    join cron.job jobs on jobs.jobid = details.jobid
    where jobs.jobname in (
      'carecomply-enqueue-document-expiry-reminders',
      'carecomply-call-reminder-worker',
      'carecomply-run-document-reminder-pipeline'
    )
    order by details.start_time desc
    limit 50;
  exception when others then
    cron_runs := jsonb_build_array(
      jsonb_build_object('warning', 'Cron run history could not be read by diagnostics.')
    );
  end;

  return jsonb_build_object(
    -- worker_url intentionally omitted — prevents secret leakage even if
    -- grant is accidentally restored. Use platform_settings via service_role.
    'worker_url_configured', worker_url is not null,
    'worker_url_source', case
      when settings_worker_url is not null then 'platform_settings'
      when legacy_worker_url is not null then 'database_setting'
      else null
    end,
    'worker_secret_configured', worker_secret is not null,
    'worker_secret_source', case
      when settings_worker_secret is not null then 'platform_settings'
      when legacy_worker_secret is not null then 'database_setting'
      else null
    end,
    'cron_jobs', cron_jobs,
    'cron_runs', cron_runs,
    'starter_fixed_reminders', jsonb_build_array(30, 7, 0),
    'notes', 'Starter fixed reminders fire 30 days before expiry, 7 days before expiry, and on expiry day.'
  );
end;
$function$;

notify pgrst, 'reload schema';

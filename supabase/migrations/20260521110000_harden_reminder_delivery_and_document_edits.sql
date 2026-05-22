 create or replace function public.call_reminder_worker()
returns void
language plpgsql
security definer
set search_path = public, extensions
as $function$
declare
  -- Configure these with:
  -- alter database postgres set app.reminder_worker_url = 'https://<app>/api/reminders/worker';
  -- alter database postgres set app.reminder_worker_secret = '<same value as REMINDER_WORKER_SECRET>';
  worker_url text := nullif(current_setting('app.reminder_worker_url', true), '');
  worker_secret text := nullif(current_setting('app.reminder_worker_secret', true), '');
begin
  if worker_url is null or worker_secret is null then
    insert into public.audit_logs (
      organization_id,
      action,
      entity_type,
      entity_name,
      category,
      severity,
      source,
      cqc_key_question,
      details
    )
    select
      o.id,
      'reminder.worker_configuration_missing',
      'reminder',
      'Reminder worker configuration',
      'settings',
      'warning',
      'system',
      'well_led',
      jsonb_build_object(
        'worker_url_configured', worker_url is not null,
        'worker_secret_configured', worker_secret is not null,
        'outcome', 'pg_cron_worker_call_skipped'
      )
    from public.organizations o
    where not exists (
      select 1
      from public.audit_logs existing
      where existing.organization_id = o.id
        and existing.action = 'reminder.worker_configuration_missing'
        and existing.created_at > now() - interval '1 hour'
    );

    return;
  end if;

  perform net.http_post(
    url := worker_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || worker_secret
    ),
    body := jsonb_build_object('source', 'pg_cron')
  );
end;
$function$;

create or replace function public.reminder_delivery_diagnostics(p_org_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $function$
declare
  worker_url text := nullif(current_setting('app.reminder_worker_url', true), '');
  worker_secret text := nullif(current_setting('app.reminder_worker_secret', true), '');
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
      'carecomply-call-reminder-worker'
    );
  exception when others then
    cron_jobs := jsonb_build_array(
      jsonb_build_object(
        'warning',
        'Cron jobs could not be read by diagnostics.'
      )
    );
  end;

  begin
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'jobid', jobid,
          'jobname', jobname,
          'status', status,
          'return_message', return_message,
          'start_time', start_time,
          'end_time', end_time
        )
        order by start_time desc
      ),
      '[]'::jsonb
    )
    into cron_runs
    from (
      select details.jobid, jobs.jobname, details.status, details.return_message, details.start_time, details.end_time
      from cron.job_run_details details
      join cron.job jobs on jobs.jobid = details.jobid
      where jobs.jobname in (
        'carecomply-enqueue-document-expiry-reminders',
        'carecomply-call-reminder-worker'
      )
      order by details.start_time desc
      limit 50
    ) recent_runs;
  exception when others then
    cron_runs := jsonb_build_array(
      jsonb_build_object(
        'warning',
        'Cron run history could not be read by diagnostics.'
      )
    );
  end;

  return jsonb_build_object(
    'worker_url_configured', worker_url is not null,
    'worker_secret_configured', worker_secret is not null,
    'worker_url', worker_url,
    'cron_jobs', cron_jobs,
    'cron_runs', cron_runs,
    'starter_fixed_reminders', jsonb_build_array(30, 7, 0),
    'notes', 'Starter fixed reminders fire 30 days before expiry, 7 days before expiry, and on expiry day. A 15 or 14 day reminder requires a Pro custom automation.'
  );
end;
$function$;

create or replace function public.run_document_reminder_pipeline(p_run_date date default current_date)
returns integer
language plpgsql
security definer
set search_path = public
as $function$
declare
  inserted_count integer := 0;
begin
  inserted_count := public.enqueue_document_expiry_reminders(p_run_date);
  perform public.call_reminder_worker();
  return inserted_count;
end;
$function$;

revoke all on function public.run_document_reminder_pipeline(date) from public, anon, authenticated;
grant execute on function public.run_document_reminder_pipeline(date) to service_role;

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
        'carecomply-call-reminder-worker',
        'carecomply-run-document-reminder-pipeline'
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
    'organization_id', p_org_id,
    'worker_url_configured', worker_url is not null,
    'worker_secret_configured', worker_secret is not null,
    'worker_url', worker_url,
    'worker_url_source', case
      when settings_worker_url is not null then 'platform_settings'
      when legacy_worker_url is not null then 'database_setting'
      else null
    end,
    'worker_secret_source', case
      when settings_worker_secret is not null then 'platform_settings'
      when legacy_worker_secret is not null then 'database_setting'
      else null
    end,
    'cron_jobs', cron_jobs,
    'cron_runs', cron_runs,
    'starter_fixed_reminders', jsonb_build_array(30, 7, 0),
    'notes', 'Starter fixed reminders fire 30 days before expiry, 7 days before expiry, and on expiry day. A 15 or 14 day reminder requires a Pro custom automation.'
  );
end;
$function$;

select cron.unschedule('carecomply-enqueue-document-expiry-reminders')
where exists (
  select 1 from cron.job where jobname = 'carecomply-enqueue-document-expiry-reminders'
);

select cron.unschedule('carecomply-call-reminder-worker')
where exists (
  select 1 from cron.job where jobname = 'carecomply-call-reminder-worker'
);

select cron.unschedule('carecomply-run-document-reminder-pipeline')
where exists (
  select 1 from cron.job where jobname = 'carecomply-run-document-reminder-pipeline'
);

select cron.schedule(
  'carecomply-run-document-reminder-pipeline',
  '*/5 * * * *',
  $$select public.run_document_reminder_pipeline(current_date);$$
);

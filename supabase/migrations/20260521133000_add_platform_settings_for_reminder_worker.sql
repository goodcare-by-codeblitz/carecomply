create table if not exists public.platform_settings (
  key text primary key,
  value text not null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

alter table public.platform_settings enable row level security;

grant select, insert, update, delete on table public.platform_settings to service_role;

drop trigger if exists set_platform_settings_updated_at on public.platform_settings;
create trigger set_platform_settings_updated_at
before update on public.platform_settings
for each row
execute function public.set_updated_at();

create or replace function public.get_platform_setting(setting_key text)
returns text
language sql
stable
security definer
set search_path = public
as $function$
  select ps.value
  from public.platform_settings ps
  where ps.key = setting_key
  limit 1;
$function$;

create or replace function public.call_reminder_worker()
returns void
language plpgsql
security definer
set search_path = public, extensions
as $function$
declare
  worker_url text := coalesce(
    nullif(public.get_platform_setting('reminder_worker_url'), ''),
    nullif(current_setting('app.reminder_worker_url', true), '')
  );
  worker_secret text := coalesce(
    nullif(public.get_platform_setting('reminder_worker_secret'), ''),
    nullif(current_setting('app.reminder_worker_secret', true), '')
  );
begin
  if worker_url is null or worker_secret is null then
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

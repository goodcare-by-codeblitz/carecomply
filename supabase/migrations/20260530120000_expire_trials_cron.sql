-- Schedule a daily pg_cron job to expire trials whose trial_end has passed
-- and no Stripe subscription has been attached.
--
-- The job calls /api/billing/expire-trials on the Next.js app using the same
-- worker URL and secret already stored in platform_settings for the reminder
-- worker (billing_worker_url / billing_worker_secret, falling back to
-- reminder_worker_url / reminder_worker_secret so existing deployments work
-- without any new environment variables).

create or replace function public.call_expire_trials_worker()
returns void
language plpgsql
security definer
set search_path = public, extensions
as $function$
declare
  -- Prefer a dedicated billing worker URL; fall back to the reminder worker
  -- URL with the path swapped to /api/billing/expire-trials.
  reminder_url text := coalesce(
    nullif(public.get_platform_setting('reminder_worker_url'), ''),
    nullif(current_setting('app.reminder_worker_url', true), '')
  );
  worker_url text := coalesce(
    nullif(public.get_platform_setting('billing_worker_url'), ''),
    -- Derive from reminder_worker_url by replacing the last path segment.
    case
      when reminder_url is not null
      then regexp_replace(reminder_url, '/api/[^/]+$', '/api/billing/expire-trials')
      else null
    end
  );
  worker_secret text := coalesce(
    nullif(public.get_platform_setting('billing_worker_secret'), ''),
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

revoke all on function public.call_expire_trials_worker() from public, anon, authenticated;
grant execute on function public.call_expire_trials_worker() to service_role;

-- Safely replace any existing schedule before creating the new one.
select cron.unschedule('carecomply-expire-trials')
where exists (
  select 1 from cron.job where jobname = 'carecomply-expire-trials'
);

-- Run daily at 02:00 UTC — after midnight in all UK timezones.
select cron.schedule(
  'carecomply-expire-trials',
  '0 2 * * *',
  $$select public.call_expire_trials_worker();$$
);

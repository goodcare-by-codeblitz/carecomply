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

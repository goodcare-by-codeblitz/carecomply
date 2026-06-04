-- GDPR Article 5(1)(e) — storage limitation.
-- stripe_events rows contain Stripe event payloads which may include
-- customer email addresses and billing addresses. Purge records older
-- than 90 days on a weekly schedule.

create or replace function public.purge_old_stripe_events()
returns integer
language plpgsql
security definer
set search_path = public
as $function$
declare
  deleted_count integer;
begin
  delete from public.stripe_events
  where received_at < now() - interval '90 days';

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$function$;

revoke all on function public.purge_old_stripe_events() from public, anon, authenticated;
grant execute on function public.purge_old_stripe_events() to service_role;

-- Safely replace any existing schedule.
select cron.unschedule('carecomply-purge-stripe-events')
where exists (
  select 1 from cron.job where jobname = 'carecomply-purge-stripe-events'
);

-- Run weekly on Sunday at 03:00 UTC.
select cron.schedule(
  'carecomply-purge-stripe-events',
  '0 3 * * 0',
  $$select public.purge_old_stripe_events();$$
);

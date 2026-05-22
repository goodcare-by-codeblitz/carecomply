alter table public.carer_references
  add column if not exists reference_token text unique,
  add column if not exists token_expires_at timestamptz,
  add column if not exists last_chased_at timestamptz,
  add column if not exists chase_count integer not null default 0,
  add column if not exists request_attempted_at timestamptz;

create table if not exists public.reference_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  reference_id uuid not null references public.carer_references(id) on delete cascade,
  carer_id uuid not null references public.carers(id) on delete cascade,
  job_type text not null check (job_type in ('initial_request', 'chase', 'manager_notification')),
  status text not null default 'queued' check (status in ('queued', 'processing', 'sent', 'failed', 'skipped')),
  due_at timestamptz not null default now(),
  idempotency_key text not null unique,
  payload jsonb not null default '{}'::jsonb,
  attempts integer not null default 0,
  max_attempts integer not null default 5,
  locked_at timestamptz,
  locked_by text,
  last_error text,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reference_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  reference_id uuid references public.carer_references(id) on delete set null,
  reference_job_id uuid references public.reference_jobs(id) on delete set null,
  carer_id uuid references public.carers(id) on delete set null,
  channel text not null default 'email',
  recipient_type text not null check (recipient_type in ('referee', 'manager')),
  recipient_email text,
  status text not null,
  event_type text not null,
  error_message text,
  provider_message_id text,
  sent_at timestamptz not null default now()
);

alter table public.reference_jobs enable row level security;
alter table public.reference_logs enable row level security;

grant select, insert, update, delete on table public.reference_jobs to service_role;
grant select, insert, update, delete on table public.reference_logs to service_role;
grant select on table public.reference_logs to authenticated;

drop trigger if exists set_reference_jobs_updated_at on public.reference_jobs;
create trigger set_reference_jobs_updated_at
before update on public.reference_jobs
for each row
execute function public.set_updated_at();

create policy "Members can view reference logs"
on public.reference_logs
for select
to authenticated
using (public.has_org_permission(organization_id, 'carers.view'));

create or replace function public.enqueue_reference_chase_jobs(p_run_at timestamptz default now())
returns integer
language plpgsql
security definer
set search_path = public
as $function$
declare
  inserted_count integer := 0;
begin
  insert into public.reference_jobs (
    organization_id,
    reference_id,
    carer_id,
    job_type,
    due_at,
    idempotency_key,
    payload
  )
  select
    c.organization_id,
    r.id,
    r.carer_id,
    'chase',
    p_run_at,
    concat_ws(':', 'reference_chase', r.id::text, next_chase.chase_number::text),
    jsonb_build_object('chase_number', next_chase.chase_number)
  from public.carer_references r
  join public.carers c on c.id = r.carer_id
  cross join lateral (
    select case
      when r.request_sent_at <= p_run_at - interval '14 days'
        and coalesce(r.chase_count, 0) < 3 then 3
      when r.request_sent_at <= p_run_at - interval '7 days'
        and coalesce(r.chase_count, 0) < 2 then 2
      when r.request_sent_at <= p_run_at - interval '3 days'
        and coalesce(r.chase_count, 0) < 1 then 1
      else null
    end as chase_number
  ) next_chase
  where r.status = 'requested'
    and r.request_sent_at is not null
    and next_chase.chase_number is not null
    and c.status in ('pending', 'incomplete', 'active')
  on conflict (idempotency_key) do nothing;

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$function$;

create or replace function public.claim_reference_jobs(
  p_worker_id text,
  p_limit integer default 25
)
returns setof public.reference_jobs
language sql
security definer
set search_path = public
as $function$
  with candidates as (
    select id
    from public.reference_jobs
    where status = 'queued'
      and due_at <= now()
      and attempts < max_attempts
    order by due_at, created_at
    limit greatest(1, least(coalesce(p_limit, 25), 100))
    for update skip locked
  )
  update public.reference_jobs jobs
  set status = 'processing',
      attempts = attempts + 1,
      locked_at = now(),
      locked_by = p_worker_id,
      updated_at = now()
  from candidates
  where jobs.id = candidates.id
  returning jobs.*;
$function$;

select cron.unschedule('carecomply-enqueue-reference-chases')
where exists (
  select 1 from cron.job where jobname = 'carecomply-enqueue-reference-chases'
);

select cron.schedule(
  'carecomply-enqueue-reference-chases',
  '30 * * * *',
  $$select public.enqueue_reference_chase_jobs(now());$$
);

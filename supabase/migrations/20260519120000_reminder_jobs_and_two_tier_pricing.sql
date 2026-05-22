create extension if not exists "pg_net" with schema "extensions";

alter table public.organization_billing
  alter column plan set default 'starter';

alter table public.organization_billing
  drop constraint if exists organization_billing_plan_check;

update public.organization_billing
set plan = case
  when plan in ('complipro', 'guardian_plus') then 'pro'
  else 'starter'
end
where plan not in ('starter', 'pro');

alter table public.organization_billing
  add constraint organization_billing_plan_check
  check (plan in ('starter', 'pro'));

alter table public.reminders
  add column if not exists document_type_id uuid references public.document_types(id) on delete cascade,
  add column if not exists recipient_type text not null default 'carer',
  add column if not exists min_plan text not null default 'starter',
  add column if not exists subject_template text,
  add column if not exists is_system boolean not null default false;

alter table public.reminders
  drop constraint if exists reminders_trigger_type_check;

alter table public.reminders
  add constraint reminders_trigger_type_check
  check (trigger_type in ('days_before_expiry', 'days_after_expiry', 'days_after_upload', 'manual'));

alter table public.reminders
  drop constraint if exists reminders_recipient_type_check;

alter table public.reminders
  add constraint reminders_recipient_type_check
  check (recipient_type in ('carer', 'management'));

alter table public.reminders
  drop constraint if exists reminders_min_plan_check;

alter table public.reminders
  add constraint reminders_min_plan_check
  check (min_plan in ('starter', 'pro'));

create unique index if not exists reminders_system_unique
on public.reminders (organization_id, name)
where is_system = true;

create table if not exists public.reminder_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  reminder_id uuid references public.reminders(id) on delete set null,
  carer_id uuid not null references public.carers(id) on delete cascade,
  document_id uuid references public.documents(id) on delete set null,
  recipient_type text not null check (recipient_type in ('carer', 'management')),
  recipient_email text,
  recipient_name text,
  due_on date not null,
  idempotency_key text not null unique,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'queued' check (status in ('queued', 'processing', 'sent', 'failed', 'skipped')),
  attempts integer not null default 0,
  max_attempts integer not null default 5,
  locked_at timestamptz,
  locked_by text,
  next_attempt_at timestamptz not null default now(),
  last_error text,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.reminder_logs
  add column if not exists reminder_job_id uuid references public.reminder_jobs(id) on delete set null,
  add column if not exists recipient_type text not null default 'carer',
  add column if not exists recipient_email text;

alter table public.reminders enable row level security;
alter table public.reminder_jobs enable row level security;
alter table public.reminder_logs enable row level security;

grant select on table public.reminders to authenticated;
grant select on table public.reminder_logs to authenticated;
grant select, insert, update, delete on table public.reminders to service_role;
grant select, insert, update, delete on table public.reminder_jobs to service_role;
grant select, insert, update, delete on table public.reminder_logs to service_role;

drop policy if exists "Automation viewers can view reminders" on public.reminders;
create policy "Automation viewers can view reminders"
on public.reminders
for select
to authenticated
using (public.has_org_permission(organization_id, 'automations.view'));

drop policy if exists "Automation viewers can view reminder logs" on public.reminder_logs;
create policy "Automation viewers can view reminder logs"
on public.reminder_logs
for select
to authenticated
using (
  exists (
    select 1
    from public.carers c
    where c.id = reminder_logs.carer_id
      and public.has_org_permission(c.organization_id, 'automations.view')
  )
);

create or replace function public.ensure_default_reminders(p_org_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $function$
begin
  insert into public.reminders (
    organization_id,
    name,
    trigger_type,
    trigger_days,
    recipient_type,
    min_plan,
    subject_template,
    message_template,
    is_system,
    is_active
  )
  values
    (p_org_id, '30 day expiry reminder', 'days_before_expiry', 30, 'carer', 'starter', '{{document_type}} expires in 30 days', 'Hi {{carer_name}}, your {{document_type}} for {{organization_name}} expires on {{expiry_date}}. Please upload a renewed document here: {{onboarding_link}}', true, true),
    (p_org_id, '7 day expiry reminder', 'days_before_expiry', 7, 'carer', 'starter', '{{document_type}} expires in 7 days', 'Hi {{carer_name}}, your {{document_type}} for {{organization_name}} expires on {{expiry_date}}. Please upload a renewed document here: {{onboarding_link}}', true, true),
    (p_org_id, 'Expiry day reminder', 'days_before_expiry', 0, 'carer', 'starter', '{{document_type}} expires today', 'Hi {{carer_name}}, your {{document_type}} for {{organization_name}} expires today. Please upload a renewed document here: {{onboarding_link}}', true, true),
    (p_org_id, 'Management overdue escalation', 'days_after_expiry', 1, 'management', 'pro', '{{carer_name}} has an overdue {{document_type}}', '{{carer_name}} has not renewed {{document_type}} for {{organization_name}}. The document expired on {{expiry_date}}.', true, true)
  on conflict do nothing;
end;
$function$;

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

create or replace function public.organization_has_pro(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $function$
  select coalesce((
    select ob.plan = 'pro'
      and coalesce(ob.status, 'trialing') in ('trialing', 'active')
    from public.organization_billing ob
    where ob.organization_id = p_org_id
  ), false);
$function$;

create or replace function public.render_reminder_template(
  p_template text,
  p_carer_name text,
  p_document_type text,
  p_expiry_date date,
  p_onboarding_link text,
  p_organization_name text
)
returns text
language sql
immutable
as $function$
  select replace(replace(replace(replace(replace(coalesce(p_template, ''), '{{carer_name}}', coalesce(p_carer_name, '')), '{{document_type}}', coalesce(p_document_type, '')), '{{expiry_date}}', coalesce(to_char(p_expiry_date, 'DD Mon YYYY'), '')), '{{onboarding_link}}', coalesce(p_onboarding_link, '')), '{{organization_name}}', coalesce(p_organization_name, ''));
$function$;

create or replace function public.enqueue_document_expiry_reminders(p_run_date date default current_date)
returns integer
language plpgsql
security definer
set search_path = public
as $function$
declare
  inserted_count integer := 0;
begin
  perform public.ensure_default_reminders(id) from public.organizations;

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
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || worker_secret),
    body := jsonb_build_object('source', 'pg_cron')
  );
end;
$function$;

create or replace function public.claim_reminder_jobs(
  p_worker_id text,
  p_limit integer default 25
)
returns setof public.reminder_jobs
language sql
security definer
set search_path = public
as $function$
  with candidates as (
    select id
    from public.reminder_jobs
    where status = 'queued'
      and next_attempt_at <= now()
      and attempts < max_attempts
    order by next_attempt_at, created_at
    limit greatest(1, least(coalesce(p_limit, 25), 100))
    for update skip locked
  )
  update public.reminder_jobs jobs
  set status = 'processing',
      attempts = attempts + 1,
      locked_at = now(),
      locked_by = p_worker_id,
      updated_at = now()
  from candidates
  where jobs.id = candidates.id
  returning jobs.*;
$function$;

select cron.unschedule('carecomply-enqueue-document-expiry-reminders')
where exists (select 1 from cron.job where jobname = 'carecomply-enqueue-document-expiry-reminders');

select cron.schedule(
  'carecomply-enqueue-document-expiry-reminders',
  '15 * * * *',
  $$select public.enqueue_document_expiry_reminders(current_date);$$
);

select cron.unschedule('carecomply-call-reminder-worker')
where exists (select 1 from cron.job where jobname = 'carecomply-call-reminder-worker');

select cron.schedule(
  'carecomply-call-reminder-worker',
  '*/10 * * * *',
  $$select public.call_reminder_worker();$$
);

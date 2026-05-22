set check_function_bodies = on;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

create or replace function public.create_org_roles(org_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  admin_role_id uuid;
  manager_role_id uuid;
  viewer_role_id uuid;
begin
  insert into public.roles (organization_id, name, scope, is_system_role, description)
  values
    (org_id, 'admin', 'ORGANIZATION', true, 'Full org control'),
    (org_id, 'manager', 'ORGANIZATION', true, 'Manage operations'),
    (org_id, 'viewer', 'ORGANIZATION', true, 'Read only')
  on conflict (organization_id, name) do nothing;

  select id into admin_role_id
  from public.roles
  where organization_id = org_id
    and name = 'admin';

  select id into manager_role_id
  from public.roles
  where organization_id = org_id
    and name = 'manager';

  select id into viewer_role_id
  from public.roles
  where organization_id = org_id
    and name = 'viewer';

  insert into public.role_permissions (role_id, permission_id)
  select admin_role_id, id
  from public.permissions
  on conflict (role_id, permission_id) do nothing;

  insert into public.role_permissions (role_id, permission_id)
  select manager_role_id, id
  from public.permissions
  where code in (
    'carers.view',
    'carers.create',
    'documents.view',
    'documents.review',
    'automations.view',
    'audit.view'
  )
  on conflict (role_id, permission_id) do nothing;

  insert into public.role_permissions (role_id, permission_id)
  select viewer_role_id, id
  from public.permissions
  where code in ('carers.view', 'documents.view')
  on conflict (role_id, permission_id) do nothing;
end;
$function$;

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
    (
      p_org_id,
      '30 day expiry reminder',
      'days_before_expiry',
      30,
      'carer',
      'starter',
      '{{document_type}} expires in 30 days',
      'Hi {{carer_name}}, your {{document_type}} for {{organization_name}} expires on {{expiry_date}}. Please upload a renewed document here: {{onboarding_link}}',
      true,
      true
    ),
    (
      p_org_id,
      '7 day expiry reminder',
      'days_before_expiry',
      7,
      'carer',
      'starter',
      '{{document_type}} expires in 7 days',
      'Hi {{carer_name}}, your {{document_type}} for {{organization_name}} expires on {{expiry_date}}. Please upload a renewed document here: {{onboarding_link}}',
      true,
      true
    ),
    (
      p_org_id,
      'Expiry day reminder',
      'days_before_expiry',
      0,
      'carer',
      'starter',
      '{{document_type}} expires today',
      'Hi {{carer_name}}, your {{document_type}} for {{organization_name}} expires today. Please upload a renewed document here: {{onboarding_link}}',
      true,
      true
    ),
    (
      p_org_id,
      'Management overdue escalation',
      'days_after_expiry',
      1,
      'management',
      'pro',
      '{{carer_name}} has an overdue {{document_type}}',
      '{{carer_name}} has not renewed {{document_type}} for {{organization_name}}. The document expired on {{expiry_date}}.',
      true,
      true
    )
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

create or replace function public.has_org_permission(
  p_org_id uuid,
  p_permission_code text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $function$
  select exists (
    select 1
    from public.organization_memberships om
    join public.roles r on r.id = om.role_id
    join public.role_permissions rp on rp.role_id = r.id
    join public.permissions p on p.id = rp.permission_id
    where om.user_id = auth.uid()
      and om.organization_id = p_org_id
      and om.deleted_at is null
      and coalesce(om.status, 'active') in ('active', 'on_leave')
      and r.organization_id = p_org_id
      and p.code = p_permission_code
  );
$function$;

create or replace function public.is_org_member(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $function$
  select exists (
    select 1
    from public.organization_memberships om
    where om.user_id = auth.uid()
      and om.organization_id = p_org_id
      and om.deleted_at is null
      and coalesce(om.status, 'active') in ('active', 'on_leave')
  );
$function$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), new.email),
    new.email
  )
  on conflict (id) do nothing;

  return new;
end;
$function$;

drop trigger if exists set_organization_billing_updated_at on public.organization_billing;
create trigger set_organization_billing_updated_at
before update on public.organization_billing
for each row
execute function public.set_updated_at();

drop trigger if exists set_platform_settings_updated_at on public.platform_settings;
create trigger set_platform_settings_updated_at
before update on public.platform_settings
for each row
execute function public.set_updated_at();

drop trigger if exists set_reference_jobs_updated_at on public.reference_jobs;
create trigger set_reference_jobs_updated_at
before update on public.reference_jobs
for each row
execute function public.set_updated_at();

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

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
  select replace(
    replace(
      replace(
        replace(
          replace(
            coalesce(p_template, ''),
            '{{carer_name}}',
            coalesce(p_carer_name, '')
          ),
          '{{document_type}}',
          coalesce(p_document_type, '')
        ),
        '{{expiry_date}}',
        coalesce(to_char(p_expiry_date, 'DD Mon YYYY'), '')
      ),
      '{{onboarding_link}}',
      coalesce(p_onboarding_link, '')
    ),
    '{{organization_name}}',
    coalesce(p_organization_name, '')
  );
$function$;

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
    concat_ws(
      ':',
      r.id::text,
      d.id::text,
      r.recipient_type,
      p_run_date::text
    ),
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
          and (
            replacement.expiry_date is null
            or replacement.expiry_date >= p_run_date
          )
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

select cron.unschedule('carecomply-enqueue-reference-chases')
where exists (
  select 1 from cron.job where jobname = 'carecomply-enqueue-reference-chases'
);

select cron.schedule(
  'carecomply-enqueue-reference-chases',
  '30 * * * *',
  $$select public.enqueue_reference_chase_jobs(now());$$
);

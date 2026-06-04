insert into public.permissions (code, name, description, category)
values
  ('training.view', 'View Training', 'Can view onsite training requirements and records', 'Training'),
  ('training.record', 'Record Training', 'Can mark onsite training completed and observed', 'Training'),
  ('training.manage', 'Manage Training', 'Can configure onsite training requirements', 'Training')
on conflict (code) do update
set name = excluded.name,
    description = excluded.description,
    category = excluded.category;

create table if not exists public.training_requirements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  description text,
  is_required boolean not null default true,
  is_active boolean not null default true,
  validity_months integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  constraint training_requirements_validity_months_check check (
    validity_months is null
    or validity_months between 1 and 240
  ),
  constraint training_requirements_unique_org_name unique (organization_id, name)
);

create table if not exists public.carer_training_records (
  id uuid primary key default gen_random_uuid(),
  carer_id uuid not null references public.carers(id) on delete cascade,
  training_requirement_id uuid not null references public.training_requirements(id) on delete cascade,
  status text not null default 'pending' check (
    status in ('pending', 'completed', 'expired')
  ),
  observed_at date,
  observed_by uuid references public.profiles(id) on delete set null,
  observed_notes text,
  expiry_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  constraint carer_training_records_unique unique (carer_id, training_requirement_id),
  constraint carer_training_records_completed_check check (
    status <> 'completed'
    or observed_at is not null
  )
);

create index if not exists idx_training_requirements_org_active
on public.training_requirements (organization_id, is_active);

create index if not exists idx_carer_training_records_carer
on public.carer_training_records (carer_id);

create index if not exists idx_carer_training_records_expiry
on public.carer_training_records (expiry_date)
where status = 'completed' and expiry_date is not null;

drop trigger if exists set_training_requirements_updated_at on public.training_requirements;
create trigger set_training_requirements_updated_at
before update on public.training_requirements
for each row
execute function public.set_updated_at();

drop trigger if exists set_carer_training_records_updated_at on public.carer_training_records;
create trigger set_carer_training_records_updated_at
before update on public.carer_training_records
for each row
execute function public.set_updated_at();

alter table public.training_requirements enable row level security;
alter table public.carer_training_records enable row level security;

grant select on table public.training_requirements to authenticated;
grant select, insert, update, delete on table public.training_requirements to service_role;
grant select on table public.carer_training_records to authenticated;
grant select, insert, update, delete on table public.carer_training_records to service_role;

create policy "Training viewers can view requirements"
on public.training_requirements
for select
to authenticated
using (
  public.has_org_permission(organization_id, 'training.view')
  or public.has_org_permission(organization_id, 'training.record')
  or public.has_org_permission(organization_id, 'training.manage')
);

create policy "Training managers can create requirements"
on public.training_requirements
for insert
to authenticated
with check (public.has_org_permission(organization_id, 'training.manage'));

create policy "Training managers can update requirements"
on public.training_requirements
for update
to authenticated
using (public.has_org_permission(organization_id, 'training.manage'))
with check (public.has_org_permission(organization_id, 'training.manage'));

create policy "Training managers can delete requirements"
on public.training_requirements
for delete
to authenticated
using (public.has_org_permission(organization_id, 'training.manage'));

create policy "Training viewers can view carer records"
on public.carer_training_records
for select
to authenticated
using (
  exists (
    select 1
    from public.carers c
    where c.id = carer_training_records.carer_id
      and (
        public.has_org_permission(c.organization_id, 'training.view')
        or public.has_org_permission(c.organization_id, 'training.record')
        or public.has_org_permission(c.organization_id, 'training.manage')
      )
  )
);

create policy "Training recorders can create carer records"
on public.carer_training_records
for insert
to authenticated
with check (
  exists (
    select 1
    from public.carers c
    where c.id = carer_training_records.carer_id
      and public.has_org_permission(c.organization_id, 'training.record')
  )
);

create policy "Training recorders can update carer records"
on public.carer_training_records
for update
to authenticated
using (
  exists (
    select 1
    from public.carers c
    where c.id = carer_training_records.carer_id
      and public.has_org_permission(c.organization_id, 'training.record')
  )
)
with check (
  exists (
    select 1
    from public.carers c
    where c.id = carer_training_records.carer_id
      and public.has_org_permission(c.organization_id, 'training.record')
  )
);

alter table public.reminder_jobs
  add column if not exists training_record_id uuid
  references public.carer_training_records(id)
  on delete set null;

alter table public.reminder_logs
  add column if not exists training_record_id uuid
  references public.carer_training_records(id)
  on delete set null;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.code in (
  'training.view',
  'training.record',
  'training.manage'
)
where r.organization_id is not null
  and r.name = 'admin'
on conflict (role_id, permission_id) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.code in ('training.view', 'training.record')
where r.organization_id is not null
  and r.name = 'manager'
on conflict (role_id, permission_id) do nothing;

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
    'audit.view',
    'training.view',
    'training.record'
  )
  on conflict (role_id, permission_id) do nothing;

  insert into public.role_permissions (role_id, permission_id)
  select viewer_role_id, id
  from public.permissions
  where code in ('carers.view', 'documents.view')
  on conflict (role_id, permission_id) do nothing;
end;
$function$;

create or replace function public.enqueue_document_expiry_reminders(p_run_date date default current_date)
returns integer
language plpgsql
security definer
set search_path = public
as $function$
declare
  inserted_count integer := 0;
  training_inserted_count integer := 0;
begin
  perform public.ensure_default_reminders(id) from public.organizations;

  insert into public.reminder_jobs (
    organization_id,
    reminder_id,
    carer_id,
    document_id,
    training_record_id,
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
    null::uuid,
    r.recipient_type,
    case when r.recipient_type = 'carer' then c.email else null end,
    case when r.recipient_type = 'carer' then c.full_name else 'Management' end,
    p_run_date,
    concat_ws(':', r.id::text, d.id::text, r.recipient_type, p_run_date::text),
    jsonb_build_object(
      'item_kind', 'document',
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

  insert into public.reminder_jobs (
    organization_id,
    reminder_id,
    carer_id,
    document_id,
    training_record_id,
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
    null::uuid,
    ctr.id,
    r.recipient_type,
    case when r.recipient_type = 'carer' then c.email else null end,
    case when r.recipient_type = 'carer' then c.full_name else 'Management' end,
    p_run_date,
    concat_ws(':', 'training', r.id::text, ctr.id::text, r.recipient_type, p_run_date::text),
    jsonb_build_object(
      'item_kind', 'training',
      'carer_name', c.full_name,
      'carer_email', c.email,
      'document_type', tr.name,
      'training_requirement', tr.name,
      'training_requirement_id', tr.id,
      'training_record_id', ctr.id,
      'expiry_date', ctr.expiry_date,
      'organization_name', o.name,
      'organization_slug', o.slug,
      'subject_template', replace(coalesce(r.subject_template, '{{document_type}} expires on {{expiry_date}}'), '{{document_type}}', '{{training_requirement}}'),
      'message_template', replace(coalesce(r.message_template, 'Hi {{carer_name}}, your {{document_type}} for {{organization_name}} expires on {{expiry_date}}.'), '{{document_type}}', '{{training_requirement}}'),
      'trigger_type', r.trigger_type,
      'trigger_days', r.trigger_days
    )
  from public.carer_training_records ctr
  join public.carers c on c.id = ctr.carer_id
  join public.organizations o on o.id = c.organization_id
  join public.training_requirements tr on tr.id = ctr.training_requirement_id
  join public.reminders r on r.organization_id = c.organization_id
  left join public.organization_billing ob on ob.organization_id = c.organization_id
  where r.is_active = true
    and r.document_type_id is null
    and c.status = 'active'
    and tr.is_active = true
    and ctr.status = 'completed'
    and ctr.expiry_date is not null
    and (
      r.min_plan = 'starter'
      or (
        r.min_plan = 'pro'
        and coalesce(ob.plan, 'starter') = 'pro'
        and coalesce(ob.status, 'trialing') in ('trialing', 'active')
      )
    )
    and (
      (r.trigger_type = 'days_before_expiry' and ctr.expiry_date = p_run_date + coalesce(r.trigger_days, 0))
      or (r.trigger_type = 'days_after_expiry' and ctr.expiry_date = p_run_date - coalesce(r.trigger_days, 0))
    )
  on conflict (idempotency_key) do nothing;

  get diagnostics training_inserted_count = row_count;
  inserted_count := inserted_count + training_inserted_count;
  return inserted_count;
end;
$function$;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  logo_url text,
  logo_path text,
  created_at timestamptz default now(),
  required_work_references_count integer,
  required_character_references_count integer,
  constraint organizations_required_work_references_count_check check (
    required_work_references_count is null
    or required_work_references_count between 1 and 5
  ),
  constraint organizations_required_character_references_count_check check (
    required_character_references_count is null
    or required_character_references_count between 1 and 5
  ),
  constraint organizations_slug_format_check check (slug ~ '^[a-z]+(-[a-z]+)*$')
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  email text,
  is_super_admin boolean default false,
  last_active_at timestamptz,
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id),
  created_at timestamptz default now()
);

create table if not exists public.permissions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  category text not null,
  created_at timestamptz default now()
);

create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  name text not null,
  description text,
  is_system_role boolean default false,
  scope text not null default 'ORGANIZATION',
  created_at timestamptz default now(),
  constraint roles_unique_org_name unique (organization_id, name),
  constraint roles_scope_check check (scope in ('PLATFORM', 'ORGANIZATION'))
);

create table if not exists public.role_permissions (
  id uuid primary key default gen_random_uuid(),
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  created_at timestamptz default now(),
  constraint role_permissions_unique unique (role_id, permission_id)
);

create unique index if not exists roles_unique_platform_name
on public.roles (name)
where organization_id is null
  and scope = 'PLATFORM';

create table if not exists public.platform_memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  constraint platform_memberships_unique_user unique (user_id)
);

create table if not exists public.organization_memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  role_id uuid references public.roles(id) on delete set null,
  phone text,
  job_title text,
  department text,
  address_line1 text,
  address_line2 text,
  city text,
  county text,
  postcode text,
  emergency_contact_name text,
  emergency_contact_relationship text,
  emergency_contact_phone text,
  emergency_contact_email text,
  status text not null default 'active',
  previous_status text,
  status_changed_at timestamptz,
  status_changed_by uuid references auth.users(id) on delete set null,
  former_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz,
  deleted_at timestamptz,
  constraint organization_memberships_status_check check (
    status in ('active', 'on_leave', 'suspended', 'former')
  ),
  constraint org_membership_unique unique (user_id, organization_id)
);

create table if not exists public.carers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  full_name text not null,
  email text not null,
  phone text,
  address_line1 text,
  address_line2 text,
  city text,
  county text,
  postcode text,
  emergency_contact_name text,
  emergency_contact_relationship text,
  emergency_contact_phone text,
  emergency_contact_email text,
  status text default 'pending' check (
    status in ('pending', 'active', 'expired', 'incomplete', 'on_leave', 'suspended', 'former')
  ),
  onboarding_progress integer default 0,
  status_changed_at timestamptz,
  status_changed_by uuid references auth.users(id) on delete set null,
  previous_status text,
  former_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.document_types (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  description text,
  is_required boolean default true,
  expiry_months integer,
  created_at timestamptz default now()
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  carer_id uuid not null references public.carers(id) on delete cascade,
  document_type_id uuid not null references public.document_types(id) on delete cascade,
  file_name text not null,
  file_path text not null,
  file_size integer,
  status text default 'pending' check (
    status in ('pending', 'approved', 'rejected', 'expired', 'obsolete')
  ),
  expiry_date date,
  uploaded_at timestamptz default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id),
  rejection_reason text,
  review_notes text,
  superseded_by uuid references public.documents(id),
  superseded_at timestamptz
);

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

create table if not exists public.carer_references (
  id uuid primary key default gen_random_uuid(),
  carer_id uuid not null references public.carers(id) on delete cascade,
  full_name text not null,
  email text not null,
  phone text not null,
  organization text,
  relationship text not null,
  reference_type text not null default 'character' check (
    reference_type in ('work', 'character')
  ),
  notes text,
  status text not null default 'pending' check (
    status in ('pending', 'requested', 'responded', 'approved', 'rejected')
  ),
  reference_token text unique,
  token_expires_at timestamptz,
  request_sent_at timestamptz,
  request_attempted_at timestamptz,
  request_error text,
  response_received_at timestamptz,
  response_payload jsonb,
  response_url text,
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id),
  review_notes text,
  last_chased_at timestamptz,
  chase_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create table if not exists public.organization_billing (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  plan text not null default 'starter',
  interval text not null default 'monthly',
  status text not null default 'trialing',
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  stripe_price_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  trial_start timestamptz,
  trial_end timestamptz,
  grace_period_ends_at timestamptz,
  pending_checkout_session_id text,
  pending_checkout_url text,
  pending_checkout_plan text,
  pending_checkout_interval text,
  pending_checkout_expires_at timestamptz,
  last_billing_state_change_at timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organization_billing_plan_check check (
    plan in ('starter', 'pro')
  ),
  constraint organization_billing_interval_check check (
    interval in ('monthly', 'yearly')
  ),
  constraint organization_billing_status_check check (
    status in ('not_configured', 'trialing', 'active', 'past_due', 'canceled')
  ),
  constraint organization_billing_pending_checkout_plan_check check (
    pending_checkout_plan is null or pending_checkout_plan in ('starter', 'pro')
  ),
  constraint organization_billing_pending_checkout_interval_check check (
    pending_checkout_interval is null or pending_checkout_interval in ('monthly', 'yearly')
  )
);

create index if not exists idx_organization_billing_pending_checkout
on public.organization_billing (pending_checkout_session_id)
where pending_checkout_session_id is not null;

create table if not exists public.organization_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  invite_type text not null check (invite_type in ('team_member', 'carer')),
  email text not null,
  token text unique,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked', 'expired')),
  role_id uuid references public.roles(id) on delete set null,
  carer_id uuid references public.carers(id) on delete cascade,
  invited_by uuid references auth.users(id) on delete set null,
  accepted_by uuid references auth.users(id) on delete set null,
  revoked_by uuid references auth.users(id) on delete set null,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  document_type_id uuid references public.document_types(id) on delete cascade,
  name text not null,
  trigger_type text not null check (trigger_type in ('days_before_expiry', 'days_after_expiry', 'days_after_upload', 'manual')),
  trigger_days integer,
  recipient_type text not null default 'carer' check (recipient_type in ('carer', 'management')),
  min_plan text not null default 'starter' check (min_plan in ('starter', 'pro')),
  message_template text,
  subject_template text,
  is_system boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz

);

create unique index if not exists reminders_system_unique
on public.reminders (
  organization_id,
  name
)
where is_system = true;

create table if not exists public.reminder_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  reminder_id uuid references public.reminders(id) on delete set null,
  carer_id uuid not null references public.carers(id) on delete cascade,
  document_id uuid references public.documents(id) on delete set null,
  training_record_id uuid references public.carer_training_records(id) on delete set null,
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

create table if not exists public.reminder_logs (
  id uuid primary key default gen_random_uuid(),
  reminder_id uuid references public.reminders(id) on delete set null,
  reminder_job_id uuid references public.reminder_jobs(id) on delete set null,
  carer_id uuid not null references public.carers(id) on delete cascade,
  document_id uuid references public.documents(id) on delete set null,
  training_record_id uuid references public.carer_training_records(id) on delete set null,
  channel text not null default 'email',
  recipient_type text not null default 'carer',
  recipient_email text,
  status text not null,
  sent_at timestamptz not null default now(),
  error_message text,
  provider_message_id text
);

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

create table if not exists public.stripe_events (
  id text primary key,
  type text not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  payload jsonb not null,
  processing_status text not null default 'pending',
  processing_started_at timestamptz,
  processing_completed_at timestamptz,
  failed_at timestamptz,
  attempt_count integer not null default 0,
  last_error text,
  notification_keys text[] not null default '{}',
  constraint stripe_events_processing_status_check check (
    processing_status in ('pending', 'processing', 'processed', 'failed')
  )
);

create index if not exists idx_stripe_events_processing_status
on public.stripe_events (processing_status, received_at);

create table if not exists public.organization_usage_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  active_carers integer not null,
  snapshot_date date not null,
  created_at timestamptz not null default now(),
  constraint organization_usage_snapshots_active_carers_check check (active_carers >= 0),
  constraint organization_usage_snapshots_unique unique (organization_id, snapshot_date)
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  user_email text,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  entity_name text,
  category text,
  severity text default 'info' check (severity in ('info', 'warning', 'critical')),
  source text default 'api',
  cqc_key_question text check (
    cqc_key_question in ('safe', 'effective', 'caring', 'responsive', 'well_led')
  ),
  details jsonb not null default '{}'::jsonb,
  ip_address text,
  user_agent text,  
  created_at timestamptz not null default now()
);

create table if not exists public.audit_exports (
  id uuid primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  user_email text,
  format text not null check (format in ('csv', 'xlsx')),
  filters jsonb not null default '{}'::jsonb,
  row_count integer not null default 0,
  generated_at timestamptz not null,
  rows_hash text not null,
  file_hash text not null,
  manifest_hash text not null,
  signature text not null,
  verification_count integer not null default 0,
  last_verified_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.auth_audit_events (
  id uuid primary key default gen_random_uuid(),
  email text,
  user_id uuid references auth.users(id) on delete set null,
  outcome text not null check (outcome in ('attempted', 'success', 'failure', 'logout')),
  failure_reason text,
  matched_organization_ids uuid[] not null default '{}'::uuid[],
  details jsonb not null default '{}'::jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);

create table if not exists public.platform_settings (
  key text primary key,
  value text not null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

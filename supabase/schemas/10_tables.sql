create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  logo_url text,
  logo_path text,
  created_at timestamptz default now(),
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

create table if not exists public.organization_memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  role_id uuid references public.roles(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz,
  deleted_at timestamptz,
  constraint org_membership_unique unique (user_id, organization_id)
);

create table if not exists public.carers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  full_name text not null,
  email text not null,
  phone text,
  status text default 'pending' check (
    status in ('pending', 'active', 'expired', 'incomplete', 'on_leave', 'former')
  ),
  onboarding_progress integer default 0,
  status_changed_at timestamptz,
  status_changed_by uuid references auth.users(id) on delete set null,
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

create table if not exists public.carer_references (
  id uuid primary key default gen_random_uuid(),
  carer_id uuid not null references public.carers(id) on delete cascade,
  full_name text not null,
  email text not null,
  phone text not null,
  relationship text not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create table if not exists public.organization_billing (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  plan text not null default 'carecore',
  interval text not null default 'monthly',
  status text not null default 'trialing',
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  stripe_price_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  trial_start timestamptz,
  trial_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organization_billing_plan_check check (
    plan in ('carecore', 'safetrack', 'complipro', 'guardian_plus')
  ),
  constraint organization_billing_interval_check check (
    interval in ('monthly', 'yearly')
  ),
  constraint organization_billing_status_check check (
    status in ('not_configured', 'trialing', 'active', 'past_due', 'canceled')
  )
);


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
  name text not null,
  trigger_type text not null check (trigger_type in ('days_before_expiry', 'days_after_upload', 'manual')),
  trigger_days integer,
  message_template text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz

);

create table if not exists public.reminder_logs (
  id uuid primary key default gen_random_uuid(),
  reminder_id uuid references public.reminders(id) on delete set null,
  carer_id uuid not null references public.carers(id) on delete cascade,
  document_id uuid references public.documents(id) on delete set null,
  channel text not null default 'email',
  status text not null,
  sent_at timestamptz not null default now(),
  error_message text,
  provider_message_id text
);

create table if not exists public.stripe_events (
  id text primary key,
  type text not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  payload jsonb not null
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

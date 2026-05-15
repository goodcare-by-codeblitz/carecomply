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

alter table public.auth_audit_events enable row level security;

grant select, insert, update, delete on table public.auth_audit_events to service_role;

notify pgrst, 'reload schema';

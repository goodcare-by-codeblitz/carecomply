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

alter table public.audit_exports enable row level security;

drop policy if exists "Audit viewers can view organization audit exports" on public.audit_exports;
create policy "Audit viewers can view organization audit exports"
on public.audit_exports
for select
to authenticated
using (public.has_org_permission(organization_id, 'audit.view'));

grant select on table public.audit_exports to authenticated;
grant select, insert, update, delete on table public.audit_exports to service_role;

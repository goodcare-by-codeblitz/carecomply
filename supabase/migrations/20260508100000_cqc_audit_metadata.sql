alter table public.audit_logs
add column if not exists category text;

alter table public.audit_logs
add column if not exists severity text default 'info';

alter table public.audit_logs
add column if not exists source text default 'api';

alter table public.audit_logs
add column if not exists cqc_key_question text;

alter table public.audit_logs
drop constraint if exists audit_logs_severity_check;

alter table public.audit_logs
add constraint audit_logs_severity_check check (
  severity in ('info', 'warning', 'critical')
);

alter table public.audit_logs
drop constraint if exists audit_logs_cqc_key_question_check;

alter table public.audit_logs
add constraint audit_logs_cqc_key_question_check check (
  cqc_key_question in ('safe', 'effective', 'caring', 'responsive', 'well_led')
);

alter table public.audit_logs enable row level security;

drop policy if exists "Audit viewers can view organization audit logs" on public.audit_logs;
create policy "Audit viewers can view organization audit logs"
on public.audit_logs
for select
to authenticated
using (public.has_org_permission(organization_id, 'audit.view'));

grant select on table public.audit_logs to authenticated;
grant select, insert, update, delete on table public.audit_logs to service_role;

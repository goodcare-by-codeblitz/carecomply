alter table public.organization_billing
  drop constraint if exists organization_billing_plan_check;

alter table public.organization_billing
  alter column plan set default 'starter';

update public.organization_billing
set plan = case
  when plan in ('pro', 'complipro', 'guardian_plus') then 'pro'
  else 'starter'
end
where plan is distinct from case
  when plan in ('pro', 'complipro', 'guardian_plus') then 'pro'
  else 'starter'
end;

alter table public.organization_billing
  add constraint organization_billing_plan_check
  check (plan in ('starter', 'pro'));

-- Diagnostic check after migration:
-- select organization_id, plan from public.organization_billing where plan not in ('starter', 'pro');

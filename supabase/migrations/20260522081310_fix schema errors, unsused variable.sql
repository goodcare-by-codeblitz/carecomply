drop policy "Enable insert for authenticated users only" on "public"."organization_invitations";

drop policy "Team Members can update Organization info" on "public"."organizations";

alter table "public"."organizations" drop column "required_character_references_count";

alter table "public"."organizations" drop column "required_work_references_count";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.enqueue_document_expiry_reminders(p_run_date date DEFAULT CURRENT_DATE)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.ensure_default_reminders(p_org_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.render_reminder_template(p_template text, p_carer_name text, p_document_type text, p_expiry_date date, p_onboarding_link text, p_organization_name text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$
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
$function$
;

grant delete on table "public"."auth_audit_events" to "anon";

grant insert on table "public"."auth_audit_events" to "anon";

grant select on table "public"."auth_audit_events" to "anon";

grant update on table "public"."auth_audit_events" to "anon";

grant delete on table "public"."auth_audit_events" to "authenticated";

grant insert on table "public"."auth_audit_events" to "authenticated";

grant select on table "public"."auth_audit_events" to "authenticated";

grant update on table "public"."auth_audit_events" to "authenticated";


  create policy "Team Members can update Organization info"
  on "public"."organizations"
  as permissive
  for update
  to authenticated
with check (public.has_org_permission(id, 'organizations.edit'::text));




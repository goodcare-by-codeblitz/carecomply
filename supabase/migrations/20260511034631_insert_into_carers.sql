alter table "public"."organization_invitations" disable row level security;

alter table "public"."reminder_logs" disable row level security;

alter table "public"."reminders" disable row level security;

grant delete on table "public"."audit_logs" to "anon";

grant insert on table "public"."audit_logs" to "anon";

grant select on table "public"."audit_logs" to "anon";

grant update on table "public"."audit_logs" to "anon";

grant delete on table "public"."carer_references" to "anon";

grant insert on table "public"."carer_references" to "anon";

grant select on table "public"."carer_references" to "anon";

grant update on table "public"."carer_references" to "anon";

grant delete on table "public"."carer_references" to "authenticated";

grant insert on table "public"."carer_references" to "authenticated";

grant select on table "public"."carer_references" to "authenticated";

grant update on table "public"."carer_references" to "authenticated";

grant delete on table "public"."organization_billing" to "anon";

grant insert on table "public"."organization_billing" to "anon";

grant select on table "public"."organization_billing" to "anon";

grant update on table "public"."organization_billing" to "anon";

grant delete on table "public"."organization_billing" to "authenticated";

grant insert on table "public"."organization_billing" to "authenticated";

grant update on table "public"."organization_billing" to "authenticated";

grant delete on table "public"."organization_invitations" to "anon";

grant insert on table "public"."organization_invitations" to "anon";

grant select on table "public"."organization_invitations" to "anon";

grant update on table "public"."organization_invitations" to "anon";

grant delete on table "public"."reminder_logs" to "anon";

grant insert on table "public"."reminder_logs" to "anon";

grant select on table "public"."reminder_logs" to "anon";

grant update on table "public"."reminder_logs" to "anon";

grant delete on table "public"."reminders" to "anon";

grant insert on table "public"."reminders" to "anon";

grant select on table "public"."reminders" to "anon";

grant update on table "public"."reminders" to "anon";

grant delete on table "public"."stripe_events" to "anon";

grant insert on table "public"."stripe_events" to "anon";

grant select on table "public"."stripe_events" to "anon";

grant update on table "public"."stripe_events" to "anon";

grant delete on table "public"."stripe_events" to "authenticated";

grant insert on table "public"."stripe_events" to "authenticated";

grant select on table "public"."stripe_events" to "authenticated";

grant update on table "public"."stripe_events" to "authenticated";


  create policy "Members can delete carers"
  on "public"."carers"
  as permissive
  for delete
  to authenticated
using (public.has_org_permission(organization_id, 'carers.delete'::text));



  create policy "Members can edit carers"
  on "public"."carers"
  as permissive
  for update
  to authenticated
using (public.has_org_permission(organization_id, 'carers.edit'::text))
with check (public.has_org_permission(organization_id, 'carers.edit'::text));



  create policy "Members can view carers"
  on "public"."carers"
  as permissive
  for select
  to authenticated
using (public.has_org_permission(organization_id, 'carers.view'::text));



  create policy "Team Members can create carers"
  on "public"."carers"
  as permissive
  for insert
  to authenticated
with check (public.has_org_permission(organization_id, 'carers.create'::text));



  create policy "Members can review documents"
  on "public"."documents"
  as permissive
  for update
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.carers c
  WHERE ((c.id = documents.carer_id) AND public.has_org_permission(c.organization_id, 'documents.review'::text)))))
with check ((EXISTS ( SELECT 1
   FROM public.carers c
  WHERE ((c.id = documents.carer_id) AND public.has_org_permission(c.organization_id, 'documents.review'::text)))));



  create policy "Members can upload documents"
  on "public"."documents"
  as permissive
  for insert
  to authenticated
with check ((EXISTS ( SELECT 1
   FROM public.carers c
  WHERE ((c.id = documents.carer_id) AND public.has_org_permission(c.organization_id, 'documents.upload'::text)))));



  create policy "Members can view documents"
  on "public"."documents"
  as permissive
  for select
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.carers c
  WHERE ((c.id = documents.carer_id) AND public.has_org_permission(c.organization_id, 'documents.view'::text)))));




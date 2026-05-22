revoke delete on table "public"."auth_audit_events" from "anon";

revoke insert on table "public"."auth_audit_events" from "anon";

revoke select on table "public"."auth_audit_events" from "anon";

revoke update on table "public"."auth_audit_events" from "anon";

revoke delete on table "public"."auth_audit_events" from "authenticated";

revoke insert on table "public"."auth_audit_events" from "authenticated";

revoke select on table "public"."auth_audit_events" from "authenticated";

revoke update on table "public"."auth_audit_events" from "authenticated";

alter table "public"."reminder_logs" enable row level security;

alter table "public"."reminders" enable row level security;


  create policy "Enable insert for authenticated users only"
  on "public"."organization_invitations"
  as permissive
  for insert
  to authenticated
with check (public.has_org_permission(organization_id, 'team.invite'::text));




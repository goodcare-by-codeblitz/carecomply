drop policy "Members can create carers" on "public"."carers";

drop policy "Members can delete carers" on "public"."carers";

drop policy "Members can edit carers" on "public"."carers";

drop policy "Members can view carers" on "public"."carers";

drop policy "Members can review documents" on "public"."documents";

drop policy "Members can upload documents" on "public"."documents";

drop policy "Members can view documents" on "public"."documents";

revoke delete on table "public"."audit_logs" from "anon";

revoke insert on table "public"."audit_logs" from "anon";

revoke select on table "public"."audit_logs" from "anon";

revoke update on table "public"."audit_logs" from "anon";

revoke delete on table "public"."carer_references" from "anon";

revoke insert on table "public"."carer_references" from "anon";

revoke select on table "public"."carer_references" from "anon";

revoke update on table "public"."carer_references" from "anon";

revoke delete on table "public"."carer_references" from "authenticated";

revoke insert on table "public"."carer_references" from "authenticated";

revoke select on table "public"."carer_references" from "authenticated";

revoke update on table "public"."carer_references" from "authenticated";

revoke delete on table "public"."organization_billing" from "anon";

revoke insert on table "public"."organization_billing" from "anon";

revoke select on table "public"."organization_billing" from "anon";

revoke update on table "public"."organization_billing" from "anon";

revoke delete on table "public"."organization_billing" from "authenticated";

revoke insert on table "public"."organization_billing" from "authenticated";

revoke update on table "public"."organization_billing" from "authenticated";

revoke delete on table "public"."organization_invitations" from "anon";

revoke insert on table "public"."organization_invitations" from "anon";

revoke select on table "public"."organization_invitations" from "anon";

revoke update on table "public"."organization_invitations" from "anon";

revoke delete on table "public"."reminder_logs" from "anon";

revoke insert on table "public"."reminder_logs" from "anon";

revoke select on table "public"."reminder_logs" from "anon";

revoke update on table "public"."reminder_logs" from "anon";

revoke delete on table "public"."reminders" from "anon";

revoke insert on table "public"."reminders" from "anon";

revoke select on table "public"."reminders" from "anon";

revoke update on table "public"."reminders" from "anon";

revoke delete on table "public"."stripe_events" from "anon";

revoke insert on table "public"."stripe_events" from "anon";

revoke select on table "public"."stripe_events" from "anon";

revoke update on table "public"."stripe_events" from "anon";

revoke delete on table "public"."stripe_events" from "authenticated";

revoke insert on table "public"."stripe_events" from "authenticated";

revoke select on table "public"."stripe_events" from "authenticated";

revoke update on table "public"."stripe_events" from "authenticated";

alter table "public"."organization_invitations" enable row level security;

alter table "public"."reminder_logs" enable row level security;

alter table "public"."reminders" enable row level security;



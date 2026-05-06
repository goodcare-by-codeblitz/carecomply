
  create table "public"."audit_logs" (
    "id" uuid not null default gen_random_uuid(),
    "organization_id" uuid not null,
    "user_id" uuid,
    "user_email" text,
    "action" text not null,
    "entity_type" text not null,
    "entity_id" uuid,
    "entity_name" text,
    "details" jsonb not null default '{}'::jsonb,
    "ip_address" text,
    "user_agent" text,
    "created_at" timestamp with time zone not null default now()
      );



  create table "public"."organization_invitations" (
    "id" uuid not null default gen_random_uuid(),
    "organization_id" uuid not null,
    "invite_type" text not null,
    "email" text not null,
    "token" text,
    "status" text not null default 'pending'::text,
    "role_id" uuid,
    "carer_id" uuid,
    "invited_by" uuid,
    "accepted_by" uuid,
    "revoked_by" uuid,
    "expires_at" timestamp with time zone,
    "revoked_at" timestamp with time zone,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone
      );



  create table "public"."reminder_logs" (
    "id" uuid not null default gen_random_uuid(),
    "reminder_id" uuid,
    "carer_id" uuid not null,
    "document_id" uuid,
    "channel" text not null default 'email'::text,
    "status" text not null,
    "sent_at" timestamp with time zone not null default now(),
    "error_message" text,
    "provider_message_id" text
      );



  create table "public"."reminders" (
    "id" uuid not null default gen_random_uuid(),
    "organization_id" uuid not null,
    "name" text not null,
    "trigger_type" text not null,
    "trigger_days" integer,
    "message_template" text,
    "is_active" boolean not null default true,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone
      );


CREATE UNIQUE INDEX audit_logs_pkey ON public.audit_logs USING btree (id);

CREATE UNIQUE INDEX organization_invitations_pkey ON public.organization_invitations USING btree (id);

CREATE UNIQUE INDEX organization_invitations_token_key ON public.organization_invitations USING btree (token);

CREATE UNIQUE INDEX reminder_logs_pkey ON public.reminder_logs USING btree (id);

CREATE UNIQUE INDEX reminders_pkey ON public.reminders USING btree (id);

alter table "public"."audit_logs" add constraint "audit_logs_pkey" PRIMARY KEY using index "audit_logs_pkey";

alter table "public"."organization_invitations" add constraint "organization_invitations_pkey" PRIMARY KEY using index "organization_invitations_pkey";

alter table "public"."reminder_logs" add constraint "reminder_logs_pkey" PRIMARY KEY using index "reminder_logs_pkey";

alter table "public"."reminders" add constraint "reminders_pkey" PRIMARY KEY using index "reminders_pkey";

alter table "public"."audit_logs" add constraint "audit_logs_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE not valid;

alter table "public"."audit_logs" validate constraint "audit_logs_organization_id_fkey";

alter table "public"."audit_logs" add constraint "audit_logs_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL not valid;

alter table "public"."audit_logs" validate constraint "audit_logs_user_id_fkey";

alter table "public"."organization_invitations" add constraint "organization_invitations_accepted_by_fkey" FOREIGN KEY (accepted_by) REFERENCES auth.users(id) ON DELETE SET NULL not valid;

alter table "public"."organization_invitations" validate constraint "organization_invitations_accepted_by_fkey";

alter table "public"."organization_invitations" add constraint "organization_invitations_carer_id_fkey" FOREIGN KEY (carer_id) REFERENCES public.carers(id) ON DELETE CASCADE not valid;

alter table "public"."organization_invitations" validate constraint "organization_invitations_carer_id_fkey";

alter table "public"."organization_invitations" add constraint "organization_invitations_invite_type_check" CHECK ((invite_type = ANY (ARRAY['team_member'::text, 'carer'::text]))) not valid;

alter table "public"."organization_invitations" validate constraint "organization_invitations_invite_type_check";

alter table "public"."organization_invitations" add constraint "organization_invitations_invited_by_fkey" FOREIGN KEY (invited_by) REFERENCES auth.users(id) ON DELETE SET NULL not valid;

alter table "public"."organization_invitations" validate constraint "organization_invitations_invited_by_fkey";

alter table "public"."organization_invitations" add constraint "organization_invitations_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE not valid;

alter table "public"."organization_invitations" validate constraint "organization_invitations_organization_id_fkey";

alter table "public"."organization_invitations" add constraint "organization_invitations_revoked_by_fkey" FOREIGN KEY (revoked_by) REFERENCES auth.users(id) ON DELETE SET NULL not valid;

alter table "public"."organization_invitations" validate constraint "organization_invitations_revoked_by_fkey";

alter table "public"."organization_invitations" add constraint "organization_invitations_role_id_fkey" FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE SET NULL not valid;

alter table "public"."organization_invitations" validate constraint "organization_invitations_role_id_fkey";

alter table "public"."organization_invitations" add constraint "organization_invitations_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'accepted'::text, 'revoked'::text, 'expired'::text]))) not valid;

alter table "public"."organization_invitations" validate constraint "organization_invitations_status_check";

alter table "public"."organization_invitations" add constraint "organization_invitations_token_key" UNIQUE using index "organization_invitations_token_key";

alter table "public"."reminder_logs" add constraint "reminder_logs_carer_id_fkey" FOREIGN KEY (carer_id) REFERENCES public.carers(id) ON DELETE CASCADE not valid;

alter table "public"."reminder_logs" validate constraint "reminder_logs_carer_id_fkey";

alter table "public"."reminder_logs" add constraint "reminder_logs_document_id_fkey" FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE SET NULL not valid;

alter table "public"."reminder_logs" validate constraint "reminder_logs_document_id_fkey";

alter table "public"."reminder_logs" add constraint "reminder_logs_reminder_id_fkey" FOREIGN KEY (reminder_id) REFERENCES public.reminders(id) ON DELETE SET NULL not valid;

alter table "public"."reminder_logs" validate constraint "reminder_logs_reminder_id_fkey";

alter table "public"."reminders" add constraint "reminders_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE not valid;

alter table "public"."reminders" validate constraint "reminders_organization_id_fkey";

alter table "public"."reminders" add constraint "reminders_trigger_type_check" CHECK ((trigger_type = ANY (ARRAY['days_before_expiry'::text, 'days_after_upload'::text, 'manual'::text]))) not valid;

alter table "public"."reminders" validate constraint "reminders_trigger_type_check";


grant delete on table "public"."audit_logs" to "authenticated";

grant insert on table "public"."audit_logs" to "authenticated";

grant references on table "public"."audit_logs" to "authenticated";

grant select on table "public"."audit_logs" to "authenticated";

grant trigger on table "public"."audit_logs" to "authenticated";

grant truncate on table "public"."audit_logs" to "authenticated";

grant update on table "public"."audit_logs" to "authenticated";

grant delete on table "public"."audit_logs" to "service_role";

grant insert on table "public"."audit_logs" to "service_role";

grant references on table "public"."audit_logs" to "service_role";

grant select on table "public"."audit_logs" to "service_role";

grant trigger on table "public"."audit_logs" to "service_role";

grant truncate on table "public"."audit_logs" to "service_role";

grant update on table "public"."audit_logs" to "service_role";


grant delete on table "public"."organization_invitations" to "authenticated";

grant insert on table "public"."organization_invitations" to "authenticated";

grant references on table "public"."organization_invitations" to "authenticated";

grant select on table "public"."organization_invitations" to "authenticated";

grant trigger on table "public"."organization_invitations" to "authenticated";

grant truncate on table "public"."organization_invitations" to "authenticated";

grant update on table "public"."organization_invitations" to "authenticated";

grant delete on table "public"."organization_invitations" to "service_role";

grant insert on table "public"."organization_invitations" to "service_role";

grant references on table "public"."organization_invitations" to "service_role";

grant select on table "public"."organization_invitations" to "service_role";

grant trigger on table "public"."organization_invitations" to "service_role";

grant truncate on table "public"."organization_invitations" to "service_role";

grant update on table "public"."organization_invitations" to "service_role";

grant delete on table "public"."reminder_logs" to "authenticated";

grant insert on table "public"."reminder_logs" to "authenticated";

grant references on table "public"."reminder_logs" to "authenticated";

grant select on table "public"."reminder_logs" to "authenticated";

grant trigger on table "public"."reminder_logs" to "authenticated";

grant truncate on table "public"."reminder_logs" to "authenticated";

grant update on table "public"."reminder_logs" to "authenticated";

grant delete on table "public"."reminder_logs" to "service_role";

grant insert on table "public"."reminder_logs" to "service_role";

grant references on table "public"."reminder_logs" to "service_role";

grant select on table "public"."reminder_logs" to "service_role";

grant trigger on table "public"."reminder_logs" to "service_role";

grant truncate on table "public"."reminder_logs" to "service_role";

grant update on table "public"."reminder_logs" to "service_role";

grant delete on table "public"."reminders" to "authenticated";

grant insert on table "public"."reminders" to "authenticated";

grant references on table "public"."reminders" to "authenticated";

grant select on table "public"."reminders" to "authenticated";

grant trigger on table "public"."reminders" to "authenticated";

grant truncate on table "public"."reminders" to "authenticated";

grant update on table "public"."reminders" to "authenticated";

grant delete on table "public"."reminders" to "service_role";

grant insert on table "public"."reminders" to "service_role";

grant references on table "public"."reminders" to "service_role";

grant select on table "public"."reminders" to "service_role";

grant trigger on table "public"."reminders" to "service_role";

grant truncate on table "public"."reminders" to "service_role";

grant update on table "public"."reminders" to "service_role";



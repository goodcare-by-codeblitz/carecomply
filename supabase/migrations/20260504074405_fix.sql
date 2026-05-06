create extension if not exists "pg_cron" with schema "pg_catalog";

create extension if not exists "wrappers" with schema "extensions";


  create table "public"."carers" (
    "id" uuid not null default gen_random_uuid(),
    "organization_id" uuid not null,
    "full_name" text not null,
    "email" text not null,
    "phone" text,
    "status" text default 'pending'::text,
    "onboarding_progress" integer default 0,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
      );





  create table "public"."document_types" (
    "id" uuid not null default gen_random_uuid(),
    "organization_id" uuid not null,
    "name" text not null,
    "description" text,
    "is_required" boolean default true,
    "expiry_months" integer,
    "created_at" timestamp with time zone default now()
      );

alter table "public"."carers" enable row level security;
alter table "public"."document_types" enable row level security;


  create table "public"."documents" (
    "id" uuid not null default gen_random_uuid(),
    "carer_id" uuid not null,
    "document_type_id" uuid not null,
    "file_name" text not null,
    "file_path" text not null,
    "file_size" integer,
    "status" text default 'pending'::text,
    "expiry_date" date,
    "uploaded_at" timestamp with time zone default now(),
    "reviewed_at" timestamp with time zone,
    "reviewed_by" uuid
      );


alter table "public"."documents" enable row level security;


  create table "public"."organization_memberships" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid,
    "organization_id" uuid,
    "role_id" uuid,
    "created_at" timestamp with time zone default now()
      );


alter table "public"."organization_memberships" enable row level security;


  create table "public"."organizations" (
    "id" uuid not null default gen_random_uuid(),
    "name" text not null,
    "slug" text not null,
    "created_at" timestamp with time zone default now()
      );


alter table "public"."organizations" enable row level security;


  create table "public"."permissions" (
    "id" uuid not null default gen_random_uuid(),
    "code" text not null,
    "name" text not null,
    "description" text,
    "category" text not null,
    "created_at" timestamp with time zone default now()
      );


alter table "public"."permissions" enable row level security;


  create table "public"."profiles" (
    "id" uuid not null,
    "full_name" text,
    "avatar_url" text,
    "email" text,
    "is_super_admin" boolean default false,
    "last_active_at" timestamp with time zone,
    "deleted_at" timestamp with time zone,
    "deleted_by" uuid,
    "created_at" timestamp with time zone default now()
      );


alter table "public"."profiles" enable row level security;


  create table "public"."role_permissions" (
    "id" uuid not null default gen_random_uuid(),
    "role_id" uuid not null,
    "permission_id" uuid not null,
    "created_at" timestamp with time zone default now()
      );


alter table "public"."role_permissions" enable row level security;


  create table "public"."roles" (
    "id" uuid not null default gen_random_uuid(),
    "organization_id" uuid,
    "name" text not null,
    "description" text,
    "is_system_role" boolean default false,
    "scope" text not null default 'ORGANIZATION'::text,
    "created_at" timestamp with time zone default now()
      );


alter table "public"."roles" enable row level security;

CREATE UNIQUE INDEX carers_pkey ON public.carers USING btree (id);

CREATE UNIQUE INDEX document_types_pkey ON public.document_types USING btree (id);

CREATE UNIQUE INDEX documents_pkey ON public.documents USING btree (id);

CREATE UNIQUE INDEX org_membership_unique ON public.organization_memberships USING btree (user_id, organization_id);

CREATE UNIQUE INDEX organization_memberships_pkey ON public.organization_memberships USING btree (id);

CREATE UNIQUE INDEX organizations_pkey ON public.organizations USING btree (id);

CREATE UNIQUE INDEX organizations_slug_key ON public.organizations USING btree (slug);

CREATE UNIQUE INDEX permissions_code_key ON public.permissions USING btree (code);

CREATE UNIQUE INDEX permissions_pkey ON public.permissions USING btree (id);

CREATE UNIQUE INDEX profiles_pkey ON public.profiles USING btree (id);

CREATE UNIQUE INDEX role_permissions_pkey ON public.role_permissions USING btree (id);

CREATE UNIQUE INDEX role_permissions_unique ON public.role_permissions USING btree (role_id, permission_id);

CREATE UNIQUE INDEX roles_pkey ON public.roles USING btree (id);

CREATE UNIQUE INDEX roles_unique_org_name ON public.roles USING btree (organization_id, name);

alter table "public"."carers" add constraint "carers_pkey" PRIMARY KEY using index "carers_pkey";

alter table "public"."document_types" add constraint "document_types_pkey" PRIMARY KEY using index "document_types_pkey";

alter table "public"."documents" add constraint "documents_pkey" PRIMARY KEY using index "documents_pkey";

alter table "public"."organization_memberships" add constraint "organization_memberships_pkey" PRIMARY KEY using index "organization_memberships_pkey";

alter table "public"."organizations" add constraint "organizations_pkey" PRIMARY KEY using index "organizations_pkey";

alter table "public"."permissions" add constraint "permissions_pkey" PRIMARY KEY using index "permissions_pkey";

alter table "public"."profiles" add constraint "profiles_pkey" PRIMARY KEY using index "profiles_pkey";

alter table "public"."role_permissions" add constraint "role_permissions_pkey" PRIMARY KEY using index "role_permissions_pkey";

alter table "public"."roles" add constraint "roles_pkey" PRIMARY KEY using index "roles_pkey";

alter table "public"."carers" add constraint "carers_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE not valid;

alter table "public"."carers" validate constraint "carers_organization_id_fkey";

alter table "public"."carers" add constraint "carers_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'active'::text, 'expired'::text, 'incomplete'::text]))) not valid;

alter table "public"."carers" validate constraint "carers_status_check";

alter table "public"."document_types" add constraint "document_types_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE not valid;

alter table "public"."document_types" validate constraint "document_types_organization_id_fkey";

alter table "public"."documents" add constraint "documents_carer_id_fkey" FOREIGN KEY (carer_id) REFERENCES public.carers(id) ON DELETE CASCADE not valid;

alter table "public"."documents" validate constraint "documents_carer_id_fkey";

alter table "public"."documents" add constraint "documents_document_type_id_fkey" FOREIGN KEY (document_type_id) REFERENCES public.document_types(id) ON DELETE CASCADE not valid;

alter table "public"."documents" validate constraint "documents_document_type_id_fkey";

alter table "public"."documents" add constraint "documents_reviewed_by_fkey" FOREIGN KEY (reviewed_by) REFERENCES public.profiles(id) not valid;

alter table "public"."documents" validate constraint "documents_reviewed_by_fkey";

alter table "public"."documents" add constraint "documents_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'expired'::text]))) not valid;

alter table "public"."documents" validate constraint "documents_status_check";

alter table "public"."organization_memberships" add constraint "org_membership_unique" UNIQUE using index "org_membership_unique";

alter table "public"."organization_memberships" add constraint "organization_memberships_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE not valid;

alter table "public"."organization_memberships" validate constraint "organization_memberships_organization_id_fkey";

alter table "public"."organization_memberships" add constraint "organization_memberships_role_id_fkey" FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE SET NULL not valid;

alter table "public"."organization_memberships" validate constraint "organization_memberships_role_id_fkey";

alter table "public"."organization_memberships" add constraint "organization_memberships_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."organization_memberships" validate constraint "organization_memberships_user_id_fkey";

alter table "public"."organizations" add constraint "organizations_slug_key" UNIQUE using index "organizations_slug_key";

alter table "public"."permissions" add constraint "permissions_code_key" UNIQUE using index "permissions_code_key";

alter table "public"."profiles" add constraint "profiles_deleted_by_fkey" FOREIGN KEY (deleted_by) REFERENCES auth.users(id) not valid;

alter table "public"."profiles" validate constraint "profiles_deleted_by_fkey";

alter table "public"."profiles" add constraint "profiles_id_fkey" FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."profiles" validate constraint "profiles_id_fkey";

alter table "public"."role_permissions" add constraint "role_permissions_permission_id_fkey" FOREIGN KEY (permission_id) REFERENCES public.permissions(id) ON DELETE CASCADE not valid;

alter table "public"."role_permissions" validate constraint "role_permissions_permission_id_fkey";

alter table "public"."role_permissions" add constraint "role_permissions_role_id_fkey" FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE CASCADE not valid;

alter table "public"."role_permissions" validate constraint "role_permissions_role_id_fkey";

alter table "public"."role_permissions" add constraint "role_permissions_unique" UNIQUE using index "role_permissions_unique";

alter table "public"."roles" add constraint "roles_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE not valid;

alter table "public"."roles" validate constraint "roles_organization_id_fkey";

alter table "public"."roles" add constraint "roles_scope_check" CHECK ((scope = ANY (ARRAY['PLATFORM'::text, 'ORGANIZATION'::text]))) not valid;

alter table "public"."roles" validate constraint "roles_scope_check";

alter table "public"."roles" add constraint "roles_unique_org_name" UNIQUE using index "roles_unique_org_name";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.create_organization_with_roles(p_user_id uuid, org_name text, org_slug text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$DECLARE org_id UUID; admin_role_id UUID; 
	BEGIN

	INSERT INTO
		organizations (name, slug)
	VALUES
		(org_name, org_slug) RETURNING id INTO org_id;

	PERFORM create_org_roles (org_id);

	-- get admin role 
	SELECT id INTO admin_role_id
	FROM
		roles
	WHERE
		organization_id = org_id
		AND name = 'admin';

	-- assign membership 
	INSERT INTO
		organization_memberships (user_id, organization_id, role_id)
	VALUES
		(p_user_id, org_id, admin_role_id)
ON CONFLICT (user_id, organization_id) DO NOTHING; END;$function$
;

CREATE OR REPLACE FUNCTION public.has_org_permission(p_org_id uuid, p_permission_code text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
SELECT  exists (
SELECT  1
FROM organization_memberships om
JOIN roles r
ON r.id = om.role_id
JOIN role_permissions rp
ON rp.role_id = r.id
JOIN permissions p
ON p.id = rp.permission_id
WHERE om.user_id = auth.uid()
AND om.organization_id = p_org_id
AND r.organization_id = p_org_id
AND p.code = p_permission_code ); $function$
;

grant delete on table "public"."carers" to "anon";

grant insert on table "public"."carers" to "anon";

grant references on table "public"."carers" to "anon";

grant select on table "public"."carers" to "anon";

grant trigger on table "public"."carers" to "anon";

grant truncate on table "public"."carers" to "anon";

grant update on table "public"."carers" to "anon";

grant delete on table "public"."carers" to "authenticated";

grant insert on table "public"."carers" to "authenticated";

grant references on table "public"."carers" to "authenticated";

grant select on table "public"."carers" to "authenticated";

grant trigger on table "public"."carers" to "authenticated";

grant truncate on table "public"."carers" to "authenticated";

grant update on table "public"."carers" to "authenticated";

grant delete on table "public"."carers" to "service_role";

grant insert on table "public"."carers" to "service_role";

grant references on table "public"."carers" to "service_role";

grant select on table "public"."carers" to "service_role";

grant trigger on table "public"."carers" to "service_role";

grant truncate on table "public"."carers" to "service_role";

grant update on table "public"."carers" to "service_role";

grant delete on table "public"."document_types" to "anon";

grant insert on table "public"."document_types" to "anon";

grant references on table "public"."document_types" to "anon";

grant select on table "public"."document_types" to "anon";

grant trigger on table "public"."document_types" to "anon";

grant truncate on table "public"."document_types" to "anon";

grant update on table "public"."document_types" to "anon";

grant delete on table "public"."document_types" to "authenticated";

grant insert on table "public"."document_types" to "authenticated";

grant references on table "public"."document_types" to "authenticated";

grant select on table "public"."document_types" to "authenticated";

grant trigger on table "public"."document_types" to "authenticated";

grant truncate on table "public"."document_types" to "authenticated";

grant update on table "public"."document_types" to "authenticated";

grant delete on table "public"."document_types" to "service_role";

grant insert on table "public"."document_types" to "service_role";

grant references on table "public"."document_types" to "service_role";

grant select on table "public"."document_types" to "service_role";

grant trigger on table "public"."document_types" to "service_role";

grant truncate on table "public"."document_types" to "service_role";

grant update on table "public"."document_types" to "service_role";

grant delete on table "public"."documents" to "anon";

grant insert on table "public"."documents" to "anon";

grant references on table "public"."documents" to "anon";

grant select on table "public"."documents" to "anon";

grant trigger on table "public"."documents" to "anon";

grant truncate on table "public"."documents" to "anon";

grant update on table "public"."documents" to "anon";

grant delete on table "public"."documents" to "authenticated";

grant insert on table "public"."documents" to "authenticated";

grant references on table "public"."documents" to "authenticated";

grant select on table "public"."documents" to "authenticated";

grant trigger on table "public"."documents" to "authenticated";

grant truncate on table "public"."documents" to "authenticated";

grant update on table "public"."documents" to "authenticated";

grant delete on table "public"."documents" to "service_role";

grant insert on table "public"."documents" to "service_role";

grant references on table "public"."documents" to "service_role";

grant select on table "public"."documents" to "service_role";

grant trigger on table "public"."documents" to "service_role";

grant truncate on table "public"."documents" to "service_role";

grant update on table "public"."documents" to "service_role";

grant delete on table "public"."organization_memberships" to "anon";

grant insert on table "public"."organization_memberships" to "anon";

grant references on table "public"."organization_memberships" to "anon";

grant select on table "public"."organization_memberships" to "anon";

grant trigger on table "public"."organization_memberships" to "anon";

grant truncate on table "public"."organization_memberships" to "anon";

grant update on table "public"."organization_memberships" to "anon";

grant delete on table "public"."organization_memberships" to "authenticated";

grant insert on table "public"."organization_memberships" to "authenticated";

grant references on table "public"."organization_memberships" to "authenticated";

grant select on table "public"."organization_memberships" to "authenticated";

grant trigger on table "public"."organization_memberships" to "authenticated";

grant truncate on table "public"."organization_memberships" to "authenticated";

grant update on table "public"."organization_memberships" to "authenticated";

grant delete on table "public"."organization_memberships" to "service_role";

grant insert on table "public"."organization_memberships" to "service_role";

grant references on table "public"."organization_memberships" to "service_role";

grant select on table "public"."organization_memberships" to "service_role";

grant trigger on table "public"."organization_memberships" to "service_role";

grant truncate on table "public"."organization_memberships" to "service_role";

grant update on table "public"."organization_memberships" to "service_role";

grant delete on table "public"."organizations" to "anon";

grant insert on table "public"."organizations" to "anon";

grant references on table "public"."organizations" to "anon";

grant select on table "public"."organizations" to "anon";

grant trigger on table "public"."organizations" to "anon";

grant truncate on table "public"."organizations" to "anon";

grant update on table "public"."organizations" to "anon";

grant delete on table "public"."organizations" to "authenticated";

grant insert on table "public"."organizations" to "authenticated";

grant references on table "public"."organizations" to "authenticated";

grant select on table "public"."organizations" to "authenticated";

grant trigger on table "public"."organizations" to "authenticated";

grant truncate on table "public"."organizations" to "authenticated";

grant update on table "public"."organizations" to "authenticated";

grant delete on table "public"."organizations" to "service_role";

grant insert on table "public"."organizations" to "service_role";

grant references on table "public"."organizations" to "service_role";

grant select on table "public"."organizations" to "service_role";

grant trigger on table "public"."organizations" to "service_role";

grant truncate on table "public"."organizations" to "service_role";

grant update on table "public"."organizations" to "service_role";

grant delete on table "public"."permissions" to "anon";

grant insert on table "public"."permissions" to "anon";

grant references on table "public"."permissions" to "anon";

grant select on table "public"."permissions" to "anon";

grant trigger on table "public"."permissions" to "anon";

grant truncate on table "public"."permissions" to "anon";

grant update on table "public"."permissions" to "anon";

grant delete on table "public"."permissions" to "authenticated";

grant insert on table "public"."permissions" to "authenticated";

grant references on table "public"."permissions" to "authenticated";

grant select on table "public"."permissions" to "authenticated";

grant trigger on table "public"."permissions" to "authenticated";

grant truncate on table "public"."permissions" to "authenticated";

grant update on table "public"."permissions" to "authenticated";

grant delete on table "public"."permissions" to "service_role";

grant insert on table "public"."permissions" to "service_role";

grant references on table "public"."permissions" to "service_role";

grant select on table "public"."permissions" to "service_role";

grant trigger on table "public"."permissions" to "service_role";

grant truncate on table "public"."permissions" to "service_role";

grant update on table "public"."permissions" to "service_role";

grant delete on table "public"."profiles" to "anon";

grant insert on table "public"."profiles" to "anon";

grant references on table "public"."profiles" to "anon";

grant select on table "public"."profiles" to "anon";

grant trigger on table "public"."profiles" to "anon";

grant truncate on table "public"."profiles" to "anon";

grant update on table "public"."profiles" to "anon";

grant delete on table "public"."profiles" to "authenticated";

grant insert on table "public"."profiles" to "authenticated";

grant references on table "public"."profiles" to "authenticated";

grant select on table "public"."profiles" to "authenticated";

grant trigger on table "public"."profiles" to "authenticated";

grant truncate on table "public"."profiles" to "authenticated";

grant update on table "public"."profiles" to "authenticated";

grant delete on table "public"."profiles" to "service_role";

grant insert on table "public"."profiles" to "service_role";

grant references on table "public"."profiles" to "service_role";

grant select on table "public"."profiles" to "service_role";

grant trigger on table "public"."profiles" to "service_role";

grant truncate on table "public"."profiles" to "service_role";

grant update on table "public"."profiles" to "service_role";

grant delete on table "public"."role_permissions" to "anon";

grant insert on table "public"."role_permissions" to "anon";

grant references on table "public"."role_permissions" to "anon";

grant select on table "public"."role_permissions" to "anon";

grant trigger on table "public"."role_permissions" to "anon";

grant truncate on table "public"."role_permissions" to "anon";

grant update on table "public"."role_permissions" to "anon";

grant delete on table "public"."role_permissions" to "authenticated";

grant insert on table "public"."role_permissions" to "authenticated";

grant references on table "public"."role_permissions" to "authenticated";

grant select on table "public"."role_permissions" to "authenticated";

grant trigger on table "public"."role_permissions" to "authenticated";

grant truncate on table "public"."role_permissions" to "authenticated";

grant update on table "public"."role_permissions" to "authenticated";

grant delete on table "public"."role_permissions" to "service_role";

grant insert on table "public"."role_permissions" to "service_role";

grant references on table "public"."role_permissions" to "service_role";

grant select on table "public"."role_permissions" to "service_role";

grant trigger on table "public"."role_permissions" to "service_role";

grant truncate on table "public"."role_permissions" to "service_role";

grant update on table "public"."role_permissions" to "service_role";

grant delete on table "public"."roles" to "anon";

grant insert on table "public"."roles" to "anon";

grant references on table "public"."roles" to "anon";

grant select on table "public"."roles" to "anon";

grant trigger on table "public"."roles" to "anon";

grant truncate on table "public"."roles" to "anon";

grant update on table "public"."roles" to "anon";

grant delete on table "public"."roles" to "authenticated";

grant insert on table "public"."roles" to "authenticated";

grant references on table "public"."roles" to "authenticated";

grant select on table "public"."roles" to "authenticated";

grant trigger on table "public"."roles" to "authenticated";

grant truncate on table "public"."roles" to "authenticated";

grant update on table "public"."roles" to "authenticated";

grant delete on table "public"."roles" to "service_role";

grant insert on table "public"."roles" to "service_role";

grant references on table "public"."roles" to "service_role";

grant select on table "public"."roles" to "service_role";

grant trigger on table "public"."roles" to "service_role";

grant truncate on table "public"."roles" to "service_role";

grant update on table "public"."roles" to "service_role";


  create policy "Members can create carers"
  on "public"."carers"
  as permissive
  for insert
  to authenticated
with check (public.has_org_permission(organization_id, 'carers.create'::text));



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




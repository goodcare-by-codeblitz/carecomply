alter table "public"."organizations" drop constraint "organizations_slug_format_check";

alter table "public"."organizations" add constraint "organizations_slug_format_check" CHECK ((slug ~ '^[a-z]+(-[a-z]+)*$'::text)) not valid;

alter table "public"."organizations" validate constraint "organizations_slug_format_check";



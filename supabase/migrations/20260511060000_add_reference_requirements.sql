alter table public.organizations
  add column if not exists required_work_references_count integer,
  add column if not exists required_character_references_count integer;

alter table public.carer_references
  add column if not exists reference_type text not null default 'character',
  add column if not exists organization text;

alter table public.carer_references
  add constraint carer_references_reference_type_check
  check (reference_type in ('work', 'character'));

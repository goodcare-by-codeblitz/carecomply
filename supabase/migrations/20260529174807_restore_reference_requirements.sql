alter table public.organizations
  add column if not exists required_work_references_count integer,
  add column if not exists required_character_references_count integer;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'organizations_required_work_references_count_check'
      and conrelid = 'public.organizations'::regclass
  ) then
    alter table public.organizations
      add constraint organizations_required_work_references_count_check
      check (
        required_work_references_count is null
        or required_work_references_count between 1 and 5
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'organizations_required_character_references_count_check'
      and conrelid = 'public.organizations'::regclass
  ) then
    alter table public.organizations
      add constraint organizations_required_character_references_count_check
      check (
        required_character_references_count is null
        or required_character_references_count between 1 and 5
      );
  end if;
end $$;

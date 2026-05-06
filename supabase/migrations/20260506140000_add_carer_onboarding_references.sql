create table if not exists public.carer_references (
  id uuid primary key default gen_random_uuid(),
  carer_id uuid not null references public.carers(id) on delete cascade,
  full_name text not null,
  email text not null,
  phone text not null,
  relationship text not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

alter table public.documents
add column if not exists rejection_reason text;

alter table public.documents
add column if not exists review_notes text;

alter table public.carer_references enable row level security;

grant select, insert, update, delete on table public.carer_references to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'carer-documents',
  'carer-documents',
  false,
  10485760,
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

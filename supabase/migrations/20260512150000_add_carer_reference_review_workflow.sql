alter table public.carer_references
  add column if not exists status text not null default 'pending',
  add column if not exists request_sent_at timestamptz,
  add column if not exists request_error text,
  add column if not exists response_received_at timestamptz,
  add column if not exists response_payload jsonb,
  add column if not exists response_url text,
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid references public.profiles(id),
  add column if not exists review_notes text;

alter table public.carer_references
  drop constraint if exists carer_references_status_check;

alter table public.carer_references
  add constraint carer_references_status_check
  check (status in ('pending', 'requested', 'responded', 'approved', 'rejected'));

alter table public.documents
add column if not exists superseded_by uuid references public.documents(id),
add column if not exists superseded_at timestamptz;

alter table public.documents
drop constraint if exists documents_status_check;

alter table public.documents
add constraint documents_status_check check (
  status in ('pending', 'approved', 'rejected', 'expired', 'obsolete')
);

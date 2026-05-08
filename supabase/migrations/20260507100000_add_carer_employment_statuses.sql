alter table public.carers
add column if not exists status_changed_at timestamptz;

alter table public.carers
add column if not exists status_changed_by uuid references auth.users(id) on delete set null;

alter table public.carers
add column if not exists former_at timestamptz;

alter table public.carers
drop constraint if exists carers_status_check;

alter table public.carers
add constraint carers_status_check check (
  status in ('pending', 'active', 'expired', 'incomplete', 'on_leave', 'former')
);

alter table public.carers
add column if not exists address_line1 text,
add column if not exists address_line2 text,
add column if not exists city text,
add column if not exists county text,
add column if not exists postcode text,
add column if not exists emergency_contact_name text,
add column if not exists emergency_contact_relationship text,
add column if not exists emergency_contact_phone text,
add column if not exists emergency_contact_email text;

alter table public.organization_memberships
add column if not exists phone text,
add column if not exists job_title text,
add column if not exists department text,
add column if not exists address_line1 text,
add column if not exists address_line2 text,
add column if not exists city text,
add column if not exists county text,
add column if not exists postcode text,
add column if not exists emergency_contact_name text,
add column if not exists emergency_contact_relationship text,
add column if not exists emergency_contact_phone text,
add column if not exists emergency_contact_email text;

notify pgrst, 'reload schema';

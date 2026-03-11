-- Pending signups: holds unverified signup data until user confirms email with 6-digit code.
-- Data is only moved to members after: 1) user verifies code, 2) admin approves.

create table public.pending_signups (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  payload jsonb not null,
  code text not null,
  code_expires_at timestamptz not null,
  polaroid_still_path text not null,
  polaroid_live_path text not null,
  created_at timestamptz default now()
);

create index pending_signups_email_idx on public.pending_signups (email);
create index pending_signups_code_expires_idx on public.pending_signups (code_expires_at);

alter table public.pending_signups enable row level security;

create policy "Service role full access"
  on public.pending_signups for all
  using (auth.role() = 'service_role');

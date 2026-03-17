-- Track last profile edit time for rate limiting / UX
alter table public.members
  add column if not exists last_profile_update_at timestamptz;


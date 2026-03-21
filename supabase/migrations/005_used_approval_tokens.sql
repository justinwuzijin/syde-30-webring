create table public.used_approval_tokens (
  token_hash text primary key,
  used_at timestamptz default now()
);

alter table public.used_approval_tokens enable row level security;
create policy "Service role full access"
  on public.used_approval_tokens for all
  using (auth.role() = 'service_role');

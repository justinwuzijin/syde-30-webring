-- Members table for SYDE 2030 webring
-- All fields match sign-up form; * = required at application level

create table public.members (
  id uuid primary key default gen_random_uuid(),

  -- Account information
  name text not null,
  email text not null unique,
  -- Store bcrypt/argon2 hash only; never plain text
  password_hash text not null,
  website_link text,
  profile_picture_url text,

  -- Social links (handles only, no @)
  linkedin_handle text,
  twitter_handle text,
  github_handle text,

  -- At least one social handle required
  constraint at_least_one_social check (
    linkedin_handle is not null or
    twitter_handle is not null or
    github_handle is not null
  ),

  -- Metadata
  program text not null,
  approved boolean default false,
  joined_at timestamptz default now()
);

-- Index for lookups
create index members_email_idx on public.members (email);
create index members_approved_idx on public.members (approved) where approved = true;

-- RLS
alter table public.members enable row level security;

-- Public can read approved members only
create policy "Public read approved members"
  on public.members for select
  using (approved = true);

-- Service role (API routes) has full access
create policy "Service role full access"
  on public.members for all
  using (auth.role() = 'service_role');

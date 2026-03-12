-- Add polaroid URL columns if not present (for members who join via approval flow)
alter table public.members add column if not exists polaroid_still_url text;
alter table public.members add column if not exists polaroid_live_url text;

-- One-time stamp animation flag: show "your polaroid stamped" on first login after approval
alter table public.members add column if not exists has_seen_join_stamp_animation boolean default false;

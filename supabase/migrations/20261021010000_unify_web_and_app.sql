-- Mind Your Block: one schema for the phone app and the web page.
-- Run AFTER 20261021000000_init.sql. Safe to re-run.
--
-- What changes:
--   * profiles get the fields the web page uses (full_name, username, neighborhood, zone, avatar, account type)
--   * check-ins can be tied to an event
--   * new tables the web page writes to: events, event_draws, feedback
--   * public 'avatars' bucket for profile pictures
--   * leaderboard returns everything the web and the app render, still names and totals only

-- ── profiles ────────────────────────────────────────────────

do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'profiles' and column_name = 'display_name') then
    alter table public.profiles rename column display_name to full_name;
  end if;
end $$;

alter table public.profiles drop constraint if exists profiles_display_name_check;
alter table public.profiles drop constraint if exists profiles_full_name_check;
alter table public.profiles add constraint profiles_full_name_check check (char_length(full_name) <= 60);

alter table public.profiles
  add column if not exists username text,
  add column if not exists neighborhood text not null default '',
  add column if not exists zone text not null default '',
  add column if not exists avatar_url text,
  add column if not exists account_type text not null default 'resident',
  add column if not exists business_name text,
  add column if not exists business_role text,
  add column if not exists business_url text;

alter table public.profiles drop constraint if exists profiles_account_type_check;
alter table public.profiles add constraint profiles_account_type_check check (account_type in ('resident', 'business'));
alter table public.profiles drop constraint if exists profiles_username_check;
alter table public.profiles add constraint profiles_username_check check (username is null or char_length(username) <= 30);
alter table public.profiles drop constraint if exists profiles_misc_length_check;
alter table public.profiles add constraint profiles_misc_length_check check (
  char_length(neighborhood) <= 80 and char_length(zone) <= 40
  and char_length(coalesce(business_name, '')) <= 120 and char_length(coalesce(business_role, '')) <= 80
  and char_length(coalesce(business_url, '')) <= 300 and char_length(coalesce(avatar_url, '')) <= 500
);

create unique index if not exists profiles_username_key
  on public.profiles (lower(username)) where username is not null and username <> '';

-- New auth users (email sign-ups on the web, anonymous guests in the app) get a profile.
-- A taken username must never block sign-up, so it falls back to no username.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  acct text := case when meta ->> 'account_type' = 'business' then 'business' else 'resident' end;
begin
  begin
    insert into public.profiles (id, full_name, username, account_type, business_name, business_role, business_url)
    values (new.id,
            left(coalesce(meta ->> 'full_name', meta ->> 'display_name', ''), 60),
            nullif(left(meta ->> 'username', 30), ''),
            acct,
            left(meta ->> 'business_name', 120),
            left(meta ->> 'business_role', 80),
            left(meta ->> 'business_url', 300))
    on conflict (id) do nothing;
  exception when unique_violation then
    insert into public.profiles (id, full_name, account_type)
    values (new.id, left(coalesce(meta ->> 'full_name', ''), 60), acct)
    on conflict (id) do nothing;
  end;
  return new;
end $$;

-- ── check-ins: optional link to an event ────────────────────

alter table public.checkins
  add column if not exists event_id text,
  add column if not exists verified boolean not null default false;
create index if not exists checkins_event_idx on public.checkins (event_id) where event_id is not null;

-- ── events hosted by neighbors and sponsors (reviewed in the dashboard) ──

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  organizer text not null check (char_length(organizer) between 1 and 120),
  contact_email text check (char_length(contact_email) <= 200),
  zone_id text,
  meeting_point text check (char_length(meeting_point) <= 200),
  event_date date not null,
  start_time time,
  duration text check (char_length(duration) <= 40),
  spots integer check (spots between 1 and 1000),
  supplies text check (char_length(supplies) <= 200),
  description text check (char_length(description) <= 2000),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_by uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  sponsored boolean not null default false,
  sponsor_url text check (char_length(sponsor_url) <= 300),
  reward_type text check (reward_type in ('raffle', 'top', 'both')),
  prize text check (char_length(prize) <= 300),
  raffle_prize text check (char_length(raffle_prize) <= 200),
  top_prize text check (char_length(top_prize) <= 200)
);
create index if not exists events_status_date_idx on public.events (status, event_date);

-- Raffle and top-cleaner draw results.
create table if not exists public.event_draws (
  id uuid primary key default gen_random_uuid(),
  event_id text not null,
  raffle_winner text,
  raffle_code text,
  top_cleaner text,
  top_minutes integer,
  top_bags numeric,
  top_code text,
  drawn_by uuid not null default auth.uid() references auth.users (id) on delete cascade,
  drawn_at timestamptz not null default now()
);

-- Feedback box. Guests can send it too, so signed-out inserts are allowed (length limited, nobody can read it back).
create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  type text check (char_length(type) <= 40),
  email text check (char_length(email) <= 200),
  message text not null check (char_length(message) between 1 and 4000),
  user_id uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.events enable row level security;
alter table public.event_draws enable row level security;
alter table public.feedback enable row level security;

drop policy if exists "events: read own or approved" on public.events;
create policy "events: read own or approved" on public.events
  for select to authenticated using (created_by = auth.uid() or status = 'approved');
-- New events are always pending. Approving one is done by the owner in the dashboard.
drop policy if exists "events: insert own pending" on public.events;
create policy "events: insert own pending" on public.events
  for insert to authenticated with check (created_by = auth.uid() and status = 'pending');
drop policy if exists "events: delete own" on public.events;
create policy "events: delete own" on public.events
  for delete to authenticated using (created_by = auth.uid() and status = 'pending');

drop policy if exists "draws: read own" on public.event_draws;
create policy "draws: read own" on public.event_draws
  for select to authenticated using (drawn_by = auth.uid());
drop policy if exists "draws: insert own" on public.event_draws;
create policy "draws: insert own" on public.event_draws
  for insert to authenticated with check (drawn_by = auth.uid());

drop policy if exists "feedback: anyone can send" on public.feedback;
create policy "feedback: anyone can send" on public.feedback
  for insert to anon, authenticated with check (user_id is null or user_id = auth.uid());

-- ── leaderboard (names and totals only, never user ids or emails) ──

-- Consecutive weeks with at least one named check-in, counting back from this week or last week.
create or replace function public.streak_weeks(uid uuid)
returns integer language sql stable security definer set search_path = public as $$
  with w as (
    select distinct date_trunc('week', created_at)::date as wk
    from public.checkins where user_id = uid and not anonymous
  ),
  islands as (
    select wk, wk - ((row_number() over (order by wk))::int * 7) as grp from w
  )
  select coalesce((
    select count(*)::int from islands
    where grp = (select grp from islands order by wk desc limit 1)
      and (select max(wk) from w) >= (date_trunc('week', now())::date - 7)
  ), 0);
$$;
revoke all on function public.streak_weeks(uuid) from public, anon, authenticated;

drop function if exists public.get_leaderboard(integer);
create or replace function public.get_leaderboard(max_rows integer default 20)
returns table (
  rank bigint, full_name text, username text, avatar_url text, neighborhood text,
  points bigint, bags_collected numeric, minutes_cleaned bigint, events_attended bigint,
  streak_weeks integer, is_you boolean
)
language sql stable security definer set search_path = public as $$
  with totals as (
    select c.user_id,
           sum(c.points) as points,
           sum(c.bags) as bags,
           sum(c.minutes) as minutes,
           count(distinct c.event_id) filter (where c.event_id is not null) as events
    from public.checkins c
    where not c.anonymous
    group by c.user_id
  )
  select row_number() over (order by t.points desc, t.user_id) as rank,
         coalesce(nullif(p.full_name, ''), nullif(p.username, ''), 'Neighbor') as full_name,
         p.username, p.avatar_url, nullif(p.neighborhood, '') as neighborhood,
         t.points, t.bags, t.minutes, t.events,
         public.streak_weeks(t.user_id) as streak_weeks,
         (t.user_id = auth.uid()) as is_you
  from totals t
  join public.profiles p on p.id = t.user_id
  order by t.points desc, t.user_id
  limit greatest(1, least(max_rows, 100));
$$;

create or replace function public.get_activity_feed(max_rows integer default 30)
returns table (id uuid, display_name text, zone_id text, block_name text, bags numeric, created_at timestamptz, is_you boolean)
language sql stable security definer set search_path = public as $$
  select c.id,
         case when c.anonymous then 'Anonymous'
              else coalesce(nullif(p.full_name, ''), nullif(p.username, ''), 'Neighbor') end,
         c.zone_ids[1],
         c.block_names[1],
         c.bags,
         c.created_at,
         (c.user_id = auth.uid())
  from public.checkins c
  join public.profiles p on p.id = c.user_id
  order by c.created_at desc
  limit greatest(1, least(max_rows, 100));
$$;

revoke all on function public.get_leaderboard(integer) from public, anon;
revoke all on function public.get_activity_feed(integer) from public, anon;
grant execute on function public.get_leaderboard(integer) to authenticated;
grant execute on function public.get_activity_feed(integer) to authenticated;

-- ── Storage: public bucket for profile pictures ─────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do nothing;

drop policy if exists "avatars: read own" on storage.objects;
create policy "avatars: read own" on storage.objects
  for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "avatars: insert own" on storage.objects;
create policy "avatars: insert own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "avatars: update own" on storage.objects;
create policy "avatars: update own" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "avatars: delete own" on storage.objects;
create policy "avatars: delete own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

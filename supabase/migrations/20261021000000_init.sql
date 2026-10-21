-- Mind Your Block: initial schema
-- Safe to re-run in the Supabase SQL editor (tables use IF NOT EXISTS, policies are dropped and recreated).
--
-- Model: every user, including guests, signs in with Supabase anonymous auth, so every row has a user_id.
-- Row level security is ON for every table. Users can only read and write their own rows.
-- Shared views of data (leaderboard, activity feed) go through two security definer functions
-- that return only display names and totals, never user ids or emails.

-- ── Tables ───────────────────────────────────────────────────

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 30),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  minutes integer not null check (minutes between 0 and 1440),
  bags numeric(5, 2) not null default 0 check (bags between 0 and 200),
  notes text check (char_length(notes) <= 1000),
  zone_ids text[] not null check (cardinality(zone_ids) between 1 and 9),
  block_ids text[] not null default '{}',
  block_names text[] not null default '{}',
  points integer not null check (points between 0 and 100000),
  multiplier integer not null default 1 check (multiplier between 1 and 10),
  anonymous boolean not null default false,
  -- Paths inside the private 'checkin-photos' bucket, always '<user_id>/<file>'.
  photo_paths text[] not null default '{}' check (cardinality(photo_paths) <= 3)
);
create index if not exists checkins_user_idx on public.checkins (user_id, created_at desc);
create index if not exists checkins_created_idx on public.checkins (created_at desc);

create table if not exists public.rsvps (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  event_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, event_id)
);

-- One adopter per block.
create table if not exists public.adoptions (
  block_id text primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  zone_id text not null,
  adopted_at timestamptz not null default now()
);
create index if not exists adoptions_user_idx on public.adoptions (user_id);

-- ── Triggers ─────────────────────────────────────────────────

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- Every new auth user (including anonymous guests) gets an empty profile.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(left(new.raw_user_meta_data ->> 'display_name', 30), ''))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── Row level security ───────────────────────────────────────

alter table public.profiles enable row level security;
alter table public.checkins enable row level security;
alter table public.rsvps enable row level security;
alter table public.adoptions enable row level security;

drop policy if exists "profiles: read own" on public.profiles;
create policy "profiles: read own" on public.profiles
  for select to authenticated using (id = auth.uid());
drop policy if exists "profiles: insert own" on public.profiles;
create policy "profiles: insert own" on public.profiles
  for insert to authenticated with check (id = auth.uid());
drop policy if exists "profiles: update own" on public.profiles;
create policy "profiles: update own" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "checkins: read own" on public.checkins;
create policy "checkins: read own" on public.checkins
  for select to authenticated using (user_id = auth.uid());
drop policy if exists "checkins: insert own" on public.checkins;
create policy "checkins: insert own" on public.checkins
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "checkins: delete own" on public.checkins;
create policy "checkins: delete own" on public.checkins
  for delete to authenticated using (user_id = auth.uid());
-- No update policy: check-ins are immutable once recorded.

drop policy if exists "rsvps: own" on public.rsvps;
create policy "rsvps: own" on public.rsvps
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Anyone signed in can see which blocks are adopted, only the owner can add or remove.
drop policy if exists "adoptions: read all" on public.adoptions;
create policy "adoptions: read all" on public.adoptions
  for select to authenticated using (true);
drop policy if exists "adoptions: insert own" on public.adoptions;
create policy "adoptions: insert own" on public.adoptions
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "adoptions: delete own" on public.adoptions;
create policy "adoptions: delete own" on public.adoptions
  for delete to authenticated using (user_id = auth.uid());

-- ── Shared views of the data (names and totals only) ─────────

-- Leaderboard. Anonymous check-ins do not count toward a named score.
create or replace function public.get_leaderboard(max_rows integer default 20)
returns table (rank bigint, display_name text, points bigint, bags numeric, minutes bigint, is_you boolean)
language sql stable security definer set search_path = public as $$
  with totals as (
    select c.user_id, sum(c.points) as points, sum(c.bags) as bags, sum(c.minutes) as minutes
    from public.checkins c
    where not c.anonymous
    group by c.user_id
  )
  select row_number() over (order by t.points desc, t.user_id) as rank,
         coalesce(nullif(p.display_name, ''), 'Neighbor') as display_name,
         t.points, t.bags, t.minutes,
         (t.user_id = auth.uid()) as is_you
  from totals t
  join public.profiles p on p.id = t.user_id
  order by t.points desc, t.user_id
  limit greatest(1, least(max_rows, 100));
$$;

-- Recent activity. Anonymous check-ins show as 'Anonymous'.
create or replace function public.get_activity_feed(max_rows integer default 30)
returns table (id uuid, display_name text, zone_id text, block_name text, bags numeric, created_at timestamptz, is_you boolean)
language sql stable security definer set search_path = public as $$
  select c.id,
         case when c.anonymous then 'Anonymous'
              else coalesce(nullif(p.display_name, ''), 'Neighbor') end,
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

-- In-app account deletion (required by Apple for apps that create accounts).
-- The app deletes the user's photos through the Storage API first, then calls this.
-- Foreign keys cascade, so profile, check-ins, RSVPs and adoptions go with the user.
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = public, auth as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  delete from auth.users where id = auth.uid();
end $$;

revoke all on function public.get_leaderboard(integer) from public, anon;
revoke all on function public.get_activity_feed(integer) from public, anon;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.get_leaderboard(integer) to authenticated;
grant execute on function public.get_activity_feed(integer) to authenticated;
grant execute on function public.delete_my_account() to authenticated;

-- ── Storage: private bucket for check-in photos ──────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('checkin-photos', 'checkin-photos', false, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists "photos: read own" on storage.objects;
create policy "photos: read own" on storage.objects
  for select to authenticated
  using (bucket_id = 'checkin-photos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "photos: insert own" on storage.objects;
create policy "photos: insert own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'checkin-photos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "photos: delete own" on storage.objects;
create policy "photos: delete own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'checkin-photos' and (storage.foldername(name))[1] = auth.uid()::text);

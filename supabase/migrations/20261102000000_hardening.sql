-- Hardening release (from the Nov 2 adversarial review).
--
-- Until now the server trusted whatever a phone put in a check-in: its own
-- points, minutes, "verified" flag and event, any zone, any number of them.
-- The rules below move that trust to the server:
--
--   * check-ins: points and multiplier are worked out here (the phone's values
--     are ignored), minutes are capped at the app's 6 hour maximum, zones and
--     blocks must be real ids, check-ins cannot overlap in time, and there is a
--     daily limit. `verified` can only be true for an approved event, on its
--     day, in its zone, once per person.
--   * the public name is always the unique username (nobody can display as
--     someone else or as the organization); avatars must be in our own bucket
--   * block adoption needs 3 real cleanups on that block, at most 3 per person
--   * no points bonuses or adoptions on the interstate and ramp zone (z5)
--   * event draws can only be saved by the event's host; pending events are limited
--   * the activity feed shows others' cleanups later and without the block
--   * public roles lose rights they never needed
--
-- Still honor-based (needs the v2 server-side location check): that a person
-- was really at the cleanup, and that an event check-in was really on site.
-- Safe to re-run.

-- ── Reserved ids ─────────────────────────────────────────────

-- The interstate and ramps zone and its blocks never earn bonuses.
delete from public.hot_zones where zone_id = 'z5';
alter table public.hot_zones drop constraint if exists hot_zones_no_roadway;
alter table public.hot_zones add constraint hot_zones_no_roadway check (zone_id <> 'z5');

-- ── XP: the hot bonus skips roadway zones ────────────────────

create or replace function public.calc_checkin_xp(
  p_user uuid, p_id uuid, p_created timestamptz, p_before timestamptz,
  p_minutes integer, p_zones text[], p_blocks text[], p_event text
) returns integer
language plpgsql stable security definer set search_path = public as $$
declare
  tz constant text := 'America/New_York';
  day date := (p_created at time zone tz)::date;
  used_minutes integer;
  showed_up boolean;
  time_xp integer;
  total integer;
begin
  select coalesce(sum(c.minutes), 0),
         bool_or(c.minutes >= 10)
    into used_minutes, showed_up
  from public.checkins c
  where c.user_id = p_user
    and (c.created_at, c.id) < (p_before, p_id)
    and (c.created_at at time zone tz)::date = day;

  time_xp := greatest(0, least(p_minutes, 120 - least(120, used_minutes)));
  total := time_xp;

  if p_minutes >= 10 then
    if not coalesce(showed_up, false) then
      total := total + 20;
    end if;

    if p_zones is not null and cardinality(p_zones) > 0 and not exists (
      select 1 from public.checkins c
      where c.user_id = p_user and (c.created_at, c.id) < (p_before, p_id)
        and p_zones[1] = any (c.zone_ids)
    ) then
      total := total + 50;
    end if;

    total := total + 15 * least(3, (
      select count(*) from (select distinct b from unnest(coalesce(p_blocks, '{}')) b) nb
      where not exists (
        select 1 from public.checkins c
        where c.user_id = p_user and (c.created_at, c.id) < (p_before, p_id)
          and nb.b = any (c.block_ids)
      )
    ));
  end if;

  if exists (select 1 from public.hot_zones h where h.zone_id = any (coalesce(p_zones, '{}')) and h.zone_id <> 'z5') then
    total := total + 25;
  end if;

  if p_event is not null and not exists (
    select 1 from public.checkins c
    where c.user_id = p_user and c.event_id = p_event
      and (c.created_at, c.id) < (p_before, p_id)
  ) then
    total := total + 100;
  end if;

  return least(total, 1000);
end $$;

-- ── Check-ins: the server decides what counts ────────────────

create or replace function public.set_checkin_xp()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  tz constant text := 'America/New_York';
  ev record;
  hot integer;
  adopted boolean;
  recent_count integer;
  recent_minutes integer;
  p text;
begin
  -- A phone resending a check-in that already arrived: the insert is ignored
  -- anyway, so skip every rule (they would see the original and refuse it).
  if exists (select 1 from public.checkins c where c.id = new.id) then
    return new;
  end if;

  -- A phone may be offline for a while, but not travel in time.
  if new.created_at > now() then new.created_at := now(); end if;
  if new.created_at < now() - interval '7 days' then new.created_at := now(); end if;

  -- Real zones and blocks only.
  if cardinality(new.zone_ids) > 3 or exists (select 1 from unnest(new.zone_ids) z where z !~ '^z[1-9]$') then
    raise exception 'invalid zone' using errcode = 'P0001';
  end if;
  if cardinality(new.block_ids) > 8 or exists (select 1 from unnest(new.block_ids) b where b !~ '^b(_z)?[0-9]+_[0-9]+$') then
    raise exception 'invalid block' using errcode = 'P0001';
  end if;
  foreach p in array new.photo_paths loop
    if p not like new.user_id::text || '/%' then
      raise exception 'invalid photo path' using errcode = 'P0001';
    end if;
  end loop;

  -- The app's own maximum session; bags were removed from the program.
  new.minutes := least(new.minutes, 360);
  new.bags := 0;

  -- Not more than 12 check-ins and 12 hours in any day, and no two overlapping in time.
  select count(*), coalesce(sum(c.minutes), 0) into recent_count, recent_minutes
  from public.checkins c
  where c.user_id = new.user_id
    and c.created_at between new.created_at - interval '24 hours' and new.created_at + interval '24 hours';
  if recent_count >= 12 or recent_minutes + new.minutes > 720 then
    raise exception 'daily check-in limit reached' using errcode = 'P0001';
  end if;
  if new.minutes >= 1 and exists (
    select 1 from public.checkins c
    where c.user_id = new.user_id and c.minutes >= 1
      and c.created_at > new.created_at - make_interval(mins => new.minutes) + interval '1 minute'
      and c.created_at - make_interval(mins => c.minutes) < new.created_at - interval '1 minute'
  ) then
    raise exception 'this overlaps another cleanup' using errcode = 'P0001';
  end if;

  -- Event check-ins: only an approved event counts, "verified" only on its day,
  -- in its zone, and once per person.
  if new.event_id is not null then
    select * into ev from public.events e where e.id::text = new.event_id and e.status = 'approved';
    if not found then
      new.event_id := null;
      new.verified := false;
    else
      new.verified := coalesce(new.verified, false)
        and ev.event_date = (new.created_at at time zone tz)::date
        and (ev.zone_id is null or ev.zone_id = new.zone_ids[1])
        and not exists (
          select 1 from public.checkins c
          where c.user_id = new.user_id and c.event_id = new.event_id and c.verified
        );
    end if;
  else
    new.verified := false;
  end if;

  -- Points and multiplier are the server's, from its own hot zones and the
  -- person's adoptions. Roadway zones never get a bonus.
  select max(h.multiplier) into hot
  from public.hot_zones h where h.zone_id = any (new.zone_ids) and h.zone_id <> 'z5';
  select exists (
    select 1 from public.adoptions a
    where a.user_id = new.user_id and a.block_id = any (new.block_ids) and a.block_id !~ '^b_z5_'
  ) into adopted;
  new.multiplier := greatest(coalesce(hot, 1), case when adopted then 2 else 1 end);
  new.points := greatest(10, round(new.minutes * 2)) * new.multiplier;

  new.xp := public.calc_checkin_xp(
    new.user_id, new.id, new.created_at, 'infinity'::timestamptz,
    new.minutes, new.zone_ids, new.block_ids,
    case when new.verified then new.event_id end
  );
  return new;
end $$;

-- ── Profiles: the public name is the unique username ─────────

create or replace function public.reserved_username(u text)
returns boolean language sql immutable as $$
  select lower(regexp_replace(coalesce(u, ''), '[^a-zA-Z0-9]', '', 'g')) in
         ('admin', 'administrator', 'moderator', 'official', 'support', 'staff', 'organizer')
      or lower(regexp_replace(coalesce(u, ''), '[^a-zA-Z0-9]', '', 'g')) like '%discoverdeutschtown%'
      or lower(regexp_replace(coalesce(u, ''), '[^a-zA-Z0-9]', '', 'g')) like '%mindyourblock%';
$$;

create or replace function public.profile_guard()
returns trigger language plpgsql set search_path = public as $$
begin
  new.username := nullif(btrim(new.username), '');
  if public.reserved_username(new.username) then
    -- A sign-up must never fail on this (it falls back to no username); an edit is told no.
    if tg_op = 'UPDATE' then
      raise exception 'That username is not available' using errcode = 'P0001';
    end if;
    new.username := null;
  end if;
  -- Whatever name a sign-up or an edit asks to show, the shown name is the username.
  new.full_name := coalesce(new.username, '');
  return new;
end $$;

drop trigger if exists profiles_guard on public.profiles;
create trigger profiles_guard
  before insert or update on public.profiles
  for each row execute function public.profile_guard();

update public.profiles set full_name = username where username is not null and full_name is distinct from username;

-- Avatars live in our own bucket, in your own folder. Business links are web links.
alter table public.profiles drop constraint if exists profiles_avatar_own_bucket;
alter table public.profiles add constraint profiles_avatar_own_bucket check (
  avatar_url is null or avatar_url = ''
  or avatar_url like 'https://qcdlqavkmnojftlysxxt.supabase.co/storage/v1/object/public/avatars/' || id::text || '/%'
);
alter table public.profiles drop constraint if exists profiles_business_url_web;
alter table public.profiles add constraint profiles_business_url_web check (
  business_url is null or business_url = '' or business_url ~* '^https?://'
);

create or replace function public.username_available(candidate text)
returns boolean language sql stable security definer set search_path = public as $$
  select candidate is not null
     and char_length(candidate) between 3 and 30
     and candidate ~ '^[a-z0-9_]+$'
     and not public.reserved_username(candidate)
     and not exists (
       select 1 from public.profiles p
       where lower(p.username) = lower(candidate)
     );
$$;
revoke all on function public.username_available(text) from public;
grant execute on function public.username_available(text) to anon, authenticated;

-- ── Adoptions: earned, limited, never on the roadway ─────────

create or replace function public.adoption_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare cleanups integer; mine integer;
begin
  if new.block_id !~ '^b(_z)?[0-9]+_[0-9]+$' or new.zone_id !~ '^z[1-9]$' then
    raise exception 'invalid block' using errcode = 'P0001';
  end if;
  if new.block_id ~ '^b_z5_' or new.zone_id = 'z5' then
    raise exception 'blocks on the interstate and ramps cannot be adopted' using errcode = 'P0001';
  end if;
  select count(*) into cleanups from public.checkins c
    where c.user_id = new.user_id and new.block_id = any (c.block_ids);
  if cleanups < 3 then
    raise exception 'clean this block 3 times before adopting it' using errcode = 'P0001';
  end if;
  select count(*) into mine from public.adoptions a where a.user_id = new.user_id;
  if mine >= 3 then
    raise exception 'you can adopt up to 3 blocks' using errcode = 'P0001';
  end if;
  return new;
end $$;

drop trigger if exists adoptions_guard on public.adoptions;
create trigger adoptions_guard
  before insert on public.adoptions
  for each row execute function public.adoption_guard();

-- ── Events and draws ─────────────────────────────────────────

create or replace function public.event_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.events e where e.created_by = new.created_by and e.status = 'pending') >= 5 then
    raise exception 'you already have 5 events waiting for approval' using errcode = 'P0001';
  end if;
  return new;
end $$;

drop trigger if exists events_guard on public.events;
create trigger events_guard
  before insert on public.events
  for each row execute function public.event_guard();

-- Only an event's host can save its draw.
drop policy if exists "draws: insert own" on public.event_draws;
create policy "draws: insert own" on public.event_draws
  for insert to authenticated
  with check (
    drawn_by = auth.uid()
    and exists (select 1 from public.events e where e.id::text = event_id and e.created_by = auth.uid())
  );

-- ── Names shown to others: the username only ─────────────────

drop function if exists public.get_leaderboard(integer);
create or replace function public.get_leaderboard(max_rows integer default 20)
returns table (
  rank bigint, full_name text, username text, avatar_url text, neighborhood text,
  points bigint, bags_collected numeric, minutes_cleaned bigint, events_attended bigint,
  streak_weeks integer, is_you boolean, xp bigint
)
language sql stable security definer set search_path = public as $$
  with totals as (
    select c.user_id,
           sum(c.points) as points,
           sum(c.bags) as bags,
           sum(c.minutes) as minutes,
           sum(c.xp) as xp,
           count(distinct c.event_id) filter (where c.event_id is not null and c.verified) as events
    from public.checkins c
    join auth.users u on u.id = c.user_id
    where not c.anonymous
      and (u.banned_until is null or u.banned_until <= now())
    group by c.user_id
  )
  select row_number() over (order by t.points desc, t.user_id) as rank,
         coalesce(nullif(p.username, ''), 'Neighbor') as full_name,
         p.username, p.avatar_url, nullif(p.neighborhood, '') as neighborhood,
         t.points, t.bags, t.minutes, t.events,
         public.streak_weeks(t.user_id) as streak_weeks,
         (t.user_id = auth.uid()) as is_you,
         t.xp
  from totals t
  join public.profiles p on p.id = t.user_id
  order by t.points desc, t.user_id
  limit greatest(1, least(max_rows, 100));
$$;
revoke all on function public.get_leaderboard(integer) from public, anon;
grant execute on function public.get_leaderboard(integer) to authenticated;

-- Other people's cleanups show up 30 minutes later, to the hour, and without
-- the block, so the feed cannot be used to follow a neighbor around. Yours
-- appear right away and exact.
create or replace function public.get_activity_feed(max_rows integer default 30)
returns table (id uuid, display_name text, zone_id text, block_name text, bags numeric, created_at timestamptz, is_you boolean)
language sql stable security definer set search_path = public as $$
  select c.id,
         case when c.anonymous then 'Anonymous'
              else coalesce(nullif(p.username, ''), 'Neighbor') end,
         c.zone_ids[1],
         case when c.user_id = auth.uid() then c.block_names[1] end,
         c.bags,
         case when c.user_id = auth.uid() then c.created_at else date_trunc('hour', c.created_at) end,
         (c.user_id = auth.uid())
  from public.checkins c
  join public.profiles p on p.id = c.user_id
  join auth.users u on u.id = c.user_id
  where (u.banned_until is null or u.banned_until <= now())
    and (c.user_id = auth.uid() or c.created_at <= now() - interval '30 minutes')
  order by c.created_at desc
  limit greatest(1, least(max_rows, 100));
$$;
revoke all on function public.get_activity_feed(integer) from public, anon;
grant execute on function public.get_activity_feed(integer) to authenticated;

create or replace function public.get_event_attendees(p_event text)
returns table (display_name text, anonymous boolean, bags numeric, minutes integer, checked_in_at timestamptz)
language sql stable security definer set search_path = public as $$
  select case when c.anonymous then 'Anonymous'
              else coalesce(nullif(p.username, ''), 'Neighbor') end,
         c.anonymous, c.bags, c.minutes, c.created_at
  from public.checkins c
  join public.profiles p on p.id = c.user_id
  where c.event_id = p_event
    and c.verified
    and exists (select 1 from public.events e where e.id::text = p_event and e.created_by = auth.uid())
  order by c.created_at;
$$;
revoke all on function public.get_event_attendees(text) from public, anon;
grant execute on function public.get_event_attendees(text) to authenticated;

-- ── Rights the public roles never needed ─────────────────────

-- The API cannot use these, but a missing policy elsewhere should not be one
-- mistake away from a wiped table.
revoke truncate, trigger, references on all tables in schema public from anon, authenticated;
-- Signed-out visitors may only read hot zones and drop a note in the feedback box.
revoke all on all tables in schema public from anon;
grant select on public.hot_zones to anon;
grant insert on public.feedback to anon;

-- XP and levels (Phase 1).
--
-- XP is the progression number behind levels. Points stay the leaderboard
-- number. The server works XP out when a check-in arrives and stores it on
-- the check-in row, so the phone cannot send or change it and a reinstall or
-- a new phone gets the same level back. The level itself (titles, curve) lives
-- in the app (app/src/levels.js), so tuning it never needs a migration.
--
-- Rules (the app mirrors these in app/src/levels.js for its preview):
--   1 XP per minute, at most 120 XP of time per day (New York day)
--   +20  showing up: first cleanup of the day that lasts 10+ minutes
--   +50  first time in a zone, +15 per new block (up to 3), 10+ minutes only
--   +25  the cleanup was in a hot zone (flat, not a multiplier)
--   +100 first check-in at a hosted event (web page check-ins carry event_id)
--
-- The phone's own total can lag the server by the check-ins still waiting to
-- be sent; the app adds its estimate for those until they arrive.
-- Safe to re-run.

alter table public.checkins
  add column if not exists xp integer not null default 0 check (xp between 0 and 1000);

-- ── The XP rules, in one place ───────────────────────────────

-- Prior check-ins are those strictly before (p_before, p_id). The trigger
-- passes 'infinity' so every check-in already stored counts; the backfill below
-- passes the row's own position so old rows are scored in order.
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

  if exists (select 1 from public.hot_zones h where h.zone_id = any (coalesce(p_zones, '{}'))) then
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
revoke all on function public.calc_checkin_xp(uuid, uuid, timestamptz, timestamptz, integer, text[], text[], text) from public, anon, authenticated;

-- ── Set XP on every new check-in ─────────────────────────────

create or replace function public.set_checkin_xp()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- A phone may be offline for a while, but not travel in time: the day a
  -- check-in counts for (and its daily XP cap) cannot be backdated or set ahead.
  if new.created_at > now() then new.created_at := now(); end if;
  if new.created_at < now() - interval '7 days' then new.created_at := now(); end if;

  new.xp := public.calc_checkin_xp(
    new.user_id, new.id, new.created_at, 'infinity'::timestamptz,
    new.minutes, new.zone_ids, new.block_ids, new.event_id
  );
  return new;
end $$;

drop trigger if exists checkins_set_xp on public.checkins;
create trigger checkins_set_xp
  before insert on public.checkins
  for each row execute function public.set_checkin_xp();

-- Score check-ins that were stored before this migration, oldest first.
do $$
declare r record;
begin
  for r in select * from public.checkins where xp = 0 order by created_at, id loop
    update public.checkins
       set xp = public.calc_checkin_xp(r.user_id, r.id, r.created_at, r.created_at, r.minutes, r.zone_ids, r.block_ids, r.event_id)
     where id = r.id;
  end loop;
end $$;

-- ── Your own totals, for restoring a phone ───────────────────

-- Everything the You tab and Home need, from the server's copy: totals (all
-- your check-ins, anonymous ones included, since this is only for you),
-- how often you cleaned each zone and block, and your adopted blocks.
create or replace function public.my_stats()
returns table (
  xp bigint, points bigint, minutes bigint, sessions bigint, streak_weeks integer,
  zone_counts jsonb, block_counts jsonb, adoptions jsonb, rsvps text[]
)
language sql stable security definer set search_path = public as $$
  select
    coalesce((select sum(c.xp) from public.checkins c where c.user_id = auth.uid()), 0)::bigint,
    coalesce((select sum(c.points) from public.checkins c where c.user_id = auth.uid()), 0)::bigint,
    coalesce((select sum(c.minutes) from public.checkins c where c.user_id = auth.uid()), 0)::bigint,
    (select count(*) from public.checkins c where c.user_id = auth.uid())::bigint,
    public.streak_weeks(auth.uid()),
    coalesce((
      select jsonb_object_agg(z, n) from (
        select z, count(*) as n
        from public.checkins c, unnest(c.zone_ids) z
        where c.user_id = auth.uid() group by z
      ) q
    ), '{}'::jsonb),
    coalesce((
      select jsonb_object_agg(b, n) from (
        select b, count(*) as n
        from public.checkins c, unnest(c.block_ids) b
        where c.user_id = auth.uid() group by b
      ) q
    ), '{}'::jsonb),
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'blockId', a.block_id, 'zoneId', a.zone_id,
        'adoptedAt', (extract(epoch from a.adopted_at) * 1000)::bigint
      ))
      from public.adoptions a where a.user_id = auth.uid()
    ), '[]'::jsonb),
    coalesce((select array_agg(r.event_id) from public.rsvps r where r.user_id = auth.uid()), '{}'::text[])
  where auth.uid() is not null;
$$;
revoke all on function public.my_stats() from public, anon;
grant execute on function public.my_stats() to authenticated;

-- ── Leaderboard: add XP (named check-ins only) ───────────────

-- Anonymous check-ins stay out of the named board, and out of the public XP
-- too, so a level shown next to a name cannot give an anonymous cleanup away.
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
           count(distinct c.event_id) filter (where c.event_id is not null) as events
    from public.checkins c
    join auth.users u on u.id = c.user_id
    where not c.anonymous
      and (u.banned_until is null or u.banned_until <= now())
    group by c.user_id
  )
  select row_number() over (order by t.points desc, t.user_id) as rank,
         coalesce(nullif(p.full_name, ''), nullif(p.username, ''), 'Neighbor') as full_name,
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

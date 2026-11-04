-- Adopt a Zone, and public profiles. Run AFTER 20261102000000_hardening.sql.
--
-- Adopt a Zone: many neighbors can adopt the same zone and take care of it
-- regularly. Everyone signed in sees who adopted a zone on the map.
--   * You need 1 real cleanup in a zone before adopting it, at most 2 zones at once
--   * The interstate and ramps zone (z5) cannot be adopted, it is not safe to promise
--   * The promise is a cleanup at least every 30 days. An adoption with no cleanup
--     there for 45 days has lapsed: it drops off the map and stops counting toward
--     your limit, and your next cleanup in the zone picks it back up. Worked out
--     from check-ins when asked, so no scheduled job is needed.
--   * Recognition only: zone adoption does not change points or XP
--
-- Public profiles: a signed-in user can open another neighbor's profile by
-- username. It shows the username, level, totals, the zones they have cleaned and
-- what they adopted, from named check-ins only, so it cannot give an anonymous
-- cleanup away. Never: real name, email, notes, photos or when and where they
-- were last out. Anyone can set their profile private (profiles.profile_hidden),
-- which leaves the username, level and adopted zones (already on the map).
--
-- The app mirrors the limits in app/src/data.js (ZONE_ADOPTION). Safe to re-run.

-- ── The table ────────────────────────────────────────────────

create table if not exists public.zone_adoptions (
  zone_id    text not null check (zone_id ~ '^z[1-9]$'),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  adopted_at timestamptz not null default now(),
  primary key (zone_id, user_id)
);
create index if not exists zone_adoptions_user_idx on public.zone_adoptions (user_id);

alter table public.zone_adoptions enable row level security;

-- Your own rows only. What others see comes through get_zone_adopters(), which
-- gives usernames and never user ids.
drop policy if exists "zone adoptions: read own" on public.zone_adoptions;
create policy "zone adoptions: read own" on public.zone_adoptions
  for select to authenticated using (user_id = auth.uid());
drop policy if exists "zone adoptions: insert own" on public.zone_adoptions;
create policy "zone adoptions: insert own" on public.zone_adoptions
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "zone adoptions: delete own" on public.zone_adoptions;
create policy "zone adoptions: delete own" on public.zone_adoptions
  for delete to authenticated using (user_id = auth.uid());

revoke all on public.zone_adoptions from anon, authenticated;
grant select, insert, delete on public.zone_adoptions to authenticated;

-- ── Lapsing and the rules for adopting ───────────────────────

create or replace function public.zone_adoption_active(p_user uuid, p_zone text, p_adopted timestamptz)
returns boolean language sql stable security definer set search_path = public as $$
  select greatest(
    p_adopted,
    (select max(c.created_at) from public.checkins c where c.user_id = p_user and p_zone = any (c.zone_ids))
  ) >= now() - interval '45 days';
$$;
revoke all on function public.zone_adoption_active(uuid, text, timestamptz) from public, anon, authenticated;

create or replace function public.zone_adoption_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare mine integer;
begin
  -- A phone resending an adoption that already arrived: ignored anyway.
  if exists (select 1 from public.zone_adoptions a where a.zone_id = new.zone_id and a.user_id = new.user_id) then
    return new;
  end if;
  new.adopted_at := now();
  if new.zone_id = 'z5' then
    raise exception 'this zone runs beside highways and cannot be adopted' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.checkins c where c.user_id = new.user_id and new.zone_id = any (c.zone_ids)) then
    raise exception 'clean this zone once before adopting it' using errcode = 'P0001';
  end if;
  select count(*) into mine from public.zone_adoptions a
    where a.user_id = new.user_id and public.zone_adoption_active(a.user_id, a.zone_id, a.adopted_at);
  if mine >= 2 then
    raise exception 'you can adopt up to 2 zones' using errcode = 'P0001';
  end if;
  return new;
end $$;

drop trigger if exists zone_adoptions_guard on public.zone_adoptions;
create trigger zone_adoptions_guard
  before insert on public.zone_adoptions
  for each row execute function public.zone_adoption_guard();

-- ── Who adopted each zone (the map) ──────────────────────────

-- Active adoptions only, longest-standing first. The date is only to the month.
-- XP is from named check-ins, same as the leaderboard.
create or replace function public.get_zone_adopters()
returns table (zone_id text, username text, xp bigint, adopted_at timestamptz, is_you boolean)
language sql stable security definer set search_path = public as $$
  select a.zone_id,
         p.username,
         (select coalesce(sum(c.xp), 0) from public.checkins c where c.user_id = a.user_id and not c.anonymous)::bigint,
         date_trunc('month', a.adopted_at),
         (a.user_id = auth.uid())
  from public.zone_adoptions a
  join public.profiles p on p.id = a.user_id
  join auth.users u on u.id = a.user_id
  where p.username is not null and p.username <> ''
    and (u.banned_until is null or u.banned_until <= now())
    and public.zone_adoption_active(a.user_id, a.zone_id, a.adopted_at)
  order by a.zone_id, a.adopted_at, p.username;
$$;
revoke all on function public.get_zone_adopters() from public, anon;
grant execute on function public.get_zone_adopters() to authenticated;

-- ── Public profiles ──────────────────────────────────────────

alter table public.profiles add column if not exists profile_hidden boolean not null default false;

-- These read as something else in the feed and on the board.
create or replace function public.reserved_username(u text)
returns boolean language sql immutable as $$
  select lower(regexp_replace(coalesce(u, ''), '[^a-zA-Z0-9]', '', 'g')) in
         ('admin', 'administrator', 'moderator', 'official', 'support', 'staff', 'organizer',
          'anonymous', 'neighbor', 'you')
      or lower(regexp_replace(coalesce(u, ''), '[^a-zA-Z0-9]', '', 'g')) like '%discoverdeutschtown%'
      or lower(regexp_replace(coalesce(u, ''), '[^a-zA-Z0-9]', '', 'g')) like '%mindyourblock%';
$$;

-- No row for an unknown or banned username. Everything is from named check-ins.
-- A private profile keeps its username, level and adopted zones.
create or replace function public.get_public_profile(p_username text)
returns table (
  username text, member_since timestamptz, is_you boolean, is_hidden boolean,
  xp bigint, points bigint, minutes bigint, sessions bigint, streak_weeks integer,
  zones text[], adopted_zones text[], adopted_blocks text[]
)
language sql stable security definer set search_path = public as $$
  with target as (
    select p.id, p.username, p.created_at, p.profile_hidden,
           (p.id = auth.uid()) as me
    from public.profiles p
    join auth.users u on u.id = p.id
    where auth.uid() is not null
      and lower(p.username) = lower(p_username)
      and (u.banned_until is null or u.banned_until <= now())
  ),
  open_stats as (
    select t.id, not (t.profile_hidden and not t.me) as visible from target t
  )
  select t.username,
         date_trunc('month', t.created_at),
         t.me,
         (t.profile_hidden and not t.me),
         (select coalesce(sum(c.xp), 0) from public.checkins c where c.user_id = t.id and not c.anonymous)::bigint,
         case when o.visible then (select coalesce(sum(c.points), 0) from public.checkins c where c.user_id = t.id and not c.anonymous) else 0 end::bigint,
         case when o.visible then (select coalesce(sum(c.minutes), 0) from public.checkins c where c.user_id = t.id and not c.anonymous) else 0 end::bigint,
         case when o.visible then (select count(*) from public.checkins c where c.user_id = t.id and not c.anonymous) else 0 end::bigint,
         case when o.visible then public.streak_weeks(t.id) else 0 end,
         case when o.visible then coalesce((
           select array_agg(distinct z order by z)
           from public.checkins c, unnest(c.zone_ids) z
           where c.user_id = t.id and not c.anonymous
         ), '{}'::text[]) else '{}'::text[] end,
         coalesce((
           select array_agg(a.zone_id order by a.adopted_at)
           from public.zone_adoptions a
           where a.user_id = t.id and public.zone_adoption_active(a.user_id, a.zone_id, a.adopted_at)
         ), '{}'::text[]),
         case when o.visible then coalesce((
           select array_agg(a.block_id order by a.adopted_at) from public.adoptions a where a.user_id = t.id
         ), '{}'::text[]) else '{}'::text[] end
  from target t
  join open_stats o on o.id = t.id;
$$;
revoke all on function public.get_public_profile(text) from public, anon;
grant execute on function public.get_public_profile(text) to authenticated;

-- ── Your own totals gain your zones and your privacy setting ─

drop function if exists public.my_stats();
create or replace function public.my_stats()
returns table (
  xp bigint, points bigint, minutes bigint, sessions bigint, streak_weeks integer,
  zone_counts jsonb, block_counts jsonb, adoptions jsonb, rsvps text[],
  zone_adoptions jsonb, profile_hidden boolean
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
    coalesce((select array_agg(r.event_id) from public.rsvps r where r.user_id = auth.uid()), '{}'::text[]),
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'zoneId', a.zone_id,
        'adoptedAt', (extract(epoch from a.adopted_at) * 1000)::bigint,
        'lastCleanup', (
          select (extract(epoch from max(c.created_at)) * 1000)::bigint
          from public.checkins c where c.user_id = auth.uid() and a.zone_id = any (c.zone_ids)
        )
      ) order by a.adopted_at)
      from public.zone_adoptions a where a.user_id = auth.uid()
    ), '[]'::jsonb),
    coalesce((select p.profile_hidden from public.profiles p where p.id = auth.uid()), false)
  where auth.uid() is not null;
$$;
revoke all on function public.my_stats() from public, anon;
grant execute on function public.my_stats() to authenticated;

-- Mind Your Block: owner visibility and moderation. Run AFTER 20261021020000_real_data_views.sql. Safe to re-run.
--
-- Everything here lives in a private `admin` schema that the apps cannot reach (it is not exposed
-- through the API and no app role has any access). You use it from the Supabase SQL editor as the
-- project owner.

create schema if not exists admin;
revoke all on schema admin from public, anon, authenticated;

-- One row per account: who they are, what they have done, and whether they are banned.
create or replace view admin.user_overview as
select u.id,
       u.created_at,
       u.last_sign_in_at,
       case when u.is_anonymous then 'guest' else 'email' end as kind,
       u.email,
       p.full_name,
       p.username,
       p.neighborhood,
       p.account_type,
       coalesce(c.checkins, 0) as checkins,
       coalesce(c.points, 0) as points,
       c.last_checkin,
       coalesce(a.adoptions, 0) as adoptions,
       (u.banned_until is not null and u.banned_until > now()) as banned
from auth.users u
left join public.profiles p on p.id = u.id
left join (
  select user_id, count(*) as checkins, sum(points) as points, max(created_at) as last_checkin
  from public.checkins group by user_id
) c on c.user_id = u.id
left join (
  select user_id, count(*) as adoptions from public.adoptions group by user_id
) a on a.user_id = u.id;
revoke all on admin.user_overview from public, anon, authenticated;

-- Ban an account: it can no longer refresh its login, and (optionally) its public name is wiped.
-- Check-ins stay in the database but a banned account no longer appears on the leaderboard or feed.
create or replace function admin.ban_user(target uuid, scrub boolean default true)
returns void language plpgsql security definer set search_path = public, auth as $$
begin
  update auth.users set banned_until = 'infinity' where id = target;
  if scrub then
    update public.profiles set full_name = '', username = null, neighborhood = '', avatar_url = null where id = target;
  end if;
end $$;

create or replace function admin.unban_user(target uuid)
returns void language plpgsql security definer set search_path = public, auth as $$
begin
  update auth.users set banned_until = null where id = target;
end $$;
revoke all on function admin.ban_user(uuid, boolean) from public, anon, authenticated;
revoke all on function admin.unban_user(uuid) from public, anon, authenticated;

-- The public leaderboard and feed skip banned accounts.
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
  join auth.users u on u.id = c.user_id
  where u.banned_until is null or u.banned_until <= now()
  order by c.created_at desc
  limit greatest(1, least(max_rows, 100));
$$;

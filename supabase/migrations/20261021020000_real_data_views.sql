-- Mind Your Block: real data for events, zone status and community totals.
-- Run AFTER 20261021010000_unify_web_and_app.sql. Safe to re-run.
--
-- These replace the demo content the apps used to ship with. They return only aggregate,
-- non-identifying numbers (never user ids, emails, or host contact details), so they are
-- readable by signed-out visitors of the web page as well as by app guests.
--
-- Events are added by an organizer: a host submits one in the web page (it lands as 'pending'),
-- and the owner approves it in the dashboard, Table Editor, events, status = 'approved'.

-- Approved events with how many people RSVPed and showed up. Host contact emails are not included.
create or replace function public.get_events()
returns table (
  id uuid, name text, organizer text, zone_id text, meeting_point text,
  event_date date, start_time time, duration text, spots integer, supplies text, description text,
  sponsored boolean, sponsor_url text, reward_type text, prize text, raffle_prize text, top_prize text,
  going bigint, volunteers bigint, bags numeric
)
language sql stable security definer set search_path = public as $$
  select e.id, e.name, e.organizer, e.zone_id, e.meeting_point,
         e.event_date, e.start_time, e.duration, e.spots, e.supplies, e.description,
         e.sponsored, e.sponsor_url, e.reward_type, e.prize, e.raffle_prize, e.top_prize,
         (select count(*) from public.rsvps r where r.event_id = e.id::text),
         (select count(distinct c.user_id) from public.checkins c where c.event_id = e.id::text),
         (select coalesce(sum(c.bags), 0) from public.checkins c where c.event_id = e.id::text)
  from public.events e
  where e.status = 'approved' and e.event_date >= current_date - 90
  order by e.event_date, e.start_time
  limit 200;
$$;

-- When each zone was last cleaned, from real check-ins (anonymous ones count, they say nothing about who).
create or replace function public.get_zone_activity()
returns table (zone_id text, last_cleanup timestamptz, checkins bigint)
language sql stable security definer set search_path = public as $$
  select z as zone_id, max(c.created_at) as last_cleanup, count(*) as checkins
  from public.checkins c, unnest(c.zone_ids) as z
  group by z;
$$;

-- Community totals for the web page's headline numbers.
create or replace function public.get_community_stats()
returns table (total_minutes bigint, total_bags numeric, volunteers bigint, checkins bigint)
language sql stable security definer set search_path = public as $$
  select coalesce(sum(c.minutes), 0)::bigint,
         coalesce(sum(c.bags), 0),
         count(distinct c.user_id),
         count(*)
  from public.checkins c;
$$;

revoke all on function public.get_events() from public;
revoke all on function public.get_zone_activity() from public;
revoke all on function public.get_community_stats() from public;
grant execute on function public.get_events() to anon, authenticated;
grant execute on function public.get_zone_activity() to anon, authenticated;
grant execute on function public.get_community_stats() to anon, authenticated;

-- Adopt a zone without cleaning in it first. Run AFTER 20261104000000_zone_adoptions.sql.
--
-- The earlier rule asked for 1 real cleanup in a zone before adopting it. That is
-- gone: anyone can adopt any zone except the interstate and ramps zone (z5), up
-- to 2 at once. An adoption with no cleanup in the zone for 45 days (counted from
-- the day it was adopted) lapses, as before, so a zone nobody looks after drops
-- back to open on the clipboard.
--
-- Only the guard changes. Safe to re-run.

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
  select count(*) into mine from public.zone_adoptions a
    where a.user_id = new.user_id and public.zone_adoption_active(a.user_id, a.zone_id, a.adopted_at);
  if mine >= 2 then
    raise exception 'you can adopt up to 2 zones' using errcode = 'P0001';
  end if;
  return new;
end $$;

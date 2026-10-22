-- Hot zones: the weekly point multipliers that steer volunteers to the zones
-- that need help most. They used to be hard-coded in the app and the web page,
-- so changing them needed an app release. Now organizers edit this table in
-- the dashboard (Table Editor, hot_zones) and both apps pick it up on next sync.
--
-- One row per hot zone. Delete a row to make a zone normal again.
-- multiplier 3 shows as "Hottest", 2 as "Hot".

create table if not exists public.hot_zones (
  zone_id    text primary key check (zone_id ~ '^z[0-9]+$'),
  multiplier integer not null default 2 check (multiplier between 2 and 5),
  updated_at timestamptz not null default now()
);

alter table public.hot_zones enable row level security;

-- Everyone can read them (the web page shows them signed out too).
-- Nobody can write through the API: edits happen in the dashboard.
drop policy if exists "hot zones are public" on public.hot_zones;
create policy "hot zones are public" on public.hot_zones
  for select to anon, authenticated using (true);

grant select on public.hot_zones to anon, authenticated;

-- Same zones the apps had built in, so nothing changes for testers today.
insert into public.hot_zones (zone_id, multiplier) values
  ('z2', 3),
  ('z3', 2),
  ('z6', 2)
on conflict (zone_id) do nothing;

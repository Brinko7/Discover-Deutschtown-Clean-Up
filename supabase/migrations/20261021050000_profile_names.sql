-- Mind Your Block: sign-up collects a username (the public display name), an optional
-- first and last name (shown only as a subheader on the person's own profile), an email
-- and a password. Run AFTER 20261021040000_require_accounts.sql. Safe to re-run.
--
-- The app sets profiles.full_name equal to the username at sign-up, so the leaderboard
-- and feed (which read full_name, then username) keep showing the username. The real
-- first and last name live in their own columns and are never returned by the
-- leaderboard, feed or event functions.

alter table public.profiles
  add column if not exists first_name text not null default '',
  add column if not exists last_name text not null default '';

alter table public.profiles drop constraint if exists profiles_real_name_check;
alter table public.profiles add constraint profiles_real_name_check
  check (char_length(first_name) <= 40 and char_length(last_name) <= 40);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  acct text := case when meta ->> 'account_type' = 'business' then 'business' else 'resident' end;
begin
  begin
    insert into public.profiles (id, full_name, username, first_name, last_name, account_type, business_name, business_role, business_url)
    values (new.id,
            left(coalesce(meta ->> 'full_name', meta ->> 'display_name', ''), 60),
            nullif(left(meta ->> 'username', 30), ''),
            left(coalesce(meta ->> 'first_name', ''), 40),
            left(coalesce(meta ->> 'last_name', ''), 40),
            acct,
            left(meta ->> 'business_name', 120),
            left(meta ->> 'business_role', 80),
            left(meta ->> 'business_url', 300))
    on conflict (id) do nothing;
  exception when unique_violation then
    insert into public.profiles (id, full_name, first_name, last_name, account_type)
    values (new.id, left(coalesce(meta ->> 'full_name', ''), 60),
            left(coalesce(meta ->> 'first_name', ''), 40), left(coalesce(meta ->> 'last_name', ''), 40), acct)
    on conflict (id) do nothing;
  end;
  return new;
end $$;

-- The signed-in user's own profile, now including the optional real name.
drop function if exists public.my_profile();
create or replace function public.my_profile()
returns table (
  id uuid, full_name text, username text, first_name text, last_name text,
  neighborhood text, zone text, avatar_url text, account_type text
)
language sql stable security definer set search_path = public as $$
  select p.id, p.full_name, p.username, p.first_name, p.last_name,
         p.neighborhood, p.zone, p.avatar_url, p.account_type
  from public.profiles p
  where p.id = auth.uid();
$$;
revoke all on function public.my_profile() from public, anon;
grant execute on function public.my_profile() to authenticated;

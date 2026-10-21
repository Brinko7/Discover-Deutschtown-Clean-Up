-- Mind Your Block: accounts are required, guests are gone
-- Run AFTER 20261021030000_admin_moderation.sql. Safe to re-run.
--
-- Decision (Zach, Oct 21, 2026): scrap anonymous guest accounts. Every user
-- creates an account (username + email + password) and signs in.
--
-- What this migration does:
--   * username_available(): lets the sign-up form check a username before
--     creating the account. Profiles RLS is read-own-only, so the form
--     cannot check by querying the table.
--   * my_profile(): returns the signed-in user's own profile row (username,
--     email-adjacent fields the app shows on the You screen) in one call.
--
-- What it deliberately does NOT do:
--   * No email_for_username() lookup. Sign-in is by email + password.
--     A username-to-email lookup would let anyone enumerate account emails.
--   * It does not delete existing anonymous accounts. That is a separate,
--     deliberate cleanup (see supabase/cleanup_guest_accounts.sql) run once
--     from the dashboard after the new build ships.
--   * Dashboard settings are not SQL: turning the Anonymous provider OFF
--     and Confirm Email OFF happens in Authentication settings (or
--     `supabase config push`); see supabase/README.md.

-- ── Username availability for the sign-up form ───────────────
-- Callable before sign-in (anon) because the form runs signed out.
-- Returns only a boolean, never whose username it is.
create or replace function public.username_available(candidate text)
returns boolean
language sql stable security definer set search_path = public as $$
  select candidate is not null
     and char_length(candidate) between 3 and 30
     and candidate ~ '^[a-z0-9_]+$'
     and not exists (
       select 1 from public.profiles p
       where lower(p.username) = lower(candidate)
     );
$$;
revoke all on function public.username_available(text) from public;
grant execute on function public.username_available(text) to anon, authenticated;

-- ── The signed-in user's own profile ─────────────────────────
create or replace function public.my_profile()
returns table (
  id uuid, full_name text, username text, neighborhood text, zone text,
  avatar_url text, account_type text
)
language sql stable security definer set search_path = public as $$
  select p.id, p.full_name, p.username, p.neighborhood, p.zone,
         p.avatar_url, p.account_type
  from public.profiles p
  where p.id = auth.uid();
$$;
revoke all on function public.my_profile() from public, anon;
grant execute on function public.my_profile() to authenticated;

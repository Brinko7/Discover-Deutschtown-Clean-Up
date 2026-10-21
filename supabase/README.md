# Supabase backend

Project: `mind-your-block`, region US East (North Virginia), free tier, owned by the Bored Brinko organization (Zach's personal account).
Project ref: `qcdlqavkmnojftlysxxt`. API URL: `https://qcdlqavkmnojftlysxxt.supabase.co`

Only the **publishable** key belongs in the repo (`app/src/config.js`). It is safe to publish only because row level security is on.
**Never commit** the secret key, the legacy `service_role` key, or the database password.

## What is here

- `migrations/20261021000000_init.sql`: tables (`profiles`, `checkins`, `rsvps`, `adoptions`), row level security,
  leaderboard and activity feed functions, in-app account deletion, and the private `checkin-photos` bucket.
- `migrations/20261021010000_unify_web_and_app.sql`: one schema for both the phone app and the web page. Adds profile fields
  (`full_name`, `username`, `neighborhood`, `zone`, `avatar_url`, account type), event links on check-ins, the `events`,
  `event_draws` and `feedback` tables, the public `avatars` bucket, and a richer leaderboard.

- `migrations/20261021020000_real_data_views.sql`: public aggregate functions that replace the demo content (`get_events`, `get_zone_activity`, `get_community_stats`, host-only `get_event_attendees`). **Applied and verified Oct 21.**

- `migrations/20261021030000_admin_moderation.sql`: private `admin` schema with `admin.user_overview`, `admin.ban_user`, `admin.unban_user`; banned accounts are hidden from the leaderboard and feed. **Applied and verified Oct 21.** See `ADMIN.md`.
- `migrations/20261021040000_require_accounts.sql`: accounts required (Zach's call, Oct 21, 2026). Adds `username_available()` for the sign-up form and `my_profile()` for the signed-in user's own profile. **Written Oct 21, not yet applied.**
- `cleanup_guest_accounts.sql`: NOT a migration. One-time, by-hand deletion of the leftover anonymous test accounts, run in the dashboard SQL Editor after the Anonymous provider is off.

Run the files in order. All are safe to re-run.

## Status

- Both migrations are **applied** to the live project. Verified: 7 tables with row level security on, 23 policies,
  leaderboard, activity feed and account deletion functions, `checkin-photos` private, `avatars` public, signed-out callers cannot
  read the leaderboard or any table, and nobody can read the feedback box back.
- **Accounts are required (decided Oct 21, 2026).** Guests are scrapped: the app and the web page both use email + password accounts, and the app shows a sign-in screen until the user is signed in. Remaining go-live steps: apply migration 20261021040000, turn the Anonymous provider OFF and Confirm Email OFF in the dashboard (see Settings below), then run `cleanup_guest_accounts.sql` by hand to delete the leftover test guest accounts.
- The old project (`tbaovavrxdlpkyexfazm`) is **no longer used anywhere** in the code. Its key is gone from the web page.

## How the two clients use it

- **Phone app** (`app/src/backend.js`, `app/src/store.js`): email + password account (a sign-in screen gates the app; local state on the phone belongs to one account and resets when a different account signs in), an outbox that retries offline, reads the leaderboard and feed
  through functions, "Delete my data" removes photos and calls `delete_my_account()`.
- **Web page** (top of the script in `clean-east-allegheny-Github-initial.html`): email and password accounts, profile editing,
  events, raffle draws, feedback. Signed-in users get the real leaderboard, guests see example names.
- The web page and the app share the same check-in table, so activity from both shows up in one leaderboard.

## Apply it

Either paste the migration into Dashboard, SQL Editor, and run it, or use the CLI:

```bash
brew install supabase/tap/supabase
# On Zach's Mac (Oct 21, 2026): brew is blocked until the Xcode Command Line
# Tools are reinstalled, so the CLI 2.121 binary from the supabase/cli GitHub
# releases is installed at ~/.local/bin/supabase instead. Same tool.
supabase login
supabase link --project-ref qcdlqavkmnojftlysxxt
supabase db push
```

## Settings to turn on in the dashboard

- Authentication, Providers: **Email ON**, **Anonymous OFF** (turn it off when the required-sign-in build ships).
- Authentication, Sign In / Providers: minimum password length **8**; **Confirm email OFF for closed testing** (decided Oct 21, 2026: sign-up signs straight in, because the built-in sender's rate limit of a few emails per hour would break group tester sign-ups). This is project-wide, so web sign-ups sign straight in too. Before public launch: set up a real SMTP sender, then turn Confirm email back ON.
- Authentication, URL Configuration: redirect URLs must include the live web page, because password reset links from the app land there: `https://brinko7.github.io/Discover-Deutschtown-Clean-Up/clean-east-allegheny-Github-initial.html`.
- Authentication, Attack Protection: CAPTCHA is off for testing. Anonymous sign-ins can be abused, so turn it on before a public launch.

## Known limits of the test build

- Points are calculated on the phone. A determined tester could send inflated points. Fine for neighbors, not for prizes.
  Before a real raffle, move scoring into a database function.
- With email confirmation off for testing, a typo'd email cannot be recovered later, and an account is effectively lost if its password is forgotten. Accepted for closed testing.
- Check-ins made on a phone before this backend existed stay on that phone only.
- Deleting an account in the app removes the user's photos through the Storage API, then calls `delete_my_account()`.

## Moving to an organization later

The whole backend is these files. To move: create a project under the new account, run the migration, copy the project URL and publishable key into `app/src/config.js`, and export the data with `pg_dump` if testers' history should carry over.
Supabase can also transfer a project between organizations.

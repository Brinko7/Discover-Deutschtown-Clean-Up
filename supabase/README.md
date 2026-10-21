# Supabase backend

Project: `mind-your-block`, region US East (North Virginia), free tier, owned by the Bored Brinko organization (Zach's personal account).
Project ref: `qcdlqavkmnojftlysxxt`. API URL: `https://qcdlqavkmnojftlysxxt.supabase.co`

Only the **publishable** key belongs in the repo (`app/src/config.js`). It is safe to publish only because row level security is on.
**Never commit** the secret key, the legacy `service_role` key, or the database password.

## What is here

- `migrations/20261021000000_init.sql`: tables (`profiles`, `checkins`, `rsvps`, `adoptions`), row level security,
  leaderboard and activity feed functions, in-app account deletion, and the private `checkin-photos` bucket.

## Status

- Schema **applied** to the live project through the dashboard SQL editor. Checked afterwards: all four tables have row level security on,
  13 policies exist, the three functions exist, the `checkin-photos` bucket is private, and the `anon` role cannot call the leaderboard.
- **Anonymous sign-ins: still OFF.** Turn on in Authentication, Sign In / Providers, "Allow anonymous sign-ins", then Save changes.
  The app cannot create guest accounts until this is on.

## Apply it

Either paste the migration into Dashboard, SQL Editor, and run it, or use the CLI:

```bash
brew install supabase/tap/supabase
supabase login
supabase link --project-ref qcdlqavkmnojftlysxxt
supabase db push
```

## Settings to turn on in the dashboard

- Authentication, Sign In / Providers: **Allow anonymous sign-ins** (guests get a real user id).
- Authentication, Attack Protection: leave CAPTCHA off for testing, but know that anonymous sign-ins can be abused. Turn it on before a public launch.

## Known limits of the test build

- Points are calculated on the phone. A determined tester could send inflated points. Fine for neighbors, not for prizes.
  Before a real raffle, move scoring into a database function.
- Anonymous guests lose their account if they uninstall or clear app data, because there is no email to recover it.
- Deleting an account in the app removes the user's photos through the Storage API, then calls `delete_my_account()`.

## Moving to an organization later

The whole backend is these files. To move: create a project under the new account, run the migration, copy the project URL and publishable key into `app/src/config.js`, and export the data with `pg_dump` if testers' history should carry over.
Supabase can also transfer a project between organizations.

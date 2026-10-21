# Running the community: seeing accounts and acting on bad actors

Run all of these in the Supabase dashboard, SQL Editor, as the project owner. The apps cannot reach any of it.
Needs migration `20261021030000_admin_moderation.sql` applied once.

## Why the Users page looks empty

Authentication, Users only shows login details. Guest accounts have no email, so they show as "Anonymous" with just an ID.
The display name people type is stored in `public.profiles` (Table Editor, schema `public`, table `profiles`). The queries below put it all in one place.

## See everyone

```sql
select * from admin.user_overview order by created_at desc;
```

Columns: id, created_at, last_sign_in_at, kind (`guest` or `email`), email (web accounts only), full_name, username, neighborhood, checkins, points, last_checkin, adoptions, banned.

## Things worth checking

```sql
-- Newest accounts (last 7 days)
select * from admin.user_overview where created_at > now() - interval '7 days' order by created_at desc;

-- Most active, in case points look inflated (points are calculated on the phone)
select id, full_name, kind, checkins, points from admin.user_overview order by points desc limit 20;

-- Suspicious check-ins: long sessions or lots of points for little time
select c.id, p.full_name, c.minutes, c.bags, c.points, c.created_at
from public.checkins c join public.profiles p on p.id = c.user_id
where c.minutes > 480 or c.points > c.minutes * 6 or c.bags > 30
order by c.created_at desc;

-- Names to review (edit the words to taste)
select id, full_name, username from public.profiles
where full_name ~* '(word1|word2|word3)' or username ~* '(word1|word2|word3)';

-- Events waiting for approval, and feedback people sent
select id, name, organizer, contact_email, event_date, sponsored, status from public.events where status = 'pending' order by created_at;
select created_at, type, email, message from public.feedback order by created_at desc;
```

Approve an event: Table Editor, `events`, change `status` to `approved`. It then shows up in both apps and on the web page.

## Acting on someone

```sql
-- Ban: they can no longer refresh their login, their name is wiped, they vanish from the leaderboard and feed.
select admin.ban_user('<user id>');          -- add , false to keep their name

-- Undo a ban
select admin.unban_user('<user id>');

-- Remove someone completely (their check-ins, RSVPs, adoptions and profile go with them)
delete from auth.users where id = '<user id>';
```

- A ban takes full effect within about an hour, when their current login token runs out.
- Their photos are private to them. To remove files, Storage, `checkin-photos`, open the folder named with their user id, delete.
- Remove one bad check-in only: `delete from public.checkins where id = '<checkin id>';`
- Block a single event: set `status` to `rejected`.

## Things to know

- Guest accounts are cheap to create, so a banned person can come back as a new guest. If that becomes a problem, turn on CAPTCHA (Authentication, Attack Protection) and consider requiring email sign-in for the leaderboard.
- The `admin` views show emails for web accounts. Treat them as private.
- Apple's guideline 1.2 may ask for an in-app way to report abusive names. If that happens, a "Report" button on leaderboard names that writes to a `reports` table is the next step.

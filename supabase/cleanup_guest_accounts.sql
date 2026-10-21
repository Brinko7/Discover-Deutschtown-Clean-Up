-- Mind Your Block: one-time cleanup of anonymous guest accounts
-- NOT a migration. Run this BY HAND in the Supabase dashboard SQL Editor,
-- as the project owner, AFTER the required-sign-in build has shipped and
-- the Anonymous provider has been turned OFF in Authentication settings.
--
-- Why: Zach decided Oct 21, 2026 that guests are scrapped. The only
-- anonymous accounts that exist are test accounts from building the app.
-- Deleting an auth user cascades: their profile, check-ins, RSVPs and
-- adoptions are removed with them, so the leaderboard starts clean.
-- Their check-in photos in Storage are NOT deleted by this (Storage
-- objects have no cascade). Delete the folders named by those user ids
-- in the checkin-photos and avatars buckets afterwards, by hand.
--
-- Step 1: PREVIEW. Run this first and read the list before deleting.

select id, created_at, last_sign_in_at
from auth.users
where is_anonymous = true
order by created_at;

-- Step 2: DELETE. Only when the preview list is exactly the test accounts
-- you expect. There is no undo.

-- delete from auth.users where is_anonymous = true;

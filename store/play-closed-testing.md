# Play Console setup, draft answers (closed testing, personal account)

App: Mind Your Block, package `com.boredbrinko.mindyourblock`, account Bored Brinko (personal).
Status: **drafts for Zach to confirm. Nothing below has been entered in Play Console yet.**
Items marked `NEEDS` are blocked on a decision or a value from Zach.

Play will not open closed testing until every task under "Finish setting up your app" is done.

## App content tasks

| Task | Draft answer | Notes |
| --- | --- | --- |
| Privacy policy | `NEEDS` public URL | Host `privacy-policy.html` (repo root) somewhere public. GitHub Pages on the repo is the quickest. Policy still lists the placeholder email `hello@mindyourblock.org`, replace it first. After Supabase is connected, the policy must also describe accounts, check-in data and photos. |
| Sign in details (app access) | "All functionality is available without special access" | True while the app works as a guest. If Supabase sign-in becomes mandatory, add a test account here for Google's reviewer. |
| Ads | No ads | Correct, no ad SDK. |
| Content rating | Answer the IARC questionnaire truthfully at the time | No violence, sexual content, gambling, or purchases. The one judgment call is user-generated content: once Supabase is on, notes and photos from check-ins can be seen by other users, answer "yes" then. Expect Everyone or Teen. |
| Target audience | 18 and over (recommended for testing) | Avoids the children's-app rules. Revisit before production. |
| Data safety | See the table below | Must match the privacy policy and the real behavior of the build. |
| Government apps | No | |
| Financial features | None | Donations are hidden (`DONATIONS_ENABLED = false`). |
| Health | No health features | |

### Data safety draft (assumes Supabase is connected)

| Data | Collected | Why | Shared | Optional |
| --- | --- | --- | --- | --- |
| Name or nickname | Yes | Profile, leaderboard | No (a processor stores it) | Yes, can check in anonymously |
| Email address | Yes, if accounts are on | Sign in | No | Yes |
| Photos | Yes | Attach to check-ins | No | Yes |
| Approximate or precise location | Used on device to find the zone and block | App function | Not sent, only the chosen zone and block are stored | Yes |
| App activity (check-ins, RSVPs, points) | Yes | App function, leaderboard | No | n/a |
| User IDs | Yes | Account | No | n/a |

- Encrypted in transit: Yes (HTTPS).
- Users can request deletion: Yes, by email (needs the real contact address).
- Not sold, not used for ads.

## Store presence

- **Category:** Lifestyle (Social is the alternative).
- **Contact email:** `NEEDS` real address. Website is optional.
- **App name:** Mind Your Block
- **Short description (80 max):** Check in when you clean, earn points, and keep Deutschtown looking good.
- **Full description (draft):**
  Mind Your Block is the neighborhood cleanup companion for Deutschtown.

  - Check in when you start cleaning and track your time, bags, and photos.
  - Find your zone and block automatically with GPS, or pick one by hand.
  - Earn points, with bonus multipliers on the blocks that need help most.
  - Collect a mascot badge for every zone you clean.
  - RSVP to upcoming cleanups and see who is out there.
  - Adopt a block and keep it looking good.

  This is a test version for neighbors. Feedback is welcome.
- **Graphics needed:** app icon 512x512 PNG, feature graphic 1024x500, at least two phone screenshots.
  The icon comes from `app/assets/icon.svg`. Screenshots can be taken from the running app.

## Release

1. Rebuild the signed bundle (`versionCode` 2 or higher).
2. Create a closed testing release on the closed track.
3. Add testers: a Google Group or an email list, then share the opt-in link.
4. Closed tests go through a short Google review before testers can install.

The 12 testers / 14 day rule only matters when applying for production. Closed testing as home base has no such wait.

# Play Console setup, draft answers (closed testing, personal account)

App: Mind Your Block, package `com.boredbrinko.mindyourblock`, account Bored Brinko (personal).
Status: **drafts for Zach to confirm. Nothing below has been entered in Play Console yet.**
Items marked `NEEDS` are blocked on a decision or a value from Zach.

Play will not open closed testing until every task under "Finish setting up your app" is done.

## App content tasks

| Task | Draft answer | Notes |
| --- | --- | --- |
| Privacy policy | https://brinko7.github.io/Discover-Deutschtown-Clean-Up/privacy-policy.html | Live, contact zach.carman@gmail.com. **Needs an update pass now that the app sends data to Supabase** (guest accounts, check-ins, photos, in-app deletion). Merlin owns that edit. |
| Sign in details (app access) | "All functionality is available without special access" | True: the app signs in as an anonymous guest automatically, no credentials needed. |
| Ads | No ads | Correct, no ad SDK. |
| Content rating | Answer the IARC questionnaire truthfully at the time | No violence, sexual content, gambling, or purchases. Notes and photos are private to the user. Other users only see a display name, a zone and a bag count in the leaderboard and feed, so answer the "users interact or share content" question carefully and honestly. Expect Everyone. |
| Target audience | 18 and over (recommended for testing) | Avoids the children's-app rules. Revisit before production. |
| Data safety | See the table below | Must match the privacy policy and the real behavior of the build. |
| Government apps | No | |
| Financial features | None | Donations are hidden (`DONATIONS_ENABLED = false`). |
| Health | No health features | |

### Data safety draft (the app now sends data to Supabase)

What the phone app sends to its private Supabase database: a guest account id, the display name, check-ins (zone and block, minutes, bags, points, optional note), RSVPs, adopted blocks, and optional check-in photos.

| Data | Collected | Why | Shared | Optional |
| --- | --- | --- | --- | --- |
| Name or nickname | Yes | Leaderboard and activity feed | No. Only the display name is visible to other users, and not for anonymous check-ins | Yes, can check in anonymously |
| Email address | **No** in the phone app (guest sign-in, no email). The web page collects it for web accounts | n/a | n/a | n/a |
| Photos | Yes | Attached to check-ins. Stored privately, only the owner can see them | No | Yes |
| Other user-generated content (notes) | Yes | Stored with the check-in, never shown to other users | No | Yes |
| Location | **No.** Used on the device only to pick a zone and block. Coordinates are never sent or stored | App function | n/a | Yes |
| App activity (check-ins, RSVPs, adoptions, points) | Yes | App function, leaderboard | No | n/a |
| User ID (anonymous guest id) | Yes | Account | No | n/a |

- Encrypted in transit: Yes (HTTPS).
- Users can request deletion: Yes. In the app: You tab, "Delete my data" removes the account, check-ins and photos. Also by email.
- Processor: Supabase hosts the database as a service provider. Play counts that as "not shared".
- Not sold, not used for ads.
- Declare **Account creation: users can create an account in the app** (guest accounts), and give the in-app deletion path above.

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

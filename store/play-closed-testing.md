# Play Console setup, draft answers (closed testing, personal account)

App: Mind Your Block, package `com.boredbrinko.mindyourblock`, account Bored Brinko (personal).
Status (Oct 21): **8 of the 10 app content declarations are filled in and saved in Play Console** (staged in Publishing overview, nothing sent for review):
privacy policy URL, ads (none), sign in details (no restricted access), target audience (18 and over), advertising ID (not used), government apps (no), financial features (none), health apps (none).
**Still to do in Play Console:** content rating (needs Zach to accept IARC's terms), data safety (answers below, the form was started but not saved), app category and contact details, store listing, then the closed testing release.

Play will not open closed testing until every task under "Finish setting up your app" is done.

## App content tasks

| Task | Draft answer | Notes |
| --- | --- | --- |
| Privacy policy | https://brinko7.github.io/Discover-Deutschtown-Clean-Up/privacy-policy.html | Live, contact zach.carman@gmail.com. **Needs an update pass now that the app sends data to Supabase** (guest accounts, check-ins, photos, in-app deletion). Merlin owns that edit. |
| Sign in details (app access) | "All functionality is available without special access" | True: the app signs in as an anonymous guest automatically, no credentials needed. |
| Ads | No ads | Correct, no ad SDK. |
| Content rating | **Not done yet.** Start the questionnaire (it asks you to accept IARC's terms) and answer truthfully | No violence, sexual content, gambling, or purchases. Notes and photos are private to the user. Other users only see a display name, a zone and a bag count in the leaderboard and feed, so answer the "users interact or share content" question carefully and honestly. Expect Everyone. |
| Target audience | 18 and over (recommended for testing) | Avoids the children's-app rules. Revisit before production. |
| Data safety | See the table below | Must match the privacy policy and the real behavior of the build. |
| Government apps | No | |
| Financial features | None | Donations are hidden (`DONATIONS_ENABLED = false`). |
| Health | No health features | |

### Data safety draft (the app now sends data to Supabase)

What the phone app sends to its private Supabase database: a guest account id, the display name, check-ins (zone and block, minutes, points, optional note), RSVPs, adopted blocks, and optional check-in photos.

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
- Declare **Account creation: users can create an account in the app**, method **Other**, described as "Anonymous guest account created automatically, with no email, username or password".
- **Delete account URL** (Play asks for a link): use the privacy policy page, which must explain how to request deletion (in the app: You tab, "Delete my data"; or by email to zach.carman@gmail.com).
- Data types to tick under "Data types" (all collected, none shared, all optional except the user id, purpose App functionality): Personal info > Name; Photos and videos > Photos; App activity > Other user-generated content, and App interactions; Device or other IDs > not collected; Location > not collected.

## Store presence

- **Category:** Lifestyle (Social is the alternative).
- **Contact email:** `NEEDS` real address. Website is optional.
- **App name:** Mind Your Block
- **Short description (80 max):** Check in when you clean, earn points, and keep Deutschtown looking good.
- **Full description (draft):**
  Mind Your Block is the neighborhood cleanup companion for Deutschtown.

  - Check in when you start cleaning and track your time and photos.
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

## Permissions

The Android app asks for camera, approximate and precise location, and network access. `READ_MEDIA_IMAGES` was removed because the camera library uses Android's system Photo Picker, which needs no storage permission on Android 13 and up. That also avoids Google's photo and video permissions declaration form. Please test choosing a photo from the library on a real Android 13+ phone.

# App Store Connect and TestFlight pack (individual developer account)

App: Mind Your Block. Bundle ID `com.boredbrinko.mindyourblock`, version 1.0, build 1.
Status: **the app is ready to archive. It is waiting on the Apple Developer enrollment.** Nothing here has been entered in App Store Connect.

## Already done in the project

- Bundle ID matches Android. iPhone only, portrait only (no iPad screenshots or layouts to maintain).
- Privacy manifest `app/ios/App/App/PrivacyInfo.xcprivacy` declares what the app collects and the required-reason APIs it uses.
- `ITSAppUsesNonExemptEncryption = false` (the app only uses standard HTTPS), so Apple will not ask the export question on every upload.
- Usage descriptions for camera, photos and location are in `Info.plist`.
- App icon and launch screen are generated from `app/assets/icon.svg`.
- Verified: the project compiles for the iPhone simulator and launches (iPhone 17 Pro Max, iOS 26.5).
- Screenshots at 1320x2868 (6.9 inch): `store/app-store-assets/iphone-6.9-inch/`. Apple scales them down for smaller phones.

## Your steps, in order

1. **Enroll** at developer.apple.com/programs/enroll as an Individual ($99/year). Wait for the confirmation email (up to a couple of days).
2. **Xcode, sign in:** Xcode, Settings, Accounts, add your Apple ID. Then open `app/ios/App/App.xcodeproj`, target App, Signing & Capabilities, choose your Team. Leave "Automatically manage signing" on. The bundle ID is already `com.boredbrinko.mindyourblock`.
3. **App Store Connect, new app:** appstoreconnect.apple.com, My Apps, +, New App. Platform iOS, name "Mind Your Block", language English (U.S.), bundle ID `com.boredbrinko.mindyourblock`, SKU `mindyourblock-ios`, user access Full.
4. **Upload a build:** run `cd app && npm run sync`, then in Xcode choose "Any iOS Device (arm64)", Product, Archive, then Distribute App, App Store Connect, Upload. Each upload needs a higher build number (Target App, General, Build).
5. **Fill in the pages** below, then TestFlight, add the build to a group.
6. **Internal testing** (up to 100 people on your App Store Connect team, no review) works within minutes of the build finishing processing. **External testing** (neighbors, up to 10,000, by email or public link) needs one Beta App Review, usually 24 to 48 hours.

## App Store Connect: App Information

| Field | Value |
| --- | --- |
| Name | Mind Your Block |
| Subtitle (30) | Keep Deutschtown clean |
| Category | Primary: Lifestyle. Secondary: Social Networking |
| Privacy Policy URL | https://brinko7.github.io/Discover-Deutschtown-Clean-Up/privacy-policy.html |
| Support URL | https://brinko7.github.io/Discover-Deutschtown-Clean-Up/clean-east-allegheny-Github-initial.html |
| Contact email | zach.carman@gmail.com |
| Content rights | Does not use third-party content (map tiles are OpenStreetMap, credited in the app) |
| Age rating | 4+ (answer "None" to every content question, no unrestricted web access) |

## Version 1.0 page

- **Promotional text (170):** Check in when you clean, earn points, collect mascot badges, and see your block shine on the Deutschtown map.
- **Keywords (100):** cleanup,litter,volunteer,neighborhood,Pittsburgh,Deutschtown,community,trash,map,streets,points
- **Description:**
  Mind Your Block is the neighborhood cleanup companion for Deutschtown, Pittsburgh.

  • Check in when you start cleaning and track your time, bags and photos
  • Find your zone and block automatically with GPS, or pick one by hand
  • Earn points, with bonus multipliers on the blocks that need help most
  • Collect a mascot badge for every zone you clean
  • See which zones were cleaned recently and which need attention
  • RSVP to group cleanups and see who is out there
  • Adopt a block and keep it looking good
  • Climb the neighborhood leaderboard, or check in anonymously

  No account needed. You start as a guest, and you can delete all of your data from the You tab at any time.
- **What's new:** First test release for neighbors.
- **Screenshots:** the five files in `store/app-store-assets/iphone-6.9-inch/`, in order 1 to 5.
- **Copyright:** 2026 Zach Carman (or your legal name as enrolled).

## App Privacy ("nutrition label")

Everything below matches the privacy manifest in the project. Nothing is used for tracking, nothing is sold.

| Data type | Collected | Linked to the user | Purpose |
| --- | --- | --- | --- |
| Name (display name you type) | Yes | Yes | App functionality |
| Photos | Yes (optional, private) | Yes | App functionality |
| Other user content (check-in notes) | Yes (optional, private) | Yes | App functionality |
| User ID (anonymous guest id) | Yes | Yes | App functionality |
| Product interaction (check-ins, RSVPs, adoptions, points) | Yes | Yes | App functionality |
| Precise or coarse location | **No** (used on the phone to pick a zone, never sent or stored) | n/a | n/a |
| Email, phone, contacts, financial info, health, browsing history | No | n/a | n/a |

- Tracking: **No**.
- Account deletion: the app has an in-app path (You tab, "Delete my data"), which Apple requires for apps that create accounts.

## App Review information

- **Sign-in required:** No. The app signs in automatically as a guest.
- **Contact:** Zach Carman, zach.carman@gmail.com, **phone number (Apple requires one, add yours)**.
- **Notes for the reviewer:**
  > Mind Your Block is a neighborhood litter cleanup app for Deutschtown in Pittsburgh. No account is needed: the app creates an anonymous guest account the first time you tap "Let's clean up" or "Continue as guest". To try the main flow: open the Check In tab, tap "Find my zone automatically" (or pick any zone), tap Start cleanup, then Finish and check out. Location is only used once, when you tap "Find my zone", to pick the zone you are standing in. Photos are optional and private. Group events appear in the Events tab once the organizer approves them, so that list can be empty during review. You can delete your account and all data from the You tab, Delete my data.
- **Features that need real-world conditions:** GPS zone detection only works inside the Deutschtown neighborhood. A reviewer elsewhere can still pick a zone by hand.

## TestFlight

- **Beta app description:** Mind Your Block is a neighborhood cleanup app for Deutschtown. Please try checking in, finding your zone, adding a photo and RSVPing to events, and tell us what is confusing.
- **Feedback email:** zach.carman@gmail.com
- **What to test:** Welcome screen, a full check-in (with and without GPS), the map, events and RSVP, the leaderboard, and Delete my data.
- **Groups:** an internal group for you first (smoke test), then an external group named "Neighbors". The public link lets people join without you adding each email.
- **Builds expire after 90 days**, so upload a fresh build at least every three months while testing.

## Known risks to watch

- **User names are visible to other users.** Apple's rule 1.2 asks apps with user-generated content to offer a way to report or block abusive content. This app only shows short display names, the anonymous option hides them, and photos and notes are private. If the reviewer asks, the quickest fix is a "Report" action on leaderboard names and a profanity filter on names.
- **Empty states.** With no approved events and few neighbors yet, the Events tab and leaderboard are empty on day one. They say so plainly, which is fine for TestFlight, but real activity makes a better first impression.
- **Transfer to an organization later.** Apple allows an app transfer between accounts, but TestFlight builds and testers must be removed first, and Apple generally wants an approved App Store version. If the app only ever lives in TestFlight, expect to recreate it under the organization account instead.

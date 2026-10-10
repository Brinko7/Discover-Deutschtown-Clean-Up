# Mind Your Block — testing release runbook

Goal: get test builds to neighbors through the stores' private testing
tracks (no public listing needed).

- Android: Google Play **Internal testing** (no review, up to 100 testers)
- iOS: **TestFlight** external group (one beta review, ~24-48h)

Bundle ID (both stores): `org.eastallegheny.mindyourblock`
Version: 1.0 (versionCode 1 / build 1)

## 0. Prepare the build (on your Mac, ~10 min)

```bash
cd ~/Documents/GitHub/Discover-Deutschtown-Clean-Up/app
npm install
npm run sync          # vite build + copy web bundle into android/ and ios/
npx @capacitor/assets generate --iconBackgroundColor '#1a1a2e' --splashBackgroundColor '#1a1a2e'
```

The last command builds all app icons + splash screens from
`assets/icon.svg` (the brand grid mark) for both platforms.
Commit the result.

## 1. Google Play — internal testing

You already have the Bored Brinko developer account.

1. Play Console > Create app. Name: "Mind Your Block".
2. Android Studio: open `app/android` > Build > Generate Signed App Bundle/APK
   > Android App Bundle. Create a **new keystore** for this app (new upload
   key; Play App Signing manages the final signing key). Keep the keystore
   file + passwords somewhere safe, you need them for every future upload.
3. Play Console > the app > Testing > Internal testing > Create release,
   upload the `.aab`.
4. Internal testing > Testers > Create email list, add the neighbors.
5. Share the opt-in link from the Internal testing page. Testers open it,
   join, and install from the Play Store.

No review is required for the internal track. (The 14-day closed test rule
only applies before a *production* release.)

## 2. Apple — TestFlight

1. Enroll in the Apple Developer Program ($99/yr) at developer.apple.com
   with your Apple ID. Identity verification takes ~1-2 days, start early.
2. Xcode: open `ios/App/App.xcworkspace`, select the App target > Signing &
   Capabilities, set your Team. Set the Bundle Identifier to
   `org.eastallegheny.mindyourblock`.
3. Product > Archive, then Distribute App > App Store Connect > Upload.
4. App Store Connect > My Apps > + > New App (iOS, bundle ID above).
   You will be asked for a **privacy policy URL** — host
   `privacy-policy.html` (repo root) somewhere public first.
5. TestFlight tab > add the build to an External group, fill in the beta
   review info (no login needed; test notes: "Neighborhood cleanup tracker
   for Discover Deutschtown — check in when you clean, earn points."),
   submit for beta review.
6. Once approved, share the public TestFlight link with neighbors.

## Later (public launch, not needed for testing)

- Real Venmo handle (see the warning comment on `VENMO_HANDLE` in
  `src/data.js`)
- Real domain for share links (`mindyourblock.org` placeholder in
  `src/native.js`) and the contact email
- Move check-in photos from Preferences data-URLs to Filesystem storage
  (they will hit storage limits with real use)
- Rotate the Supabase anon key hardcoded in the old web HTML before any
  backend goes live (see README)

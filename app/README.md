# Mind Your Block — Mobile App

The Capacitor (native webview) version of the Mind Your Block neighborhood
cleanup platform. The original one-page website still lives at the repo root
(`clean-east-allegheny-Github-initial.html`) — this app is a from-scratch
mobile rebuild of the same ideas, designed like a modern phone app instead of
a scrolling page.

## What's inside

| Tab | What it does |
| --- | --- |
| **Home** | Greeting, your stats, 🔥 hot blocks (point multipliers), live activity feed, donate / share / mixer |
| **Map** | Leaflet map of all 9 Deutschtown zones colored by cleanup status, "find me" GPS button, zone detail sheet with blocks + check-in shortcut |
| **Check In** (center button) | Pick a zone (or let GPS detect your zone *and block*), live cleanup timer, bag counter with partial bags, **camera photos**, notes, live points preview, confetti celebration |
| **Events** | Upcoming / My events / Past segmented list, RSVP, sponsored event details (ACB), share an event |
| **You** | Profile, leaderboard with podium, mascot badge collection, adopted blocks, cleanup history with photos |

Native device features via Capacitor plugins:

- **Camera** (`@capacitor/camera`) — attach cleanup photos during a session
- **Geolocation** (`@capacitor/geolocation`) — auto-detect which zone/block you're standing in (point-in-polygon against the real zone boundaries)
- Haptics, Status Bar, Splash Screen, Share, Preferences (offline persistence)

Everything persists on-device via Preferences, so points, badges, RSVPs and
history survive app restarts. **No backend is wired up yet** — see
"Connecting Supabase" below.

## Development

```bash
cd app
npm install
npm run dev        # runs in the browser at http://localhost:5173
```

The whole app runs in a normal desktop/mobile browser — camera falls back to
a file picker and geolocation uses the browser API — so you can iterate
without a device.

## Building the phone apps

```bash
npm run sync       # = vite build + cap sync (do this after any web change)
```

### Android (Windows/Mac/Linux)

1. Install [Android Studio](https://developer.android.com/studio)
2. `npx cap open android`
3. Run on an emulator or a plugged-in phone (enable USB debugging).
   To share with neighbors: **Build → Generate Signed App Bundle/APK** and
   send the APK, or distribute through Play Console internal testing.

### iOS (Mac only)

1. Install Xcode + CocoaPods (`sudo gem install cocoapods`)
2. `cd ios/App && pod install`
3. `npx cap open ios`
4. Set your signing team, then run on a simulator or device.
   For sharing: TestFlight.

Camera/location permission strings are already declared in
`android/app/src/main/AndroidManifest.xml` and `ios/App/App/Info.plist`.

## Where things live

```
app/
├── src/
│   ├── main.js            # boot, tab router, onboarding
│   ├── data.js            # zones, blocks, polygons, events, scoring — all seed data
│   ├── store.js           # state + on-device persistence (swap in Supabase here)
│   ├── native.js          # camera / GPS / haptics / share wrappers
│   ├── ui.js              # bottom sheets, toasts, confetti
│   ├── icons.js           # inline SVG icon set (no CDN needed)
│   ├── styles.css         # design system (brand palette from the website)
│   └── screens/           # home, map, checkin, events, profile
├── android/               # native Android project (committed)
├── ios/                   # native iOS project (committed)
└── capacitor.config.json
```

## Connecting Supabase (later)

The web version's tables map cleanly onto this app:

- `store.js` → `recordCheckin()` is the single write path for check-ins
  (insert into `checkins`, upload `photos` to a storage bucket).
- `store.js` → profile/points → `profiles` table; leaderboard in
  `screens/profile.js` currently merges you into `MOCK_LEADERS` — replace
  with a `profiles` query ordered by points.
- RSVPs (`toggleRsvp`) → `rsvps` table; adoptions (`adoptBlock`) → `adoptions`.
- `data.js` seed constants (`ZONES`, `BLOCKS`, `SCHEDULE`, `ZONE_META`,
  `HOT_SPOTS`) become fetches with the seeds as offline fallbacks.

Note: the anon key hardcoded in the old website should be rotated before the
backend goes live.

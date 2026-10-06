<p align="center">
  <img src="public/assets/flip7-title-logo.webp" width="300" alt="Flip7 Companion" />
</p>

<h1 align="center">Flip7 Companion Mobile</h1>

<p align="center">An offline Capacitor app for tracking the physical Flip 7 card game on one device.</p>

## What it does

Flip7 Companion Mobile has separate Classic and With a Vengeance spaces while running entirely on the device. Players reveal and move cards from the physical deck; the app records cards, actions, round scores, and totals. It never draws cards.

The mobile build includes:

- Banker Mode for a whole group sharing one phone or tablet.
- Temporary Demo Mode for practice, including a multi-hand Vengeance table.
- An edition switch with separate player profiles, rooms, match history, and lifetime stats. One backup contains both spaces.
- A mobile room library, reusable player profiles, match history, and settings.
- A floating Home / Players / + / History / Settings dock.
- Local card artwork bundled in the app, with compact WebP assets.
- Saved offline rooms with automatic game resume and per-round scores and card records.
- No accounts, online room codes, multiplayer networking, analytics, backend calls, or internet requirement.

Banker rooms are saved automatically in device-local app storage. Leaving, refreshing, or reopening the app retains the current cards, scores, and turn order. Demo practice remains temporary.

Game data has a 10 MB budget, measured conservatively as UTF-16 JSON size. Recorded cards reference the bundled card catalog by ID; images are never duplicated in match saves. Undo snapshots remain in memory and reset when reopening a table. Failed writes retain the previous save and offer a retry before play continues. Settings shows storage usage, backup export/restore, and explicit completed-room cleanup; active rooms are never automatically deleted. Existing save versions migrate into the Classic space.

## Playing offline

1. Open Home and tap **+** to create a room.
2. Select Classic or With a Vengeance. Name the room, add 2–18 players, choose a target score, and start or save it for later. The printed Vengeance game is marked for 3 or more players.
3. Record the cards revealed from the physical deck.
4. In Vengeance, choose action recipients and eligible face-up cards, then confirm the physical move. Stayed hands remain visible because their scores can change. Undo corrects recording mistakes.
5. Return to the room to review standings and each completed round’s cards. Add players before the first card of a round; they join with zero points. Started participants remain in the record.

The APK contains the JavaScript bundle, styles, icons, and card artwork. It does not need a server or internet connection after installation.

## Build the web bundle

Prerequisites: Node.js 20 or newer and npm.

```bash
npm install
npm test
npm run build
```

The production web bundle is written to `dist/`.

The supplied Vengeance PNGs stay in `public/cards/thumbnails_vengeance/`. Run `npm run import:vengeance-cards` to map them to 27 full-size WebP faces plus a card back in `public/cards/vengeance/`, and 256-pixel-wide WebP previews in `public/cards/vengeance/thumbnails/`. This preserves the source PNGs and their aspect ratios, matching the Classic preview process. The web build excludes the staging PNGs from the APK. Selectable artwork uses catalog IDs such as `v-action-steal.webp` and `v-number-lucky-13.webp`. `npm run build:release` and Android `assembleRelease` verify all 27 selectable faces and previews.

## Build the Android APK

Prerequisites: Android Studio with its bundled JDK and the Android SDK.

```bash
npx cap sync android
cd android
./gradlew clean assembleDebug
```

On Windows PowerShell, use `gradlew.bat` instead of `./gradlew`.

The debug APK is created at:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

Named APK versions are kept in `APK Versions/`, including `flip7-companion-v1.1.apk`, `flip7-companion-v1.2.apk`, and `flip7-companion-v1.3.apk`.

The room's **Show live scores on TV** action starts a local read-only scoreboard server and displays its address. Open that address in a TV web browser on the same local network. The phone keeps control of the game; the TV receives live score updates without internet access. TVs need a compatible browser and access to the phone's local IP address.

## Product pages

| Route | Purpose |
| --- | --- |
| `/landing` | Home and saved room library. |
| `/players` | Reusable player profiles and match stats. |
| `/history` | Completed and active match records. |
| `/settings` | Preferences, storage, backups, and help. |
| `/new`, `/play` | Create a room and choose its players. |
| `/room?id=…` | Room standings, editing, and per-round card history. |
| `/banker?room=…` | Local one-device Banker Mode for a saved room. |
| `/demo` | Temporary Classic or Vengeance practice for the selected edition. |
| `/vengeance`, `/vengeance-demo` | Vengeance saved table and temporary multi-hand table. |
| `/rules` | Illustrated game rules and scoring reference. |
| `/faq` | Offline app and gameplay answers. |
| `/privacy` | Local-data privacy policy. |
| `/terms` | Offline app terms. |
| `/contact` | Contact page and email-copy action. |

## Technology

| Area | Implementation |
| --- | --- |
| UI | React 19, TypeScript, Vite 8 |
| Android wrapper | Capacitor 8 |
| Animation | Motion |
| Icons | Lucide React |
| Game state | Local React reducers and compact versioned device saves |
| Styling | Mobile room shell with preserved Carnival Table gameplay visuals |

## Project structure

```text
public/
├── assets/                 # Logo, icon, and promotional artwork
└── cards/                  # Bundled WebP card artwork

src/
├── components/             # Shared card and modal components
├── game/                   # Card definitions and local game reducers
├── lib/                    # Navigation and local utilities
├── pages/game/             # Demo, Banker, table, controls, and dialogs
├── pages/local/            # Offline mode chooser
├── pages/landing/          # Landing page and footer
├── pages/legal/            # Privacy and terms content
├── pages/rules/            # Illustrated rules reference
├── styles/                 # Shared responsive styles
├── App.tsx                 # Local route selection
└── main.tsx                # React entry point

android/                    # Capacitor Android project
```

## Design and gameplay

Classic retains its existing scoring rules, action behavior, and carnival look. Vengeance has a separate rules engine and navy, red, and cream theme. Both editions share the same Android package and offline backup. This repository is the offline mobile version; the separate web project remains responsible for any online functionality.

## Current limitations

- Rooms are local to the device and are not synchronized online. Clearing app data or uninstalling may remove local saves.
- Backup export uses the platform’s browser download handling. Native Android file export still needs device-level verification.
- The app is a companion to the physical deck and does not deal cards automatically.
- Vengeance artwork is bundled. Complete physical-deck playtests are still needed before distributing a signed update. Optional Brutal Mode is not included in this version.
- The contact form is not built yet; the Contact page provides a copyable email action.

## License and trademarks

Flip7 Companion is an independent, unofficial companion app for the physical card game. It is not affiliated with, endorsed by, sponsored by, or associated with the creator, publisher, or other rights holders of **Flip 7**.

**Flip 7** and its related game materials belong to their respective owners.

<p align="center">
  <img src="public/assets/flip7-title-logo.webp" width="300" alt="Flip7 Companion" />
</p>

<h1 align="center">Flip7 Companion Mobile</h1>

<p align="center">An offline Capacitor app for tracking the physical Flip 7 card game together.</p>

## What it does

Flip7 Companion Mobile keeps the existing Flip 7 game rules and visual design while running entirely on the device. Players use the physical deck; the app records cards, actions, round scores, and totals.

The mobile build includes:

- Banker Mode for a whole group sharing one phone or tablet.
- Demo Mode for private practice.
- A mobile room library, reusable player profiles, match history, and settings.
- A floating Home / Players / + / History / Settings dock.
- Local card artwork bundled in the app, with compact WebP assets.
- Saved offline rooms with automatic game resume and per-round scores and card records.
- Optional local-network room sharing, with QR/code invites and host-approved guest seats.
- No accounts, cloud game server, analytics, or internet requirement after installation.

Banker rooms are saved automatically in device-local app storage. Leaving, refreshing, or reopening the app retains the current cards, scores, and turn order. Demo practice remains temporary.

Host game data has a 10 MB budget, measured conservatively as UTF-16 JSON size. Recorded cards reference the bundled card catalog by ID; images are never duplicated in match saves. Undo snapshots remain in memory and reset when reopening a table. Failed writes retain the previous save and offer a retry before play continues. Settings shows storage usage, backup export/restore, and explicit completed-room cleanup; active rooms are never automatically deleted.

## Playing offline

1. Open Home and tap **+** to create a room.
2. Name the room, add 3–18 players, choose a target score, and start or save it for later.
3. Record the cards revealed from the physical deck.
4. Use the existing Hit, Stay / Bank, action-card, correction, undo, and round controls.
5. Return to the room to review standings and each completed round’s cards. Add players before the first card of a round; they join with zero points. Started participants remain in the record.

The APK contains the JavaScript bundle, styles, icons, and card artwork. Solo and shared play do not need internet after installation. For shared play, the host Android phone runs a temporary local server that other devices reach over the same Wi-Fi or hotspot.

## Playing together on a local network

1. The host creates a room with 3–18 players, then taps **Invite players to join** from the room or **Invite players** from the game menu.
2. Everyone connects to the same Wi-Fi or the host phone’s hotspot. Android guests choose **Join a nearby room → Scan QR code** in Flip7, then point their camera at the host’s invite QR. They can also enter the six-character room code or full address. Browser guests can scan the QR with their phone’s camera to open the browser page.
3. Each guest sets **My character**, selects their seat, and asks to join. The host approves the request. Unclaimed seats remain under host control.
4. On their turn, a guest records their own physical card or banks their own table. They can view other tables. The host can edit any table and take back a claimed seat.

The host phone holds the authoritative match. Each joined device saves a read-only copy of the room and round history after live updates, so its last received state remains visible when disconnected. The host must keep the app open for live play. Room codes are discoverable on the local network; the full address is the fallback when discovery is unavailable. Device profiles and joined-room copies are stored separately from the host library and are not included in the Settings backup.

## Build the web bundle

Prerequisites: Node.js 20 or newer and npm.

```bash
npm install
npm test
npm run build
```

The production web bundle is written to `dist/`.

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

Named APK versions are kept in `APK Versions/`.

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
| `/banker?room=…` | Host table for a saved room, with optional local guest control. |
| `/join` | Join a host's local room by code or address. |
| `/demo` | Local solo practice table. |
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

The mobile app keeps the existing scoring rules, action-card behavior, and card artwork. The surrounding mobile screens use the same carnival colors and art style. Local sharing connects nearby devices directly without an online account.

## Current limitations

- Shared rooms work only while the host is reachable on the same local network. There is no cloud sync; clearing app data or uninstalling may remove local saves.
- Browser guests can play while connected, but their saved copy depends on the browser and the host's address. Android app guests have a stable local copy in app storage.
- Backup export uses the platform’s browser download handling. Native Android file export still needs device-level verification.
- The app is a companion to the physical deck and does not deal cards automatically.
- The contact form is not built yet; the Contact page provides a copyable email action.

## License and trademarks

Flip7 Companion is an independent, unofficial companion app for the physical card game. It is not affiliated with, endorsed by, sponsored by, or associated with the creator, publisher, or other rights holders of **Flip 7**.

**Flip 7** and its related game materials belong to their respective owners.

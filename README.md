<p align="center">
  <img src="public/assets/flip7-title-logo.png" width="300" alt="Flip7 Companion" />
</p>

<h1 align="center">Flip7 Companion Mobile</h1>

<p align="center">An offline Capacitor app for tracking the physical Flip 7 card game on one device.</p>

## What it does

Flip7 Companion Mobile keeps the existing Flip 7 game rules and visual design while running entirely on the device. Players use the physical deck; the app records cards, actions, round scores, and totals.

The mobile build includes:

- Banker Mode for a whole group sharing one phone or tablet.
- Demo Mode for private practice.
- The same responsive Carnival Table interface used by the mobile web layout.
- Local card artwork bundled in the app, with compact WebP assets.
- No accounts, room codes, multiplayer screens, analytics, backend calls, or internet requirement.

The active table is held in memory. Leaving or refreshing the app clears that session.

## Playing offline

1. Open the app and choose **Banker Mode** or **Demo Mode**.
2. In Banker Mode, add the player names, choose a target score, and start the table.
3. Record the cards revealed from the physical deck.
4. Use the existing Hit, Stay / Bank, action-card, correction, undo, and round controls.

The APK contains the JavaScript bundle, styles, icons, and card artwork. It does not need a server or internet connection after installation.

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

The current named copy is `android/app/build/outputs/apk/debug/flip7-companion-mob-ver-1.1.apk`.

## Product pages

| Route | Purpose |
| --- | --- |
| `/landing` | Mobile landing page and entry point. |
| `/play` | Offline mode chooser. |
| `/banker` | Local one-device Banker Mode. |
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
| Game state | Local React reducers and in-memory state |
| Styling | Existing responsive Carnival Table CSS |

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

The mobile app intentionally keeps the existing game logic, scoring rules, action-card behavior, card artwork, and mobile layout. This repository is the offline mobile version; the separate web project remains responsible for any online functionality.

## Current limitations

- Game sessions are temporary and are not synchronized between devices.
- The app is a companion to the physical deck and does not deal cards automatically.
- The contact form is not built yet; the Contact page provides a copyable email action.

## License and trademarks

Flip7 Companion is an independent, unofficial companion app for the physical card game. It is not affiliated with, endorsed by, sponsored by, or associated with the creator, publisher, or other rights holders of **Flip 7**.

**Flip 7** and its related game materials belong to their respective owners.

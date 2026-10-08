<p align="center">
  <img src="public/assets/flip7-title-logo.webp" width="300" alt="Flip7 Companion" />
</p>

<h1 align="center">Flip7 Companion Mobile</h1>

<p align="center">An offline Capacitor mobile app for tracking the physical Flip 7 card game on a single phone or tablet.</p>

---

## What it does

**Flip7 Companion Mobile** is an offline digital companion for the physical **Flip 7** card game. It features dedicated game spaces for both the **Classic** game and **With a Vengeance** expansion, running entirely on-device without needing internet, backend servers, or user accounts.

While players shuffle, deal, and reveal cards from the physical deck at the table, the app acts as the table host ("Banker"): recording revealed cards, enforcing game rules, resolving interactive actions, computing scores in real time, and keeping a permanent record of match standings and per-round cards.

---

## Features

### 1. Dual Game Spaces: Classic & With a Vengeance
- **Classic Edition:** Full support for original Flip 7 scoring, bust thresholds, second chances, freezes, and points modifiers with the signature carnival table styling.
- **With a Vengeance Edition:** Complete implementation of the Vengeance rules engine — featuring interactive player-targeting actions (Freeze, Discard, Steal, Flip Three, Dealer Freeze), stayed hand score adjustments, and dealer rotations with a dedicated navy, crimson, and gold aesthetic.
- **Quick Edition Switcher:** A floating Action Button (FAB) lets you instantly toggle between Classic and Vengeance modes. Each edition maintains independent player rosters, active rooms, match history, and lifetime stats.

### 2. Brutal Mode Variant (Vengeance)
- **High-Stakes Scoring:** An optional rules variant for cutthroat Vengeance matches, featuring sub-zero score accumulation.
- **Penalty Retention:** Negative modifier cards continue to dock points from players even after they bust.
- **The Flip 7 Dilemma:** Achieving a Flip 7 presents the finisher with a critical choice: take the +15 point bonus for themselves, or unleash a devastating -15 point penalty directly against a rival's score!
- **Safety Warnings:** Dedicated confirmation dialogues and distinct skull badging prevent accidental activation.

### 3. TV Scoreboard Cast (Local LAN & Hotspot)
- **Zero-Cloud Local Streaming:** Built-in offline HTTP and WebSocket server hosted directly on your Android device.
- **Big-Screen Spectator View:** Smart TVs, tablets, or laptops on the same Wi-Fi network or mobile hotspot can open the local URL (`http://<phone-ip>:8080/tv.html`) to display a live, read-only scoreboard.
- **Real-Time Synchronisation:** Spectator screens automatically reflect round progression, point updates, active player highlights, and match winners without requiring an internet connection.

### 4. Single-Device Banker Mode
- **Shared Table Operator:** Designed for game night where the entire group shares one phone or tablet operated by a host or passed between players.
- **Bundled Card Art:** High-resolution, compact WebP artwork for all number, modifier, and action cards bundled directly into the app.
- **Smart Rule Enforcement:** Automatic duplicate-number bust detection, Second Chance protection, Freeze state handling, and Flip 7 recognition.
- **Guided Action Wizards:** Step-by-step modal prompts for complex actions such as Steals (selecting source, actor, target, and eligible cards) and Discards.
- **Full Undo & Redo History:** In-memory undo/redo stack allows instant correction of physical card recording mistakes.
- **In-Hand Card Management:** Tap any card in a player's hand to view details, replace it, void/discard it, or remove it.

### 5. Visual Match Scorecard & Share Integration
- **High-Resolution Scorecard Generator:** Generates a custom, high-res PNG image of the final scoreboard directly on an HTML5 canvas.
- **Native Share Integration:** Uses the Web Share API (`navigator.share`) to send match results directly to group chats or messaging apps.
- **1-Tap Save:** Download PNG results directly to device storage with full podium rankings and round-by-round point breakdowns.

### 6. Player Crew Profiles & Lifetime Stats
- **Reusable Crew Roster:** Save player profiles once and add them to any game room.
- **Character Avatars & Styles:** Diverse character avatar picker with Male, Female, and expressive character categories, paired with 8 vibrant color badges.
- **Persistent Lifetime Stats:** Tracks matches played, total wins, and all-time highest scores across game sessions.

### 7. Room Library & Match Management
- **2 to 18 Players:** Accommodates intimate duels up to massive party game tables.
- **Turn Order Management:** Interactive controls to arrange players in table seating order.
- **Dynamic Mid-Game Roster:** Add new players before a round begins (they join with 0 points) or adjust rosters mid-game.
- **Target Score Flexibility:** Choose from presets (50, 100, 150, 200, 250 pts) or set a custom target (50–500 pts).
- **Organization & Search:** Pin favorite or active rooms, filter by match state (All, In Progress, Ready, Completed), and search by room or player name.
- **One-Tap Rematch:** Start a new game with the exact same crew and target score in one tap.

### 8. Round-by-Round History Explorer
- **Detailed Match Archives:** View past game outcomes and podium winners.
- **Expandable Round Breakdown:** Inspect every player's exact cards, banked hands, busts, freezes, voided cards, and points earned in every round played.

### 9. Risk-Free Demo Practice Mode
- **Practice Without Consequences:** Temporary sandbox tables for both Classic and multi-hand Vengeance.
- Test card synergies, learn action resolution mechanics, and practice banking strategies without altering saved room records or player statistics.

### 10. Illustrated In-App Rulebook & FAQ
- **Illustrated Rules Reference:** Interactive rulebooks for both Classic and Vengeance editions (`/rules`), with visual guides for scoring, card counts, and action effects.
- **Comprehensive FAQ:** In-app guide (`/faq`) covering gameplay edge cases, offline operation, and companion features.

### 11. Storage Controls, Backup & Restore
- **10 MB Storage Budget:** Conservative UTF-16 JSON limit with an active storage meter in Settings.
- **Full JSON Backups:** Export your entire game library (both Classic and Vengeance spaces) as a single portable JSON file, and restore it on any device.
- **Completed Room Cleanup:** Safely purge detailed card histories from finished rooms to reclaim storage space while keeping player lifetime stats intact.

### 12. 100% Offline & Privacy-First Architecture
- **Zero Accounts:** No email addresses, phone numbers, passwords, or authentication required.
- **Zero Tracking:** No analytics libraries, crash reporters, telemetry beacons, or ad networks.
- **Zero Remote Calls:** No remote backend servers, external APIs, or internet connection needed.

---

## Playing offline

1. Open **Home** and tap **+** (New room) in the bottom navigation.
2. Select **Classic** or **With a Vengeance**.
3. Name the room, set a target score (50–500 pts), select your gameplay style (Standard or Brutal in Vengeance), and add 2–18 players.
4. Arrange players in turn order and tap **Create & start playing**.
5. Reveal cards from your physical deck and record them by tapping player seats.
6. The app automatically calculates points, prompts for action decisions, detects duplicate busts, and flags Flip 7s.
7. Tap **Stay** when a player chooses to bank their points.
8. When all hands settle, advance to the next round until someone reaches the target score.
9. Review the final podium, generate a visual share card, or view the complete round-by-round card history.

---

## Product pages & routes

| Route | Purpose |
| --- | --- |
| `/landing` | Home screen, promo carousel, room library, search, and pin controls. |
| `/players` | Saved player profiles, character avatar picker, and lifetime match statistics. |
| `/history` | Completed and active match archives with round-by-round card details. |
| `/settings` | Storage monitor, JSON backup export/restore, room cleanup, and preferences. |
| `/new`, `/play` | Room creation wizard, gameplay style chooser, and roster setup. |
| `/room?id=…` | Room overview, current standings, roster editing, and past round history. |
| `/banker?room=…` | Single-device Banker Mode table for Classic rooms. |
| `/vengeance?room=…` | Single-device Banker Mode table for With a Vengeance rooms. |
| `/demo` | Temporary Classic practice table. |
| `/vengeance-demo` | Temporary multi-hand Vengeance practice table. |
| `/rules` | Illustrated game rules, scoring tables, and action card reference. |
| `/faq` | Frequently asked questions regarding offline gameplay and app features. |
| `/privacy` | In-app Data Privacy Policy. |
| `/terms` | In-app Terms & Conditions. |
| `/contact` | Contact information and email-copy action. |

---

## Legal & Privacy

- Full documentation of our terms and privacy policy can be found in [PRIVACY_AND_TERMS.md](PRIVACY_AND_TERMS.md).
- Both policies can also be viewed natively inside the mobile app via the `/privacy` and `/terms` routes.

---

## Technology

| Area | Implementation |
| --- | --- |
| UI | React 19, TypeScript, Vite 8 |
| Android wrapper | Capacitor 8 |
| Animation | Motion 13 |
| Icons | Lucide React |
| Game state | Local React reducers with immutable undo/redo history |
| Data storage | Sandboxed on-device storage (IndexedDB / LocalStorage) with JSON migrations |
| TV Casting | Direct local HTTP / WebSocket streaming over LAN/hotspot |
| Visual Sharing | Canvas-rendered PNG scoreboard cards with Web Share API |

---

## Project structure

```text
public/
├── assets/                 # Logo, icons, and promotional artwork
└── cards/                  # Bundled WebP card artwork (Classic & Vengeance)

src/
├── components/             # Reusable UI components (Avatars, Cards, Modals)
├── game/                   # Card catalogs, game reducers (Classic & Vengeance)
├── lib/                    # Storage, TV casting, share cards, navigation
├── pages/contact/          # Contact page and email actions
├── pages/faq/              # Interactive FAQ and guide
├── pages/game/             # Banker, Demo, Vengeance tables, controls, and dialogs
├── pages/landing/          # Home screen, hero, promo carousels, and footer
├── pages/legal/            # In-app Privacy Policy and Terms screens
├── pages/mobile/           # Navigation dock, room cards, player editors, TV dialog
├── pages/rules/            # Illustrated game rules and scoring reference
├── styles/                 # Theme and responsive styles (Classic & Vengeance)
├── tv/                     # Standalone TV Scoreboard spectator display
├── App.tsx                 # Route coordinator
└── main.tsx                # React application entry point

android/                    # Capacitor Android Studio native project
```

---

## Build instructions

### 1. Build the web bundle

Prerequisites: Node.js 20 or newer and npm.

```bash
npm install
npm test
npm run build
```

The production web bundle is compiled to `dist/`.

To build a release package and verify card artwork integrity:
```bash
npm run build:release
```

### 2. Build the Android APK

Prerequisites: Android Studio with its bundled JDK and the Android SDK.

```bash
npx cap sync android
cd android
./gradlew clean assembleDebug
```

On Windows PowerShell, use `gradlew.bat` instead of `./gradlew`:
```powershell
.\gradlew.bat clean assembleDebug
```

The debug APK is output to:
```text
android/app/build/outputs/apk/debug/app-debug.apk
```

Named APK versions are archived in `APK Versions/`, including:
- `flip7-companion-v1.1.apk`
- `flip7-companion-v1.2.apk`
- `flip7-companion-v1.3.apk`

---

## Current limitations

- **Local-Only Storage:** Game rooms and statistics live solely on your device. Clearing app data or uninstalling the app removes local records unless exported via Settings backup.
- **Companion Nature:** The app is a companion tool for the physical game and does not deal or draw cards automatically.
- **TV Casting Scope:** The TV Scoreboard requires display devices to be connected to the same local network or mobile hotspot as your phone.

---

## License and trademarks

Flip7 Companion is an independent, unofficial companion app for the physical card game. It is not affiliated with, endorsed by, sponsored by, or associated with the creator, publisher, or other rights holders of **Flip 7**.

**Flip 7** and all associated card designs, titles, and trademarks are the property of their respective owners.

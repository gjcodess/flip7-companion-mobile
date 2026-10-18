# Local shared rooms

The Android app can host one shared match over a reachable local Wi-Fi network or
phone hotspot. Internet, accounts and a cloud service are not used. Existing
single-device play and the read-only TV server remain available.

## Using the feature

1. Start a saved match, tap the upper-left cast button, then choose **Invite → Open room for friends** in **Share & connect**. The same modal includes the TV scoreboard.
2. Keep the host room open. Other players connect to the same Wi-Fi/hotspot.
3. Players choose **Join a nearby room** from Home and scan the host's QR code.
   A QR photo or pasted invitation is also supported.
4. Each player selects/creates a local profile, requests an existing seat, and
   waits for host approval. The host sees a request count on the cast button and approves seats in its **Players** tab.
5. Approved players browse all tables, enter cards for their own turn/forced
   draws, bank their hand, and make decisions assigned to them by the game.
   The host can record for anyone and alone controls corrections/undo/rounds.

The host phone keeps the screen awake while hosting. Leaving the host room or
backgrounding its app pauses incoming requests; other phones cannot continue
independently. Reopening the room resumes processing. A participant disconnect
does not remove their hand. The host can continue recording for that player.

## Authority and durability

`shared-room-protocol.ts` accepts a small allowlist of player commands, maps the
approved device to its seat, and invokes the existing Classic/Vengeance reducers.
It never executes a reducer action supplied directly by a peer. Browsing is local
UI state. Host viewing changes do not invalidate a player's pending submission.

The host serializes requests and writes the room, revision and operation receipt
in one localStorage transaction **before** responding successfully. Revision
checks reject stale submissions. Up to 256 recent accepted operation IDs are
retained; retries check receipts before checking revisions. Older retries whose
receipt has expired fail their stale revision check rather than replaying a card.

Clients persist an unconfirmed operation before sending it. They cannot send
another action until the outcome is resolved. Network timeouts preserve that
same operation ID across restarts; explicit host rejection clears it. Polls and
actions use one client queue so late polls cannot replace newer accepted state.
Full snapshots are sent only when revisions change (or after an action).

## Transport and approval

`SharedRoomPlugin.java` uses bounded native HTTP sockets and a bounded work queue.
Invitations contain the local address, protocol version, room ID, invitation
secret and host RSA public key. Each exchange uses a new AES-256-GCM key wrapped
with RSA-OAEP SHA-256; replies use the same exchange key with a fresh nonce.
The invitation pins the host key. Payloads and reconnect credentials are encrypted
even though the local HTTP carrier requires Android cleartext transport enabled.
Redirects, remote addresses, oversized requests and incompatible protocols are
rejected. The spectator TV server does not acquire shared-room permissions.

Approvals and reconnect credentials survive host app restarts. The native plugin
remembers the last host key/port; if the address or port changes, scan the new
invitation. One controller is allowed per seat. The host can decline or release
a controller. Native server sessions are separate from saved rooms.

## History and statistics

Approved participants automatically receive the entire match, stripped of host
credentials and undo snapshots. Copies use `joined-<host room ID>` and remain
read-only. Incomplete copies show their last synchronization time. Finished
matches count once toward the participant's explicitly linked local profile;
other room members are not automatically imported into the local crew.

Backups include joined history and profile links. Deleting a completed copy
archives its lifetime statistics locally, with a tombstone to prevent a later
delivery from counting it again. It does not delete any other device's copy.
Removed completed copies are not automatically downloaded again. Export a backup
before removing details if they may be needed later. A disconnected participant
must reconnect to the original host to receive missing rounds/final corrections.

## Validation and limits

Automated tests cover seat approval/revocation, unauthorized commands, turn and
action ownership in both editions, forced draws, Brutal Flip 7 decisions, stale
submissions, idempotent retries, compact snapshots, backup compatibility, failed
saves, history/statistics deduplication and host revisions. Android instrumentation
tests exercise native socket/crypto exchanges and tamper rejection on an emulator.

Before release, test on at least three physical Android devices over both home
Wi-Fi and host-created hotspots. Cover camera QR scanning, host/participant app
backgrounding and restarts, address changes, simultaneous host/player entry,
seat replacement, final-result delivery, TV sharing and the supported player count.
Some guest networks isolate clients; hotspot device limits also vary. An emulator
does not establish compatibility with those hardware/network combinations.

The current target is Android API 36. When raising to API 37, implement the
applicable local-network permission flow. Do not promise background hosting or
automatic host transfer in this version. The protocol constant must be bumped
when command semantics or game-rule compatibility change.

### Two-emulator walkthrough — October 16, 2026

Manually exercised the installed APK on `medium_phone` (Android 16, host) and
`Pixel_10_Pro` (Android 17, participant), using Emulator 36.6.11 shared Wi-Fi:

- Decoded the QR actually displayed by the host and pasted its invitation on
  the participant. The emulated camera was not used.
- Requested Anna's seat, approved it on the host, and confirmed player entry
  remained unavailable before approval.
- Recorded a host 12 and participant 3 on their respective phones and verified
  both appeared on the host.
- Assigned Flip Three from the host to Anna. Her phone showed three forced draws;
  entering another 3 correctly busted her hand and ended the forced draws.
- Banked the host's 12, confirmed the round, and verified round two and the full
  round-one card history (12–0) on the participant.
- Backgrounded the host and verified the participant paused with input disabled.
- Restarted the host app, reopened the saved room, and re-enabled hosting. The
  participant reconnected with its existing approval and unchanged scores.
- Restarted the participant app, opened its retained read-only history, and
  reconnected without another approval. Browsing the host's table remained
  read-only and did not change the host's selected table.

This walkthrough found and fixed missing theme variables on the hosting dialog
and own-hand controls being displayed while browsing another player's table.
The automated suite still passes all 192 tests. This manual run covers Classic;
manual Vengeance/Brutal, physical camera scanning, hotspot hardware, larger groups
and TV coexistence still need separate validation.

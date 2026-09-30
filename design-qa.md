# Mobile Redesign — Visual QA

## Comparison setup

- Home source of truth: selected direction 3, `C:/Users/glenn/.codex/generated_images/01a0ed7a-36c0-7be1-b908-6bac3295fde0/exec-2983fe5d-d67e-47a9-a0e6-83a5c1f189b5.png` (853 × 1844 px).
- Settings reference: `C:/Users/glenn/AppData/Local/Temp/codex-clipboard-3194e1fc-9750-43dc-936c-497944fd1583.png` (390 × 821 px).
- Implementation: live app at `http://127.0.0.1:5173/landing`, with browser captures reviewed at 320 × 720, 360 × 800, 393 × 848, 430 × 932, and 768 × 1024 CSS px where the in-app browser allowed the requested size. Device scale was 1. The current Codex browser only exposes captures inline, not as a local screenshot path.
- Home matched comparison: selected mock normalized to 393 × 848 CSS px; app capture at 393 × 848. The source and implementation were opened and reviewed in this task. A retained side-by-side image could not be created because the browser URL policy rejected opening the local source over `file://`; no workaround was attempted.
- UI state: the original browser profile had one empty `New match` draft. During visual inspection, opening `/banker` without a match ID created an additional empty draft. I asked for approval to delete only that newest test draft and have not deleted it. The displayed list state therefore differs from the mock's named in-progress and draft examples.

## Visual findings and fixes

1. Initial P1 — Home hero proportions and artwork drifted: the logo was near the top edge, the heading was too small, and two low-resolution card photos stood in for the mock's large comic card fan. Moved the logo/headline to the reference landmarks, enlarged the display heading, and generated a transparent card-fan illustration based on the selected mock. At 393 × 848, measured landmarks are logo y=42, headline y=126, match section y=231, match panel y=275, and navbar top y=747; these align with the normalized source composition. The hero image is 768 × 512 PNG, 437 KB, at `public/assets/mobile-home-hero-art.png`.
2. Initial P1 — the app stretched across tablet/desktop widths and pushed the layout away from a phone app. Constrained the app surface and its docked navbar to 480 px from 720 px upward; the 768 px check showed a centered phone-width frame and no page-width overflow.
3. Initial P2 — the dark navbar was too short and its labels/control were undersized against the mock. Increased it to a 101 px standard height (90 px on short screens), enlarged navigation targets, and retained the user-requested navy background with yellow top rule and pink active state.
4. Initial P2 — long match names ellipsized awkwardly between 320–380 px. The narrow breakpoint now allows a two-line title while preserving the card's score/action column.
5. Setup-flow check — at 320 × 720, the fixed nav covers the save action at the initial scroll position, as expected for the long form; scrolling to the bottom brings both Start and Save fully above the dock. At 393 × 848 both actions fit above it without scrolling.

## Fidelity review

- Typography: the hero now uses a 40–46 px heavy navy headline and the reference's two-line wrap; the page-title and compact utility text preserve a clear scale hierarchy. Existing Inter/system fallback remains offline-capable.
- Layout and spacing: logo, heading, accent line, action row, outlined room panel, lower corner fans, and fixed navigation were compared at the matched phone size. Home content uses 14 px gutters; the room panel begins at y=275 and the dock begins at y=747 in the 393 × 848 capture.
- Colors and surfaces: cream, navy, hot pink, cyan, and yellow remain the established palette. The dark navy navbar (instead of the mock's yellow) is intentional per the user's latest direction.
- Imagery: the top card-fan artwork is a transparent PNG derived from the chosen reference's visual motif. Existing gameplay cards and the active gameplay screen were not redesigned. The Home-room thumbnail also uses the card-fan art; the 437 KB image is reused rather than duplicated.
- Copy and controls: the user-facing room status, target score, and Edit/Resume actions remain; the existing delete affordance is still available as a subtle icon. Settings retains its local/offline guidance and the accordion opens correctly.
- Responsiveness: no horizontal overflow was measured at 320, 360, 393, 430, or 768 px. The app uses a centered 480 px surface from tablet width upward. Settings rows and the About card remain reachable by scrolling with the fixed dock present.
- Accessibility/polish: nav labels remain visible at 320 px; focus-visible and reduced-motion rules remain. One historical Vite HMR reload error was logged while the CSS file was being replaced; it did not recur after a page reload, and the production build succeeds.

## Remaining blockers

- The extra empty draft created during setup inspection is pending the user's explicit approval before deletion.
- The source/implementation screenshots were visually reviewed at the matched viewport, but a persistent paired capture is unavailable because the selected browser does not provide a screenshot file path and blocks the local-file URL needed for a montage.

## Implementation checklist

- [x] Rework Home, Players, History, Settings, New Game setup, and the dark-blue bottom navigation.
- [x] Use a shared responsive phone frame and explicit narrow/short/tablet breakpoints.
- [x] Inspect the main screens and key responsive widths in the in-app browser.
- [x] Verify Settings accordion and New Game bottom actions.
- [x] `npm run build` passes.
- [ ] Restore the original local match list after user approval.
- [ ] Retain a side-by-side screenshot artifact if a file-backed browser capture becomes available.

final result: blocked

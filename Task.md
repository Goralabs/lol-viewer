# Tasks

This document tracks tasks to implement on the site. Add new items with clear acceptance criteria and keep status updated.

## 1) Fix series/game pill color for ongoing games

- Problem: The UI currently colors the game pill for ongoing games. Game pills should remain neutral until a winner is decided.
- Desired behavior:
  - While a game is in progress (no winner recorded), the game pill is neutral gray (use existing neutral/gray token from the design system; avoid hardcoded hex if possible).
  - When a game completes, color that game’s pill according to the winning team.
  - The series-level pill should only reflect series outcome when a team wins the series, not during ongoing games.
- Acceptance criteria:
  - Ongoing games show a gray/neutral pill across all relevant views (e.g., lists, series detail, match cards).
  - Completed games show a pill colored for the winner of that game.
  - Series-level pill updates only when a team clinches the series (does not prematurely use team colors during in-progress games).
  - No regressions to other pill/tag components (e.g., status labels like BO1/BO3 remain unchanged).
  - Visual check passes in light/dark themes if applicable.
- Notes:
  - Likely involves components that render game and series pills and their color mapping logic.
  - Ensure color selection uses tokens from the theme/design system rather than inline values.
- Status: TODO
- Priority: High
- Owner: Unassigned

## 2) Split “Today’s Games” into Upcoming and Past (24h windows)

- Problem: The current “Today’s Games” section isn’t segmented. We need two sections to better reflect a rolling 24-hour window.
- Desired behavior:
  - Upcoming Games: include all games with start time in the next 24 hours from “now”.
  - Past Games: include all games with start time within the last 24 hours from “now”.
  - Hide a section if it has zero items.
  - Sort Upcoming ascending by start time; sort Past descending by start time.
  - Ongoing games (already started) should not appear in Upcoming. If they started within the last 24 hours, include under Past; optionally display a “Live” tag if supported.
- Acceptance criteria:
  - Two sections render as “Upcoming Games” and “Past Games” with correct items based on a rolling 24-hour window.
  - Time boundaries are inclusive on the nearer edge and exclusive on the farther edge:
    - Upcoming: startTime >= now and < now + 24h
    - Past: startTime >= now - 24h and < now
  - Uses a consistent timezone reference (prefer UTC or a configured site timezone). Do not mix server and client time without normalization.
  - Sorting matches spec in both sections.
  - Empty states are handled gracefully (section hidden or shows a subtle “No games” state, per design).
- Notes:
  - Centralize “now” computation to avoid drift across components; consider passing a single reference timestamp through context/props.
  - Ensure data filtering happens after normalizing timestamps to the chosen timezone.
  - If a separate Live area exists, coordinate to avoid duplication.
- Status: TODO
- Priority: High
- Owner: Unassigned

## 3) Reorder game detail: place Gold Graph and Objective Timeline below Players table

- Problem: In game detail views where the Players table, Gold Graph, and Objective Timeline are shown together, the graphs may appear above or mixed with player information. This makes it harder to scan player stats first.
- Desired behavior:
  - For any view that shows these three modules together, the visual order should be:
    1) Players table
    2) Gold Graph
    3) Objective Timeline
  - Keep section headers consistent and spacing uniform between sections.
  - Ensure responsive layouts preserve this order on mobile and desktop.
- Acceptance criteria:
  - On game detail pages/cards that include all three modules, the Players table renders first, followed by the Gold Graph, and then the Objective Timeline.
  - No overlapping, truncation, or layout shift when switching tabs/filters or resizing.
  - Keyboard navigation follows the same order for accessibility.
  - No regressions to data rendering; only the layout order changes.
- Notes:
  - Check components likely involved (e.g., Live game cards, series/game detail pages) and centralize the ordering in a shared layout wrapper if possible.
  - Verify conditional rendering still respects the order if one of the modules is missing (e.g., if Objective Timeline is unavailable, Gold Graph still follows the Players table).
  - Confirm CSS grid/flex ordering matches DOM order to avoid screen reader confusion.
- Status: TODO
- Priority: Medium
- Owner: Unassigned

## 4) Live backfill should not rewind the visible frame

- Problem: When a game is live and backfill is enabled (older frames are fetched/inserted), the currently shown frame jumps backward in time. The UI should maintain the current/latest context instead of rewinding when older frames arrive.
- Desired behavior:
  - When backfilling, insert older frames into history without moving the current frame pointer or visible time position.
  - Live playback/auto-advance continues moving forward based on new incoming live frames.
  - Graphs and timelines extend to include older data to the left, but the viewport and selected frame stay anchored at the same timestamp (or continue forward if live).
- Acceptance criteria:
  - Enabling backfill during a live game does not cause the selected frame, gold graph cursor, objective timeline marker, or players table to jump to an earlier time.
  - The time slider (if present) maintains position relative to the current timestamp after backfilled frames are added (index may shift internally, but the selected timestamp remains the same or advances if live).
  - Subsequent live updates still append/advance forward correctly with no stutter or double-processing.
  - No regressions when toggling backfill on/off multiple times during a single live session.
  - Works consistently after a refresh: state rehydrates and remains anchored to the latest/live frame when appropriate.
- Notes:
  - Anchor selection by timestamp, not array index; when prepending frames, adjust the internal index to keep the same timestamp selected.
  - Ensure sorting is stable and strictly by frame time; avoid resort side-effects that reset selection.
  - Consider keeping a monotonic "currentTime"/"currentFrameTimestamp" in state that is not reduced by backfill operations.
  - Verify all consumers (players table, gold graph, objective timeline) derive from the same selected timestamp to avoid desync.
- Status: TODO
- Priority: High
- Owner: Unassigned

## 5) Timeline controls visibility and speed behavior

- Problem: The timeline play/pause and speed controls only appear when clicking on “Live”, but they should be available when manually viewing older frames. Additionally, the speed sometimes changes automatically based on frame time deltas; it should only change via explicit user input.
- Desired behavior:
  - Show play/pause and speed selector only when the user is in manual (non-live) mode, i.e., viewing a timestamp older than the latest frame.
  - Hide or disable these controls when anchored to “Live”.
  - Playback speed remains fixed at the user-selected value (e.g., 0.5x/1x/2x) and never auto-adjusts due to irregular frame intervals.
  - Play advances frames from the current manual timestamp forward toward the latest frame at the chosen speed. Reaching the live boundary either pauses or switches to live only if the user opts in (per design choice), but does not change speed automatically.
- Acceptance criteria:
  - When the selected timestamp < latest timestamp (manual mode), play/pause and speed controls are visible and interactive; when selected timestamp == latest (live), these controls are hidden or disabled.
  - Speed selection does not change unless the user selects a different speed; irregular or sparse frame timings have no effect on the chosen speed.
  - Toggling between live and manual does not reset the speed; the last user-chosen value persists for the session.
  - Play/pause works as expected: play advances consistently at the selected speed, pause stops advancing; no stutter or double-advance when frames have variable spacing.
  - Keyboard and screen reader users can operate the controls; focus order and labels are correct.
- Notes:
  - Model timeline state explicitly: `mode: 'live' | 'manual'`, `selectedTimestamp`, `latestTimestamp`, `playState`, and `playbackRate`.
  - Compute `isLive` by comparing `selectedTimestamp` to `latestTimestamp` within a small tolerance to account for clock skew.
  - Store `playbackRate` in state or context; do not derive from frame deltas. Drive visual animations by timers tied to `playbackRate`.
  - Ensure all consumers (graphs, tables, markers) respond to the same selected timestamp to avoid desync during playback.
- Status: TODO
- Priority: Medium
- Owner: Unassigned

## 6) Show official local time under Upcoming/Past game cards

- Problem: The main page’s Upcoming and Past game cards do not show the official game time localized to the user. Users need a clear A.M./P.M. time under each card.
- Desired behavior:
  - Display the game’s official start time beneath each game card in Upcoming and Past sections.
  - Format the time in the user’s local timezone using 12-hour A.M./P.M. format (e.g., 3:05 PM).
  - If helpful for clarity across day boundaries, include a short date context when not “today” (e.g., Tue 3:05 PM). Keep it concise.
- Acceptance criteria:
  - Each game in Upcoming and Past shows a localized time directly below the card content, aligned consistently with the card layout.
  - Time is rendered in 12-hour format with A.M./P.M. suffix, reflecting the user’s current timezone.
  - Daylight saving and timezone differences are handled correctly by the formatting API; no manual offsets.
  - If the start time is missing/invalid, render a subtle placeholder (e.g., “TBD”) rather than nothing.
  - Works in light/dark themes and does not cause layout shift.
- Notes:
  - Use `Intl.DateTimeFormat` with `hour: 'numeric'`, `minute: '2-digit'`, `hour12: true` and the user timezone from `Intl.DateTimeFormat().resolvedOptions().timeZone`.
  - Consider a util in `src/utils/timestampUtils.ts` for consistent formatting and easy testing.
  - For non-today dates, consider prefixing a short weekday to reduce ambiguity.
- Status: TODO
- Priority: Medium
- Owner: Unassigned

## 7) Update site metadata (title and social sharing)

- Problem: When sharing the site link, the preview shows the placeholder name "vite-temp" and likely lacks proper metadata, reducing clarity and brand presence.
- Desired behavior:
  - Set a meaningful site title and meta description reflecting the product.
  - Add Open Graph and Twitter Card tags for rich link previews: title, description, image, URL, and site name.
  - Provide a default social share image that works across platforms (1200x630 recommended) and lives under `public/`.
  - Ensure favicon, apple-touch-icon, and theme color are defined.
  - Support per-page dynamic titles/descriptions if applicable (fallback to sane defaults).
- Acceptance criteria:
  - Browser tab shows the new site title instead of "vite-temp" across routes.
  - Sharing the root URL in Slack/Discord/Twitter/X renders the expected title, description, and image.
  - The default OG image loads from a stable absolute URL and meets size/aspect guidelines.
  - No console warnings about missing icons or metadata; Lighthouse/validators show metadata present.
  - If dynamic pages exist, their titles can override defaults without breaking the base metadata.
- Notes:
  - Update `index.html` head tags (title, meta description, og:*, twitter:*, theme-color, icons).
  - Consider a runtime approach (e.g., React Helmet/Head manager) for route-level overrides while keeping defaults in `index.html`.
  - Place the share image at `public/social-share.png` (1200x630) and reference it with an absolute path; ensure production base URL is correct.
  - Keep copy concise and consistent with README branding.
- Status: TODO
- Priority: Medium
- Owner: Unassigned

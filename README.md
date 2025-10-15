# Live LoL Esports

> Community-maintained fork of [aureom/live-lol-esports](https://github.com/aureom/live-lol-esports) with additional quality-of-life updates for following League of Legends esports in real time.

Live LoL Esports is a React + TypeScript single-page app that surfaces schedules, live match data, and post-game insights pulled from Riot's LoL Esports API. This fork keeps the upstream experience intact while layering on enhanced scoreboards, timeline tooling, and responsive styling for casters, analysts, and fans.

## Highlights
- Live series view with updated scoreboard, match point callouts, and team-branded styling.
- Gold differential graph and objective timeline overlays tuned for widescreen and mobile layouts.
- Timeline scrubber, backfill controls, and preferences that persist between visits.
- Dark/light theme toggle, toast notifications, and audio cues powered by the original project.
- Hash-based routing and static-host friendly deployment flow (Cloudflare Pages, GitHub Pages).

## Enhancements in this Fork
- Adds blue/red banner accents, polished typography, and deterministic winner logic to the series scoreboard (`SeriesScoreboard.tsx`).
- Hides unplayed games once a series is complete so only contested maps appear in the scoreboard pills.
- Expands the gold differential chart to use the full enhancement panel width on desktop and mobile (`goldGraph.css`).
- Maps elemental dragon kills to their correct SVG icons inside the objective timeline (`ObjectiveTimeline.tsx`).
- Shows the timeline scrubber only when the backfill toggle is enabled, keeping the live view uncluttered (`LiveGame.tsx` + `BackfillContext`).
- Persists theme and backfill preferences via `localStorage`, ensuring consistent UX between sessions (`ThemeToggler.tsx`, `BackfillContext.tsx`).

## Tech Stack & Tooling
- **Framework**: React 18 with TypeScript + Vite
- **Routing**: React Router v6 (`HashRouter` for static hosting)
- **Styling**: CSS Modules and scoped component styles with light/dark themes
- **Data**: Riot LoL Esports API (via Axios)
- **Utilities**: BigNumber.js for gold differentials, `use-sound` for audio feedback
- **Tooling**: ESLint (flat config), TypeScript 5, `vite-plugin-svgr` for inline SVGs, static hosting via GitHub Pages or Cloudflare Pages

## Key Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| [react](https://react.dev/) | ^18.2.0 | UI framework |
| [react-dom](https://react.dev/reference/react-dom) | ^18.2.0 | React renderer |
| [react-router-dom](https://reactrouter.com/) | ^6.8.0 | Client-side routing (HashRouter) |
| [axios](https://axios-http.com/) | ^0.21.1 | HTTP client for Riot API calls |
| [react-toastify](https://fkhadra.github.io/react-toastify/) | ^9.1.1 | In-app notifications |
| [use-sound](https://www.joshwcomeau.com/react/use-sound/) | ^2.0.1 | Lightweight audio cues |
| [bignumber.js](https://github.com/MikeMcl/bignumber.js/) | ^9.0.1 | Precise gold differential calculations |
| [react-helmet](https://github.com/nfl/react-helmet) | ^6.1.0 | Document head management |

Dev tooling highlights: `vite` ^7, `@vitejs/plugin-react`, `eslint` ^9 with React Refresh and Hooks plugins, `typescript` ~5.9, and `vite-plugin-svgr`.

## Getting Started

### Prerequisites
- Node.js 16+ (18+ recommended for best tooling support)
- npm (ships with Node) or your preferred package manager

### Installation
1. Clone your fork of this repository:
   ```bash
   git clone https://github.com/<your-github-username>/live-lol-esports.git
   cd live-lol-esports
   ```
   > Want the upstream project instead? Grab it from [aureom/live-lol-esports](https://github.com/aureom/live-lol-esports).

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the Vite dev server:
   ```bash
   npm run dev
   ```

4. Open `http://localhost:5173/` in your browser.

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Launches the Vite dev server with hot module replacement |
| `npm run build` | Creates an optimized production build in `dist/` |
| `npm run preview` | Serves the production build locally for smoke testing |
| `npm run lint` | Runs ESLint across the project |
| `npm run deploy` | Builds and publishes the site to GitHub Pages (`gh-pages` branch) |

### Environment Variables
Use `.env` (or `.env.local`) to override defaults. Copy from `.env.example` to get started:

```env
# Generate source maps for debugging (true/false)
GENERATE_SOURCEMAP=false
```

Vite exposes variables prefixed with `VITE_`. Add any new configuration using that convention.
- `VITE_BASE_PATH` (optional): Overrides the base path used for production builds. Defaults to `/`, which works for Cloudflare Pages and most static hosts. Set to `/live-lol-esports/` if you still deploy to GitHub Pages.

## Build & Deployment
- `npm run build` compiles the app to `dist/`.
- `npm run preview` verifies the build locally.
- `npm run deploy` runs the build and pushes the output to GitHub Pages. Ensure the repo's Pages settings target the `gh-pages` branch.

Because the router uses a hash history, the app is safe to host on static platforms (GitHub Pages, Netlify, etc.) without additional rewrites.

### Cloudflare Pages
1. Create a Cloudflare Pages project and connect it to this repository.
2. Leave the root directory as `/`, set the build command to `npm run build`, and set the build output directory to `dist`.
3. Add any required environment variables. Recommended defaults:
   - `NODE_VERSION=18` (matches the local tooling).
   - `VITE_BASE_PATH=/` (only necessary if you override it elsewhere).
4. Trigger a deploy. The `_redirects` file in `public/` ensures all client-side routes fall back to `index.html`, so React Router works without extra configuration.

If you continue to deploy to GitHub Pages, export `VITE_BASE_PATH=/live-lol-esports/` when running `npm run build` or `npm run deploy` so asset URLs resolve correctly.

## Project Structure

```
live-lol-esports/
├── public/                 # Static assets (favicon, manifest, robots)
├── src/
│   ├── assets/             # SVGs, images, audio
│   ├── components/         # Feature modules (Live game card, navbar, tests)
│   ├── hooks/              # Shared hooks (series summary, responsive helpers)
│   ├── theme/              # Theme context and tokens
│   ├── utils/              # API calls, formatting, series helpers
│   ├── App.tsx             # Router and layout shell
│   └── main.tsx            # React entry point
├── legacy/                 # Original Create React App implementation for reference
├── package.json
├── vite.config.ts
└── README.md
```

## Data Source & API Docs
Match data comes from the community-maintained [LoL Esports API documentation](https://github.com/vickz84259/lolesports-api-docs) by [vickz84259](https://github.com/vickz84259). Respect rate limits and caching recommendations when building additional features.

## Troubleshooting
1. Reinstall dependencies:
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```
2. Confirm your Node version matches the prerequisites.
3. Check the browser console and terminal output for API errors or CORS issues.
4. If GitHub Pages shows a blank screen, verify that Pages is targeting the `gh-pages` branch and that the router is still using `HashRouter`.

## Legacy & Migration Notes
- The project started as a Create React App build; the complete CRA version lives under `legacy/` for historical reference.
- Migration highlights: Vite build pipeline, React 18 `createRoot`, HashRouter-based routing, English (en-US) localisation, and Vite-friendly environment variables (`VITE_*`).
- Keep `legacy/` intact when contributing so upstream comparisons remain straightforward.

## Credits & Attribution
- Original project and core functionality by [aureom](https://github.com/aureom). If you build on this work, please credit the upstream repository.
- LoL Esports API documentation provided by [vickz84259](https://github.com/vickz84259).
- Additional enhancements in this fork by the community maintaining this repository.

## License
This repository is distributed under the terms of the [GNU GPL v3.0](LICENSE), consistent with the upstream project. See the license file for details.

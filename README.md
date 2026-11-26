# Carrot Roll

A fast-paced arcade survival game. Fly as a rabbit, dodge a giant rolling carrot that shoots broccoli, collect carrots to level up, and grab power-ups for shields, speed, and extra lives.

Created by Nya.

## Features

- 25 levels in five themed tiers (Sunny Meadow, Autumn Orchard, Frost Valley, Stormy Skies, Starlight Night), each with its own background, two new hazards, and a boss fight on its last level
- 12 power-ups unlocked one at a time (shield, speed, blasters, magnet, Decoy Doe, Broccoli Reflector, Bunny Bomb, Slow-Mo Clover, Carrot Rain, Shrinking Violet, Double Trouble, hearts) plus power-up combos
- Scoring extras: carrot combos up to x5, near-miss bonuses, golden (and rotten) carrots
- Full-screen mobile play in portrait or landscape: drag anywhere to fly, blasters auto-fire
- Installable as a home-screen web app (true full screen on iPhone)
- Sound effects and in-game music (one Web Audio mixer, so volume/mute work on iOS too)
- Daily challenge: one seed per UTC day, so everyone plays the same levels, with its own 🎯 leaderboard tab
- Leaderboard with seasons: the current season's Today / Overall / Mobile boards, and the original 20-level game's scores kept under "Classic"
- Admin tools for score management and ending demos

## Tech stack

- **Frontend:** React, TypeScript, Vite, Tailwind CSS, Framer Motion
- **Backend:** Express, Drizzle ORM
- **Shared:** Zod schemas for API routes and validation

## Getting started

### Prerequisites

- Node.js 20+
- npm

### Install & run

```bash
npm install
npm run dev
```

The app runs at [http://localhost:5000](http://localhost:5000) by default.

### Build for production

```bash
npm run build
npm start
```

Optional environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | HTTP port | `5000` |
| `ADMIN_USERNAME` | Initial admin username (first run) | `admin` |
| `ADMIN_PASSWORD` | Initial admin password (first run) | `password` |
| `VITE_BASE_URL` | Public base path for assets/routes | `/` in dev, `/carrotroll/` in production |

### Database note (seasons and daily challenge)

Scores carry a `season` (1 = Classic) and a nullable `challenge` day (`YYYY-MM-DD`, UTC) for
daily challenge runs. With Postgres, run `npm run db:push` once after deploying to add any
missing column; existing rows become Classic, normal runs. File storage (`data/scores.json`)
needs nothing. The server accepts challenge scores only for today or yesterday (UTC), so a run
started just before midnight still counts; challenge scores stay off the normal boards.

### Web preview (GitHub Pages)

`.github/workflows/pages.yml` builds the client as a static site and deploys it to
`https://<owner>.github.io/<repo>/` on every push to `main` (or run it by hand from the Actions tab).

- One-time setup: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
- Pages has no server, so the preview keeps high scores **in each player's browser** and leaves out
  the admin tools. The shared leaderboard needs the full Node app (`npm run build && npm start`).
- Try the same build locally: `VITE_BASE_URL=/CarrotRoll/ VITE_STATIC_SITE=true npx vite build`.

## Controls

| Input | Action |
|-------|--------|
| WASD / Arrow keys | Move |
| Spacebar | Fire |
| P / Esc | Pause |
| Touch: drag anywhere | Move (the bunny follows your finger; blasters fire automatically) |
| Touch: menu → Classic touchpad | Optional on-screen touchpad + fire buttons |

Collect 10 carrots to level up. Avoid the giant carrot, broccoli, spiky balls and each tier's new hazards. Every fifth level is a boss: no carrots, so drain its health (blasters fire down at it, reflected broccoli hurts it) or survive 30 seconds. Beat the Carrot King on level 25 to see the ending.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build client and server |
| `npm start` | Run production build |
| `npm run check` | Typecheck with `tsc` |
| `npm run sim` | Balance simulator: plays hundreds of seeded games with bots (`-- --runs 200 --world mobile --compare script/sim-baseline.json`) |
| `npx tsx script/boss-test.ts` | Boss dodge test: one boss fight, no power-ups, hits per attack pattern (`--level 5 --input keys` for desktop keyboard movement) |
| `npm run check:daily` | Checks that a daily challenge seed gives the same levels whatever the player does |
| `npm run generate-sounds` | Fill in any missing sounds with placeholders (never overwrites real ones) |
| `npm run optimize-assets` | Re-encode masters in `assets-src/` into web assets (needs `ffmpeg`) |
| `npm run db:push` | Push Drizzle schema |

## Project layout

- `client/src/game/` – the game itself: `engine.ts` (fixed-timestep, seeded simulation), `content.ts` (items, unlock levels, spawn weights), `tiers.ts` (themes, hazard rates, bosses), `render.ts` (canvas drawing), `art.ts` (sprites, cached at screen resolution), `input.ts` (drag controls)
- `script/sim.ts` – balance simulator; `script/sim-baseline*.json` (the original 20-level game) and `script/sim-results*.json` (current tuning)
- `client/src/components/GameCanvas.tsx` – React host: sizing, input wiring, HUD and overlays
- `client/src/contexts/SoundContext.tsx` – audio engine
- `assets-src/` – full-quality master audio/images (not deployed); see its README

## License

MIT

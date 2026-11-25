# Carrot Roll

A fast-paced arcade survival game. Fly as a rabbit, dodge a giant rolling carrot that shoots broccoli, collect carrots to level up, and grab power-ups for shields, speed, and extra lives.

Created by Nya.

## Features

- Canvas-based arcade gameplay with scrolling backgrounds and level progression
- Power-ups: shield, speed, extra lives, and more
- Full-screen mobile play in portrait or landscape: drag anywhere to fly, blasters auto-fire
- Installable as a home-screen web app (true full screen on iPhone)
- Sound effects and in-game music (one Web Audio mixer, so volume/mute work on iOS too)
- Local high score leaderboard
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

## Controls

| Input | Action |
|-------|--------|
| WASD / Arrow keys | Move |
| Spacebar | Fire |
| P / Esc | Pause |
| Touch: drag anywhere | Move (the bunny follows your finger; blasters fire automatically) |
| Touch: menu → Classic touchpad | Optional on-screen touchpad + fire buttons |

Collect 10 carrots to level up. Avoid the giant carrot, broccoli, and spiky balls.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build client and server |
| `npm start` | Run production build |
| `npm run check` | Typecheck with `tsc` |
| `npm run generate-sounds` | Fill in any missing sounds with placeholders (never overwrites real ones) |
| `npm run optimize-assets` | Re-encode masters in `assets-src/` into web assets (needs `ffmpeg`) |
| `npm run db:push` | Push Drizzle schema |

## Project layout

- `client/src/game/` – the game itself: `engine.ts` (fixed-timestep simulation), `render.ts` (canvas drawing), `art.ts` (sprites, cached at screen resolution), `input.ts` (drag controls)
- `client/src/components/GameCanvas.tsx` – React host: sizing, input wiring, HUD and overlays
- `client/src/contexts/SoundContext.tsx` – audio engine
- `assets-src/` – full-quality master audio/images (not deployed); see its README

## License

MIT

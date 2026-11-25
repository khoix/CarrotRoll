# Carrot Roll

A fast-paced arcade survival game. Fly as a rabbit, dodge a giant rolling carrot that shoots broccoli, collect carrots to level up, and grab power-ups for shields, speed, and extra lives.

Created by Nya.

## Features

- Canvas-based arcade gameplay with scrolling backgrounds and level progression
- Power-ups: shield, speed, extra lives, and more
- Touch controls for mobile play
- Sound effects and in-game music
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
| Touch controls | Move / fire on mobile |

Collect 10 carrots to level up. Avoid the giant carrot, broccoli, and spiky balls.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build client and server |
| `npm start` | Run production build |
| `npm run check` | Typecheck with `tsc` |
| `npm run generate-sounds` | Generate placeholder sound assets |
| `npm run db:push` | Push Drizzle schema |

## License

MIT

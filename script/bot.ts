/**
 * The simulator's bots, shared by script/sim.ts and script/boss-test.ts. They steer exactly like
 * a finger drag (engine.dragTarget), so they play by the same rules as a touch player.
 */
import { GameEngine, KEY_SPEED_MULT, type Threat } from "../client/src/game/engine";

export type BotConfig = {
  name: string;
  /** How often the bot re-decides (ms of game time). */
  reactMs: number;
  /** How far ahead it predicts threats (s). */
  lookahead: number;
  /** Extra clearance it wants around threats (px). */
  margin: number;
  /** Pull toward carrots and power-ups. */
  greed: number;
  /** Random error added to its judgement. */
  noise: number;
};

export const BOTS: BotConfig[] = [
  // Roughly a casual player: slow to react, short-sighted, often misjudges
  { name: "casual", reactMs: 300, lookahead: 0.3, margin: 18, greed: 3000, noise: 1.2 },
  // Roughly a strong player: quick and forward-looking, still imperfect
  { name: "expert", reactMs: 250, lookahead: 0.35, margin: 18, greed: 3000, noise: 1.0 },
];

export const WORLDS = {
  desktop: { w: 800, h: 600 },
  // iPhone portrait with the 1.25x mobile zoom (480 wide, height from the screen's aspect)
  mobile: { w: 480, h: 817 },
} as const;

const DIRS = Array.from({ length: 16 }, (_, i) => [Math.cos((i / 16) * Math.PI * 2), Math.sin((i / 16) * Math.PI * 2)] as const);
const RADII = [45, 100, 170];

/** Value of each collectible to the bot (0 = ignore, negative = avoid). */
function pickupValue(type: string, e: GameEngine): number {
  if (type === "carrot") return 1;
  if (type === "carrot_golden") return 3;
  if (type === "carrot_rotten") return -0.6;
  if (type === "powerup_heart") return e.lives < 3 ? 2 : 0.8;
  if (type.startsWith("powerup_")) return 0.9;
  return 0;
}

/** `speedMult`: how fast the bot can actually move, as a multiple of the bunny's speed (drag 2.5, keys 1). */
export function think(e: GameEngine, bot: BotConfig, rng: () => number, speedMult = 2.5) {
  const p = e.player;
  const pcx = p.x + p.width / 2;
  const pcy = p.y + p.height / 2;
  const speed = p.speed * speedMult;
  const threats: Threat[] = [];
  e.forEachThreat((t) => threats.push(t));
  const zones: { x0: number; x1: number; from: number; to: number }[] = [];
  e.forEachZone((z) => zones.push(z));
  const floor = e.carrotRestY - 10 - 20 - 18; // keep the bunny's bottom clear of the giant carrot's wobble
  const safeMode = p.speedBoostTimer > 0.4 || (p.invincible && p.invincibilityTimer > 0.4);

  let best = { x: pcx, y: pcy, score: Infinity };
  const consider = (cx: number, cy: number) => {
    cx = Math.max(22, Math.min(e.W - 22, cx));
    cy = Math.max(22, Math.min(floor, cy));
    const dist = Math.hypot(cx - pcx, cy - pcy);
    const travel = dist / speed;
    let danger = 0;
    if (!safeMode) {
      for (const t of threats) {
        for (let k = 0; k <= 6; k++) {
          const tau = (k / 6) * bot.lookahead;
          const f = travel > 0 ? Math.min(1, tau / travel) : 1;
          const bx = pcx + (cx - pcx) * f;
          const by = pcy + (cy - pcy) * f;
          const d = Math.hypot(t.x + t.vx * tau - bx, t.y + t.vy * tau - by) - t.r - 20;
          const gap = bot.margin - d;
          if (gap > 0) danger += gap * gap * (1 - 0.5 * (tau / bot.lookahead));
        }
      }
    }
    // Column warnings (icicles, lightning): don't be in the column when it goes live
    if (!safeMode) {
      for (const z of zones) {
        const arrive = e.time + travel * 1000;
        const live = z.from - arrive < bot.lookahead * 1000 + 300 && z.to > e.time;
        const inside = cx + 20 + bot.margin * 0.5 > z.x0 && cx - 20 - bot.margin * 0.5 < z.x1;
        if (live && inside) danger += 4000;
      }
    }
    // Stay off the walls a little
    const edge = Math.min(cx, e.W - cx, cy);
    if (edge < 50) danger += (50 - edge) * 4;
    // Pull toward the best nearby pickup (predicted where it will be)
    let pull = 0;
    for (const o of e.collectibles) {
      if (!o.active) continue;
      const v = pickupValue(o.type, e);
      if (v === 0) continue;
      const ox = o.x + o.width / 2 + o.vx * travel;
      const oy = o.y + o.height / 2 + o.vy * travel;
      if (oy > floor + 10) continue;
      const g = (bot.greed * v) / (Math.hypot(ox - cx, oy - cy) + 40);
      if (Math.abs(g) > Math.abs(pull)) pull = g;
    }
    const score = danger - pull + rng() * bot.noise * 60 + dist * 0.05;
    if (score < best.score) best = { x: cx, y: cy, score };
  };
  consider(pcx, pcy);
  for (const r of RADII) for (const [dx, dy] of DIRS) consider(pcx + dx * r, pcy + dy * r);
  e.dragTarget = { x: best.x, y: best.y };
}

/**
 * Desktop players can only use the keyboard (mouse drag is off): 8 directions at the bunny's
 * base speed with a little acceleration, instead of the drag's 2.5x speed. Call this every
 * frame after think() to turn the bot's drag target into key presses.
 */
export function steerWithKeys(e: GameEngine, target: { x: number; y: number } | null) {
  e.dragTarget = null;
  const k = e.keys;
  k.w = k.a = k.s = k.d = false;
  if (!target) return;
  const p = e.player;
  const dx = target.x - (p.x + p.width / 2);
  const dy = target.y - (p.y + p.height / 2);
  const dead = 8;
  k.a = dx < -dead;
  k.d = dx > dead;
  k.w = dy < -dead;
  k.s = dy > dead;
}

/**
 * A planner standing in for a very good desktop player: every `everyMs` it tries every pair of
 * keyboard moves (8 directions or none, 0.35 s each), extrapolates every threat in a straight
 * line, and picks the pair that stays clear longest (then with the most room). It sees threats
 * only as they were `reactMs` ago, like a human's reaction time.
 */
export function planKeys(e: GameEngine, reactMs: number, history: { t: number; threats: Threat[] }[]) {
  const now = e.time;
  const threats: Threat[] = [];
  e.forEachThreat((t) => threats.push(t));
  history.push({ t: now, threats });
  while (history.length > 1 && history[1].t <= now - reactMs) history.shift();
  const seen = history[0];
  const age = (now - seen.t) / 1000;
  const p = e.player;
  const opts = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]].map(([x, y]) => {
    const l = Math.hypot(x, y) || 1;
    return [x / l, y / l];
  });
  const floor = e.carrotRestY - 48;
  const dt = 1 / 30;
  const half = 20;
  let best = { score: -Infinity, dir: opts[0] };
  for (const a of opts) {
    for (const b of opts) {
      let x = p.x + p.width / 2;
      let y = p.y + p.height / 2;
      let vx = p.vx;
      let vy = p.vy;
      let clear = Infinity;
      let survive = 1.2;
      for (let t = dt; t <= 1.2; t += dt) {
        const d = t < 0.35 ? a : b;
        const k = 1 - Math.pow(0.35, dt * 60);
        vx += (d[0] * p.speed * KEY_SPEED_MULT - vx) * k;
        vy += (d[1] * p.speed * KEY_SPEED_MULT - vy) * k;
        x = Math.max(half, Math.min(e.W - half, x + vx * dt));
        y = Math.max(half, y + vy * dt);
        if (y > floor && t < survive) survive = t; // into the giant carrot
        for (const th of seen.threats) {
          const tx = th.x + th.vx * (t + age);
          const ty = th.y + th.vy * (t + age);
          const gap = Math.max(Math.abs(tx - x), Math.abs(ty - y)) - (th.r + half);
          if (gap < clear) clear = gap;
          if (gap < 0 && t < survive) survive = t;
        }
        if (survive < 1.2) break;
      }
      const edge = Math.min(x, e.W - x, y, floor - y);
      const score = survive * 1000 + Math.min(clear, 60) + Math.min(edge, 120) * 0.2;
      if (score > best.score) best = { score, dir: a };
    }
  }
  return { x: p.x + p.width / 2 + best.dir[0] * 100, y: p.y + p.height / 2 + best.dir[1] * 100 };
}

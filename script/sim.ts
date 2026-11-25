/**
 * Balance simulator: plays many seeded games headlessly with simple bots and reports how far
 * they get, how long levels take, and what kills them.
 *
 *   npm run sim                          # both bots, 100 runs each, desktop world
 *   npm run sim -- --runs 300 --world mobile
 *   npm run sim -- --save script/sim-baseline.json     # record a baseline
 *   npm run sim -- --compare script/sim-baseline.json  # compare against it
 *
 * The bots steer exactly like a finger drag (engine.dragTarget) with blasters on auto-fire,
 * so they play by the same rules as a touch player. They are a yardstick, not a human: compare
 * runs of the same bots before and after a change rather than reading absolute numbers.
 */
import fs from "fs";
import { GameEngine, type Threat } from "../client/src/game/engine";
import { FINAL_LEVEL, LEVELS_PER_TIER } from "../client/src/game/content";
import { mulberry32 } from "../client/src/game/rng";

type BotConfig = {
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

const BOTS: BotConfig[] = [
  // Roughly a casual player: slow to react, short-sighted, often misjudges
  { name: "casual", reactMs: 300, lookahead: 0.3, margin: 18, greed: 3000, noise: 1.2 },
  // Roughly a strong player: quick and forward-looking, still imperfect
  { name: "expert", reactMs: 250, lookahead: 0.35, margin: 18, greed: 3000, noise: 1.0 },
];

const WORLDS = {
  desktop: { w: 800, h: 600 },
  // iPhone portrait with the 1.25x mobile zoom (480 wide, height from the screen's aspect)
  mobile: { w: 480, h: 817 },
} as const;

const FRAME_MS = 1000 / 60;
const MAX_GAME_S = 60 * 60;
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

function think(e: GameEngine, bot: BotConfig, rng: () => number) {
  const p = e.player;
  const pcx = p.x + p.width / 2;
  const pcy = p.y + p.height / 2;
  const speed = p.speed * 2.5;
  const threats: Threat[] = [];
  e.forEachThreat((t) => threats.push(t));
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

type RunResult = { seed: number; level: number; ending: boolean; seconds: number; deathCause: string | null; levelTimes: number[] };

function runOne(bot: BotConfig, seed: number, world: { w: number; h: number }): RunResult {
  const noop = () => {};
  const e = new GameEngine({ sfx: noop, ambient: noop, goldenBunny: noop, hud: noop, phase: noop });
  e.setWorldSize(world.w, world.h);
  e.autoFire = true;
  const botRng = mulberry32(seed ^ 0x9e3779b9);
  e.start(1, seed);
  const t0 = e.time;
  let nextThink = 0;
  while ((e.phase === "countdown" || e.phase === "playing") && (e.time - t0) / 1000 < MAX_GAME_S) {
    if (e.time >= nextThink) {
      think(e, bot, botRng);
      nextThink = e.time + bot.reactMs;
    }
    e.advance(FRAME_MS);
  }
  return {
    seed,
    level: e.level,
    ending: e.phase === "ending",
    seconds: Math.round((e.time - t0) / 100) / 10,
    deathCause: e.phase === "over" ? e.stats.deathCause : null,
    levelTimes: e.stats.levelTimes,
  };
}

const quantile = (xs: number[], q: number) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(q * s.length))];
};
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

type Summary = {
  bot: string;
  runs: number;
  finalLevel: number;
  endingRate: number;
  levelMedian: number;
  levelP25: number;
  levelP75: number;
  /** Share of runs reaching the last level of each tier block (5, 10, 15, ...). */
  reachRate: Record<string, number>;
  /** Mean seconds per completed level, by tier block. */
  secondsPerLevel: Record<string, number>;
  deaths: Record<string, number>;
  medianRunMinutes: number;
};

function summarize(bot: string, results: RunResult[]): Summary {
  const levels = results.map((r) => r.level);
  const reachRate: Record<string, number> = {};
  for (let L = LEVELS_PER_TIER; L <= FINAL_LEVEL; L += LEVELS_PER_TIER) {
    reachRate[`L${L}`] = Math.round((100 * results.filter((r) => r.level >= L || r.ending).length) / results.length);
  }
  const secondsPerLevel: Record<string, number> = {};
  for (let start = 1; start <= FINAL_LEVEL; start += LEVELS_PER_TIER) {
    const end = Math.min(FINAL_LEVEL, start + LEVELS_PER_TIER - 1);
    const times = results.flatMap((r) => r.levelTimes.slice(start - 1, end));
    secondsPerLevel[`L${start}-${end}`] = Math.round(mean(times));
  }
  const deaths: Record<string, number> = {};
  for (const r of results) if (r.deathCause) deaths[r.deathCause] = (deaths[r.deathCause] ?? 0) + 1;
  for (const k of Object.keys(deaths)) deaths[k] = Math.round((100 * deaths[k]) / results.length);
  return {
    bot,
    runs: results.length,
    finalLevel: FINAL_LEVEL,
    endingRate: Math.round((1000 * results.filter((r) => r.ending).length) / results.length) / 10,
    levelMedian: quantile(levels, 0.5),
    levelP25: quantile(levels, 0.25),
    levelP75: quantile(levels, 0.75),
    reachRate,
    secondsPerLevel,
    deaths,
    medianRunMinutes: Math.round(quantile(results.map((r) => r.seconds), 0.5) / 6) / 10,
  };
}

function arg(name: string, fallback?: string) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

function main() {
  const runs = Number(arg("runs", "100"));
  const worldName = (arg("world", "desktop") as keyof typeof WORLDS) ?? "desktop";
  const world = WORLDS[worldName];
  const onlyBot = arg("bot");
  const seed0 = Number(arg("seed", "1000"));
  const summaries: Summary[] = [];
  for (const bot of BOTS.filter((b) => !onlyBot || b.name === onlyBot)) {
    const started = Date.now();
    const results: RunResult[] = [];
    for (let i = 0; i < runs; i++) results.push(runOne(bot, seed0 + i, world));
    const s = summarize(bot.name, results);
    summaries.push(s);
    console.log(`\n${bot.name} bot · ${runs} runs · ${worldName} ${world.w}x${world.h} · ${((Date.now() - started) / 1000).toFixed(1)} s`);
    console.log(`  ending reached: ${s.endingRate}% (final level ${s.finalLevel})`);
    console.log(`  level reached: median ${s.levelMedian}, middle half ${s.levelP25}-${s.levelP75}; median run ${s.medianRunMinutes} min`);
    console.log(`  reached: ${Object.entries(s.reachRate).map(([k, v]) => `${k} ${v}%`).join(" · ")}`);
    console.log(`  seconds per level: ${Object.entries(s.secondsPerLevel).map(([k, v]) => `${k} ${v}s`).join(" · ")}`);
    console.log(`  deaths: ${Object.entries(s.deaths).map(([k, v]) => `${k} ${v}%`).join(" · ") || "none"}`);
  }
  const out = { world: worldName, runs, seed0, date: new Date().toISOString().slice(0, 10), summaries };
  const save = arg("save");
  if (save) {
    fs.writeFileSync(save, JSON.stringify(out, null, 2) + "\n");
    console.log(`\nsaved ${save}`);
  }
  const compare = arg("compare");
  if (compare) {
    const base = JSON.parse(fs.readFileSync(compare, "utf8")) as typeof out;
    console.log(`\ncompared with ${compare} (${base.date}, final level ${base.summaries[0]?.finalLevel}):`);
    for (const s of summaries) {
      const b = base.summaries.find((x) => x.bot === s.bot);
      if (!b) continue;
      console.log(`  ${s.bot}: ending ${b.endingRate}% -> ${s.endingRate}% · median level ${b.levelMedian} -> ${s.levelMedian} · median run ${b.medianRunMinutes} -> ${s.medianRunMinutes} min`);
    }
  }
}

main();

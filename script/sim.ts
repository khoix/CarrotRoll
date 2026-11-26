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
import { GameEngine } from "../client/src/game/engine";
import { FINAL_LEVEL, LEVELS_PER_TIER } from "../client/src/game/content";
import { mulberry32 } from "../client/src/game/rng";
import { BOTS, WORLDS, think, type BotConfig } from "./bot";

const FRAME_MS = 1000 / 60;
const MAX_GAME_S = 60 * 60;

type BossResult = { level: number; outcome: "defeated" | "survived" | "died"; seconds: number };
type RunResult = { seed: number; level: number; ending: boolean; seconds: number; deathCause: string | null; levelTimes: number[]; bosses: BossResult[] };

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
    bosses: e.stats.bosses,
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
  /** Per boss level: share of fights won by draining it / survived / lost, and mean fight length. */
  bosses?: Record<string, { fights: number; defeated: number; survived: number; died: number; meanSeconds: number }>;
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
    bosses: (() => {
      const out: NonNullable<Summary["bosses"]> = {};
      for (const r of results) {
        for (const b of r.bosses) {
          const k = `L${b.level}`;
          const o = (out[k] ??= { fights: 0, defeated: 0, survived: 0, died: 0, meanSeconds: 0 });
          o.fights++;
          o[b.outcome]++;
          o.meanSeconds += b.seconds;
        }
      }
      for (const o of Object.values(out)) {
        o.meanSeconds = Math.round(o.meanSeconds / o.fights);
        o.defeated = Math.round((100 * o.defeated) / o.fights);
        o.survived = Math.round((100 * o.survived) / o.fights);
        o.died = Math.round((100 * o.died) / o.fights);
      }
      return out;
    })(),
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
    if (s.bosses && Object.keys(s.bosses).length)
      console.log(`  bosses: ${Object.entries(s.bosses).map(([k, b]) => `${k} ${b.fights} fights: won ${b.defeated}% / survived ${b.survived}% / lost ${b.died}% (${b.meanSeconds}s)`).join(" · ")}`);
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

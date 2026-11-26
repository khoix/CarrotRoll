/**
 * Boss dodge test: plays one boss fight many times with no power-ups (so the boss can only be
 * survived, never shot down) and counts how often the bots get hit, by attack pattern.
 *
 *   npx tsx script/boss-test.ts                        # Broccoli Barrage (level 5), desktop
 *   npx tsx script/boss-test.ts --level 10 --world mobile --runs 300
 *   npx tsx script/boss-test.ts --input keys           # move like a desktop player (keyboard)
 *
 * Each pattern is also run on its own, with and without the falling spiky balls, so a pattern
 * that can't be dodged shows up even when the full fight mixes it with others. Lives are set
 * high so every fight lasts the full 30 s; the usual stun and invulnerability after a hit apply.
 */
import { GameEngine, KEY_SPEED_MULT } from "../client/src/game/engine";
import { bossForLevel, isBossLevel, BOSS_SURVIVE_S, type BossPattern } from "../client/src/game/tiers";
import { mulberry32 } from "../client/src/game/rng";
import { BOTS, WORLDS, planKeys, steerWithKeys, think, type BotConfig } from "./bot";

const FRAME_MS = 1000 / 60;

function arg(name: string, fallback: string) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

// A much sharper player than the sim's two: fast, far-sighted, no judgement errors. If even this
// one keeps getting hit, the pattern leaves no real path.
const SHARP: BotConfig = { name: "sharp", reactMs: 60, lookahead: 0.6, margin: 24, greed: 0, noise: 0 };
// Planner (keyboard only): searches two-step key sequences against every threat's path, seeing
// the screen 0.2 s late. Stands in for a very good desktop player.
const PLANNER: BotConfig = { name: "planner", reactMs: 50, lookahead: 0, margin: 0, greed: 0, noise: 0 };

type Fight = { hits: number; firstHitS: number | null; causes: Record<string, number> };

type Input = "drag" | "keys";

function fight(bot: BotConfig, seed: number, world: { w: number; h: number }, level: number, patterns: BossPattern[] | null, balls: boolean, input: Input): Fight {
  const noop = () => {};
  const e = new GameEngine({ sfx: noop, ambient: noop, goldenBunny: noop, hud: noop, phase: noop });
  e.setWorldSize(world.w, world.h);
  e.autoFire = true;
  e.controls = input === "keys" ? "keys" : "touch";
  e.start(level, seed);
  const botRng = mulberry32(seed ^ 0x9e3779b9);
  let nextThink = 0;
  let target: { x: number; y: number } | null = null;
  const history: Parameters<typeof planKeys>[2] = [];
  let started = -1;
  let lives = 0;
  const out: Fight = { hits: 0, firstHitS: null, causes: {} };
  for (let guard = 0; guard < 60 * (BOSS_SURVIVE_S + 15); guard++) {
    if (e.phase !== "countdown" && e.phase !== "playing") break;
    if (e.boss && started < 0) {
      started = e.time;
      if (patterns) e.boss.def = { ...e.boss.def, patterns };
      e.lives = lives = 1000;
    }
    if (started >= 0 && (!e.boss || e.boss.done || e.level !== level)) break;
    e.collectibles.length = 0; // no items
    if (!balls) e.obstacles.length = 0;
    if (e.time >= nextThink) {
      if (bot === PLANNER) target = planKeys(e, 200, history);
      else {
        think(e, bot, botRng, input === "keys" ? KEY_SPEED_MULT : 2.5);
        target = e.dragTarget;
      }
      nextThink = e.time + bot.reactMs;
    }
    if (input === "keys") steerWithKeys(e, target);
    e.advance(FRAME_MS);
    if (started >= 0 && e.lives < lives) {
      const n = lives - e.lives;
      lives = e.lives;
      out.hits += n;
      const cause = e.stats.deathCause ?? "?";
      out.causes[cause] = (out.causes[cause] ?? 0) + n;
      out.firstHitS ??= Math.round((e.time - started) / 100) / 10;
    }
  }
  return out;
}

function main() {
  const level = Number(arg("level", "5"));
  const runs = Number(arg("runs", "200"));
  const worldName = arg("world", "desktop") as keyof typeof WORLDS;
  const input = arg("input", "drag") as Input;
  const onlyBot = arg("bot", "");
  const world = WORLDS[worldName];
  if (!isBossLevel(level)) throw new Error(`level ${level} has no boss`);
  const def = bossForLevel(level);
  console.log(`${def.name} (level ${level}) · ${worldName} ${world.w}x${world.h} · ${runs} fights each · ${input === "keys" ? "keyboard" : "drag"} controls · no power-ups · ${BOSS_SURVIVE_S} s per fight`);
  const setups: { label: string; patterns: BossPattern[] | null; balls: boolean }[] = [
    ...def.patterns.map((p) => ({ label: `${p} only`, patterns: [p], balls: false })),
    { label: "all patterns, no balls", patterns: null, balls: false },
    { label: "full fight (with balls)", patterns: null, balls: true },
  ];
  for (const bot of [...BOTS, SHARP, ...(input === "keys" ? [PLANNER] : [])]) {
    if (onlyBot && bot.name !== onlyBot) continue;
    console.log(`\n${bot.name} bot`);
    for (const s of setups) {
      const fights = Array.from({ length: runs }, (_, i) => fight(bot, 5000 + i, world, level, s.patterns, s.balls, input));
      const clean = fights.filter((f) => f.hits === 0).length;
      const dead3 = fights.filter((f) => f.hits >= 3).length;
      const mean = fights.reduce((a, f) => a + f.hits, 0) / runs;
      const firsts = fights.map((f) => f.firstHitS).filter((x): x is number => x !== null).sort((a, b) => a - b);
      const median = firsts.length ? firsts[Math.floor(firsts.length / 2)] : null;
      const causes: Record<string, number> = {};
      for (const f of fights) for (const [k, v] of Object.entries(f.causes)) causes[k] = (causes[k] ?? 0) + v;
      console.log(
        `  ${s.label.padEnd(24)} no hits ${String(Math.round((100 * clean) / runs)).padStart(3)}% · ` +
          `hits/fight ${mean.toFixed(2).padStart(5)} · 3+ hits ${String(Math.round((100 * dead3) / runs)).padStart(3)}% · ` +
          `first hit ${median === null ? "never" : `median ${median}s`}` +
          (Object.keys(causes).length ? ` · by ${Object.entries(causes).map(([k, v]) => `${k} ${v}`).join(", ")}` : "")
      );
    }
  }
}

main();

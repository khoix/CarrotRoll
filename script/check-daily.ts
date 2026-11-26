/**
 * Daily challenge check: the same seed must give the same level content whatever the player
 * does. Plays each level twice with very different players and compares what spawned.
 *
 *   npx tsx script/check-daily.ts
 */
import { GameEngine } from "../client/src/game/engine";
import { mulberry32 } from "../client/src/game/rng";
import { dailySeed, utcDay } from "../shared/daily";

const FRAME_MS = 1000 / 60;
const WINDOW_S = 12;

function spawnLog(seed: number, level: number, style: "still" | "wander"): string[] {
  const noop = () => {};
  const e = new GameEngine({ sfx: noop, ambient: noop, goldenBunny: noop, hud: noop, phase: noop });
  e.setWorldSize(800, 600);
  e.damageDisabled = true;
  e.autoFire = style === "wander";
  e.start(level, seed);
  const seen = new WeakSet<object>();
  const log: string[] = [];
  const rng = mulberry32(42);
  let t0 = -1;
  for (let i = 0; i < 60 * (WINDOW_S + 4); i++) {
    if (style === "wander" && i % 20 === 0) e.dragTarget = { x: rng() * e.W, y: rng() * e.H * 0.7 };
    e.advance(FRAME_MS);
    if (e.phase !== "playing") continue;
    if (t0 < 0) t0 = e.time;
    const at = ((e.time - t0) / 1000).toFixed(2);
    if ((e.time - t0) / 1000 > WINDOW_S || e.level !== level) break;
    for (const o of e.obstacles) {
      if (seen.has(o)) continue;
      seen.add(o);
      // (broccoli aims at the player, and burrs/sprouts split when the player pops them)
      if (o.type !== "broccoli" && !o.type.endsWith("_small")) log.push(`${at} ${o.type} x=${o.x.toFixed(1)}`);
    }
    for (const s of e.strikes) {
      if (seen.has(s)) continue;
      seen.add(s);
      log.push(`${at} strike ${s.kind} x=${s.x.toFixed(1)}`);
    }
  }
  return log;
}

const seed = dailySeed(utcDay());
let failed = 0;
for (const level of [1, 3, 7, 12, 14, 18, 22]) {
  const a = spawnLog(seed, level, "still");
  const b = spawnLog(seed, level, "wander");
  const same = a.length === b.length && a.every((l, i) => l === b[i]);
  if (!same) failed++;
  console.log(`level ${String(level).padStart(2)}: ${a.length} hazards (still) vs ${b.length} (wander) ${same ? "same" : "DIFFERENT"}`);
  if (!same) {
    const i = a.findIndex((l, k) => l !== b[k]);
    console.log(`   first difference: "${a[i]}" vs "${b[i]}"`);
  }
}
const other = spawnLog(dailySeed("2000-01-01"), 7, "still");
const today = spawnLog(seed, 7, "still");
console.log(`a different day differs: ${other.join() !== today.join() ? "yes" : "NO"}`);
process.exit(failed ? 1 : 0);

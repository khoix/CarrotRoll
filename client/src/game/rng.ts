/**
 * Seeded random numbers for the simulation. Every random choice the engine makes goes through
 * one of these, so a game started with the same seed and inputs plays out identically: the
 * balance simulator relies on that, and it makes a reported bug replayable.
 */
export type Rng = () => number;

/** mulberry32: small, fast, good enough for gameplay (not for anything security-related). */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A fresh seed for a normal (non-replayed) game. */
export function randomSeed(): number {
  return (Math.random() * 2 ** 32) >>> 0;
}

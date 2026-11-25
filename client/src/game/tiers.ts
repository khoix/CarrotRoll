/**
 * The five tiers: theme (look) and difficulty (rates). Levels 1–5 are tier 1, 6–10 tier 2, …
 * Each tier interpolates its numbers from its first level (`a`) to its last (`b`); a tier's two
 * new hazards also ramp in over its first three levels so they are learned before they swarm.
 */
export type TierKey = "meadow" | "autumn" | "frost" | "storm" | "night";
export type ParticleKind = "none" | "leaves" | "snow" | "rain" | "stars";

export interface TierTheme {
  key: TierKey;
  name: string;
  /** Background tile (graded copy of the base tile), relative to the public folder. */
  tile: string;
  /** Haze over the background: RGB, strength at the top and the bottom. */
  haze: { color: string; far: number; near: number };
  /** Water shimmer tint (rgba) and how strong the edge vignette is. */
  shimmer: string;
  vignette: number;
  particles: ParticleKind;
}

type Range = { a: number; b: number };

export interface TierRates {
  /** Spiky-ball chance per 60 Hz frame (scaled by world width). */
  ball: Range;
  /** Broccoli speed (px/s, before vertical scale) and seconds between shots. */
  shotSpeed: Range;
  shotInterval: Range;
  /** Share of falling balls that are chestnut burrs (tier 2+). */
  burrShare?: Range;
  /** Chance a carrot shot is a Brussels sprout / a cauliflower cannonball. */
  sproutChance?: Range;
  cauliChance?: Range;
  /** Per-second rates of column hazards and seekers. */
  icicleRate?: Range;
  lightningRate?: Range;
  meteorRate?: Range;
  beetRate?: Range;
  /** Seconds between snow gusts (lower = more often). */
  gustEvery?: Range;
}

export interface TierDef {
  n: number;
  theme: TierTheme;
  /** The two hazards this tier introduces (for banners and the plan's map). */
  newHazards: string[];
  rates: TierRates;
}

const r = (a: number, b: number): Range => ({ a, b });

export const TIERS: TierDef[] = [
  {
    n: 1,
    theme: { key: "meadow", name: "Sunny Meadow", tile: "images/baseTile.webp", haze: { color: "255,255,255", far: 0.28, near: 0.06 }, shimmer: "rgba(240,248,255,0.7)", vignette: 0.28, particles: "none" },
    newHazards: [],
    rates: { ball: r(0.015, 0.035), shotSpeed: r(320, 400), shotInterval: r(1.9, 1.5) },
  },
  {
    n: 2,
    theme: { key: "autumn", name: "Autumn Orchard", tile: "images/tiers/autumn.webp", haze: { color: "255,226,190", far: 0.3, near: 0.08 }, shimmer: "rgba(255,240,220,0.6)", vignette: 0.32, particles: "leaves" },
    newHazards: ["Chestnut burrs", "Brussels sprouts"],
    rates: { ball: r(0.04, 0.058), shotSpeed: r(420, 500), shotInterval: r(1.4, 1.0), burrShare: r(0.25, 0.5), sproutChance: r(0.2, 0.4) },
  },
  {
    n: 3,
    theme: { key: "frost", name: "Frost Valley", tile: "images/tiers/frost.webp", haze: { color: "235,245,255", far: 0.34, near: 0.1 }, shimmer: "rgba(255,255,255,0.75)", vignette: 0.3, particles: "snow" },
    newHazards: ["Icicles", "Snow gusts"],
    rates: { ball: r(0.06, 0.078), shotSpeed: r(520, 600), shotInterval: r(0.9, 0.62), burrShare: r(0.4, 0.4), sproutChance: r(0.3, 0.3), icicleRate: r(0.15, 0.35), gustEvery: r(12, 7) },
  },
  {
    n: 4,
    theme: { key: "storm", name: "Stormy Skies", tile: "images/tiers/storm.webp", haze: { color: "40,48,68", far: 0.3, near: 0.12 }, shimmer: "rgba(200,215,235,0.45)", vignette: 0.45, particles: "rain" },
    newHazards: ["Lightning strikes", "Cauliflower cannonballs"],
    rates: { ball: r(0.08, 0.098), shotSpeed: r(620, 680), shotInterval: r(0.55, 0.5), burrShare: r(0.4, 0.4), sproutChance: r(0.25, 0.25), icicleRate: r(0.15, 0.2), lightningRate: r(0.12, 0.28), cauliChance: r(0.15, 0.3) },
  },
  {
    n: 5,
    theme: { key: "night", name: "Starlight Night", tile: "images/tiers/night.webp", haze: { color: "16,22,52", far: 0.34, near: 0.16 }, shimmer: "rgba(180,200,255,0.4)", vignette: 0.55, particles: "stars" },
    newHazards: ["Meteor radishes", "Homing beets"],
    rates: { ball: r(0.095, 0.11), shotSpeed: r(680, 720), shotInterval: r(0.5, 0.45), burrShare: r(0.4, 0.4), sproutChance: r(0.25, 0.25), icicleRate: r(0.12, 0.15), lightningRate: r(0.12, 0.18), cauliChance: r(0.2, 0.25), meteorRate: r(0.12, 0.3), beetRate: r(0.05, 0.13) },
  },
];

export const LEVELS_PER_TIER = 5;

export function tierIndexForLevel(level: number): number {
  return Math.max(0, Math.min(TIERS.length - 1, Math.floor((level - 1) / LEVELS_PER_TIER)));
}

export function tierForLevel(level: number): TierDef {
  return TIERS[tierIndexForLevel(level)];
}

/** Position inside the tier: 0 on its first level, 1 on its last. */
export function tierProgress(level: number): number {
  return (((level - 1) % LEVELS_PER_TIER) / (LEVELS_PER_TIER - 1)) || 0;
}

export function lerpRange(v: Range | undefined, k: number): number {
  return v ? v.a + (v.b - v.a) * k : 0;
}

/**
 * A rate for a hazard: interpolated across the tier, and ramped in over the first three levels
 * of the tier that introduces it (it starts at 35% and reaches full rate on the third level).
 */
export function hazardRate(level: number, pick: (r: TierRates) => Range | undefined): number {
  const ti = tierIndexForLevel(level);
  const tier = TIERS[ti];
  const k = tierProgress(level);
  const value = lerpRange(pick(tier.rates), k);
  const introducedHere = ti > 0 && !pick(TIERS[ti - 1].rates);
  if (!introducedHere) return value;
  const step = (level - 1) % LEVELS_PER_TIER; // 0, 1, 2…
  return value * Math.min(1, 0.35 + step * 0.325);
}

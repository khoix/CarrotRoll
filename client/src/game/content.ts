/**
 * Game content tables: what exists, when it unlocks, how often it spawns, and how hard each
 * level is. The engine reads only these, so pacing and balance are tuned here, not in game code.
 */
import type { Rng } from "./rng";
import { TIERS, LEVELS_PER_TIER, lerpRange, tierForLevel, tierProgress } from "./tiers";

export { LEVELS_PER_TIER, TIERS };

/** Completing this level's carrots (or its boss) triggers the ending. */
export const FINAL_LEVEL = 20;

export type CollectibleType =
  | "carrot"
  | "carrot_golden"
  | "carrot_rotten"
  | "powerup_invincible"
  | "powerup_speed"
  | "powerup_heart"
  | "powerup_blaster"
  | "powerup_attract"
  | "powerup_decoy"
  | "powerup_reflector"
  | "powerup_bomb"
  | "powerup_slowmo"
  | "powerup_rain"
  | "powerup_shrink"
  | "powerup_double";

export interface ItemDef {
  /** Stable id (saved in "seen" lists on the device). */
  id: string;
  entity: CollectibleType;
  name: string;
  /** One line for the first-appearance banner and the home page panel. */
  blurb: string;
  unlockLevel: number;
  /** Relative spawn weight among collectibles once unlocked. */
  weight: number;
}

/** Power-ups, in unlock order (at most one new thing per level; see the plan's journey map). */
export const ITEMS: ItemDef[] = [
  { id: "heart", entity: "powerup_heart", name: "Heart", blurb: "+1 life. Reach 10 to become the Golden Bunny.", unlockLevel: 1, weight: 5 },
  { id: "shield", entity: "powerup_invincible", name: "Carro-Shield", blurb: "Bounces hazards away for 5 seconds.", unlockLevel: 1, weight: 9 },
  { id: "rapid", entity: "powerup_speed", name: "Rapid Rabbit", blurb: "Faster and untouchable for 5 seconds.", unlockLevel: 1, weight: 11 },
  { id: "blasters", entity: "powerup_blaster", name: "Bunny Blasters", blurb: "Lasers that pop spiky balls for 10 seconds.", unlockLevel: 3, weight: 8 },
  { id: "attract", entity: "powerup_attract", name: "Attract-o-Hare", blurb: "Pulls nearby carrots to you for 6 seconds.", unlockLevel: 6, weight: 10 },
  { id: "decoy", entity: "powerup_decoy", name: "Decoy Doe", blurb: "A cardboard bunny the giant carrot shoots at instead of you (6 s).", unlockLevel: 8, weight: 6 },
  { id: "reflector", entity: "powerup_reflector", name: "Broccoli Reflector", blurb: "Broccoli bounces back at the carrot for 8 seconds.", unlockLevel: 9, weight: 5 },
  { id: "bomb", entity: "powerup_bomb", name: "Bunny Bomb", blurb: "Clears every hazard on screen. Rare!", unlockLevel: 11, weight: 3 },
  { id: "slowmo", entity: "powerup_slowmo", name: "Slow-Mo Clover", blurb: "Everything but you moves at half speed for 5 seconds.", unlockLevel: 13, weight: 5 },
  { id: "rain", entity: "powerup_rain", name: "Carrot Rain", blurb: "3 seconds of only carrots, no new hazards.", unlockLevel: 14, weight: 4 },
  { id: "shrink", entity: "powerup_shrink", name: "Shrinking Violet", blurb: "Half-size bunny for 8 seconds. Easier to dodge, harder to grab.", unlockLevel: 16, weight: 5 },
  { id: "double", entity: "powerup_double", name: "Double Trouble", blurb: "A ghost bunny mirrors you and collects carrots for 8 seconds.", unlockLevel: 17, weight: 5 },
];

/** Plain carrots' share of the collectible weight; carrots always keep at least 55% of spawns. */
export const CARROT_WEIGHT = 53;
const MIN_CARROT_SHARE = 0.55;

/** Carrot variants: a spawned carrot becomes one of these with the given chance once unlocked. */
export interface SpecialCarrotDef {
  id: string;
  entity: "carrot_golden" | "carrot_rotten";
  name: string;
  blurb: string;
  unlockLevel: number;
  chance: number;
}
export const SPECIAL_CARROTS: SpecialCarrotDef[] = [
  { id: "golden", entity: "carrot_golden", name: "Golden Carrot", blurb: "Worth 5 carrots, but it runs away from you!", unlockLevel: 7, chance: 1 / 50 },
  { id: "rotten", entity: "carrot_rotten", name: "Rotten Carrot", blurb: "Costs a carrot if you grab it. Watch for the flies.", unlockLevel: 12, chance: 1 / 12 },
];

/** Rule changes with no pickup of their own; introduced by a banner when their level starts. */
export interface MechanicDef {
  id: string;
  name: string;
  blurb: string;
  unlockLevel: number;
}
export const MECHANICS: MechanicDef[] = [
  { id: "near_miss", name: "Near Miss", blurb: "Skim past a hazard without touching it for +5.", unlockLevel: 2 },
  { id: "combo", name: "Carrot Combo", blurb: "Grab carrots quickly to multiply points, up to x5.", unlockLevel: 4 },
];

export function mechanicUnlocked(id: string, level: number): boolean {
  const m = MECHANICS.find((x) => x.id === id);
  return !!m && level >= m.unlockLevel;
}

/** Anything with a first-appearance banner, looked up by its entity type. */
export function introForEntity(entity: string): { id: string; name: string; blurb: string } | undefined {
  return ITEMS.find((i) => i.entity === entity) ?? SPECIAL_CARROTS.find((c) => c.entity === entity);
}

/** Carrot pickups that count toward the level (golden counts 5). */
export function isGoodCarrot(type: string): boolean {
  return type === "carrot" || type === "carrot_golden";
}

export function unlockedItems(level: number): ItemDef[] {
  return ITEMS.filter((i) => i.unlockLevel <= level);
}

/** Pickups that unlock exactly on this level (they get a guaranteed early spawn). */
export function itemsUnlockingAt(level: number): CollectibleType[] {
  if (level <= 1) return [];
  return [...ITEMS, ...SPECIAL_CARROTS].filter((i) => i.unlockLevel === level).map((i) => i.entity);
}

/** Weighted pick of the next collectible for this level. */
export function pickCollectible(level: number, rng: Rng): CollectibleType {
  const items = unlockedItems(level);
  const itemWeight = items.reduce((s, i) => s + i.weight, 0);
  const carrotWeight = Math.max(CARROT_WEIGHT, (itemWeight * MIN_CARROT_SHARE) / (1 - MIN_CARROT_SHARE));
  const total = carrotWeight + itemWeight;
  let r = rng() * total;
  if (r < carrotWeight) {
    for (const c of SPECIAL_CARROTS) if (level >= c.unlockLevel && rng() < c.chance) return c.entity;
    return "carrot";
  }
  r -= carrotWeight;
  for (const i of items) {
    if (r < i.weight) return i.entity;
    r -= i.weight;
  }
  return "carrot";
}

export interface Difficulty {
  /** Chance per 60 Hz frame that a spiky ball spawns (scaled by world width). */
  ballChance: number;
  /** Broccoli speed in px/s (before the world's vertical scale). */
  shotSpeed: number;
  /** Seconds between the giant carrot's shots. */
  shotInterval: number;
  /** Most collectibles on screen at once. */
  collectibleCap: number;
}

/** Difficulty for a level, from its tier's table (see tiers.ts). */
export function difficulty(level: number): Difficulty {
  const rates = tierForLevel(level).rates;
  const k = tierProgress(level);
  return {
    ballChance: lerpRange(rates.ball, k),
    shotSpeed: lerpRange(rates.shotSpeed, k),
    shotInterval: lerpRange(rates.shotInterval, k),
    collectibleCap: Math.min(14, 3 + level),
  };
}

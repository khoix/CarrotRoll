/**
 * Game content tables: what exists, when it unlocks, how often it spawns, and how hard each
 * level is. The engine reads only these, so pacing and balance are tuned here, not in game code.
 */
import type { Rng } from "./rng";

/** Completing this level's carrots (or its boss) triggers the ending. */
export const FINAL_LEVEL = 20;
export const LEVELS_PER_TIER = 5;

export type CollectibleType =
  | "carrot"
  | "powerup_invincible"
  | "powerup_speed"
  | "powerup_heart"
  | "powerup_blaster"
  | "powerup_attract";

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

/** Power-ups and special pickups, in unlock order. */
export const ITEMS: ItemDef[] = [
  { id: "heart", entity: "powerup_heart", name: "Heart", blurb: "+1 life. Reach 10 to become the Golden Bunny.", unlockLevel: 1, weight: 5 },
  { id: "shield", entity: "powerup_invincible", name: "Carro-Shield", blurb: "Bounces hazards away for 5 seconds.", unlockLevel: 1, weight: 9 },
  { id: "rapid", entity: "powerup_speed", name: "Rapid Rabbit", blurb: "Faster and untouchable for 5 seconds.", unlockLevel: 1, weight: 13 },
  { id: "blasters", entity: "powerup_blaster", name: "Bunny Blasters", blurb: "Lasers that pop spiky balls for 10 seconds.", unlockLevel: 1, weight: 8 },
  { id: "attract", entity: "powerup_attract", name: "Attract-o-Hare", blurb: "Pulls nearby carrots to you for 6 seconds.", unlockLevel: 1, weight: 12 },
];

/** Plain carrots' share of the collectible weight. */
export const CARROT_WEIGHT = 53;

export function itemForEntity(entity: string): ItemDef | undefined {
  return ITEMS.find((i) => i.entity === entity);
}

export function unlockedItems(level: number): ItemDef[] {
  return ITEMS.filter((i) => i.unlockLevel <= level);
}

/** Items that unlock exactly on this level (they get a guaranteed early spawn). */
export function itemsUnlockingAt(level: number): ItemDef[] {
  return ITEMS.filter((i) => i.unlockLevel === level && level > 1);
}

/** Weighted pick of the next collectible for this level. */
export function pickCollectible(level: number, rng: Rng): CollectibleType {
  const items = unlockedItems(level);
  const total = CARROT_WEIGHT + items.reduce((s, i) => s + i.weight, 0);
  let r = rng() * total;
  if (r < CARROT_WEIGHT) return "carrot";
  r -= CARROT_WEIGHT;
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

/** Difficulty for a level. (Phase 1 keeps the original formulas; tiers replace them later.) */
export function difficulty(level: number): Difficulty {
  return {
    ballChance: 0.01 + level * 0.005,
    shotSpeed: 300 + level * 20,
    shotInterval: Math.max(0.5, 2.0 - level * 0.1),
    collectibleCap: 3 + level,
  };
}

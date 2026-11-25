/**
 * Carrot Roll simulation, independent of React and of the display refresh rate.
 *
 * - Fixed 120 Hz timestep with an accumulator (frame dt clamped), so a 120 Hz phone plays exactly
 *   like a 60 Hz laptop. All speeds are px/s; per-frame spawn chances are converted to per-step.
 * - World size is variable: 800×600 on desktop/landscape, 600×(taller) in portrait. Vertical
 *   speeds scale with height (`vScale`) and spawn rates with width, so difficulty stays the same.
 * - React only receives coarse events (HUD changes, phase changes, sounds), never per-frame state.
 */
import type { SfxId } from "@/contexts/SoundContext";
import { mulberry32, randomSeed, type Rng } from "./rng";
import {
  FINAL_LEVEL,
  MECHANICS,
  difficulty,
  introForEntity,
  isGoodCarrot,
  itemsUnlockingAt,
  mechanicUnlocked,
  pickCollectible,
  type CollectibleType,
} from "./content";
import { TIERS, BOSS_SURVIVE_S, bossForLevel, hazardRate, isBossLevel, tierIndexForLevel, tierForLevel, tierProgress, lerpRange, type BossDef, type BossPattern } from "./tiers";

export const BASE_W = 800;
export const BASE_H = 600;
export const PLAYER_SIZE = 40;
/** 5 px/frame at 60 fps in the original game. */
export const BASE_SPEED = 300;
/** Drag control: max chase speed as a multiple of the current player speed (prevents teleporting through hazards). */
const DRAG_SPEED_MULT = 2.5;
const FALL_SPEED = 180; // SCROLL_SPEED 3 px/frame × 60
const ATTRACT_RADIUS = 400;
const ATTRACT_STRENGTH = 480;
const ATTRACT_MAX_CARROT_SPEED = 300;
export const ATTRACT_FADE_THRESHOLD = 1.5;
export const COUNTDOWN_MS = 3000;
const STEP = 1 / 120;
const MAX_FRAME_S = 0.05;
const BLASTER_COOLDOWN_MS = 200;
/** Spiky balls spawn this many seconds above the screen so a warning marker can show first. */
export const BALL_TELEGRAPH_S = 0.6;
const MAX_HEARTS = 10;

export type ObjType =
  | "spike"
  | "ball"
  | "burr"
  | "burr_small"
  | "sprout"
  | "sprout_small"
  | "cauliflower"
  | "icicle"
  | "meteor"
  | "beet"
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
  | "powerup_double"
  | "player_laser";

export type SpawnableType = Exclude<ObjType, "player_laser">;

export type Entity = {
  x: number;
  y: number;
  width: number;
  height: number;
  type: ObjType;
  vx: number;
  vy: number;
  active: boolean;
  face?: number;
  angle?: number;
  /** Near-miss tracking: 1 = passed close, 2 = bonus awarded. */
  near?: number;
  /** Hits left before it breaks (cauliflower). */
  hp?: number;
  /** Spawn time (ms, sim clock): sprouts burst and beets expire relative to it. */
  born?: number;
  /** Bounced back by the Broccoli Reflector: harmless to the bunny, flies at the giant carrot. */
  reflected?: boolean;
};

/** Shots the Broccoli Reflector can send back. */
const REFLECTABLE = new Set<ObjType>(["spike", "sprout", "sprout_small"]);

/** Things that hurt the bunny on contact. */
export const HARMFUL = new Set<ObjType>(["spike", "ball", "burr", "burr_small", "sprout", "sprout_small", "cauliflower", "icicle", "meteor", "beet"]);
/** Things the bunny's lasers can destroy. */
const BLASTABLE = new Set<ObjType>(["ball", "burr", "burr_small", "cauliflower", "beet"]);
/** Falling balls that bounce off each other. */
const BOUNCY = new Set<ObjType>(["ball", "burr", "burr_small"]);
/** Shots that spin as they fly. */
const SPINNING = new Set<ObjType>(["spike", "sprout", "sprout_small", "cauliflower"]);

/** A column hazard: a warning stripe, then an icicle drops or lightning strikes. Times in ms. */
export type Strike = { kind: "icicle" | "lightning"; x: number; w: number; warnUntil: number; endAt: number };
/** A snow gust: shown from warnAt, pushes from start to end (px/s in direction dir). */
export type Wind = { dir: -1 | 1; warnAt: number; start: number; end: number; strength: number };

export type Phase = "idle" | "countdown" | "playing" | "over" | "ending";

/** combo = current multiplier (1 = none); comboChain changes on every combo pickup (restarts the HUD timer). */
export type HudState = { score: number; level: number; carrots: number; lives: number; combo: number; comboChain: number; boss: boolean };

/** A boss fight in progress (times in ms, sim clock). */
export type BossState = {
  def: BossDef;
  hp: number;
  start: number;
  patIdx: number;
  patStart: number;
  nextFire: number;
  phase: number;
  /** Last time it took damage (for the hit flash). */
  hitAt: number;
  done: boolean;
};

const BOSS_PATTERN_MS = 2600;
const BOSS_REST_MS = 700;

export type Particle = { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; color: string; gravity: number };
export type Popup = { x: number; y: number; text: string; start: number; color: string; big?: boolean };

export type Announcement = { kind: "new" | "tier" | "boss"; title: string; body?: string };

export interface EngineEvents {
  sfx(id: SfxId): void;
  ambient(id: "rapid_rabbit_loop" | "attract_loop", on: boolean): void;
  goldenBunny(on: boolean): void;
  hud(h: HudState): void;
  phase(p: Phase): void;
  /** Short non-blocking banner (first appearance of an item, new tier, boss). */
  announce?(a: Announcement): void;
  /** An item was seen for the first time on this device (host persists it). */
  discovered?(id: string): void;
  /** The tier changed (0-based index into TIERS); the host switches the look. */
  tier?(index: number): void;
}

/** A harmful thing's centre, velocity and radius (used by near-miss scoring and the simulation bots). */
export type Threat = { x: number; y: number; vx: number; vy: number; r: number };

/** Run statistics for the balance simulator. */
export type RunStats = { levelStart: number; levelTimes: number[]; deathCause: string | null; pickups: Record<string, number> };

type Keys = { w: boolean; a: boolean; s: boolean; d: boolean; ArrowUp: boolean; ArrowLeft: boolean; ArrowDown: boolean; ArrowRight: boolean; space: boolean };

function newPlayer(w: number, h: number) {
  return {
    x: w / 2 - PLAYER_SIZE / 2,
    y: h / 2,
    width: PLAYER_SIZE,
    height: PLAYER_SIZE,
    vx: 0,
    vy: 0,
    speed: BASE_SPEED,
    invincible: false,
    invincibilityTimer: 0,
    shieldTimer: 0,
    speedBoostTimer: 0,
    blasterTimer: 0,
    attractTimer: 0,
    stunned: 0,
    hitFlash: 0,
    reflectTimer: 0,
    slowTimer: 0,
    rainTimer: 0,
    shrinkTimer: 0,
    doubleTimer: 0,
  };
}

function overlaps(a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

/** Remove inactive entities in place (no new arrays each frame). */
function compact<T extends { active: boolean }>(arr: T[]) {
  let j = 0;
  for (let i = 0; i < arr.length; i++) if (arr[i].active) arr[j++] = arr[i];
  arr.length = j;
}

/** Convert a "probability per 60 Hz frame" into a probability for a step of dt seconds. */
function perStep(pPerFrame: number, dt: number, rateScale = 1) {
  return 1 - Math.pow(1 - Math.min(0.99, pPerFrame), dt * 60 * rateScale);
}

export class GameEngine {
  W = BASE_W;
  H = BASE_H;
  phase: Phase = "idle";
  paused = false;
  /** Simulation clock in ms (stops while paused). */
  time = 0;
  private acc = 0;
  /** All gameplay randomness comes from here (seeded per game). */
  rng: Rng = mulberry32(randomSeed());
  seed = 0;
  /** Item ids already seen on this device (the host loads and saves it). */
  seenItems = new Set<string>();
  stats: RunStats = { levelStart: 0, levelTimes: [], deathCause: null, pickups: {} };
  /** Items unlocking on this level, waiting for their guaranteed first spawn. */
  private pendingUnlocks: CollectibleType[] = [];
  strikes: Strike[] = [];
  wind: Wind | null = null;
  /** Decoy Doe: where the cardboard bunny stands and until when (ms). */
  decoy: { x: number; y: number; until: number } | null = null;
  /** White screen flash (ms remaining), e.g. after a Bunny Bomb. */
  flash = 0;
  private bombThisLevel = false;
  private rainNextCarrot = 0;
  private nextGustAt = Infinity;
  tierIndex = -1;
  /** Carrots grabbed in the current quick chain, and when the chain expires (ms, sim time). */
  comboChain = 0;
  comboUntil = 0;
  private nextUnlockSpawn = 0;

  score = 0;
  level = 1;
  carrots = 0;
  lives = 3;

  player = newPlayer(BASE_W, BASE_H);
  keys: Keys = { w: false, a: false, s: false, d: false, ArrowUp: false, ArrowLeft: false, ArrowDown: false, ArrowRight: false, space: false };
  /** Legacy analog touchpad input (dx, dy in [-1, 1]). */
  touchMove: { dx: number; dy: number } | null = null;
  /** Drag-anywhere target for the player's centre, in world units. */
  dragTarget: { x: number; y: number } | null = null;
  /** Fire blasters automatically while the power-up is active (touch play has no fire button). */
  autoFire = false;
  damageDisabled = false;

  projectiles: Entity[] = [];
  obstacles: Entity[] = [];
  collectibles: Entity[] = [];
  giantCarrot = { x: 0, y: BASE_H + 100, width: BASE_W, height: 200, angle: 0, nextShot: 0, face: 0 };
  explosions: { x: number; y: number; start: number; dur: number }[] = [];
  particles: Particle[] = [];
  popups: Popup[] = [];
  sparkleTrail: { x: number; y: number; start: number }[] = [];
  maxHeartsBlastStart: number | null = null;
  /** Screen shake remaining (ms) and strength (px). */
  shake = 0;
  shakeStrength = 0;

  private countdownStart = 0;
  private lastBlasterShot = -Infinity;
  private lastDeflect = -Infinity;
  private maxHeartsBonusAwarded = false;
  private rapidOn = false;
  private attractOn = false;
  private goldenOn = false;
  private lastHud: HudState = { score: -1, level: -1, carrots: -1, lives: -1, combo: -1, comboChain: -1, boss: false };
  boss: BossState | null = null;
  /** Which power-up combos are active (for visuals and the one-time popup). */
  combos = { turbo: false, magnet: false };

  constructor(private events: EngineEvents) {}

  get vScale() {
    return this.H / BASE_H;
  }
  get widthScale() {
    return this.W / BASE_W;
  }
  get fallSpeed() {
    return FALL_SPEED * this.vScale;
  }
  get carrotRestY() {
    return this.H - 120;
  }
  /** Bunny speed scales with the playfield height like everything else, so tall phones play fair. */
  get baseSpeed() {
    return BASE_SPEED * Math.sqrt(this.vScale);
  }

  // ---------------------------------------------------------------------------
  // Control
  // ---------------------------------------------------------------------------

  /** Resize the world (orientation change), keeping everything in the same relative place. */
  setWorldSize(w: number, h: number) {
    if (w === this.W && h === this.H) return;
    const sx = w / this.W;
    const sy = h / this.H;
    const vy = h / this.H;
    const move = (e: { x: number; y: number; width: number; height: number; vx?: number; vy?: number }) => {
      e.x = (e.x + e.width / 2) * sx - e.width / 2;
      e.y = (e.y + e.height / 2) * sy - e.height / 2;
      if (e.vy != null) e.vy *= vy;
    };
    this.projectiles.forEach(move);
    this.obstacles.forEach(move);
    this.collectibles.forEach(move);
    move(this.player);
    this.player.vx = 0;
    this.player.vy = 0;
    this.explosions.forEach((e) => { e.x *= sx; e.y *= sy; });
    this.sparkleTrail.length = 0;
    this.particles.length = 0;
    this.popups.forEach((p) => { p.x *= sx; p.y *= sy; });
    this.strikes.forEach((st) => { st.x *= sx; st.w *= sx; });
    this.W = w;
    this.H = h;
    this.player.speed = this.player.speedBoostTimer > 0 ? this.baseSpeed * 1.5 : this.baseSpeed;
    this.giantCarrot.width = w;
    if (this.phase === "playing") this.giantCarrot.y = this.carrotRestY;
    this.dragTarget = null;
    this.clampPlayer();
  }

  start(initialLevel = 1, seed = randomSeed()) {
    this.seed = seed >>> 0;
    this.rng = mulberry32(this.seed);
    this.player = newPlayer(this.W, this.H);
    this.player.speed = this.baseSpeed;
    this.strikes = [];
    this.wind = null;
    this.decoy = null;
    this.flash = 0;
    this.boss = null;
    this.combos = { turbo: false, magnet: false };
    this.nextGustAt = Infinity;
    this.tierIndex = -1;
    this.projectiles = [];
    this.obstacles = [];
    this.collectibles = [];
    this.explosions = [];
    this.particles = [];
    this.popups = [];
    this.sparkleTrail = [];
    this.giantCarrot = { x: 0, y: this.H + 180, width: this.W, height: 200, angle: 0, nextShot: 0, face: Math.floor(this.rng() * 6) };
    this.score = 0;
    this.level = initialLevel;
    this.carrots = 0;
    this.lives = 3;
    this.maxHeartsBlastStart = null;
    this.maxHeartsBonusAwarded = false;
    this.comboChain = 0;
    this.comboUntil = 0;
    this.lastBlasterShot = -Infinity;
    this.lastDeflect = -Infinity;
    this.touchMove = null;
    this.dragTarget = null;
    this.shake = 0;
    this.stopAllLoops();
    this.paused = false;
    this.acc = 0;
    this.countdownStart = this.time;
    this.stats = { levelStart: this.time + COUNTDOWN_MS, levelTimes: [], deathCause: null, pickups: {} };
    this.beginLevel(this.time + COUNTDOWN_MS);
    this.setPhase("countdown");
    this.emitHud(true);
  }

  /** Per-level setup: queue the guaranteed early spawn of anything that unlocks here. */
  private beginLevel(startTime: number) {
    this.bombThisLevel = false;
    this.pendingUnlocks = itemsUnlockingAt(this.level);
    this.nextUnlockSpawn = startTime + 3000;
    const ti = tierIndexForLevel(this.level);
    if (ti !== this.tierIndex) {
      const first = this.tierIndex < 0;
      this.tierIndex = ti;
      this.events.tier?.(ti);
      const tier = TIERS[ti];
      if (!first || ti > 0) {
        this.events.sfx("tier_up");
        this.events.announce?.({ kind: "tier", title: `Tier ${tier.n} · ${tier.theme.name}`, body: tier.newHazards.length ? `New: ${tier.newHazards.join(" and ")}` : undefined });
      }
    }
    // Boss fights close each tier
    this.boss = null;
    if (isBossLevel(this.level)) {
      const def = bossForLevel(this.level);
      this.boss = { def, hp: def.hp, start: startTime, patIdx: 0, patStart: startTime + 1200, nextFire: startTime + 1200, phase: 0, hitAt: -Infinity, done: false };
      this.events.announce?.({ kind: "boss", title: def.name, body: `Boss! Drain its health or survive ${BOSS_SURVIVE_S} s` });
      this.events.sfx("boss_warning");
      this.giantCarrot.face = 3;
    }
    const gust = tierForLevel(this.level).rates.gustEvery;
    this.nextGustAt = gust ? startTime + lerpRange(gust, tierProgress(this.level)) * 1000 * (0.6 + this.rng() * 0.6) : Infinity;
    if (!gust) this.wind = null;
    for (const m of MECHANICS) {
      if (m.unlockLevel !== this.level || this.seenItems.has(m.id)) continue;
      this.seenItems.add(m.id);
      this.events.discovered?.(m.id);
      this.events.announce?.({ kind: "new", title: m.name, body: m.blurb });
    }
  }

  /** Current score multiplier from the carrot combo (1 = no combo). */
  get comboMult() {
    if (!mechanicUnlocked("combo", this.level) || this.comboChain < 2) return 1;
    return Math.min(5, 1 + Math.floor(this.comboChain / 2));
  }

  /** Leave play without game-over (menu / unmount). */
  stop() {
    this.stopAllLoops();
    this.setPhase("idle");
  }

  setLevel(n: number) {
    this.level = Math.max(1, Math.min(FINAL_LEVEL, Math.floor(n)));
    this.carrots = 0;
    this.beginLevel(this.time);
    this.emitHud();
  }

  setPaused(p: boolean) {
    if (p && this.phase !== "countdown" && this.phase !== "playing") return;
    this.paused = p;
    this.acc = 0;
    if (p) {
      this.dragTarget = null;
      this.touchMove = null;
      (Object.keys(this.keys) as (keyof Keys)[]).forEach((k) => (this.keys[k] = false));
    }
  }

  setKey(key: string, pressed: boolean) {
    if (key in this.keys) this.keys[key as keyof Keys] = pressed;
  }

  spawnEntity(x: number, y: number, type: SpawnableType) {
    const clampX = (v: number, w: number) => Math.max(0, Math.min(this.W - w, v));
    const clampY = (v: number, h: number) => Math.max(0, Math.min(this.H - h, v));
    if (type === "spike") {
      this.projectiles.push({ x: clampX(x - 20, 40), y: clampY(y - 20, 40), width: 40, height: 40, type, vx: 0, vy: -200, active: true, angle: 0 });
      return;
    }
    if (type === "ball") {
      this.obstacles.push({ x: clampX(x - 20, 40), y: clampY(y - 20, 40), width: 40, height: 40, type, vx: 0, vy: this.fallSpeed, active: true });
      return;
    }
    const isCarrot = type.startsWith("carrot");
    const w = isCarrot ? 40 : 30;
    this.collectibles.push({
      x: clampX(x - w / 2, w),
      y: clampY(y - w / 2, w),
      width: w,
      height: w,
      type,
      vx: 0,
      vy: this.fallSpeed,
      active: true,
      ...(isCarrot && { face: type === "carrot_rotten" ? 1 : Math.floor(this.rng() * 6) }),
    });
  }

  /** Every harmful thing currently in play (for the simulation bots). */
  forEachThreat(cb: (t: Threat) => void) {
    for (const arr of [this.projectiles, this.obstacles]) {
      for (const o of arr) {
        if (o.active && !o.reflected && HARMFUL.has(o.type)) cb({ x: o.x + o.width / 2, y: o.y + o.height / 2, vx: o.vx, vy: o.vy, r: Math.max(o.width, o.height) / 2 });
      }
    }
  }

  /** Column danger zones (icicle and lightning warnings / strikes): x range and when it's live (ms). */
  forEachZone(cb: (z: { x0: number; x1: number; from: number; to: number }) => void) {
    for (const st of this.strikes) {
      // An icicle falls fast down its column for about a second after the warning ends
      const to = st.kind === "icicle" ? st.warnUntil + 1100 : st.endAt;
      cb({ x0: st.x - st.w / 2, x1: st.x + st.w / 2, from: st.warnUntil, to });
    }
  }

  /** Advance by one display frame's worth of real time (ms). */
  advance(frameMs: number) {
    if (this.paused || (this.phase !== "countdown" && this.phase !== "playing")) return;
    this.acc += Math.min(MAX_FRAME_S, Math.max(0, frameMs / 1000));
    while (this.acc >= STEP) {
      this.acc -= STEP;
      this.update(STEP);
      if (this.phase !== "countdown" && this.phase !== "playing") {
        this.acc = 0;
        break;
      }
    }
    this.emitHud();
  }

  /**
   * Outside of play (game over, menu) only effects run. The clock still advances so time-based
   * effects (score popups, explosions) finish fading and are removed instead of freezing on screen.
   */
  advanceEffects(frameMs: number) {
    const dt = Math.min(MAX_FRAME_S, Math.max(0, frameMs / 1000));
    this.time += dt * 1000;
    this.updateEffects(dt);
    let j = 0;
    for (const e of this.explosions) if (this.time - e.start < e.dur) this.explosions[j++] = e;
    this.explosions.length = j;
  }

  // ---------------------------------------------------------------------------
  // Simulation
  // ---------------------------------------------------------------------------

  private update(dt: number) {
    const p = this.player;
    this.time += dt * 1000;
    const t = this.time;
    // Slow-Mo Clover: everything except the bunny runs at half speed. Absolute timers
    // (warnings, sprout bursts, beet lifetimes, gusts) are pushed back by the time "not spent".
    const worldDt = p.slowTimer > 0 ? dt * 0.5 : dt;
    if (worldDt < dt) this.shiftWorldTimers((dt - worldDt) * 1000);
    const isCountdown = this.phase === "countdown";
    const countdownElapsed = t - this.countdownStart;

    if (isCountdown && countdownElapsed >= COUNTDOWN_MS) {
      this.giantCarrot.y = this.carrotRestY;
      this.giantCarrot.nextShot = 2.0;
      this.setPhase("playing");
    }

    this.updatePlayerMovement(dt);

    // Timers
    if (p.shieldTimer > 0) p.shieldTimer = Math.max(0, p.shieldTimer - dt);
    if (p.speedBoostTimer > 0) {
      p.speedBoostTimer = Math.max(0, p.speedBoostTimer - dt);
      if (p.speedBoostTimer <= 0) {
        p.speed = this.baseSpeed;
        this.setLoop("rapid_rabbit_loop", false);
      }
    } else {
      p.speed = this.baseSpeed;
    }
    if (p.blasterTimer > 0) p.blasterTimer = Math.max(0, p.blasterTimer - dt);
    if (p.attractTimer > 0) p.attractTimer = Math.max(0, p.attractTimer - dt);
    if (p.attractTimer <= 0) this.setLoop("attract_loop", false);
    if (p.invincible) {
      p.invincibilityTimer -= dt;
      if (p.invincibilityTimer <= 0) p.invincible = false;
    }
    if (p.hitFlash > 0) p.hitFlash = Math.max(0, p.hitFlash - dt);
    if (p.reflectTimer > 0) p.reflectTimer = Math.max(0, p.reflectTimer - dt);
    if (p.slowTimer > 0) p.slowTimer = Math.max(0, p.slowTimer - dt);
    if (p.rainTimer > 0) p.rainTimer = Math.max(0, p.rainTimer - dt);
    if (p.doubleTimer > 0) p.doubleTimer = Math.max(0, p.doubleTimer - dt);
    if (p.shrinkTimer > 0) {
      p.shrinkTimer = Math.max(0, p.shrinkTimer - dt);
      if (p.shrinkTimer <= 0) this.resizePlayer(PLAYER_SIZE);
    }
    if (this.decoy && t > this.decoy.until) this.decoy = null;
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 1000);
    if (this.comboChain > 0 && t > this.comboUntil) this.comboChain = 0;

    // Giant carrot
    const gc = this.giantCarrot;
    gc.x = 0;
    gc.width = this.W;
    if (isCountdown) {
      const k = Math.min(1, countdownElapsed / COUNTDOWN_MS);
      const easeOut = 1 - (1 - k) * (1 - k);
      const startY = this.H + 180;
      gc.y = startY + (this.carrotRestY - startY) * easeOut;
      gc.angle += dt * 5;
    } else {
      gc.y = this.carrotRestY + Math.sin(t / 200) * 10;
      gc.angle += dt * 5;
      gc.nextShot -= worldDt;
      if (gc.nextShot <= 0 && p.rainTimer > 0) gc.nextShot = 0.3; // Carrot Rain: the carrot holds fire
      if (this.boss) {
        gc.nextShot = 1; // the boss uses its attack patterns instead
        if (!isCountdown) this.updateBoss(t);
      }
      if (gc.nextShot <= 0) {
        const margin = 40;
        const sourceX = gc.x + margin + this.rng() * (gc.width - 2 * margin);
        // Decoy Doe draws every shot while it stands
        const aimX = this.decoy ? this.decoy.x - p.width / 2 : p.x;
        const aimY = this.decoy ? this.decoy.y - p.height / 2 : p.y;
        const angle = Math.atan2(aimY - gc.y, aimX - sourceX);
        const speed = difficulty(this.level).shotSpeed * this.vScale;
        const cauli = hazardRate(this.level, (r) => r.cauliChance);
        const sprout = hazardRate(this.level, (r) => r.sproutChance);
        const roll = this.rng();
        if (roll < cauli) {
          const v = speed * 0.55;
          this.projectiles.push({ x: sourceX - 28, y: gc.y - 28, width: 56, height: 56, type: "cauliflower", vx: Math.cos(angle) * v, vy: Math.sin(angle) * v, active: true, angle: 0, hp: 2 });
        } else if (roll < cauli + sprout) {
          this.projectiles.push({ x: sourceX - 13, y: gc.y - 13, width: 26, height: 26, type: "sprout", vx: Math.cos(angle) * speed * 0.85, vy: Math.sin(angle) * speed * 0.85, active: true, angle: 0, born: t });
        } else {
          this.projectiles.push({ x: sourceX, y: gc.y, width: 40, height: 40, type: "spike", vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, active: true, angle: 0 });
        }
        this.events.sfx("carrot_shoot");
        gc.nextShot = difficulty(this.level).shotInterval;
      }
    }

    if (!isCountdown) this.updatePlaying(worldDt, t, dt);
    this.updateEffects(dt);
  }

  private clampPlayer() {
    const p = this.player;
    p.x = Math.max(0, Math.min(this.W - p.width, p.x));
    p.y = Math.max(0, Math.min(this.H - p.height, p.y));
  }

  private updatePlayerMovement(dt: number) {
    const p = this.player;
    if (p.stunned > 0) {
      p.stunned -= dt;
      // Coast to a stop while stunned (keyboard feel), drag/touch simply freeze.
      const k = 1 - Math.pow(0.25, dt * 60);
      p.vx -= p.vx * k;
      p.vy -= p.vy * k;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      this.clampPlayer();
      return;
    }

    const drag = this.dragTarget;
    if (drag) {
      const cx = p.x + p.width / 2;
      const cy = p.y + p.height / 2;
      const tx = Math.max(p.width / 2, Math.min(this.W - p.width / 2, drag.x));
      const ty = Math.max(p.height / 2, Math.min(this.H - p.height / 2, drag.y));
      const dx = tx - cx;
      const dy = ty - cy;
      const d = Math.hypot(dx, dy);
      const maxStep = p.speed * DRAG_SPEED_MULT * dt;
      if (d <= maxStep) {
        p.x += dx;
        p.y += dy;
      } else {
        p.x += (dx / d) * maxStep;
        p.y += (dy / d) * maxStep;
      }
      p.vx = 0;
      p.vy = 0;
      this.clampPlayer();
      return;
    }

    const touch = this.touchMove;
    if (touch) {
      // Legacy touchpad: direct, instant response
      p.x += touch.dx * p.speed * dt;
      p.y += touch.dy * p.speed * dt;
      p.vx = 0;
      p.vy = 0;
      this.clampPlayer();
      return;
    }

    let tdx = 0;
    let tdy = 0;
    const k = this.keys;
    if (k.w || k.ArrowUp) tdy -= 1;
    if (k.s || k.ArrowDown) tdy += 1;
    if (k.a || k.ArrowLeft) tdx -= 1;
    if (k.d || k.ArrowRight) tdx += 1;
    if (tdx !== 0 || tdy !== 0) {
      const len = Math.hypot(tdx, tdy);
      tdx /= len;
      tdy /= len;
      // Same feel as the old per-frame 0.65 acceleration, made frame-rate independent.
      const a = 1 - Math.pow(1 - 0.65, dt * 60);
      p.vx += (tdx * p.speed - p.vx) * a;
      p.vy += (tdy * p.speed - p.vy) * a;
    } else {
      const dcl = 1 - Math.pow(1 - 0.75, dt * 60);
      p.vx -= p.vx * dcl;
      p.vy -= p.vy * dcl;
      if (Math.hypot(p.vx, p.vy) < 6) {
        p.vx = 0;
        p.vy = 0;
      }
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    this.clampPlayer();
  }

  private updatePlaying(dt: number, t: number, realDt = dt) {
    const p = this.player;
    const W = this.W;
    const H = this.H;
    const vS = this.vScale;
    const fall = this.fallSpeed;

    // Bunny blasters
    if (p.blasterTimer > 0 && (this.keys.space || this.autoFire) && t - this.lastBlasterShot >= BLASTER_COOLDOWN_MS) {
      this.lastBlasterShot = t;
      const cx = p.x + p.width / 2;
      const cy = p.y;
      const LASER_W = 2;
      const LASER_H = 54;
      for (const sign of [-1, 1]) {
        // In boss fights the bunny fires down at the giant carrot
        const down = !!this.boss;
        this.projectiles.push({ x: cx + sign * 14 - LASER_W / 2, y: (down ? p.y + p.height : cy) - LASER_H / 2, width: LASER_W, height: LASER_H, type: "player_laser", vx: 0, vy: (down ? 1 : -1) * 1050 * vS, active: true });
      }
      this.events.sfx("blaster_shoot");
    }

    const diff = difficulty(this.level);

    // Carrot Rain: a shower of carrots and no new hazards
    if (p.rainTimer > 0) {
      if (t >= this.rainNextCarrot) {
        this.spawnCollectible("carrot");
        this.rainNextCarrot = t + 150;
      }
    }
    // Spiky balls (and, from tier 2, chestnut burrs)
    if (p.rainTimer <= 0 && this.rng() < perStep(diff.ballChance * (this.boss ? 0.4 : 1), dt, Math.sqrt(this.widthScale))) {
      const burr = this.rng() < hazardRate(this.level, (r) => r.burrShare);
      this.obstacles.push({ x: this.rng() * (W - 40), y: -40 - fall * BALL_TELEGRAPH_S, width: 40, height: 40, type: burr ? "burr" : "ball", vx: 0, vy: fall, active: true, hp: burr ? 1 : undefined });
    }
    this.updateTierHazards(dt, t, p.rainTimer <= 0, this.boss ? 0.4 : 1);

    // Guaranteed first spawn of anything that unlocks on this level
    if (this.pendingUnlocks.length && t >= this.nextUnlockSpawn) {
      this.spawnCollectible(this.pendingUnlocks.shift()!);
      this.nextUnlockSpawn = t + 3000;
    }

    // Collectibles
    // Collectibles arrive at the same rate on every screen shape (narrow phones aren't starved of carrots)
    if (this.collectibles.length < diff.collectibleCap && this.rng() < perStep(0.02, dt, Math.pow(this.widthScale, 0.25))) {
      let pick = pickCollectible(this.level, this.rng);
      if (this.boss) {
        // Boss fights: no carrots; power-ups still drop now and then
        if (pick.startsWith("carrot") || pick === "powerup_rain") pick = this.rng() < 0.35 ? "powerup_blaster" : "powerup_invincible";
        if (this.rng() > 0.35) pick = "carrot_none" as CollectibleType;
      }
      if (pick === "powerup_bomb" && this.bombThisLevel) pick = "carrot"; // one bomb per level at most
      if (pick === "powerup_slowmo" && p.slowTimer > 0) pick = "carrot";
      if (pick === "powerup_bomb") this.bombThisLevel = true;
      if ((pick as string) !== "carrot_none") this.spawnCollectible(pick);
    }

    // Move entities
    const moveAll = (arr: Entity[]) => {
      for (const o of arr) {
        o.x += o.vx * dt;
        o.y += o.vy * dt;
        if (SPINNING.has(o.type) && o.angle !== undefined) o.angle += dt * (o.type === "cauliflower" ? 3 : 12);
        if (o.y > H + 100 || o.y < -400 || o.x < -100 || o.x > W + 100) o.active = false;
      }
    };
    moveAll(this.projectiles);
    moveAll(this.obstacles);
    moveAll(this.collectibles);

    // Golden carrots run away from the bunny
    {
      const px = p.x + p.width / 2;
      const py = p.y + p.height / 2;
      for (const o of this.collectibles) {
        if (!o.active || o.type !== "carrot_golden") continue;
        const dx = o.x + o.width / 2 - px;
        const dy = o.y + o.height / 2 - py;
        const d = Math.hypot(dx, dy) || 1e-6;
        if (d < 170) {
          o.vx += (dx / d) * 900 * dt;
          o.vy += (dy / d) * 400 * dt;
        } else {
          o.vx *= Math.pow(0.3, dt);
          o.vy += (fall - o.vy) * Math.min(1, 2 * dt);
        }
        const v = Math.hypot(o.vx, o.vy);
        const cap = 230 * vS;
        if (v > cap) {
          o.vx *= cap / v;
          o.vy *= cap / v;
        }
        if (o.x < 0 || o.x > W - o.width) {
          o.x = Math.max(0, Math.min(W - o.width, o.x));
          o.vx = -o.vx * 0.5;
        }
      }
    }

    // Attract-o-Hare
    if (p.attractTimer > 0) {
      const px = p.x + p.width / 2;
      const py = p.y + p.height / 2;
      for (const o of this.collectibles) {
        if (!o.active || !isGoodCarrot(o.type)) continue;
        const dx = px - (o.x + o.width / 2);
        const dy = py - (o.y + o.height / 2);
        const d = Math.hypot(dx, dy) || 1e-6;
        if (d > ATTRACT_RADIUS) continue;
        const nx = dx / d;
        const ny = dy / d;
        const toward = o.vx * nx + o.vy * ny;
        const v = Math.min(Math.max(0, toward) + ATTRACT_STRENGTH * dt, ATTRACT_MAX_CARROT_SPEED);
        o.vx = nx * v;
        o.vy = ny * v;
        o.x = Math.max(0, Math.min(W - o.width, o.x));
        o.y = Math.max(0, Math.min(H - o.height, o.y));
      }
    }

    // Ball vs ball (elastic bounce)
    const obs = this.obstacles;
    for (let i = 0; i < obs.length; i++) {
      const a = obs[i];
      if (!a.active || !BOUNCY.has(a.type)) continue;
      for (let j = i + 1; j < obs.length; j++) {
        const b = obs[j];
        if (!b.active || !BOUNCY.has(b.type)) continue;
        const dx = b.x + b.width / 2 - (a.x + a.width / 2);
        const dy = b.y + b.height / 2 - (a.y + a.height / 2);
        const dist = Math.hypot(dx, dy) || 1e-6;
        const overlap = a.width / 2 + b.width / 2 - dist;
        if (overlap <= 0) continue;
        const nx = dx / dist;
        const ny = dy / dist;
        a.x -= nx * overlap * 0.5;
        a.y -= ny * overlap * 0.5;
        b.x += nx * overlap * 0.5;
        b.y += ny * overlap * 0.5;
        const v1n = a.vx * nx + a.vy * ny;
        const v2n = b.vx * nx + b.vy * ny;
        a.vx += (v2n - v1n) * nx;
        a.vy += (v2n - v1n) * ny;
        b.vx += (v1n - v2n) * nx;
        b.vy += (v1n - v2n) * ny;
      }
    }

    // Lasers vs balls
    const EXPLOSION_RADIUS = 110;
    const PUSH = 380;
    const targets = [...obs, ...this.projectiles];
    for (const proj of this.projectiles) {
      if (!proj.active || proj.type !== "player_laser") continue;
      for (const ball of targets) {
        if (!ball.active || !BLASTABLE.has(ball.type) || !overlaps(proj, ball)) continue;
        proj.active = false;
        const ex = ball.x + ball.width / 2;
        const ey = ball.y + ball.height / 2;
        if (ball.hp && ball.hp > 1 && ball.type === "cauliflower") {
          ball.hp -= 1;
          this.burst(ex, ey, 6, ["#f5f5f4", "#d6d3d1"], 140);
          this.events.sfx("shield_deflect");
          break;
        }
        ball.active = false;
        this.explode(ex, ey, t);
        this.addScore(ball.type === "cauliflower" ? 15 : 5, ex, ey);
        if (ball.type === "burr") {
          // A burr splits into two small ones that scatter downward
          for (const sgn of [-1, 1]) {
            const a = Math.PI / 2 + sgn * 0.9;
            const v = 170 * vS;
            this.obstacles.push({ x: ex - 12, y: ey - 12, width: 24, height: 24, type: "burr_small", vx: Math.cos(a) * v, vy: Math.sin(a) * v, active: true });
          }
        }
        if (this.rng() < 0.1) {
          this.collectibles.push({ x: ball.x, y: ball.y, width: 30, height: 30, type: "powerup_heart", vx: 0, vy: fall, active: true });
        }
        for (const other of obs) {
          if (!other.active || !BOUNCY.has(other.type) || other === ball) continue;
          const ddx = other.x + other.width / 2 - ex;
          const ddy = other.y + other.height / 2 - ey;
          const d = Math.hypot(ddx, ddy) || 1e-6;
          if (d >= EXPLOSION_RADIUS) continue;
          const f = (1 - d / EXPLOSION_RADIUS) * PUSH;
          other.vx += (ddx / d) * f;
          other.vy += (ddy / d) * f;
          const v = Math.hypot(other.vx, other.vy);
          if (v > 400) {
            other.vx *= 400 / v;
            other.vy *= 400 / v;
          }
        }
        break;
      }
    }

    // Power-up combos (from L18): two compatible power-ups at once merge into something stronger
    if (mechanicUnlocked("power_combos", this.level)) {
      const turbo = p.shieldTimer > 0 && p.speedBoostTimer > 0;
      const magnet = p.blasterTimer > 0 && p.attractTimer > 0;
      if (turbo && !this.combos.turbo) this.announceCombo("TURBO SHIELD!");
      if (magnet && !this.combos.magnet) this.announceCombo("MAGNET LASERS!");
      this.combos = { turbo, magnet };
      const pcx = p.x + p.width / 2;
      const pcy = p.y + p.height / 2;
      if (turbo) {
        // Turbo Shield: hazards near the bunny are flung away
        for (const arr of [this.projectiles, obs]) {
          for (const o of arr) {
            if (!o.active || o.reflected || !HARMFUL.has(o.type)) continue;
            const dx = o.x + o.width / 2 - pcx;
            const dy = o.y + o.height / 2 - pcy;
            const d = Math.hypot(dx, dy) || 1;
            if (d > 80) continue;
            const v = 520 * vS;
            o.vx = (dx / d) * v;
            o.vy = (dy / d) * v;
          }
        }
      }
      if (magnet) {
        // Magnet Lasers: lasers curve toward the nearest thing they can destroy
        for (const proj of this.projectiles) {
          if (!proj.active || proj.type !== "player_laser") continue;
          let best: Entity | null = null;
          let bd = 260;
          for (const o of [...obs, ...this.projectiles]) {
            if (!o.active || !BLASTABLE.has(o.type)) continue;
            const d = Math.hypot(o.x + o.width / 2 - proj.x, o.y + o.height / 2 - proj.y);
            if (d < bd) {
              bd = d;
              best = o;
            }
          }
          if (!best) continue;
          const v = Math.hypot(proj.vx, proj.vy);
          const want = Math.atan2(best.y + best.height / 2 - proj.y, best.x + best.width / 2 - proj.x);
          const cur = Math.atan2(proj.vy, proj.vx);
          let d = want - cur;
          while (d > Math.PI) d -= Math.PI * 2;
          while (d < -Math.PI) d += Math.PI * 2;
          const a = cur + Math.max(-6 * dt, Math.min(6 * dt, d));
          proj.vx = Math.cos(a) * v;
          proj.vy = Math.sin(a) * v;
        }
      }
    }

    // Boss fights: downward lasers that reach the giant carrot damage it
    if (this.boss) {
      for (const proj of this.projectiles) {
        if (!proj.active || proj.type !== "player_laser" || proj.vy <= 0) continue;
        if (proj.y + proj.height < this.giantCarrot.y + 12) continue;
        proj.active = false;
        this.burst(proj.x, this.giantCarrot.y + 12, 3, ["#fde68a", "#fb923c"], 90);
        this.damageBoss(1, t);
      }
    }

    // Expire explosions in place
    let j = 0;
    for (const e of this.explosions) if (t - e.start < e.dur) this.explosions[j++] = e;
    this.explosions.length = j;

    // Hazards vs player
    const hazard = (o: Entity) => {
      if (!o.active || o.reflected || !HARMFUL.has(o.type) || !overlaps(p, o)) return false;
      if (p.reflectTimer > 0 && REFLECTABLE.has(o.type)) {
        // Broccoli Reflector: send it back down at the giant carrot
        const v = Math.max(300 * this.vScale, Math.hypot(o.vx, o.vy));
        const tx = this.W / 2 + (this.rng() - 0.5) * this.W * 0.6;
        const ang = Math.atan2(this.giantCarrot.y + 40 - (o.y + o.height / 2), tx - (o.x + o.width / 2));
        o.vx = Math.cos(ang) * v;
        o.vy = Math.sin(ang) * v;
        o.reflected = true;
        this.events.sfx("reflect");
        this.addScore(5, o.x + o.width / 2, o.y);
        return false;
      }
      if (p.shieldTimer > 0) {
        if (t - this.lastDeflect >= 500) {
          this.lastDeflect = t;
          this.events.sfx("shield_deflect");
        }
        if (o.type === "ball" || o.type === "burr") this.addScore(5, o.x + o.width / 2, o.y);
        const dx = o.x + o.width / 2 - (p.x + p.width / 2);
        const dy = o.y + o.height / 2 - (p.y + p.height / 2);
        const len = Math.hypot(dx, dy) || 1;
        const speed = Math.hypot(o.vx, o.vy);
        o.vx = (dx / len) * speed;
        o.vy = (dy / len) * speed;
        return false;
      }
      if (!this.vulnerable) return false;
      o.active = false;
      return this.damagePlayer(o.type);
    };
    for (const o of this.projectiles) if (hazard(o)) return;
    for (const o of obs) if (hazard(o)) return;

    // Lightning strikes hit anything in their column while active
    for (const st of this.strikes) {
      if (st.kind !== "lightning" || t < st.warnUntil || t > st.endAt) continue;
      if (p.x + p.width > st.x - st.w / 2 && p.x < st.x + st.w / 2) {
        if (p.shieldTimer > 0) continue;
        if (this.vulnerable && this.damagePlayer("lightning")) return;
      }
    }

    // Near miss: a hazard came within a few px while you were vulnerable, then moved away
    if (mechanicUnlocked("near_miss", this.level)) {
      const vulnerable = this.vulnerable && p.shieldTimer <= 0;
      const check = (o: Entity) => {
        if (!o.active || o.reflected || !HARMFUL.has(o.type) || o.near === 2) return;
        const gx = Math.max(o.x - (p.x + p.width), p.x - (o.x + o.width), 0);
        const gy = Math.max(o.y - (p.y + p.height), p.y - (o.y + o.height), 0);
        const gap = Math.hypot(gx, gy);
        if (!o.near && vulnerable && gap > 0 && gap < 10) o.near = 1;
        else if (o.near === 1 && gap > 28) {
          o.near = 2;
          this.events.sfx("near_miss");
          this.addScore(5, p.x + p.width / 2, p.y - 6, false, "CLOSE! +5");
        }
      };
      for (const o of this.projectiles) check(o);
      for (const o of obs) check(o);
    }

    // Collectibles vs player (Double Trouble's ghost collects carrots too)
    const ghost = this.ghost;
    for (const o of this.collectibles) {
      if (!o.active) continue;
      if (!overlaps(p, o) && !(ghost && isGoodCarrot(o.type) && overlaps(ghost, o))) continue;
      o.active = false;
      this.stats.pickups[o.type] = (this.stats.pickups[o.type] ?? 0) + 1;
      const ox = o.x + o.width / 2;
      const oy = o.y + o.height / 2;
      switch (o.type) {
        case "carrot":
        case "carrot_golden": {
          const golden = o.type === "carrot_golden";
          if (mechanicUnlocked("combo", this.level)) {
            this.comboChain += 1;
            this.comboUntil = t + 2000;
            if (this.comboChain >= 2 && this.comboChain % 2 === 0 && this.comboMult <= 5) this.events.sfx("combo_up");
          }
          const mult = this.comboMult;
          const pts = (golden ? 50 : 10) * this.level * mult;
          this.events.sfx(golden ? "golden_carrot" : "carrot_collect");
          this.addScore(pts, ox, oy, golden, mult > 1 ? `+${pts} x${mult}` : undefined);
          this.burst(ox, oy, golden ? 20 : 8, golden ? ["#fde047", "#facc15", "#ffffff"] : ["#fb923c", "#fdba74", "#22c55e"], golden ? 220 : 140);
          this.carrots += golden ? 5 : 1;
          if (this.carrots >= 10) {
            this.levelUp();
            if (this.phase === "ending") return;
          }
          break;
        }
        case "carrot_rotten": {
          this.events.sfx("rotten_carrot");
          this.carrots = Math.max(0, this.carrots - 1);
          this.comboChain = 0;
          this.pushPopup({ x: ox, y: oy, text: "ROTTEN! -1", start: this.time, color: "#a3e635" });
          this.burst(ox, oy, 10, ["#65a30d", "#3f6212", "#78716c"], 120);
          break;
        }
        case "powerup_invincible":
          this.events.sfx("powerup_shield");
          p.shieldTimer = 5.0;
          this.giantCarrot.face = Math.floor(this.rng() * 6);
          break;
        case "powerup_speed":
          this.events.sfx("powerup_speed");
          p.speedBoostTimer = 5.0;
          p.speed = this.baseSpeed * 1.5;
          this.setLoop("rapid_rabbit_loop", true);
          this.giantCarrot.face = Math.floor(this.rng() * 6);
          break;
        case "powerup_blaster":
          this.events.sfx("powerup_speed");
          p.blasterTimer = 10.0;
          this.giantCarrot.face = Math.floor(this.rng() * 6);
          break;
        case "powerup_attract":
          this.events.sfx("powerup_attract");
          p.attractTimer = 6.0;
          this.setLoop("attract_loop", true);
          this.giantCarrot.face = Math.floor(this.rng() * 6);
          break;
        case "powerup_decoy":
          this.events.sfx("powerup_decoy");
          this.decoy = { x: p.x + p.width / 2, y: p.y + p.height / 2, until: t + 6000 };
          this.giantCarrot.face = 2;
          break;
        case "powerup_reflector":
          this.events.sfx("powerup_reflector");
          p.reflectTimer = 8;
          break;
        case "powerup_bomb":
          this.events.sfx("bomb");
          this.bunnyBomb(t);
          break;
        case "powerup_slowmo":
          this.events.sfx("powerup_slowmo");
          p.slowTimer = 5;
          break;
        case "powerup_rain":
          this.events.sfx("powerup_rain");
          p.rainTimer = 3;
          this.rainNextCarrot = t;
          break;
        case "powerup_shrink":
          this.events.sfx("powerup_shrink");
          p.shrinkTimer = 8;
          this.resizePlayer(PLAYER_SIZE / 2);
          break;
        case "powerup_double":
          this.events.sfx("powerup_double");
          p.doubleTimer = 8;
          break;
        case "powerup_heart": {
          this.events.sfx("powerup_heart");
          const next = Math.min(this.lives + 1, MAX_HEARTS);
          const reachedMax = next === MAX_HEARTS;
          this.lives = next;
          if (reachedMax) this.maxHeartsBlast(t);
          break;
        }
      }
    }

    // Giant carrot = instant death
    const safe = this.damageDisabled || (p.invincible && p.invincibilityTimer > 0) || p.speedBoostTimer > 0;
    if (!safe && overlaps(p, this.giantCarrot)) {
      this.stats.deathCause = "giant_carrot";
      this.lives = 0;
      this.sparkleTrail.length = 0;
      this.shake = 400;
      this.shakeStrength = 10;
      this.gameOver();
      return;
    }

    // Reflected shots that reach the giant carrot splat on it
    for (const o of this.projectiles) {
      if (!o.active || !o.reflected || o.y + o.height / 2 < this.giantCarrot.y + 10) continue;
      o.active = false;
      this.burst(o.x + o.width / 2, this.giantCarrot.y + 10, 8, ["#4ade80", "#16a34a", "#fde68a"], 160);
      this.onReflectedHit();
    }

    compact(this.projectiles);
    compact(this.obstacles);
    compact(this.collectibles);
  }

  /** A reflected shot hit the giant carrot (bosses take damage from this in boss fights). */
  protected onReflectedHit() {
    this.giantCarrot.face = 3;
    if (this.boss) this.damageBoss(3, this.time);
  }

  // ---------------------------------------------------------------------------
  // Bosses
  // ---------------------------------------------------------------------------

  private damageBoss(n: number, t: number) {
    const b = this.boss;
    if (!b || b.done) return;
    b.hp = Math.max(0, b.hp - n);
    if (t - b.hitAt > 120) this.events.sfx("boss_hit");
    b.hitAt = t;
    if (b.hp <= 0) this.finishBoss(true, t);
  }

  /** Point the carrot's attacks at (the decoy if one stands, else the bunny). */
  private aimPoint() {
    const p = this.player;
    return this.decoy ? { x: this.decoy.x, y: this.decoy.y } : { x: p.x + p.width / 2, y: p.y + p.height / 2 };
  }

  private fireShot(type: "spike" | "sprout" | "sprout_small" | "cauliflower", x: number, angle: number, speed: number) {
    const size = type === "cauliflower" ? 56 : type === "sprout" ? 26 : type === "sprout_small" ? 16 : 40;
    const y = this.giantCarrot.y;
    this.projectiles.push({
      x: x - size / 2,
      y: y - size / 2,
      width: size,
      height: size,
      type,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      active: true,
      angle: 0,
      ...(type === "cauliflower" && { hp: 2 }),
      ...(type === "sprout" && { born: this.time }),
    });
  }

  private spawnMeteor() {
    const W = this.W;
    const vS = this.vScale;
    const fromLeft = this.rng() < 0.5;
    const ang = Math.PI / 2 + (fromLeft ? -1 : 1) * (0.45 + this.rng() * 0.25);
    const v = 520 * vS;
    const x = fromLeft ? this.rng() * W * 0.4 : W * 0.6 + this.rng() * W * 0.4;
    const lead = 0.5;
    this.obstacles.push({ x: x - 15 - Math.cos(ang) * v * lead, y: -30 - Math.sin(ang) * v * lead, width: 30, height: 30, type: "meteor", vx: Math.cos(ang) * v, vy: Math.sin(ang) * v, active: true, angle: ang });
  }

  /** Run the boss's current attack pattern; patterns cycle with a short rest between them. */
  private updateBoss(t: number) {
    const b = this.boss!;
    if (b.done) return;
    if ((t - b.start) / 1000 >= BOSS_SURVIVE_S) {
      this.finishBoss(false, t);
      return;
    }
    if (t < b.patStart) return;
    if (t - b.patStart > BOSS_PATTERN_MS) {
      b.patIdx = (b.patIdx + 1) % b.def.patterns.length;
      b.patStart = t + BOSS_REST_MS;
      b.nextFire = b.patStart;
      b.phase = 0;
      return;
    }
    if (t < b.nextFire) return;
    const pattern: BossPattern = b.def.patterns[b.patIdx];
    const W = this.W;
    const speed = difficulty(this.level).shotSpeed * this.vScale;
    const cx = W / 2;
    const aim = this.aimPoint();
    const aimFrom = (x: number) => Math.atan2(aim.y - this.giantCarrot.y, aim.x - x);
    switch (pattern) {
      case "fan": {
        const base = aimFrom(cx);
        for (let i = -3; i <= 3; i++) this.fireShot("spike", cx, base + i * 0.2, speed * 0.75);
        this.events.sfx("carrot_shoot");
        b.nextFire = t + 900;
        break;
      }
      case "spiral": {
        const a = -Math.PI / 2 + Math.sin(b.phase) * 1.15;
        this.fireShot("spike", cx, a, speed * 0.7);
        b.phase += 0.33;
        b.nextFire = t + 95;
        break;
      }
      case "wall": {
        const gapW = 130;
        const gapX = 40 + this.rng() * (W - 80 - gapW);
        for (let x = 12; x < W; x += 34) if (x < gapX || x > gapX + gapW) this.fireShot("sprout_small", x, -Math.PI / 2, speed * 0.5);
        this.events.sfx("carrot_shoot");
        b.nextFire = t + 1300;
        break;
      }
      case "sprouts": {
        const x = 60 + this.rng() * (W - 120);
        this.fireShot("sprout", x, aimFrom(x), speed * 0.85);
        b.nextFire = t + 450;
        break;
      }
      case "aimed": {
        const x = 40 + this.rng() * (W - 80);
        this.fireShot("spike", x, aimFrom(x), speed);
        b.nextFire = t + 420;
        break;
      }
      case "icicle_sweep": {
        // Columns sweep across the screen one after another, leaving one gap
        const step = 64;
        const n = Math.ceil(W / step);
        const gap = Math.floor(this.rng() * n);
        for (let i = 0; i < n; i++) {
          if (i === gap || i === gap + 1) continue;
          const dir = b.phase % 2 === 0 ? i : n - 1 - i;
          this.strikes.push({ kind: "icicle", x: dir * step + step / 2, w: 26, warnUntil: t + 700 + i * 110, endAt: t + 700 + i * 110 });
        }
        b.phase++;
        b.nextFire = t + 2200;
        break;
      }
      case "lightning_rows": {
        const k = 4;
        const off = b.phase % 2 === 0 ? 0.25 : 0.75;
        for (let i = 0; i < k; i++) {
          const x = ((i + off) / k) * W;
          this.strikes.push({ kind: "lightning", x, w: 44, warnUntil: t + 900, endAt: t + 1150 });
        }
        b.phase++;
        b.nextFire = t + 1400;
        break;
      }
      case "cauli_volley": {
        const base = aimFrom(cx);
        for (const d of [-0.3, 0, 0.3]) this.fireShot("cauliflower", cx, base + d, speed * 0.55);
        this.events.sfx("carrot_shoot");
        b.nextFire = t + 1300;
        break;
      }
      case "meteor_shower": {
        this.spawnMeteor();
        b.nextFire = t + 320;
        break;
      }
    }
  }

  /** The boss is beaten (or survived): bonus, clear the field, next level (or the ending). */
  private finishBoss(defeated: boolean, t: number) {
    const b = this.boss!;
    b.done = true;
    const tier = tierIndexForLevel(this.level) + 1;
    const bonus = (defeated ? 1000 : 300) * tier;
    this.events.sfx(defeated ? "boss_defeat" : "level_up");
    this.addScore(bonus, this.W / 2, this.H * 0.45, true, defeated ? `${b.def.name} DEFEATED! +${bonus}` : `SURVIVED! +${bonus}`);
    for (const arr of [this.projectiles, this.obstacles]) for (const o of arr) if (HARMFUL.has(o.type)) o.active = false;
    this.strikes = [];
    this.flash = 300;
    if (defeated) for (let i = 0; i < 6; i++) this.explosions.push({ x: (this.W * (i + 0.5)) / 6, y: this.giantCarrot.y + 30, start: t + i * 80, dur: 500 });
    this.boss = null;
    this.levelUp();
  }

  private announceCombo(name: string) {
    const p = this.player;
    this.events.sfx("combo_power");
    this.pushPopup({ x: p.x + p.width / 2, y: p.y - 24, text: name, start: this.time, color: "#facc15", big: true });
  }

  /** Resize the bunny around its centre (Shrinking Violet). */
  private resizePlayer(size: number) {
    const p = this.player;
    const cx = p.x + p.width / 2;
    const cy = p.y + p.height / 2;
    p.width = size;
    p.height = size;
    p.x = cx - size / 2;
    p.y = cy - size / 2;
    this.clampPlayer();
  }

  /** Bunny Bomb: everything harmful on screen is destroyed. */
  private bunnyBomb(t: number) {
    let n = 0;
    for (const arr of [this.projectiles, this.obstacles]) {
      for (const o of arr) {
        if (!o.active || o.reflected || !HARMFUL.has(o.type)) continue;
        o.active = false;
        if (n < 12) this.explosions.push({ x: o.x + o.width / 2, y: o.y + o.height / 2, start: t, dur: 450 });
        n++;
      }
    }
    this.strikes = [];
    this.flash = 350;
    this.shake = 350;
    this.shakeStrength = 9;
    if (this.boss) this.damageBoss(10, t);
    if (n) this.addScore(5 * n, this.player.x + this.player.width / 2, this.player.y - 10, true, `BOOM! +${5 * n}`);
  }

  /** Slow-Mo: push back absolute timers so they also run at half speed. */
  private shiftWorldTimers(ms: number) {
    for (const st of this.strikes) {
      st.warnUntil += ms;
      st.endAt += ms;
    }
    for (const arr of [this.projectiles, this.obstacles]) for (const o of arr) if (o.born != null) o.born += ms;
    if (this.wind) {
      this.wind.start += ms;
      this.wind.end += ms;
    }
    if (Number.isFinite(this.nextGustAt)) this.nextGustAt += ms;
    if (this.boss) {
      this.boss.patStart += ms;
      this.boss.nextFire += ms;
    }
  }

  /** Double Trouble's ghost: the bunny mirrored across the playfield. */
  get ghost() {
    const p = this.player;
    return this.player.doubleTimer > 0 ? { x: this.W - p.x - p.width, y: p.y, width: p.width, height: p.height } : null;
  }

  /** Can be hurt right now (no Rapid Rabbit, no post-hit invincibility, not a demo). */
  get vulnerable() {
    const p = this.player;
    return !this.damageDisabled && p.speedBoostTimer <= 0 && !(p.invincible && p.invincibilityTimer > 0);
  }

  /** Take one hit. Returns true if it ended the game. */
  private damagePlayer(cause: string): boolean {
    const p = this.player;
    this.stats.deathCause = cause;
    this.events.sfx("hit_damage");
    p.stunned = 0.5;
    p.hitFlash = 0.18;
    this.comboChain = 0;
    this.shake = 260;
    this.shakeStrength = 7;
    this.giantCarrot.face = Math.floor(this.rng() * 6);
    this.burst(p.x + p.width / 2, p.y + p.height / 2, 14, ["#ffffff", "#93c5fd", "#fca5a5"], 220);
    const wasMax = this.lives >= MAX_HEARTS;
    this.lives -= 1;
    if (wasMax) {
      this.sparkleTrail.length = 0;
      this.setGolden(false);
    }
    if (this.lives <= 0) {
      this.lives = 0;
      this.gameOver();
      return true;
    }
    p.invincible = true;
    p.invincibilityTimer = 1.0;
    return false;
  }

  /**
   * Tier hazards that aren't plain falling balls: Brussels sprouts bursting, homing beets,
   * icicle and lightning columns, meteor radishes and snow gusts.
   */
  private updateTierHazards(dt: number, t: number, allowSpawns = true, rateScale = 1) {
    const p = this.player;
    const W = this.W;
    const vS = this.vScale;
    const fall = this.fallSpeed;
    const chance = (rate: number) => allowSpawns && rate > 0 && this.rng() < 1 - Math.exp(-rate * rateScale * dt);

    // Brussels sprouts burst into three small sprouts shortly after leaving the carrot
    for (const o of this.projectiles) {
      if (!o.active || o.type !== "sprout" || o.born == null || t - o.born < 550) continue;
      o.active = false;
      const cx = o.x + o.width / 2;
      const cy = o.y + o.height / 2;
      const base = Math.atan2(o.vy, o.vx);
      const v = Math.hypot(o.vx, o.vy);
      for (const da of [-0.4, 0, 0.4]) {
        this.projectiles.push({ x: cx - 8, y: cy - 8, width: 16, height: 16, type: "sprout_small", vx: Math.cos(base + da) * v, vy: Math.sin(base + da) * v, active: true, angle: 0 });
      }
      this.burst(cx, cy, 6, ["#4ade80", "#16a34a"], 120);
      this.events.sfx("sprout_pop");
    }

    // Homing beets steer toward the bunny (limited turn rate) and fizzle out after 8 s
    for (const o of this.obstacles) {
      if (!o.active || o.type !== "beet") continue;
      if (o.born != null && t - o.born > 8000) {
        o.active = false;
        this.burst(o.x + o.width / 2, o.y + o.height / 2, 8, ["#9d174d", "#be185d"], 100);
        continue;
      }
      if (o.y < 0) continue; // still entering
      const want = Math.atan2(p.y + p.height / 2 - (o.y + o.height / 2), p.x + p.width / 2 - (o.x + o.width / 2));
      const cur = Math.atan2(o.vy, o.vx);
      let d = want - cur;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      const turn = Math.max(-1.6 * dt, Math.min(1.6 * dt, d));
      const v = 140 * vS;
      o.vx = Math.cos(cur + turn) * v;
      o.vy = Math.sin(cur + turn) * v;
    }

    // Column hazards: a warning stripe first, then an icicle drops / lightning strikes
    if (chance(hazardRate(this.level, (r) => r.icicleRate))) {
      this.strikes.push({ kind: "icicle", x: 20 + this.rng() * (W - 40), w: 26, warnUntil: t + 900, endAt: t + 900 });
    }
    if (chance(hazardRate(this.level, (r) => r.lightningRate))) {
      this.strikes.push({ kind: "lightning", x: 30 + this.rng() * (W - 60), w: 38, warnUntil: t + 1000, endAt: t + 1250 });
    }
    let j = 0;
    for (const st of this.strikes) {
      if (st.kind === "icicle" && t >= st.warnUntil) {
        this.obstacles.push({ x: st.x - 9, y: -50, width: 18, height: 46, type: "icicle", vx: 0, vy: 720 * vS, active: true });
        this.events.sfx("icicle");
        continue;
      }
      if (st.kind === "lightning" && t >= st.warnUntil && t - dt * 1000 < st.warnUntil) {
        this.events.sfx("lightning");
        this.shake = Math.max(this.shake, 120);
        this.shakeStrength = Math.max(this.shakeStrength, 4);
      }
      if (t > st.endAt + (st.kind === "lightning" ? 250 : 0)) continue; // lightning glow lingers (no damage)
      this.strikes[j++] = st;
    }
    this.strikes.length = j;

    // Meteor radishes streak in diagonally from a top corner (entering off-screen first, so the
    // edge warning marker shows before they arrive)
    if (chance(hazardRate(this.level, (r) => r.meteorRate))) {
      const fromLeft = this.rng() < 0.5;
      const ang = Math.PI / 2 + (fromLeft ? -1 : 1) * (0.45 + this.rng() * 0.25);
      const v = 520 * vS;
      const x = fromLeft ? this.rng() * W * 0.4 : W * 0.6 + this.rng() * W * 0.4;
      const lead = 0.5; // seconds above the screen
      this.obstacles.push({ x: x - 15 - Math.cos(ang) * v * lead, y: -30 - Math.sin(ang) * v * lead, width: 30, height: 30, type: "meteor", vx: Math.cos(ang) * v, vy: Math.sin(ang) * v, active: true, angle: ang });
    }
    if (chance(hazardRate(this.level, (r) => r.beetRate))) {
      this.obstacles.push({ x: 20 + this.rng() * (W - 60), y: -40 - fall * BALL_TELEGRAPH_S, width: 30, height: 30, type: "beet", vx: 0, vy: fall, active: true, born: t });
    }

    // Snow gusts: a warning, then ~3 s of sideways wind that pushes the bunny and everything falling
    if (t >= this.nextGustAt) {
      const gust = tierForLevel(this.level).rates.gustEvery;
      const dir = this.rng() < 0.5 ? -1 : 1;
      this.wind = { dir, warnAt: t, start: t + 700, end: t + 3500, strength: 110 * vS };
      this.events.sfx("wind");
      this.nextGustAt = gust ? t + lerpRange(gust, tierProgress(this.level)) * 1000 * (0.75 + this.rng() * 0.5) : Infinity;
    }
    if (this.wind && t > this.wind.end) this.wind = null;
    if (this.wind && t >= this.wind.start) {
      const push = this.wind.dir * this.wind.strength;
      p.x += push * dt;
      this.clampPlayer();
      const drift = (o: Entity) => {
        if (o.type === "icicle" || o.type === "meteor" || o.type === "beet" || o.type === "player_laser") return;
        o.vx += (push * 0.8 - o.vx) * Math.min(1, 1.5 * dt);
      };
      for (const o of this.obstacles) if (o.active) drift(o);
      for (const o of this.collectibles) if (o.active) drift(o);
    }
  }

  private maxHeartsBlast(t: number) {
    const p = this.player;
    this.maxHeartsBlastStart = t;
    this.setGolden(true);
    if (!this.maxHeartsBonusAwarded) {
      this.maxHeartsBonusAwarded = true;
      this.addScore(500, p.x + p.width / 2, p.y - 10, true);
    }
    p.invincible = true;
    p.invincibilityTimer = 3.0;
    const px = p.x + p.width / 2;
    const py = p.y + p.height / 2;
    const R = 500;
    for (const proj of this.projectiles) {
      if (!proj.active || proj.type === "player_laser") continue;
      if (Math.hypot(proj.x + proj.width / 2 - px, proj.y + proj.height / 2 - py) < R) proj.active = false;
    }
    this.strikes = this.strikes.filter((st) => Math.abs(st.x - px) >= R);
    for (const ball of this.obstacles) {
      if (!ball.active || !HARMFUL.has(ball.type)) continue;
      const bx = ball.x + ball.width / 2;
      const by = ball.y + ball.height / 2;
      if (Math.hypot(bx - px, by - py) < R) {
        ball.active = false;
        this.explode(bx, by, t);
        this.addScore(5, bx, by);
      }
    }
    this.burst(px, py, 40, ["#fffde7", "#ffd700", "#ffecb3", "#ffffff"], 420);
  }

  /** Spawn a collectible at the top; announces items the device hasn't seen before. */
  private spawnCollectible(type: CollectibleType) {
    const size = type === "carrot" ? 40 : 30;
    this.collectibles.push({
      x: this.rng() * (this.W - (type === "carrot" ? 50 : 40)),
      y: -50,
      width: size,
      height: size,
      type,
      vx: 0,
      vy: this.fallSpeed,
      active: true,
      ...(type !== "carrot_rotten" && type.startsWith("carrot") && { face: Math.floor(this.rng() * 6) }),
      ...(type === "carrot_rotten" && { face: 1 }),
    });
    const item = introForEntity(type);
    if (item && !this.seenItems.has(item.id)) {
      this.seenItems.add(item.id);
      this.events.discovered?.(item.id);
      this.events.announce?.({ kind: "new", title: item.name, body: item.blurb });
    }
  }

  private explode(x: number, y: number, t: number) {
    this.events.sfx("ball_explode");
    this.explosions.push({ x, y, start: t, dur: 400 });
    this.burst(x, y, 12, ["#fb923c", "#f97316", "#fde68a", "#6b7280"], 260);
  }

  private levelUp() {
    this.stats.levelTimes.push((this.time - this.stats.levelStart) / 1000);
    this.stats.levelStart = this.time;
    if (this.level >= FINAL_LEVEL) {
      this.stopAllLoops();
      this.level = FINAL_LEVEL;
      this.carrots = 0;
      this.emitHud(true);
      this.setPhase("ending");
      return;
    }
    this.events.sfx("level_up");
    this.level += 1;
    this.carrots = 0;
    this.beginLevel(this.time);
    this.giantCarrot.face = Math.floor(this.rng() * 6);
    // In-canvas celebration (replaces the full-page DOM confetti)
    const colors = ["#f97316", "#22c55e", "#3b82f6", "#eab308", "#ec4899", "#ffffff"];
    for (let i = 0; i < 70; i++) {
      const a = -Math.PI / 2 + (this.rng() - 0.5) * 1.6;
      const sp = 300 + this.rng() * 450;
      this.particles.push({ x: this.W / 2 + (this.rng() - 0.5) * 80, y: this.H * 0.6, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0, max: 1.2 + this.rng() * 0.6, size: 3 + this.rng() * 3, color: colors[i % colors.length], gravity: 700 });
    }
    this.pushPopup({ x: this.W / 2, y: this.H * 0.35, text: `LEVEL ${this.level}!`, start: this.time, color: "#f97316", big: true });
  }

  private gameOver() {
    this.events.sfx("death");
    this.stopAllLoops();
    this.setPhase("over");
  }

  private addScore(n: number, x: number, y: number, big = false, label?: string) {
    this.score += n;
    this.pushPopup({ x, y, text: label ?? `+${n}`, start: this.time, color: big ? "#facc15" : "#ffffff", big });
  }

  /** At most 24 popups on screen; the oldest is dropped first. */
  private pushPopup(p: Popup) {
    this.popups.push(p);
    if (this.popups.length > 24) this.popups.splice(0, this.popups.length - 24);
  }

  private burst(x: number, y: number, n: number, colors: string[], speed: number) {
    for (let i = 0; i < n; i++) {
      const a = this.rng() * Math.PI * 2;
      const sp = speed * (0.35 + this.rng() * 0.65);
      this.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0, max: 0.35 + this.rng() * 0.35, size: 2 + this.rng() * 2.5, color: colors[i % colors.length], gravity: 0 });
    }
    if (this.particles.length > 400) this.particles.splice(0, this.particles.length - 400);
  }

  private updateEffects(dt: number) {
    let j = 0;
    for (const pt of this.particles) {
      pt.life += dt;
      if (pt.life >= pt.max) continue;
      pt.vy += pt.gravity * dt;
      const drag = Math.pow(0.08, dt);
      pt.vx *= drag;
      pt.vy *= pt.gravity ? 1 : drag;
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      this.particles[j++] = pt;
    }
    this.particles.length = j;
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 1000);
    j = 0;
    for (const pp of this.popups) if (this.time - pp.start < (pp.big ? 1400 : 800)) this.popups[j++] = pp;
    this.popups.length = j;
  }

  // ---------------------------------------------------------------------------
  // Events
  // ---------------------------------------------------------------------------

  private setPhase(p: Phase) {
    if (this.phase === p) return;
    this.phase = p;
    this.events.phase(p);
  }

  private setLoop(id: "rapid_rabbit_loop" | "attract_loop", on: boolean) {
    const cur = id === "rapid_rabbit_loop" ? this.rapidOn : this.attractOn;
    if (cur === on) return;
    if (id === "rapid_rabbit_loop") this.rapidOn = on;
    else this.attractOn = on;
    this.events.ambient(id, on);
  }

  private setGolden(on: boolean) {
    if (this.goldenOn === on) return;
    this.goldenOn = on;
    this.events.goldenBunny(on);
  }

  private stopAllLoops() {
    this.setLoop("rapid_rabbit_loop", false);
    this.setLoop("attract_loop", false);
    this.setGolden(false);
  }

  private emitHud(force = false) {
    const h = this.lastHud;
    const combo = this.comboMult;
    const chain = combo > 1 ? this.comboChain : 0;
    const boss = !!this.boss;
    if (!force && h.score === this.score && h.level === this.level && h.carrots === this.carrots && h.lives === this.lives && h.combo === combo && h.comboChain === chain && h.boss === boss) return;
    this.lastHud = { score: this.score, level: this.level, carrots: this.carrots, lives: this.lives, combo, comboChain: chain, boss };
    this.events.hud({ ...this.lastHud });
  }

  get countdownElapsed() {
    return this.phase === "countdown" ? this.time - this.countdownStart : COUNTDOWN_MS;
  }
}

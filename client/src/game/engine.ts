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
  | "carrot"
  | "carrot_golden"
  | "carrot_rotten"
  | "powerup_invincible"
  | "powerup_speed"
  | "powerup_heart"
  | "powerup_blaster"
  | "powerup_attract"
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
};

export type Phase = "idle" | "countdown" | "playing" | "over" | "ending";

/** combo = current multiplier (1 = none); comboChain changes on every combo pickup (restarts the HUD timer). */
export type HudState = { score: number; level: number; carrots: number; lives: number; combo: number; comboChain: number };

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
  private lastHud: HudState = { score: -1, level: -1, carrots: -1, lives: -1, combo: -1, comboChain: -1 };

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
    this.W = w;
    this.H = h;
    this.giantCarrot.width = w;
    if (this.phase === "playing") this.giantCarrot.y = this.carrotRestY;
    this.dragTarget = null;
    this.clampPlayer();
  }

  start(initialLevel = 1, seed = randomSeed()) {
    this.seed = seed >>> 0;
    this.rng = mulberry32(this.seed);
    this.player = newPlayer(this.W, this.H);
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
    this.pendingUnlocks = itemsUnlockingAt(this.level);
    this.nextUnlockSpawn = startTime + 3000;
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
    this.level = Math.max(1, Math.min(FINAL_LEVEL - 1, Math.floor(n)));
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

  /** Every harmful thing currently in play (for near-miss checks and the simulation bots). */
  forEachThreat(cb: (t: Threat) => void) {
    for (const o of this.projectiles) {
      if (o.active && o.type === "spike") cb({ x: o.x + o.width / 2, y: o.y + o.height / 2, vx: o.vx, vy: o.vy, r: o.width / 2 });
    }
    for (const o of this.obstacles) {
      if (o.active && o.type === "ball") cb({ x: o.x + o.width / 2, y: o.y + o.height / 2, vx: o.vx, vy: o.vy, r: o.width / 2 });
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
        p.speed = BASE_SPEED;
        this.setLoop("rapid_rabbit_loop", false);
      }
    } else {
      p.speed = BASE_SPEED;
    }
    if (p.blasterTimer > 0) p.blasterTimer = Math.max(0, p.blasterTimer - dt);
    if (p.attractTimer > 0) p.attractTimer = Math.max(0, p.attractTimer - dt);
    if (p.attractTimer <= 0) this.setLoop("attract_loop", false);
    if (p.invincible) {
      p.invincibilityTimer -= dt;
      if (p.invincibilityTimer <= 0) p.invincible = false;
    }
    if (p.hitFlash > 0) p.hitFlash = Math.max(0, p.hitFlash - dt);
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
      gc.nextShot -= dt;
      if (gc.nextShot <= 0) {
        const margin = 40;
        const sourceX = gc.x + margin + this.rng() * (gc.width - 2 * margin);
        const angle = Math.atan2(p.y - gc.y, p.x - sourceX);
        const speed = difficulty(this.level).shotSpeed * this.vScale;
        this.projectiles.push({ x: sourceX, y: gc.y, width: 40, height: 40, type: "spike", vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, active: true, angle: 0 });
        this.events.sfx("carrot_shoot");
        gc.nextShot = difficulty(this.level).shotInterval;
      }
    }

    if (!isCountdown) this.updatePlaying(dt, t);
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

  private updatePlaying(dt: number, t: number) {
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
        this.projectiles.push({ x: cx + sign * 14 - LASER_W / 2, y: cy - LASER_H / 2, width: LASER_W, height: LASER_H, type: "player_laser", vx: 0, vy: -1050 * vS, active: true });
      }
      this.events.sfx("blaster_shoot");
    }

    const diff = difficulty(this.level);

    // Spiky balls
    if (this.rng() < perStep(diff.ballChance, dt, this.widthScale)) {
      this.obstacles.push({ x: this.rng() * (W - 40), y: -40 - fall * BALL_TELEGRAPH_S, width: 40, height: 40, type: "ball", vx: 0, vy: fall, active: true });
    }

    // Guaranteed first spawn of anything that unlocks on this level
    if (this.pendingUnlocks.length && t >= this.nextUnlockSpawn) {
      this.spawnCollectible(this.pendingUnlocks.shift()!);
      this.nextUnlockSpawn = t + 3000;
    }

    // Collectibles
    if (this.collectibles.length < diff.collectibleCap && this.rng() < perStep(0.02, dt, this.widthScale)) {
      this.spawnCollectible(pickCollectible(this.level, this.rng));
    }

    // Move entities
    const moveAll = (arr: Entity[]) => {
      for (const o of arr) {
        o.x += o.vx * dt;
        o.y += o.vy * dt;
        if (o.type === "spike" && o.angle !== undefined) o.angle += dt * 12;
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
      if (!a.active || a.type !== "ball") continue;
      for (let j = i + 1; j < obs.length; j++) {
        const b = obs[j];
        if (!b.active || b.type !== "ball") continue;
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
    for (const proj of this.projectiles) {
      if (!proj.active || proj.type !== "player_laser") continue;
      for (const ball of obs) {
        if (!ball.active || ball.type !== "ball" || !overlaps(proj, ball)) continue;
        proj.active = false;
        ball.active = false;
        const ex = ball.x + ball.width / 2;
        const ey = ball.y + ball.height / 2;
        this.explode(ex, ey, t);
        this.addScore(5, ex, ey);
        if (this.rng() < 0.1) {
          this.collectibles.push({ x: ball.x, y: ball.y, width: 30, height: 30, type: "powerup_heart", vx: 0, vy: fall, active: true });
        }
        for (const other of obs) {
          if (!other.active || other.type !== "ball" || other === ball) continue;
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

    // Expire explosions in place
    let j = 0;
    for (const e of this.explosions) if (t - e.start < e.dur) this.explosions[j++] = e;
    this.explosions.length = j;

    // Hazards vs player
    const hazard = (o: Entity) => {
      if (!o.active || (o.type !== "spike" && o.type !== "ball") || !overlaps(p, o)) return false;
      if (p.shieldTimer > 0) {
        if (t - this.lastDeflect >= 500) {
          this.lastDeflect = t;
          this.events.sfx("shield_deflect");
        }
        if (o.type === "ball") this.addScore(5, o.x + o.width / 2, o.y);
        const dx = o.x + o.width / 2 - (p.x + p.width / 2);
        const dy = o.y + o.height / 2 - (p.y + p.height / 2);
        const len = Math.hypot(dx, dy) || 1;
        const speed = Math.hypot(o.vx, o.vy);
        o.vx = (dx / len) * speed;
        o.vy = (dy / len) * speed;
        return false;
      }
      if (this.damageDisabled || p.speedBoostTimer > 0 || (p.invincible && p.invincibilityTimer > 0)) return false;
      o.active = false;
      this.stats.deathCause = o.type;
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
    };
    for (const o of this.projectiles) if (hazard(o)) return;
    for (const o of obs) if (hazard(o)) return;

    // Near miss: a hazard came within a few px while you were vulnerable, then moved away
    if (mechanicUnlocked("near_miss", this.level)) {
      const vulnerable = !this.damageDisabled && p.shieldTimer <= 0 && p.speedBoostTimer <= 0 && !(p.invincible && p.invincibilityTimer > 0);
      const check = (o: Entity) => {
        if (!o.active || (o.type !== "spike" && o.type !== "ball") || o.near === 2) return;
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

    // Collectibles vs player
    for (const o of this.collectibles) {
      if (!o.active || !overlaps(p, o)) continue;
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
          p.speed = BASE_SPEED * 1.5;
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

    compact(this.projectiles);
    compact(this.obstacles);
    compact(this.collectibles);
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
    for (const ball of this.obstacles) {
      if (!ball.active || ball.type !== "ball") continue;
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
    if (this.level >= FINAL_LEVEL - 1) {
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
    if (!force && h.score === this.score && h.level === this.level && h.carrots === this.carrots && h.lives === this.lives && h.combo === combo && h.comboChain === chain) return;
    this.lastHud = { score: this.score, level: this.level, carrots: this.carrots, lives: this.lives, combo, comboChain: chain };
    this.events.hud({ ...this.lastHud });
  }

  get countdownElapsed() {
    return this.phase === "countdown" ? this.time - this.countdownStart : COUNTDOWN_MS;
  }
}

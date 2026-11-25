/**
 * Draws a GameEngine frame. World coordinates throughout; the caller sets the
 * world→backing-store transform (HiDPI) before calling.
 */
import { BackgroundScroller } from "@/lib/BackgroundScroller";
import { HazeLayer } from "@/lib/HazeLayer";
import { drawEarthBackground } from "@/lib/drawEarthBackground";
import { SpriteCache, blit, drawCarrotFace, drawRabbit, type PowerupType } from "./art";
import { ATTRACT_FADE_THRESHOLD, COUNTDOWN_MS, type GameEngine } from "./engine";

const RIPPLE_PERIOD_MS = 900;
const RIPPLE_MAX_RADIUS_FACTOR = 1.5;
const MAX_HEARTS_BLAST_MS = 1200;

/** 0 = full, 1 = medium (lower DPR), 2 = low (no shimmer, fewer sparkles). */
export type Quality = 0 | 1 | 2;

export class Renderer {
  sprites: SpriteCache;
  scroller: BackgroundScroller | null = null;
  haze: HazeLayer;
  private carrotBody: { canvas: HTMLCanvasElement; w: number; scale: number } | null = null;
  private W: number;
  private H: number;

  constructor(scale: number, w: number, h: number) {
    this.sprites = new SpriteCache(scale);
    this.haze = new HazeLayer(w, h);
    this.W = w;
    this.H = h;
  }

  setScale(scale: number) {
    if (Math.abs(scale - this.sprites.scale) < 0.01) return;
    this.sprites.dispose();
    this.sprites = new SpriteCache(scale);
    this.carrotBody = null;
  }

  setWorldSize(w: number, h: number) {
    if (w === this.W && h === this.H) return;
    this.W = w;
    this.H = h;
    this.haze.resize(w, h);
    this.scroller?.resize(w, h);
    this.carrotBody = null;
  }

  setScroller(s: BackgroundScroller) {
    s.resize(this.W, this.H);
    this.scroller = s;
  }

  /** Background, haze and water shimmer. `dtS` drives scrolling (real time; pass 0 to freeze). */
  renderBackground(ctx: CanvasRenderingContext2D, dtS: number, timeMs: number, quality: Quality) {
    const s = this.scroller;
    if (s) {
      s.update(dtS);
      s.render(ctx);
    } else {
      drawEarthBackground(ctx, this.W, this.H, timeMs);
    }
    this.haze.render(ctx, timeMs / 1000);
    if (s && quality < 2) s.renderWaterShimmer(ctx);
  }

  private getCarrotBody(scale: number) {
    const w = this.W + 40;
    if (this.carrotBody && this.carrotBody.w === w && this.carrotBody.scale === scale) return this.carrotBody.canvas;
    const c = document.createElement("canvas");
    c.width = Math.ceil(w * scale);
    c.height = Math.ceil(120 * scale);
    const g = c.getContext("2d");
    if (g) {
      g.scale(scale, scale);
      const grad = g.createLinearGradient(0, 0, 0, 120);
      grad.addColorStop(0, "#EA580C");
      grad.addColorStop(0.5, "#F97316");
      grad.addColorStop(1, "#EA580C");
      g.fillStyle = grad;
      g.beginPath();
      g.roundRect(0, 0, w, 120, 20);
      g.fill();
      // Soft top highlight + bottom shade for a rounder log
      const shade = g.createLinearGradient(0, 0, 0, 120);
      shade.addColorStop(0, "rgba(255,255,255,0.18)");
      shade.addColorStop(0.25, "rgba(255,255,255,0)");
      shade.addColorStop(0.8, "rgba(0,0,0,0)");
      shade.addColorStop(1, "rgba(0,0,0,0.18)");
      g.fillStyle = shade;
      g.fill();
    }
    this.carrotBody = { canvas: c, w, scale };
    return c;
  }

  renderGame(ctx: CanvasRenderingContext2D, e: GameEngine, quality: Quality) {
    const W = e.W;
    const time = e.time;
    const S = this.sprites;
    const p = e.player;

    // --- Giant carrot (cached body; ridges without shadowBlur) ---
    ctx.save();
    ctx.translate(W / 2, e.giantCarrot.y + 60);
    ctx.drawImage(this.getCarrotBody(S.scale), -W / 2 - 20, -60, W + 40, 120);
    const rollOffset = (60 - ((time / 5) % 60)) % 60;
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(-W / 2 - 20, -60, W + 40, 120, 20);
    ctx.clip();
    for (let i = -120; i < 120; i += 60) {
      const y = i + rollOffset - 60;
      if (y <= -66 || y >= 66) continue;
      ctx.strokeStyle = "rgba(0,0,0,0.05)";
      ctx.lineWidth = 18;
      ctx.beginPath();
      ctx.moveTo(-W / 2 - 20, y);
      ctx.lineTo(W / 2 + 20, y);
      ctx.stroke();
      ctx.strokeStyle = "rgba(0,0,0,0.08)";
      ctx.lineWidth = 8;
      ctx.stroke();
    }
    ctx.restore();
    drawCarrotFace(ctx, e.giantCarrot.face ?? 0, 0, 0, 58);
    ctx.restore();

    // --- Collectibles ---
    for (const o of e.collectibles) {
      const cx = o.x + o.width / 2;
      const cy = o.y + o.height / 2;
      if (o.type === "carrot") {
        const spr = S.carrots[o.face ?? 0];
        if (spr) blit(ctx, spr, cx, cy, o.width / 40);
        else {
          ctx.fillStyle = "#F97316";
          ctx.beginPath();
          ctx.arc(cx, cy, o.width / 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        const spr = S.powerups[o.type as PowerupType];
        if (spr) blit(ctx, spr, cx, cy, o.width / 30);
      }
    }

    // --- Projectiles ---
    for (const o of e.projectiles) {
      const cx = o.x + o.width / 2;
      const cy = o.y + o.height / 2;
      if (o.type === "player_laser") {
        const h = o.height;
        ctx.lineCap = "round";
        ctx.strokeStyle = "rgba(103, 232, 249, 0.35)";
        ctx.lineWidth = 7;
        ctx.beginPath();
        ctx.moveTo(cx, cy - h / 2);
        ctx.lineTo(cx, cy + h / 2);
        ctx.stroke();
        ctx.strokeStyle = "rgba(236, 254, 255, 1)";
        ctx.lineWidth = 2;
        ctx.stroke();
        continue;
      }
      const spr = S.broccoli;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(o.angle ?? 0);
      if (spr) blit(ctx, spr, 0, 0, o.width / 40);
      else {
        ctx.fillStyle = "#22c55e";
        ctx.beginPath();
        ctx.arc(0, 0, o.width / 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // --- Spiky balls (+ entry warning while still above the screen) ---
    const fall = e.fallSpeed;
    for (const o of e.obstacles) {
      const cx = o.x + o.width / 2;
      const cy = o.y + o.height / 2;
      if (o.type === "ball" && o.y + o.height < 0 && o.vy > 0) {
        const secondsAway = -(o.y + o.height) / fall;
        const a = Math.max(0, Math.min(1, 1 - secondsAway / 0.7));
        const pulse = 0.75 + 0.25 * Math.sin(time / 60);
        ctx.fillStyle = `rgba(220, 38, 38, ${0.55 * a * pulse})`;
        ctx.beginPath();
        ctx.moveTo(cx - 9, 3);
        ctx.lineTo(cx + 9, 3);
        ctx.lineTo(cx, 15);
        ctx.closePath();
        ctx.fill();
        continue;
      }
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(time / 200);
      if (S.ball) blit(ctx, S.ball, 0, 0, o.width / 40);
      else {
        ctx.fillStyle = "#1F2937";
        ctx.beginPath();
        ctx.arc(0, 0, o.width / 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // --- Explosions (one cached radial sprite, scaled + faded) ---
    for (const ex of e.explosions) {
      const k = (time - ex.start) / ex.dur;
      if (k >= 1) continue;
      const radius = 15 + k * 45;
      ctx.globalAlpha = 1 - k;
      blit(ctx, S.explosion, ex.x, ex.y, radius / 60);
    }
    ctx.globalAlpha = 1;

    // --- Particles ---
    for (const pt of e.particles) {
      const k = pt.life / pt.max;
      ctx.globalAlpha = 1 - k * k;
      ctx.fillStyle = pt.color;
      const sz = pt.size * (1 - k * 0.5);
      ctx.fillRect(pt.x - sz / 2, pt.y - sz / 2, sz, sz);
    }
    ctx.globalAlpha = 1;

    // --- Player ---
    const pw = p.width;
    const ph = p.height;
    const cx = p.x + pw / 2;
    const cy = p.y + ph / 2;

    if (e.maxHeartsBlastStart != null) {
      const elapsed = time - e.maxHeartsBlastStart;
      if (elapsed >= MAX_HEARTS_BLAST_MS) e.maxHeartsBlastStart = null;
      else this.drawMaxHeartsBlast(ctx, cx, cy, elapsed);
    }

    const invincibleFromHit = p.invincible && p.invincibilityTimer > 0;
    const hasShield = p.shieldTimer > 0;
    const isMax = e.lives === 10;

    if (isMax) {
      const last = e.sparkleTrail[e.sparkleTrail.length - 1];
      if (!last || time - last.start > (quality === 2 ? 80 : 40)) e.sparkleTrail.push({ x: cx, y: cy, start: time });
      let j = 0;
      for (const sp of e.sparkleTrail) if (time - sp.start < 1400) e.sparkleTrail[j++] = sp;
      e.sparkleTrail.length = j;
    }
    e.sparkleTrail.forEach((sp, i) => {
      const age = time - sp.start;
      const life = 1 - age / 1400;
      if (life <= 0) return;
      const twinkle = 0.6 + 0.4 * Math.sin(age / 80 + i * 2.1);
      ctx.save();
      ctx.translate(sp.x, sp.y);
      ctx.rotate((age / 60 + i * 0.5) % (Math.PI * 2));
      drawGlitter(ctx, 2.5 + (1 - life) * 1.5, 0.4, life * twinkle * 0.95, life * twinkle * 0.8, 0.8);
      ctx.restore();
    });

    if (invincibleFromHit && p.invincibilityTimer <= 1.5) ctx.globalAlpha = 0.5 + Math.sin(time / 50) * 0.5;

    if (isMax && !hasShield) {
      const pulse = 1 + Math.sin(time / 90) * 0.12;
      const breath = 1 + Math.sin(time / 180) * 0.08;
      blit(ctx, S.aura, cx, cy, pulse * (0.94 + breath * 0.06));
    }

    const shieldFlicker = hasShield && p.shieldTimer < 1.5;
    if (hasShield && (!shieldFlicker || Math.floor(time / 80) % 2 === 0)) {
      const prevA = ctx.globalAlpha;
      if (shieldFlicker) ctx.globalAlpha = prevA * (0.5 + Math.sin(time / 70) * 0.5);
      const bubblePulse = 1 + Math.sin(time / 120) * 0.04;
      blit(ctx, S.shield, cx, cy, 0.92 * bubblePulse);
      ctx.globalAlpha = prevA;
    }

    const isAttract = p.attractTimer > 0;
    if (isAttract) {
      const a = p.attractTimer < ATTRACT_FADE_THRESHOLD ? (p.attractTimer / ATTRACT_FADE_THRESHOLD) * 0.35 : 0.35;
      ctx.strokeStyle = `rgba(220, 38, 38, ${a})`;
      ctx.lineWidth = 2;
      const Rmax = Math.max(pw, ph) * RIPPLE_MAX_RADIUS_FACTOR;
      for (let ring = 0; ring < 5; ring++) {
        const phase = (time + (ring * RIPPLE_PERIOD_MS) / 5) % RIPPLE_PERIOD_MS;
        const r = Rmax * (1 - phase / RIPPLE_PERIOD_MS);
        if (r <= 0) continue;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    const speedFlicker = p.speedBoostTimer > 0 && p.speedBoostTimer < 1.5;
    const isSpeed = p.speedBoostTimer > 0 && (!speedFlicker || Math.floor(time / 80) % 2 === 0);
    // Alpha handling as in the original: the speed-expiry flicker replaces the hit blink, and the
    // attract-expiry fade applies to the shadow and body only (not the sparkle overlays).
    let overlayAlpha = ctx.globalAlpha;
    if (isSpeed && speedFlicker) overlayAlpha = 0.5 + Math.sin(time / 70) * 0.5;
    ctx.globalAlpha = isAttract && p.attractTimer < ATTRACT_FADE_THRESHOLD ? p.attractTimer / ATTRACT_FADE_THRESHOLD : overlayAlpha;

    blit(ctx, S.shadow, cx, cy);
    if (isSpeed) {
      drawRabbit(ctx, cx, cy, pw, ph, "speed", time);
    } else {
      const spr = S.rabbits[isMax ? "gold" : isAttract ? "attract" : "normal"];
      if (spr) blit(ctx, spr, cx, cy);
    }
    ctx.globalAlpha = overlayAlpha;

    if (isSpeed) {
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(cx, cy, pw * 0.5, ph * 0.5, 0, 0, Math.PI * 2);
      ctx.clip();
      const n = quality === 2 ? 18 : 36;
      for (let i = 0; i < n; i++) {
        const sx = cx + (Math.sin(i * 1.7 + time / 200) * 0.4 + Math.cos(i * 2.3) * 0.35) * pw;
        const sy = cy + (Math.cos(i * 1.4 + time / 180) * 0.35 + Math.sin(i * 2.1) * 0.4) * ph;
        const hue = (time / 10 + i * 25) % 360;
        ctx.fillStyle = `hsla(${hue}, 100%, 90%, ${0.4 + Math.sin(time / 50 + i * 1.5) * 0.35})`;
        ctx.beginPath();
        ctx.arc(sx, sy, 1.5 + Math.sin(time / 60 + i) * 0.8, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    } else if (isMax) {
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(cx, cy, pw * 0.52, ph * 0.52, 0, 0, Math.PI * 2);
      ctx.clip();
      const n = quality === 2 ? 16 : 32;
      for (let i = 0; i < n; i++) {
        const sx = cx + (Math.sin(i * 1.7 + time / 200) * 0.38 + Math.cos(i * 2.3) * 0.32) * pw;
        const sy = cy + (Math.cos(i * 1.4 + time / 170) * 0.32 + Math.sin(i * 2.1) * 0.38) * ph;
        const twinkle = 0.5 + 0.5 * Math.sin(time / 45 + i * 1.3);
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate((time / 120 + i * 0.4) % (Math.PI * 2));
        drawGlitter(ctx, 1.8 + Math.sin(time / 60 + i * 0.8) * 0.8, 0.35, 0.4 * twinkle, 0.7 * twinkle, 0.6);
        ctx.restore();
      }
      ctx.restore();
    }

    // Brief white flash when hit
    if (p.hitFlash > 0) {
      ctx.globalAlpha = Math.min(1, p.hitFlash / 0.18) * 0.75;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.ellipse(cx, cy, pw * 0.46, ph * 0.44, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // --- Score popups ---
    if (e.popups.length) {
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.lineJoin = "round";
      for (const pp of e.popups) {
        const dur = pp.big ? 1400 : 800;
        const k = (time - pp.start) / dur;
        if (k < 0 || k >= 1) continue;
        const pop = Math.min(1, k * 8);
        const size = (pp.big ? 44 : 20) * (0.6 + 0.4 * pop);
        ctx.globalAlpha = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
        ctx.font = `${Math.round(size)}px Bangers, system-ui, sans-serif`;
        const y = pp.y - k * (pp.big ? 30 : 36);
        ctx.lineWidth = pp.big ? 6 : 4;
        ctx.strokeStyle = "rgba(0,0,0,0.75)";
        ctx.strokeText(pp.text, pp.x, y);
        ctx.fillStyle = pp.color;
        ctx.fillText(pp.text, pp.x, y);
      }
      ctx.globalAlpha = 1;
    }

    // --- Ready / Set / Go ---
    if (e.phase === "countdown") {
      const elapsed = e.countdownElapsed;
      if (elapsed < COUNTDOWN_MS) {
        const wordDur = COUNTDOWN_MS / 3;
        const phase = Math.floor(elapsed / wordDur);
        const phaseElapsed = elapsed - phase * wordDur;
        const word = ["Ready", "Set", "Go!"][Math.min(phase, 2)];
        const popIn = Math.min(1, phaseElapsed / 120);
        const sc = 0.3 + 0.7 * (1 - (1 - popIn) * (1 - popIn));
        const alpha = Math.min(1, phaseElapsed / 80) * (phaseElapsed < wordDur - 200 ? 1 : Math.max(0, (wordDur - phaseElapsed) / 200));
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "#1a1a1a";
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 6;
        ctx.lineJoin = "round";
        ctx.font = `${Math.round(88 * sc)}px Bangers, system-ui, sans-serif`;
        ctx.strokeText(word, W / 2, e.H / 2 - 40);
        ctx.fillText(word, W / 2, e.H / 2 - 40);
        ctx.restore();
      }
    }
  }

  private drawMaxHeartsBlast(ctx: CanvasRenderingContext2D, cx: number, cy: number, elapsed: number) {
    const t = elapsed / MAX_HEARTS_BLAST_MS;
    ctx.save();
    ctx.translate(cx, cy);
    const coreRadius = 20 + t * 280;
    const coreAlpha = t < 0.15 ? t / 0.15 : (1 - (t - 0.15) / 0.85) * 0.98;
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, coreRadius);
    g.addColorStop(0, `rgba(255, 255, 255, ${coreAlpha})`);
    g.addColorStop(0.15, `rgba(255, 255, 230, ${coreAlpha * 0.85})`);
    g.addColorStop(0.4, `rgba(255, 236, 120, ${coreAlpha * 0.4})`);
    g.addColorStop(0.7, `rgba(255, 200, 0, ${coreAlpha * 0.12})`);
    g.addColorStop(1, "rgba(255, 180, 0, 0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, coreRadius, 0, Math.PI * 2);
    ctx.fill();
    const ringT = Math.max(0, (elapsed - 80) / (MAX_HEARTS_BLAST_MS - 80));
    ctx.strokeStyle = `rgba(255, 255, 200, ${(1 - ringT) * 0.7})`;
    ctx.lineWidth = Math.max(0.5, 12 - ringT * 10);
    ctx.beginPath();
    ctx.arc(0, 0, 40 + ringT * 320, 0, Math.PI * 2);
    ctx.stroke();
    const spikeT = Math.max(0, (elapsed - 150) / 900);
    const spikeR = 60 + spikeT * 260;
    ctx.strokeStyle = `rgba(255, 220, 100, ${Math.max(0, 1 - spikeT) * 0.5})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2 + (elapsed / 30) * 0.02;
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * spikeR, Math.sin(a) * spikeR);
    }
    ctx.stroke();
    ctx.restore();
  }
}

/** 4-point glitter star centred on the current origin. */
function drawGlitter(ctx: CanvasRenderingContext2D, size: number, thin: number, fillA: number, strokeA: number, lw: number) {
  ctx.fillStyle = `rgba(255, 252, 240, ${fillA})`;
  ctx.strokeStyle = `rgba(255, 255, 255, ${strokeA})`;
  ctx.lineWidth = lw;
  ctx.beginPath();
  ctx.moveTo(0, -size);
  ctx.lineTo(size * thin, 0);
  ctx.lineTo(0, size);
  ctx.lineTo(-size * thin, 0);
  ctx.closePath();
  ctx.moveTo(-size, 0);
  ctx.lineTo(0, size * thin);
  ctx.lineTo(size, 0);
  ctx.lineTo(0, -size * thin);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

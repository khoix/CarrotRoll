/**
 * Lightweight haze overlay over the background: improves readability of gameplay
 * and simulates atmospheric depth. Far = top of screen (distant), near = bottom (player);
 * haze is stronger at top and weaker at bottom.
 */

function clamp(x: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, x));
}

export interface HazeParams {
  enabled: boolean;
  farStrength: number;
  nearStrength: number;
  farStartY: number;
  color: string;
  pulseAmp: number;
  pulseSpeed: number;
  noiseAmp: number;
}

const DEFAULT_COLOR = "255,255,255";

export class HazeLayer {
  private viewW: number;
  private viewH: number;
  private params: HazeParams;
  /** Reused 64x64 gray noise canvas for anti-banding; created once. */
  private noiseCanvas: HTMLCanvasElement | null = null;

  constructor(viewW: number, viewH: number) {
    this.viewW = viewW;
    this.viewH = viewH;
    this.params = {
      enabled: true,
      farStartY: 0.1 * viewH,
      farStrength: 0.28,
      nearStrength: 0.06,
      color: DEFAULT_COLOR,
      pulseAmp: 0.02,
      pulseSpeed: 0.8,
      noiseAmp: 0,
    };
  }

  setParams(params: Partial<HazeParams>): void {
    this.params = { ...this.params, ...params };
    // Keep farStartY in pixels; if caller passed a fraction, they can pass farStartY explicitly
    if (params.farStartY === undefined && (params.farStrength !== undefined || params.nearStrength !== undefined)) {
      // leave farStartY as-is
    }
  }

  private ensureNoiseCanvas(): HTMLCanvasElement {
    if (this.noiseCanvas) return this.noiseCanvas;
    const size = 64;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      const id = ctx.getImageData(0, 0, size, size);
      const d = id.data;
      for (let i = 0; i < d.length; i += 4) {
        const g = Math.floor(Math.random() * 256);
        d[i] = d[i + 1] = d[i + 2] = g;
        d[i + 3] = 255;
      }
      ctx.putImageData(id, 0, 0);
    }
    this.noiseCanvas = canvas;
    return canvas;
  }

  resize(viewW: number, viewH: number): void {
    if (viewW === this.viewW && viewH === this.viewH) return;
    this.params.farStartY = (this.params.farStartY / this.viewH) * viewH;
    this.viewW = viewW;
    this.viewH = viewH;
    this.gradient = null;
    this.vignette = null;
  }

  /** Gradient built once per size; the slow pulse is applied through globalAlpha instead. */
  private gradient: CanvasGradient | null = null;
  private gradientCtx: CanvasRenderingContext2D | null = null;
  /** Subtle edge darkening, rendered once per size. */
  private vignette: HTMLCanvasElement | null = null;

  private ensureVignette(): HTMLCanvasElement {
    if (this.vignette) return this.vignette;
    // Low-res is fine: it is a smooth gradient and gets scaled up.
    const w = Math.max(1, Math.round(this.viewW / 4));
    const h = Math.max(1, Math.round(this.viewH / 4));
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d");
    if (ctx) {
      const r = Math.hypot(w, h) / 2;
      const g = ctx.createRadialGradient(w / 2, h / 2, r * 0.55, w / 2, h / 2, r);
      g.addColorStop(0, "rgba(0,0,0,0)");
      g.addColorStop(1, `rgba(0,0,0,${this.vignetteStrength})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }
    this.vignette = c;
    return c;
  }

  render(ctx: CanvasRenderingContext2D, timeSeconds: number): void {
    if (!this.params.enabled) return;

    const { farStrength, nearStrength, farStartY, color, pulseAmp, pulseSpeed, noiseAmp } = this.params;
    if (!this.gradient || this.gradientCtx !== ctx) {
      // Built at the pulse peak; globalAlpha scales it down (alpha > 1 would be ignored by canvas).
      const peak = (farStrength + pulseAmp) / Math.max(0.01, farStrength);
      const aTop = clamp(farStrength + pulseAmp, 0, 1);
      const aBottom = clamp(nearStrength * peak, 0, 1);
      const grad = ctx.createLinearGradient(0, 0, 0, this.viewH);
      grad.addColorStop(0, `rgba(${color}, 0)`);
      grad.addColorStop(clamp(farStartY / this.viewH, 0, 1), `rgba(${color}, ${aTop})`);
      grad.addColorStop(1, `rgba(${color}, ${aBottom})`);
      this.gradient = grad;
      this.gradientCtx = ctx;
    }
    const pulse = pulseAmp * Math.sin(timeSeconds * pulseSpeed * Math.PI * 2);
    const prevAlpha = ctx.globalAlpha;
    ctx.globalAlpha = prevAlpha * clamp((farStrength + pulse) / Math.max(0.01, farStrength + pulseAmp), 0, 1);
    ctx.fillStyle = this.gradient;
    ctx.fillRect(0, 0, this.viewW, this.viewH);
    ctx.globalAlpha = prevAlpha;

    if (noiseAmp > 0) {
      const noise = this.ensureNoiseCanvas();
      ctx.globalAlpha = clamp(noiseAmp, 0.01, 0.03);
      ctx.drawImage(noise, 0, 0, noise.width, noise.height, 0, 0, this.viewW, this.viewH);
      ctx.globalAlpha = prevAlpha;
    }
  }

  /** Theme the haze (tiers): colour "r,g,b", strength at the top and bottom, vignette darkness. */
  setTheme(color: string, far: number, near: number, vignette: number): void {
    this.params = { ...this.params, color, farStrength: far, nearStrength: near };
    this.vignetteStrength = vignette;
    this.gradient = null;
    this.vignette = null;
  }

  private vignetteStrength = 0.28;

  /** Edge vignette; draw after gameplay layers you want framed. */
  renderVignette(ctx: CanvasRenderingContext2D): void {
    ctx.drawImage(this.ensureVignette(), 0, 0, this.viewW, this.viewH);
  }
}

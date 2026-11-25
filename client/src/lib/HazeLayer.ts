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

  render(ctx: CanvasRenderingContext2D, timeSeconds: number): void {
    if (!this.params.enabled) return;

    const { farStrength, nearStrength, farStartY, color, pulseAmp, pulseSpeed, noiseAmp } =
      this.params;
    const pulse = pulseAmp * Math.sin(timeSeconds * pulseSpeed * Math.PI * 2);
    const aTop = clamp(farStrength + pulse, 0, 1);
    const aBottom = clamp(nearStrength, 0, 1);

    const grad = ctx.createLinearGradient(0, 0, 0, this.viewH);
    grad.addColorStop(0, `rgba(${color}, 0)`);
    const startFrac = Math.max(0, Math.min(1, farStartY / this.viewH));
    grad.addColorStop(startFrac, `rgba(${color}, ${aTop})`);
    grad.addColorStop(1, `rgba(${color}, ${aBottom})`);

    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.viewW, this.viewH);
    ctx.restore();

    if (noiseAmp > 0) {
      const noise = this.ensureNoiseCanvas();
      ctx.save();
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = clamp(noiseAmp, 0.01, 0.03);
      ctx.drawImage(noise, 0, 0, noise.width, noise.height, 0, 0, this.viewW, this.viewH);
      ctx.globalAlpha = 1;
      ctx.restore();
    }
  }
}

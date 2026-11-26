/**
 * Seamless looping background scroller using tileable textures.
 * Vertical scroll (player flying forward); camera moves "down" the texture; world loops with no seam.
 *
 * Performance notes (this runs every frame on phones):
 * - The land-only detail overlay is baked into the base tile once at construction, instead of
 *   being re-masked with three full-screen offscreen passes per frame.
 * - The water mask is pre-scaled to the tile size once.
 * - The shimmer alpha pattern is computed into a persistent ImageData (no getImageData, which forces
 *   a GPU→CPU readback) and only refreshed at ~20 Hz; it changes slowly.
 */

function positiveMod(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}

type Drawable = HTMLImageElement | HTMLCanvasElement;

function sizeOf(d: Drawable) {
  return "naturalWidth" in d ? { w: d.naturalWidth || d.width, h: d.naturalHeight || d.height } : { w: d.width, h: d.height };
}

function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

const SHIMMER_PATTERN_SIZE = 128;
const SHIMMER_REFRESH_S = 0.05;

export class BackgroundScroller {
  private viewWidth: number;
  private viewHeight: number;
  /** Base tile with the land detail already composited in. */
  private tile: Drawable;
  private tileW: number;
  private tileH: number;
  private scrollY = 0;
  private speed = 0;
  private time = 0;

  /** Solid tint masked to water, same size as the tile. */
  private waterTint: HTMLCanvasElement | null = null;
  private shimmerPattern: HTMLCanvasElement | null = null;
  private shimmerImage: ImageData | null = null;
  private shimmerBuffer: HTMLCanvasElement | null = null;
  private lastShimmerUpdate = -Infinity;

  constructor(
    viewWidth: number,
    viewHeight: number,
    baseTile: Drawable,
    detailTile?: Drawable,
    waterMask?: Drawable,
    /** Colour of the water shimmer (themes tint it: icy, warm, dim). */
    shimmerTint = "rgba(240,248,255,0.7)"
  ) {
    this.viewWidth = viewWidth;
    this.viewHeight = viewHeight;
    const { w, h } = sizeOf(baseTile);
    this.tileW = w;
    this.tileH = h;

    // Water mask at tile resolution
    let mask: HTMLCanvasElement | null = null;
    if (waterMask) {
      mask = canvas(w, h);
      mask.getContext("2d")?.drawImage(waterMask, 0, 0, w, h);
    }

    // Bake: base + 50% detail, only on land (where the mask is transparent)
    if (detailTile) {
      const baked = canvas(w, h);
      const bctx = baked.getContext("2d");
      if (bctx) {
        bctx.drawImage(baseTile, 0, 0, w, h);
        const detail = canvas(w, h);
        const dctx = detail.getContext("2d");
        if (dctx) {
          const ds = sizeOf(detailTile);
          for (let y = 0; y < h; y += ds.h) for (let x = 0; x < w; x += ds.w) dctx.drawImage(detailTile, x, y);
          if (mask) {
            dctx.globalCompositeOperation = "destination-out";
            dctx.drawImage(mask, 0, 0);
          }
          bctx.globalAlpha = 0.5;
          bctx.drawImage(detail, 0, 0);
          bctx.globalAlpha = 1;
        }
      }
      this.tile = baked;
    } else {
      this.tile = baseTile;
    }

    if (mask) {
      const tint = canvas(w, h);
      const tctx = tint.getContext("2d");
      if (tctx) {
        tctx.fillStyle = shimmerTint;
        tctx.fillRect(0, 0, w, h);
        tctx.globalCompositeOperation = "destination-in";
        tctx.drawImage(mask, 0, 0);
      }
      this.waterTint = tint;
    }
  }

  setSpeed(pixelsPerSecond: number): void {
    this.speed = pixelsPerSecond;
  }

  resize(viewWidth: number, viewHeight: number): void {
    this.viewWidth = viewWidth;
    this.viewHeight = viewHeight;
    this.shimmerBuffer = null;
  }

  update(dtSeconds: number): void {
    this.scrollY = positiveMod(this.scrollY - this.speed * dtSeconds, this.tileH);
    this.time += dtSeconds;
  }

  private forEachTile(fn: (x: number, y: number) => void, ox = 0, oy = 0) {
    for (let y = -positiveMod(this.scrollY, this.tileH) + oy; y < this.viewHeight; y += this.tileH) {
      for (let x = ox; x < this.viewWidth; x += this.tileW) fn(x, y);
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    ctx.imageSmoothingEnabled = true;
    this.forEachTile((x, y) => ctx.drawImage(this.tile, x, y));
  }

  private updateShimmerPattern(): void {
    const S = SHIMMER_PATTERN_SIZE;
    if (!this.shimmerPattern) {
      this.shimmerPattern = canvas(S, S);
      this.shimmerImage = new ImageData(S, S);
    }
    const pctx = this.shimmerPattern.getContext("2d");
    const img = this.shimmerImage;
    if (!pctx || !img) return;
    const t = this.time;
    const d = img.data;
    for (let py = 0; py < S; py++) {
      for (let px = 0; px < S; px++) {
        const phase1 = px * 0.02 + py * 0.015 + t * 0.625;
        const phase2 = px * 0.0125 - py * 0.0175 + t * 0.425;
        const a = 0.2 + 0.6 * (0.5 + 0.5 * Math.sin(phase1) + 0.2 * Math.sin(phase2));
        const i = (py * S + px) * 4;
        d[i] = 255;
        d[i + 1] = 255;
        d[i + 2] = 255;
        d[i + 3] = Math.round(Math.max(0, Math.min(1, a)) * 255);
      }
    }
    pctx.putImageData(img, 0, 0);
  }

  /** Draw water shimmer on top of the haze (call after the haze layer so it stays visible). */
  renderWaterShimmer(ctx: CanvasRenderingContext2D): void {
    if (!this.waterTint) return;
    if (this.time - this.lastShimmerUpdate >= SHIMMER_REFRESH_S || this.time < this.lastShimmerUpdate) {
      this.lastShimmerUpdate = this.time;
      this.updateShimmerPattern();
    }
    if (!this.shimmerPattern) return;

    // Buffer at world resolution (the main canvas transform upscales it; shimmer is soft anyway).
    const bw = Math.ceil(this.viewWidth);
    const bh = Math.ceil(this.viewHeight);
    if (!this.shimmerBuffer || this.shimmerBuffer.width !== bw || this.shimmerBuffer.height !== bh) {
      this.shimmerBuffer = canvas(bw, bh);
    }
    const buf = this.shimmerBuffer.getContext("2d");
    if (!buf) return;
    const t = this.time;
    const tint = this.waterTint;
    buf.globalCompositeOperation = "source-over";
    buf.clearRect(0, 0, bw, bh);
    this.forEachTile((x, y) => buf.drawImage(tint, x, y), 1.2 * Math.sin(t * 1.1), 2.5 * Math.sin(t * 1.3));
    buf.globalCompositeOperation = "destination-in";
    buf.drawImage(this.shimmerPattern, 0, 0, SHIMMER_PATTERN_SIZE, SHIMMER_PATTERN_SIZE, 0, 0, bw, bh);
    buf.globalCompositeOperation = "source-over";
    ctx.drawImage(this.shimmerBuffer, 0, 0, this.viewWidth, this.viewHeight);
  }
}

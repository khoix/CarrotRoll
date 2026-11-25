/**
 * Seamless looping background scroller using tileable textures.
 * Vertical scroll (player flying forward); camera moves "down" the texture; world loops with no seam.
 */

function positiveMod(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}

/** Set to false to temporarily disable water shimmer for comparison. */
const WATER_SHIMMER_ENABLED = true;

export class BackgroundScroller {
  private viewWidth: number;
  private viewHeight: number;
  private baseTile: HTMLImageElement | HTMLCanvasElement;
  private detailTile: HTMLImageElement | HTMLCanvasElement | undefined;
  private waterMask: HTMLImageElement | undefined;
  private tileW: number;
  private tileH: number;
  private detailW: number;
  private detailH: number;
  private scrollY = 0;
  /** Unwrapped scroll for parallax layers so detail tile doesn't jump when base scroll wraps. */
  private totalScrollY = 0;
  private speed = 0;
  private time = 0;
  private imageSmoothingEnabled = true;
  private debugMode = false;
  private debugWaterMask = false;
  private debugWaterOnly = false;

  /** Water-only pixels (baseTile clipped by mask); built once, reused for debugWaterOnly. */
  private waterOnlyTileCanvas: HTMLCanvasElement | null = null;
  private waterOnlyCtx: CanvasRenderingContext2D | null = null;

  /** Visible tint overlay (solid color masked by water); used for shimmer so effect is always visible. */
  private waterTintCanvas: HTMLCanvasElement | null = null;

  /** Offscreen buffer for detail layer masked by land (detail only where waterMask is transparent). */
  private detailLayerBuffer: HTMLCanvasElement | null = null;

  /** Smooth alpha pattern for water shimmer (per-pixel variation); size PATTERN_SIZE. */
  private shimmerPatternCanvas: HTMLCanvasElement | null = null;
  /** Offscreen buffer to composite water tint with pattern (view size). */
  private shimmerBuffer: HTMLCanvasElement | null = null;

  private _shimmerLogged = false;

  private static readonly SHIMMER_PATTERN_SIZE = 128;

  constructor(
    viewWidth: number,
    viewHeight: number,
    baseTile: HTMLImageElement | HTMLCanvasElement,
    detailTile?: HTMLImageElement | HTMLCanvasElement,
    waterMask?: HTMLImageElement
  ) {
    this.viewWidth = viewWidth;
    this.viewHeight = viewHeight;
    this.baseTile = baseTile;
    this.detailTile = detailTile;
    this.waterMask = waterMask;
    this.tileW = "naturalWidth" in baseTile ? baseTile.naturalWidth : baseTile.width;
    this.tileH = "naturalHeight" in baseTile ? baseTile.naturalHeight : baseTile.height;
    this.detailW = detailTile
      ? "naturalWidth" in detailTile
        ? detailTile.naturalWidth
        : detailTile.width
      : 0;
    this.detailH = detailTile
      ? "naturalHeight" in detailTile
        ? detailTile.naturalHeight
        : detailTile.height
      : 0;
    if (!waterMask) {
      console.warn("BackgroundScroller: no waterMask provided — water shimmer will not run. Add images/waterMask.png for the effect.");
    }
  }

  setSpeed(pixelsPerSecond: number): void {
    this.speed = pixelsPerSecond;
  }

  setDebugMode(enabled: boolean): void {
    this.debugMode = enabled;
  }

  setDebugWaterMask(enabled: boolean): void {
    this.debugWaterMask = enabled;
  }

  setDebugWaterOnly(enabled: boolean): void {
    this.debugWaterOnly = enabled;
  }

  update(dtSeconds: number): void {
    const delta = this.speed * dtSeconds;
    this.scrollY = positiveMod(this.scrollY - delta, this.tileH);
    this.totalScrollY -= delta;
    this.time += dtSeconds;
  }

  render(ctx: CanvasRenderingContext2D): void {
    // Dimension rule: always derive from baseTile (no fixed dimensions)
    this.tileW =
      "naturalWidth" in this.baseTile
        ? (this.baseTile.naturalWidth || this.baseTile.width)
        : this.baseTile.width;
    this.tileH =
      "naturalHeight" in this.baseTile
        ? (this.baseTile.naturalHeight || this.baseTile.height)
        : this.baseTile.height;

    ctx.imageSmoothingEnabled = this.imageSmoothingEnabled;
    if ("imageSmoothingQuality" in ctx) {
      (ctx as CanvasRenderingContext2D & { imageSmoothingQuality: string }).imageSmoothingQuality =
        "high";
    }

    const scrollYSafe = positiveMod(this.scrollY, this.tileH);

    const maskReady =
      this.waterMask &&
      this.waterMask.complete &&
      this.waterMask.naturalWidth > 0 &&
      this.tileW > 0 &&
      this.tileH > 0;

    if (maskReady && this.waterMask) {
      const needsWaterOnlyBuild =
        !this.waterOnlyTileCanvas ||
        this.waterOnlyTileCanvas.width !== this.tileW ||
        this.waterOnlyTileCanvas.height !== this.tileH;

      if (needsWaterOnlyBuild) {
        this.waterOnlyTileCanvas = document.createElement("canvas");
        this.waterOnlyTileCanvas.width = this.tileW;
        this.waterOnlyTileCanvas.height = this.tileH;
        this.waterOnlyCtx = this.waterOnlyTileCanvas.getContext("2d");
        const wctx = this.waterOnlyCtx;
        if (wctx) {
          wctx.setTransform(1, 0, 0, 1, 0, 0);
          wctx.globalAlpha = 1;
          wctx.globalCompositeOperation = "source-over";
          wctx.clearRect(0, 0, this.tileW, this.tileH);
          wctx.drawImage(this.baseTile, 0, 0, this.tileW, this.tileH);
          wctx.globalCompositeOperation = "destination-in";
          wctx.globalAlpha = 1;
          wctx.drawImage(
            this.waterMask,
            0,
            0,
            this.waterMask.naturalWidth || this.waterMask.width,
            this.waterMask.naturalHeight || this.waterMask.height,
            0,
            0,
            this.tileW,
            this.tileH
          );
          wctx.globalCompositeOperation = "source-over";
          wctx.globalAlpha = 1;
        }
      }

      const needsTintBuild =
        !this.waterTintCanvas ||
        this.waterTintCanvas.width !== this.tileW ||
        this.waterTintCanvas.height !== this.tileH;
      if (needsTintBuild) {
        this.waterTintCanvas = document.createElement("canvas");
        this.waterTintCanvas.width = this.tileW;
        this.waterTintCanvas.height = this.tileH;
        const tctx = this.waterTintCanvas.getContext("2d");
        if (tctx) {
          tctx.setTransform(1, 0, 0, 1, 0, 0);
          tctx.globalAlpha = 1;
          tctx.globalCompositeOperation = "source-over";
          tctx.fillStyle = "rgba(240,248,255,0.7)";
          tctx.fillRect(0, 0, this.tileW, this.tileH);
          tctx.globalCompositeOperation = "destination-in";
          tctx.drawImage(
            this.waterMask,
            0,
            0,
            this.waterMask.naturalWidth || this.waterMask.width,
            this.waterMask.naturalHeight || this.waterMask.height,
            0,
            0,
            this.tileW,
            this.tileH
          );
          tctx.globalCompositeOperation = "source-over";
        }
      }

      if (this.debugWaterOnly && this.waterOnlyTileCanvas) {
        ctx.clearRect(0, 0, this.viewWidth, this.viewHeight);
        let y = -scrollYSafe;
        while (y < this.viewHeight) {
          let x = 0;
          while (x < this.viewWidth) {
            ctx.drawImage(this.waterOnlyTileCanvas, x, y);
            x += this.tileW;
          }
          y += this.tileH;
        }
        return;
      }
    }

    // Base layer: tile from y = -scrollYSafe; use drawImage(tile, x, y) when no scaling
    let y = -scrollYSafe;
    while (y < this.viewHeight) {
      let x = 0;
      while (x < this.viewWidth) {
        ctx.drawImage(this.baseTile, x, y);
        x += this.tileW;
      }
      y += this.tileH;
    }

    // Detail layer (parallax scrollFactor 0.8): only where mask is transparent (land)
    if (this.detailTile && this.detailW > 0 && this.detailH > 0) {
      if (maskReady && this.waterMask) {
        if (
          !this.detailLayerBuffer ||
          this.detailLayerBuffer.width !== this.viewWidth ||
          this.detailLayerBuffer.height !== this.viewHeight
        ) {
          this.detailLayerBuffer = document.createElement("canvas");
          this.detailLayerBuffer.width = this.viewWidth;
          this.detailLayerBuffer.height = this.viewHeight;
        }
        const buf = this.detailLayerBuffer.getContext("2d");
        if (buf) {
          buf.clearRect(0, 0, this.viewWidth, this.viewHeight);
          buf.globalAlpha = 0.5;
          buf.globalCompositeOperation = "source-over";
          const detailScrollY = positiveMod(this.totalScrollY * 0.9, this.detailH);
          y = -detailScrollY;
          while (y < this.viewHeight) {
            let x = 0;
            while (x < this.viewWidth) {
              buf.drawImage(this.detailTile, x, y);
              x += this.detailW;
            }
            y += this.detailH;
          }
          buf.globalCompositeOperation = "destination-out";
          buf.globalAlpha = 1;
          y = -scrollYSafe;
          while (y < this.viewHeight) {
            let x = 0;
            while (x < this.viewWidth) {
              buf.drawImage(
                this.waterMask,
                0,
                0,
                this.waterMask.naturalWidth || this.waterMask.width,
                this.waterMask.naturalHeight || this.waterMask.height,
                x,
                y,
                this.tileW,
                this.tileH
              );
              x += this.tileW;
            }
            y += this.tileH;
          }
          buf.globalCompositeOperation = "source-over";
          buf.globalAlpha = 1;
          ctx.drawImage(this.detailLayerBuffer, 0, 0);
        }
      } else {
        ctx.save();
        ctx.globalAlpha = 0.5;
        ctx.globalCompositeOperation = "source-over";
        const detailScrollY = positiveMod(this.totalScrollY * 0.9, this.detailH);
        y = -detailScrollY;
        while (y < this.viewHeight) {
          let x = 0;
          while (x < this.viewWidth) {
            ctx.drawImage(this.detailTile, x, y);
            x += this.detailW;
          }
          y += this.detailH;
        }
        ctx.restore();
      }
    }

    // Debug: tile boundaries
    if (this.debugMode) {
      ctx.strokeStyle = "rgba(255,255,0,0.35)";
      ctx.lineWidth = 1;
      y = -scrollYSafe;
      while (y < this.viewHeight) {
        let x = 0;
        while (x < this.viewWidth) {
          ctx.strokeRect(x, y, this.tileW, this.tileH);
          x += this.tileW;
        }
        y += this.tileH;
      }
    }

    // Water shimmer and debug overlay: drawn last so shimmer is above all layers
    if (maskReady && this.waterMask) {
      if (this.debugWaterMask) {
        ctx.save();
        ctx.globalAlpha = 0.35;
        ctx.globalCompositeOperation = "source-over";
        y = -scrollYSafe;
        while (y < this.viewHeight) {
          let x = 0;
          while (x < this.viewWidth) {
            ctx.drawImage(
              this.waterMask,
              0,
              0,
              this.waterMask.naturalWidth || this.waterMask.width,
              this.waterMask.naturalHeight || this.waterMask.height,
              x,
              y,
              this.tileW,
              this.tileH
            );
            x += this.tileW;
          }
          y += this.tileH;
        }
        ctx.restore();
      }

    }
  }

  /**
   * Draw water shimmer on top of the haze. Call this after the haze layer
   * so the effect is visible (haze was covering it when drawn inside render).
   */
  /**
   * Build or update the smooth alpha pattern (curved, per-pixel). Call once per frame.
   */
  private updateShimmerPattern(): void {
    const S = BackgroundScroller.SHIMMER_PATTERN_SIZE;
    if (!this.shimmerPatternCanvas || this.shimmerPatternCanvas.width !== S) {
      this.shimmerPatternCanvas = document.createElement("canvas");
      this.shimmerPatternCanvas.width = S;
      this.shimmerPatternCanvas.height = S;
    }
    const pctx = this.shimmerPatternCanvas.getContext("2d");
    if (!pctx) return;
    const t = this.time;
    const k1 = 0.02;
    const k2 = 0.015;
    const k3 = 0.0125;
    const k4 = 0.0175;
    const img = pctx.getImageData(0, 0, S, S);
    const d = img.data;
    for (let py = 0; py < S; py++) {
      for (let px = 0; px < S; px++) {
        const phase1 = px * k1 + py * k2 + t * 0.625;
        const phase2 = px * k3 - py * k4 + t * 0.425;
        const a =
          0.2 +
          0.6 *
            (0.5 +
              0.5 * Math.sin(phase1) +
              0.2 * Math.sin(phase2));
        const a8 = Math.max(0, Math.min(1, a)) * 255;
        const i = (py * S + px) * 4;
        d[i] = 255;
        d[i + 1] = 255;
        d[i + 2] = 255;
        d[i + 3] = Math.round(a8);
      }
    }
    pctx.putImageData(img, 0, 0);
  }

  renderWaterShimmer(ctx: CanvasRenderingContext2D): void {
    const maskReady =
      this.waterMask &&
      this.waterMask.complete &&
      this.waterMask.naturalWidth > 0 &&
      this.tileW > 0 &&
      this.tileH > 0;
    if (!maskReady || !this.waterTintCanvas || !WATER_SHIMMER_ENABLED) return;
    const scrollYSafe = positiveMod(this.scrollY, this.tileH);
    const t = this.time;

    this.updateShimmerPattern();
    if (!this.shimmerPatternCanvas) return;

    if (
      !this.shimmerBuffer ||
      this.shimmerBuffer.width !== this.viewWidth ||
      this.shimmerBuffer.height !== this.viewHeight
    ) {
      this.shimmerBuffer = document.createElement("canvas");
      this.shimmerBuffer.width = this.viewWidth;
      this.shimmerBuffer.height = this.viewHeight;
    }
    const buf = this.shimmerBuffer.getContext("2d");
    if (!buf) return;

    const wobbleX = 1.2 * Math.sin(t * 1.1);
    const wobbleY = 2.5 * Math.sin(t * 1.3);

    buf.clearRect(0, 0, this.viewWidth, this.viewHeight);
    buf.globalAlpha = 1;
    buf.globalCompositeOperation = "source-over";
    let y = -scrollYSafe;
    while (y < this.viewHeight) {
      let x = 0;
      while (x < this.viewWidth) {
        buf.drawImage(
          this.waterTintCanvas,
          x + wobbleX,
          y + wobbleY
        );
        x += this.tileW;
      }
      y += this.tileH;
    }

    buf.globalAlpha = 1;
    buf.globalCompositeOperation = "destination-in";
    const P = BackgroundScroller.SHIMMER_PATTERN_SIZE;
    buf.drawImage(
      this.shimmerPatternCanvas,
      0,
      0,
      P,
      P,
      0,
      0,
      this.viewWidth,
      this.viewHeight
    );

    ctx.save();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.drawImage(this.shimmerBuffer, 0, 0);
    ctx.restore();
  }
}

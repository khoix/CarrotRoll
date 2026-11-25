/**
 * Procedural "flying over Earth" background: sky above, terrain below the horizon.
 * Ground is drawn as a surface (horizontal bands of land, water, trees) that scrolls
 * upward so it looks like flying above the ground. No rays from center.
 */

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CLOUD_SEED = 12345;
const TERRAIN_SEED = 67890;
const FEATURES_SEED = 11111;
const NUM_CLOUDS = 18;
const SCROLL_SPEED = 45;
const CLOUD_SCROLL_SPEED = 40;
const WORLD_HEIGHT = 2400; // virtual world height for wrapping

// Horizon: fraction of canvas height where sky meets ground (0.5 = middle)
const HORIZON_FRAC = 0.58;

type Cloud = {
  baseY: number;
  x: number;
  width: number;
  height: number;
  blobs: { x: number; y: number; r: number }[];
  speedFactor: number;
};

function generateClouds(width: number, height: number, seed: number): Cloud[] {
  const rng = mulberry32(seed);
  const clouds: Cloud[] = [];
  for (let i = 0; i < NUM_CLOUDS; i++) {
    const baseY = rng() * (height + 150);
    const x = rng() * (width + 100) - 50;
    const w = 60 + rng() * 100;
    const h = 24 + rng() * 32;
    const blobs: { x: number; y: number; r: number }[] = [];
    const numBlobs = 2 + Math.floor(rng() * 2);
    for (let b = 0; b < numBlobs; b++) {
      blobs.push({
        x: (rng() - 0.5) * w * 0.8,
        y: (rng() - 0.5) * h * 0.6,
        r: (0.4 + rng() * 0.5) * Math.min(w, h) * 0.5,
      });
    }
    const speedFactor = 0.4 + 0.6 * (baseY / (height + 150));
    clouds.push({ baseY, x, width: w, height: h, blobs, speedFactor });
  }
  return clouds;
}

// Terrain bands: horizontal strips of ground (grass, forest, water, field) in world Y
type TerrainBand = { yStart: number; yEnd: number; color: string; label: string };

function generateTerrainBands(seed: number): TerrainBand[] {
  const rng = mulberry32(seed);
  const bands: TerrainBand[] = [];
  const palette: { color: string; label: string }[] = [
    { color: "#2d5a27", label: "forest" },
    { color: "#3d6b35", label: "grass" },
    { color: "#4a7c42", label: "grass" },
    { color: "#1e4620", label: "forest" },
    { color: "#2563a8", label: "water" },
    { color: "#1e40af", label: "water" },
    { color: "#6b5344", label: "field" },
    { color: "#8b7355", label: "field" },
    { color: "#5a4a3a", label: "field" },
  ];
  let y = 0;
  while (y < WORLD_HEIGHT) {
    const span = 80 + rng() * 180;
    const i = Math.floor(rng() * palette.length);
    bands.push({ yStart: y, yEnd: y + span, color: palette[i].color, label: palette[i].label });
    y += span;
  }
  return bands;
}

// Trees: x in [0, width], y in world space
type Tree = { worldX: number; worldY: number; size: number; green: string };

function generateTrees(seed: number, width: number): Tree[] {
  const rng = mulberry32(seed);
  const trees: Tree[] = [];
  const greens = ["#14532d", "#166534", "#15803d", "#1a5f3a", "#0f766e"];
  for (let i = 0; i < 80; i++) {
    trees.push({
      worldX: rng() * (width + 200) - 100,
      worldY: rng() * WORLD_HEIGHT,
      size: 4 + rng() * 10,
      green: greens[Math.floor(rng() * greens.length)],
    });
  }
  return trees;
}

// Water bodies: ellipses on the ground
type WaterBody = { worldX: number; worldY: number; w: number; h: number };

function generateWaterBodies(seed: number, width: number): WaterBody[] {
  const rng = mulberry32(seed);
  const bodies: WaterBody[] = [];
  for (let i = 0; i < 25; i++) {
    bodies.push({
      worldX: rng() * (width + 150) - 75,
      worldY: rng() * WORLD_HEIGHT,
      w: 40 + rng() * 120,
      h: 20 + rng() * 60,
    });
  }
  return bodies;
}

let cachedClouds: Cloud[] | null = null;
let cachedBands: TerrainBand[] | null = null;
let cachedTrees: Tree[] | null = null;
let cachedWater: WaterBody[] | null = null;

export function drawEarthBackground(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  time: number
): void {
  const w = width;
  const h = height;
  const horizonY = h * HORIZON_FRAC;
  const scrollOffset = ((time / 1000) * SCROLL_SPEED) % WORLD_HEIGHT;

  // 1. Sky (above horizon)
  const skyGradient = ctx.createLinearGradient(0, 0, 0, horizonY + 50);
  skyGradient.addColorStop(0, "#0c1445");
  skyGradient.addColorStop(0.35, "#1a237e");
  skyGradient.addColorStop(0.7, "#3949ab");
  skyGradient.addColorStop(1, "#5c6bc0");
  ctx.fillStyle = skyGradient;
  ctx.fillRect(0, 0, w, horizonY + 50);

  // 2. Ground base (below horizon): gradient so terrain reads as surface receding
  const groundGradient = ctx.createLinearGradient(0, horizonY, 0, h);
  groundGradient.addColorStop(0, "#3d5a3a");
  groundGradient.addColorStop(0.4, "#2d4a2a");
  groundGradient.addColorStop(1, "#1e3820");
  ctx.fillStyle = groundGradient;
  ctx.fillRect(0, horizonY, w, h - horizonY + 50);

  // 3. Terrain bands (horizontal strips scrolling upward = ground passing beneath)
  if (!cachedBands) cachedBands = generateTerrainBands(TERRAIN_SEED);
  for (const band of cachedBands) {
    const screenY1 = horizonY + ((band.yStart - scrollOffset) % WORLD_HEIGHT + WORLD_HEIGHT) % WORLD_HEIGHT;
    const screenY2 = horizonY + ((band.yEnd - scrollOffset) % WORLD_HEIGHT + WORLD_HEIGHT) % WORLD_HEIGHT;
    if (screenY1 >= h && screenY2 >= h) continue;
    if (screenY1 < horizonY && screenY2 < horizonY) continue;
    ctx.fillStyle = band.color;
    if (screenY1 > screenY2) {
      const h1 = Math.max(0, Math.min(h, screenY2) - horizonY);
      if (h1 > 0) ctx.fillRect(0, horizonY, w, h1);
      if (screenY1 < h) {
        const h2 = h - screenY1;
        if (h2 > 0) ctx.fillRect(0, screenY1, w, h2);
      }
    } else {
      const y = Math.max(horizonY, screenY1);
      const end = Math.min(h, screenY2);
      if (end > y) ctx.fillRect(0, y, w, end - y);
    }
  }

  // 4. Water bodies (ellipses on the ground)
  if (!cachedWater) cachedWater = generateWaterBodies(FEATURES_SEED, w);
  ctx.fillStyle = "rgba(30, 64, 175, 0.82)";
  for (const body of cachedWater) {
    const screenY = horizonY + ((body.worldY - scrollOffset) % WORLD_HEIGHT + WORLD_HEIGHT) % WORLD_HEIGHT;
    if (screenY < horizonY - 30 || screenY > h + 50) continue;
    ctx.beginPath();
    ctx.ellipse(body.worldX, screenY, body.w, body.h, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // 5. Trees (small triangles on the ground)
  if (!cachedTrees) cachedTrees = generateTrees(FEATURES_SEED, w);
  for (const tree of cachedTrees) {
    const screenY = horizonY + ((tree.worldY - scrollOffset) % WORLD_HEIGHT + WORLD_HEIGHT) % WORLD_HEIGHT;
    if (screenY < horizonY - 20 || screenY > h + 80) continue;
    const th = tree.size * 2.2;
    const tw = tree.size * 1.4;
    ctx.fillStyle = "#422006";
    ctx.fillRect(tree.worldX - 1, screenY, 2, th * 0.35);
    ctx.fillStyle = tree.green;
    ctx.beginPath();
    ctx.moveTo(tree.worldX, screenY - th);
    ctx.lineTo(tree.worldX - tw, screenY);
    ctx.lineTo(tree.worldX + tw, screenY);
    ctx.closePath();
    ctx.fill();
  }

  // 6. Soft horizon line (blend sky into ground)
  const horizonBlend = ctx.createLinearGradient(0, horizonY - 40, 0, horizonY + 60);
  horizonBlend.addColorStop(0, "rgba(92, 107, 192, 0)");
  horizonBlend.addColorStop(0.5, "rgba(92, 107, 192, 0.25)");
  horizonBlend.addColorStop(1, "rgba(45, 90, 58, 0.3)");
  ctx.fillStyle = horizonBlend;
  ctx.fillRect(0, horizonY - 40, w, 100);

  // 7. Atmospheric haze (lighter background)
  const hazeGradient = ctx.createLinearGradient(0, 0, 0, h);
  hazeGradient.addColorStop(0, "rgba(235, 238, 252, 0.2)");
  hazeGradient.addColorStop(0.3, "rgba(240, 243, 255, 0.45)");
  hazeGradient.addColorStop(0.6, "rgba(248, 250, 255, 0.65)");
  hazeGradient.addColorStop(1, "rgba(252, 253, 255, 0.85)");
  ctx.fillStyle = hazeGradient;
  ctx.fillRect(0, 0, w, h);

  // 8. Clouds
  if (!cachedClouds) cachedClouds = generateClouds(w, h, CLOUD_SEED);
  const cloudOffset = (time / 1000) * CLOUD_SCROLL_SPEED;
  const wrapHeight = h + 200;
  for (const cloud of cachedClouds) {
    const y = ((cloud.baseY - cloudOffset * cloud.speedFactor) % wrapHeight + wrapHeight) % wrapHeight - 100;
    ctx.save();
    ctx.globalAlpha = 0.88;
    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    for (const blob of cloud.blobs) {
      ctx.beginPath();
      ctx.ellipse(cloud.x + blob.x, y + blob.y, blob.r, blob.r * 0.7, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

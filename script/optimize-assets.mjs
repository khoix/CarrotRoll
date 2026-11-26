/**
 * Builds web-ready assets from the masters in assets-src/ into client/public/.
 * Requires ffmpeg on PATH (with the native aac encoder and libwebp).
 *
 *   npm run optimize-assets          # only (re)builds outputs that are missing or older than their master
 *   npm run optimize-assets -- --force
 *
 * - Music / long ambience  -> AAC .m4a (iOS can apply Web Audio gain to AAC media elements; WAV masters were 24-48 MB each)
 * - Endgame slides         -> WebP (desktop 1408px wide, mobile from the mobile JPG masters)
 * - Background tiles       -> WebP (base/detail) + water mask PNG pre-scaled to the base tile size
 */
import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "assets-src");
const OUT = path.join(ROOT, "client", "public");
const force = process.argv.includes("--force");

function stale(src, out) {
  if (force || !fs.existsSync(out)) return true;
  return fs.statSync(src).mtimeMs > fs.statSync(out).mtimeMs;
}

function ffmpeg(args) {
  execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...args], { stdio: "inherit" });
}

function job(src, out, args) {
  if (!fs.existsSync(src)) {
    console.warn("  missing master:", path.relative(ROOT, src));
    return;
  }
  if (!stale(src, out)) return;
  fs.mkdirSync(path.dirname(out), { recursive: true });
  ffmpeg(["-i", src, ...args, out]);
  const kb = (n) => `${Math.round(fs.statSync(n).size / 1024)} KB`;
  console.log(`  ${path.relative(ROOT, out)}  (${kb(src)} -> ${kb(out)})`);
}

// --- Audio ---
const AAC = ["-vn", "-c:a", "aac", "-b:a", "160k", "-ar", "44100", "-movflags", "+faststart"];
const MUSIC = [
  "music_menu",
  "music_ingame01",
  "music_ingame02",
  "music_ingame03",
  "music_ingame04",
  "music_endgame01",
  "golden_bunny",
  "static_endgame",
];
console.log("Audio:");
for (const name of MUSIC) {
  job(path.join(SRC, "sounds", `${name}.wav`), path.join(OUT, "sounds", `${name}.m4a`), AAC);
}

// --- Endgame slideshow ---
console.log("Endgame slides:");
const WEBP = (q) => ["-c:v", "libwebp", "-quality", String(q), "-compression_level", "6", "-frames:v", "1"];
for (let i = 1; i <= 18; i++) {
  const n = String(i).padStart(2, "0");
  job(path.join(SRC, "endgame", `${n}.png`), path.join(OUT, "endgame", `${n}.webp`), WEBP(82));
  job(path.join(SRC, "endgame", "mobile", `${n}.jpg`), path.join(OUT, "endgame", "mobile", `${n}.webp`), WEBP(80));
}

// --- Background tiles ---
console.log("Background:");
job(path.join(SRC, "images", "baseTile.png"), path.join(OUT, "images", "baseTile.webp"), WEBP(88));
job(path.join(SRC, "images", "detailTile.png"), path.join(OUT, "images", "detailTile.webp"), WEBP(85));
// Mask must stay lossless (hard alpha edges); pre-scale 2048 -> 1024 so it matches the base tile 1:1.
job(path.join(SRC, "images", "waterMask.png"), path.join(OUT, "images", "waterMask.png"), [
  "-vf",
  "scale=1024:1024:flags=area",
  "-frames:v",
  "1",
]);

// --- Tier backgrounds: colour-graded copies of the base tile; land and water graded separately
// (the water mask's alpha picks which grade applies), so lakes stay readable in every tier.
console.log("Tier backgrounds:");
const TIER_GRADES = {
  autumn: ["hue=h=-30:s=1.0,colorbalance=rm=0.08:gm=-0.02:bm=-0.1:rs=0.04,eq=saturation=0.92:brightness=-0.02", "colorbalance=rm=0.03:bm=-0.02"],
  frost: ["eq=saturation=0.25:brightness=0.22:contrast=0.85,colorbalance=bm=0.12:bh=0.08", "eq=saturation=0.35:brightness=0.25,colorbalance=bm=0.15:rm=0.05:gm=0.08"],
  storm: ["eq=saturation=0.4:brightness=-0.26:contrast=1.08:gamma=0.9,colorbalance=bm=0.12:bs=0.06:rm=-0.05:gm=-0.02", "eq=saturation=0.45:brightness=-0.26,colorbalance=bm=0.12:bs=0.06"],
  night: ["eq=saturation=0.45:brightness=-0.36:gamma=0.85,colorbalance=bs=0.18:bm=0.18:rm=-0.08:gm=-0.04", "eq=saturation=0.6:brightness=-0.32,colorbalance=bm=0.22:bs=0.1:rm=-0.1"],
};
{
  const base = path.join(SRC, "images", "baseTile.png");
  const mask = path.join(SRC, "images", "waterMask.png");
  for (const [name, [land, water]] of Object.entries(TIER_GRADES)) {
    const out = path.join(OUT, "images", "tiers", `${name}.webp`);
    if (!stale(base, out)) continue;
    fs.mkdirSync(path.dirname(out), { recursive: true });
    ffmpeg([
      "-i", base, "-i", mask,
      "-filter_complex",
      `[0]format=rgb24,split[a][b];[a]${land},format=rgb24[l];[b]${water},format=rgb24[w];[1]scale=1024:1024,format=rgba,alphaextract,format=gray,format=rgb24[m];[l][w][m]maskedmerge,format=rgb24`,
      ...WEBP(86),
      out,
    ]);
    console.log(`  ${path.relative(ROOT, out)}  (${Math.round(fs.statSync(out).size / 1024)} KB)`);
  }
}

console.log("Done.");

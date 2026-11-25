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

console.log("Done.");

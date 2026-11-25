/**
 * Generates placeholder WAV files for Carrot Roll.
 * Run: node script/generate-sounds.mjs [--force]
 * Output: client/public/sounds/*.wav
 *
 * Existing files are never overwritten unless --force is passed, so running this
 * only fills in sounds that are missing (real recordings are kept).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, "..", "client", "public", "sounds");

const SAMPLE_RATE = 44100;
const BITS = 16;

function writeWav(filePath, samples) {
  const numChannels = 1;
  const blockAlign = (numChannels * BITS) / 8;
  const byteRate = SAMPLE_RATE * blockAlign;
  const dataSize = samples.length * 2; // 16-bit = 2 bytes per sample
  const fileSize = 36 + dataSize;

  const buf = Buffer.alloc(44 + dataSize);
  let o = 0;
  function write(data) {
    for (let i = 0; i < data.length; i++) buf[o++] = data[i];
  }
  function writeU32(v) {
    buf[o++] = v & 0xff;
    buf[o++] = (v >> 8) & 0xff;
    buf[o++] = (v >> 16) & 0xff;
    buf[o++] = (v >> 24) & 0xff;
  }
  function writeU16(v) {
    buf[o++] = v & 0xff;
    buf[o++] = (v >> 8) & 0xff;
  }

  write([0x52, 0x49, 0x46, 0x46]); // "RIFF"
  writeU32(fileSize);
  write([0x57, 0x41, 0x56, 0x45]); // "WAVE"
  write([0x66, 0x6d, 0x74, 0x20]); // "fmt "
  writeU32(16);
  writeU16(1); // PCM
  writeU16(numChannels);
  writeU32(SAMPLE_RATE);
  writeU32(byteRate);
  writeU16(blockAlign);
  writeU16(BITS);
  write([0x64, 0x61, 0x74, 0x61]); // "data"
  writeU32(dataSize);

  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-32768, Math.min(32767, Math.round(samples[i])));
    buf[o++] = s & 0xff;
    buf[o++] = (s >> 8) & 0xff;
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(filePath, buf);
}

function tone(freqHz, durationSec, volume = 0.3, envelope = "percussive") {
  const n = Math.floor(SAMPLE_RATE * durationSec);
  const samples = [];
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    let gain = 1;
    if (envelope === "percussive") {
      const attack = 0.01;
      const release = Math.min(0.15, durationSec * 0.5);
      if (t < attack) gain = t / attack;
      else if (t > durationSec - release) gain = (durationSec - t) / release;
    }
    samples.push(32767 * volume * gain * Math.sin(2 * Math.PI * freqHz * t));
  }
  return samples;
}

function twoTone(freq1, freq2, durationSec, volume = 0.25) {
  const n = Math.floor(SAMPLE_RATE * durationSec);
  const samples = [];
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    const g = i < n * 0.1 ? i / (n * 0.1) : i > n * 0.85 ? (n - i) / (n * 0.15) : 1;
    const s = Math.sin(2 * Math.PI * freq1 * t) + 0.5 * Math.sin(2 * Math.PI * freq2 * t);
    samples.push(32767 * volume * g * s);
  }
  return samples;
}

function chord(freqs, durationSec, volume = 0.2) {
  const n = Math.floor(SAMPLE_RATE * durationSec);
  const samples = [];
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    let s = 0;
    for (const f of freqs) s += Math.sin(2 * Math.PI * f * t);
    const g = i < n * 0.05 ? i / (n * 0.05) : 1;
    samples.push(32767 * (volume / freqs.length) * g * s);
  }
  return samples;
}

function musicLoop(durationSec, volume = 0.15) {
  const n = Math.floor(SAMPLE_RATE * durationSec);
  const samples = [];
  const baseFreq = 262;
  const pattern = [0, 2, 4, 5, 7, 5, 4, 2]; // C major scale up and down
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    const step = (t / 0.4) % pattern.length;
    const idx = Math.floor(step) % pattern.length;
    const freq = baseFreq * Math.pow(2, pattern[idx] / 12);
    const s = Math.sin(2 * Math.PI * freq * t);
    samples.push(32767 * volume * s);
  }
  return samples;
}

/**
 * Seamless loop: every frequency is a whole number of Hz and the duration is a whole
 * number of seconds, so the waveform ends exactly where it began (no click at the loop point).
 */
function seamlessLoop(durationSec, voices, tremoloHz, tremoloDepth, volume) {
  const n = Math.floor(SAMPLE_RATE * durationSec);
  const samples = [];
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    let s = 0;
    for (const { freq, gain, vibHz = 0, vibDepth = 0 } of voices) {
      // Phase of a vibrato'd sine: 2πft + (depth/vibHz)·sin(2π·vibHz·t) — periodic over whole seconds
      const phase = 2 * Math.PI * freq * t + (vibHz ? (vibDepth / vibHz) * Math.sin(2 * Math.PI * vibHz * t) : 0);
      s += gain * Math.sin(phase);
    }
    const trem = 1 - tremoloDepth * (0.5 + 0.5 * Math.sin(2 * Math.PI * tremoloHz * t));
    samples.push(32767 * volume * trem * s);
  }
  return samples;
}

function explosionTone() {
  const durationSec = 0.22;
  const n = Math.floor(SAMPLE_RATE * durationSec);
  const samples = [];
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    const decay = Math.exp(-t * 18);
    const low = Math.sin(2 * Math.PI * 85 * t);
    const high = Math.sin(2 * Math.PI * 320 * t) * (1 - t / durationSec);
    const s = (low * 0.7 + high * 0.3) * decay;
    samples.push(32767 * 0.32 * s);
  }
  return samples;
}

const sfx = [
  ["start", () => twoTone(523, 659, 0.25, 0.3)],
  ["carrot_collect", () => tone(880, 0.12, 0.35)],
  ["level_up", () => chord([523, 659, 784], 0.5, 0.25)],
  ["powerup_heart", () => twoTone(330, 262, 0.2, 0.28)],
  ["powerup_shield", () => tone(622, 0.2, 0.3)],
  ["powerup_speed", () => tone(800, 0.15, 0.3)],
  ["powerup_attract", () => twoTone(440, 554, 0.18, 0.28)],
  ["hit_damage", () => tone(180, 0.2, 0.4)],
  ["shield_deflect", () => tone(1200, 0.08, 0.25)],
  ["ball_explode", () => explosionTone()],
  ["death", () => tone(150, 0.4, 0.35)],
  ["carrot_shoot", () => tone(400, 0.06, 0.2)],
  ["blaster_shoot", () => tone(650, 0.05, 0.22)],
  ["ui_click", () => tone(600, 0.05, 0.25)],
];

const ambient = [
  // Rapid Rabbit: bright, fast-pulsing whir
  ["rapid_rabbit_loop", () => seamlessLoop(2, [
    { freq: 220, gain: 0.5, vibHz: 6, vibDepth: 12 },
    { freq: 330, gain: 0.35 },
    { freq: 660, gain: 0.12 },
  ], 8, 0.6, 0.16)],
  // Attract-o-Hare: slow magnetic warble
  ["attract_loop", () => seamlessLoop(2, [
    { freq: 150, gain: 0.55, vibHz: 3, vibDepth: 20 },
    { freq: 225, gain: 0.3, vibHz: 3, vibDepth: 30 },
  ], 2, 0.4, 0.16)],
];

const music = [
  ["music_menu", () => musicLoop(4, 0.12)],
  ["music_gameover", () => musicLoop(3, 0.1)],
];

const force = process.argv.includes("--force");
console.log("Generating placeholder sounds in", OUT_DIR, force ? "(overwriting)" : "(missing files only)");
for (const [name, gen] of [...sfx, ...ambient, ...music]) {
  const out = path.join(OUT_DIR, `${name}.wav`);
  // Music ships as .m4a; treat an existing encoded file as present too.
  const encoded = path.join(OUT_DIR, `${name}.m4a`);
  if (!force && (fs.existsSync(out) || fs.existsSync(encoded))) continue;
  writeWav(out, gen());
  console.log("  ", name + ".wav");
}
console.log("Done.");

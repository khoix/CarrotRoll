/**
 * List all scores for a given level (default 11) with name and score.
 *
 * Usage: npx tsx script/list-level-scores.ts [level]
 * Example: npx tsx script/list-level-scores.ts 11
 *
 * Uses same storage as the app (DATABASE_URL or data/scores.json).
 */

import { storage } from "../server/storage";

const level = parseInt(process.argv[2] ?? "11", 10);
if (Number.isNaN(level) || level < 1) {
  console.error("Usage: npx tsx script/list-level-scores.ts [level]");
  process.exit(1);
}

const scores = await storage.getTopScores();
const byLevel = scores.filter((s) => s.level === level).sort((a, b) => b.score - a.score);

console.log(`Level ${level} scores (${byLevel.length} total):\n`);
if (byLevel.length === 0) {
  console.log("  No scores for this level.");
} else {
  byLevel.forEach((s, i) => {
    console.log(`  ${i + 1}. ${s.name} — ${s.score}`);
  });
}

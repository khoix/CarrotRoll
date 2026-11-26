/**
 * Daily challenge: everyone plays the same seed for one UTC day. Shared by the client (to seed
 * the game) and the server (to accept scores only for today's or yesterday's challenge).
 */
export const CHALLENGE_DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** The UTC day as YYYY-MM-DD. */
export function utcDay(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

/** The day before a YYYY-MM-DD day. */
export function previousDay(day: string): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return utcDay(d);
}

/** A 32-bit seed for a day (FNV-1a over the day string). */
export function dailySeed(day: string): number {
  let h = 0x811c9dc5;
  const s = `carrotroll:${day}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Whether a score for this challenge day may be submitted now: today's, or yesterday's so a run
 * that started just before midnight UTC still counts.
 */
export function isOpenChallengeDay(day: string, now: Date = new Date()): boolean {
  if (!CHALLENGE_DAY_RE.test(day)) return false;
  const today = utcDay(now);
  return day === today || day === previousDay(today);
}

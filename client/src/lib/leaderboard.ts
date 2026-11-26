/**
 * Leaderboard tabs. Daily / Overall / Mobile show the current season only; "Classic" keeps the
 * old 20-level game's board viewable (scores there were made under easier rules).
 */
import { CURRENT_SEASON } from "@shared/schema";

export type ScoreRow = { id: number; name: string; score: number; level: number; device?: string; createdAt?: Date | string | null; season?: number };

function isToday(d: Date | string | null | undefined) {
  if (!d) return false;
  const date = typeof d === "string" ? new Date(d) : d;
  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
}

export function splitLeaderboard<T extends ScoreRow>(scores: T[] | undefined, top = 20) {
  const byScore = (a: T, b: T) => b.score - a.score;
  const list = scores ?? [];
  const current = list.filter((s) => (s.season ?? 1) === CURRENT_SEASON).sort(byScore);
  const classic = list.filter((s) => (s.season ?? 1) === 1).sort(byScore);
  return {
    daily: current.filter((s) => isToday(s.createdAt)).slice(0, top),
    overall: current.slice(0, top),
    mobile: current.filter((s) => s.device === "mobile").slice(0, top),
    classic: classic.slice(0, top),
  };
}

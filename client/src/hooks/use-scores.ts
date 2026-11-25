import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type InsertHighScore } from "@shared/routes";

const apiBase = (import.meta.env.BASE_URL || "").replace(/\/$/, "");

/**
 * Static builds (e.g. the GitHub Pages preview) have no server, so scores are kept in this
 * browser's localStorage instead of the shared leaderboard.
 */
export const STATIC_SITE = import.meta.env.VITE_STATIC_SITE === "true";
const LOCAL_KEY = "carrotroll_local_scores";
type Score = typeof api.scores.list.responses[200]["_output"][number];

function readLocal(): Score[] {
  try {
    const raw = JSON.parse(localStorage.getItem(LOCAL_KEY) || "[]");
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function writeLocal(input: InsertHighScore): Score {
  const validated = api.scores.create.input.parse(input);
  const list = readLocal();
  const entry = {
    id: list.reduce((m, s) => Math.max(m, s.id), 0) + 1,
    name: validated.name,
    score: validated.score,
    level: validated.level,
    device: validated.device,
    createdAt: new Date().toISOString(),
  } as unknown as Score;
  const next = [...list, entry].sort((a, b) => b.score - a.score).slice(0, 100);
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(next));
  } catch {
    // storage full / unavailable: score just isn't kept
  }
  return entry;
}

export function useScores() {
  return useQuery({
    queryKey: [api.scores.list.path],
    queryFn: async () => {
      if (STATIC_SITE) return readLocal();
      const url = apiBase + api.scores.list.path;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch scores");
      return api.scores.list.responses[200].parse(await res.json());
    },
  });
}

export function useCreateScore() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: InsertHighScore) => {
      if (STATIC_SITE) return writeLocal(data);
      const validated = api.scores.create.input.parse(data);
      const url = apiBase + api.scores.create.path;
      const res = await fetch(url, {
        method: api.scores.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
      });
      
      if (!res.ok) {
        if (res.status === 400) {
          const error = await res.json(); // Assuming error structure
          throw new Error(error.message || "Validation failed");
        }
        throw new Error("Failed to submit score");
      }
      return api.scores.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.scores.list.path] });
    },
  });
}

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type InsertHighScore } from "@shared/routes";

const apiBase = (import.meta.env.BASE_URL || "").replace(/\/$/, "");

export function useScores() {
  return useQuery({
    queryKey: [api.scores.list.path],
    queryFn: async () => {
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

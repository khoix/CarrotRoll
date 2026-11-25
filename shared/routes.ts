import { z } from "zod";
import { insertHighScoreSchema, updateHighScoreSchema, highScores } from "./schema";

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

export const api = {
  scores: {
    list: {
      method: "GET" as const,
      path: "/api/scores" as const,
      responses: {
        200: z.array(z.custom<typeof highScores.$inferSelect>()),
      },
    },
    create: {
      method: "POST" as const,
      path: "/api/scores" as const,
      input: insertHighScoreSchema,
      responses: {
        201: z.custom<typeof highScores.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
  },
  admin: {
    login: {
      method: "POST" as const,
      path: "/api/admin/login" as const,
      input: z.object({ username: z.string(), password: z.string() }),
      responses: {
        200: z.object({ ok: z.literal(true) }),
        401: errorSchemas.validation,
      },
    },
    changePassword: {
      method: "POST" as const,
      path: "/api/admin/change-password" as const,
      input: z.object({
        currentPassword: z.string(),
        newPassword: z.string().min(8, "Password must be at least 8 characters"),
      }),
      responses: {
        200: z.object({ ok: z.literal(true) }),
        400: errorSchemas.validation,
        401: errorSchemas.validation,
      },
    },
    check: {
      method: "GET" as const,
      path: "/api/admin/check" as const,
      responses: {
        200: z.object({ authenticated: z.boolean() }),
      },
    },
    scores: {
      list: {
        method: "GET" as const,
        path: "/api/admin/scores" as const,
        responses: {
          200: z.array(z.custom<typeof highScores.$inferSelect>()),
        },
      },
      update: {
        method: "PATCH" as const,
        path: "/api/admin/scores/:id" as const,
        input: updateHighScoreSchema,
        responses: {
          200: z.custom<typeof highScores.$inferSelect>(),
          400: errorSchemas.validation,
          404: errorSchemas.validation,
        },
      },
      delete: {
        method: "DELETE" as const,
        path: "/api/admin/scores/:id" as const,
        responses: {
          204: z.void(),
          404: errorSchemas.validation,
        },
      },
    },
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}

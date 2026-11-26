import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

const deviceEnum = ["mobile", "web", "unknown"] as const;
export type DeviceType = (typeof deviceEnum)[number];

export const highScores = pgTable("high_scores", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  score: integer("score").notNull(),
  level: integer("level").notNull(),
  device: text("device").$type<DeviceType>().default("unknown").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  /** Leaderboard season. 1 = "Classic" (the 20-level game); new scores get CURRENT_SEASON. */
  season: integer("season").default(1).notNull(),
});

/** Scores submitted now belong to this season; older seasons stay viewable. */
export const CURRENT_SEASON = 2;

const NAME_MAX_LENGTH = 10;
/** Allow letters (any script), numbers, spaces, and safe punctuation: ' - . */
const NAME_ALLOWED_REGEX = /^[\p{L}\p{N} '\-.]+$/u;

function normalizeName(s: string): string {
  return s.trim().normalize("NFC");
}

export const nameSchema = z
  .string()
  .trim()
  .transform(normalizeName)
  .refine((s) => s.length > 0, "Please enter a name")
  .refine((s) => s.length <= NAME_MAX_LENGTH, "Name must be 10 characters or less")
  .refine(
    (s) => !/[\x00-\x1f\x7f]/.test(s),
    "Name contains invalid characters"
  )
  .refine(
    (s) => NAME_ALLOWED_REGEX.test(s),
    "Name can only contain letters, numbers, spaces, and ' - ."
  );

const baseInsertSchema = createInsertSchema(highScores).omit({
  id: true,
  createdAt: true,
  device: true,
  season: true, // set by the server, never by the client
});

export const insertHighScoreSchema = baseInsertSchema.extend({
  name: nameSchema,
  device: z.enum(deviceEnum).optional().default("unknown"),
});

/** Validate name for client/server; returns error message or undefined if valid. */
export function validateName(name: string): { success: true } | { success: false; error: string } {
  const result = nameSchema.safeParse(name);
  if (result.success) return { success: true };
  const msg = result.error.flatten().formErrors[0] ?? "Invalid name";
  return { success: false, error: msg };
}

export const updateHighScoreSchema = z.object({
  name: nameSchema.optional(),
  score: z.number().int().min(0).optional(),
  level: z.number().int().min(1).optional(),
  device: z.enum(deviceEnum).optional(),
});

export type HighScore = typeof highScores.$inferSelect;
export type InsertHighScore = z.infer<typeof insertHighScoreSchema>;
export type UpdateHighScore = z.infer<typeof updateHighScoreSchema>;

export type CreateHighScoreRequest = InsertHighScore;
export type HighScoreResponse = HighScore;

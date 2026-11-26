import { db } from "./db";
import { CURRENT_SEASON, highScores, type InsertHighScore, type HighScore, type UpdateHighScore } from "@shared/schema";
import { previousDay, utcDay } from "@shared/daily";
import { and, desc, eq, isNull } from "drizzle-orm";
import { promises as fs } from "fs";
import { join } from "path";

export interface IStorage {
  getTopScores(): Promise<HighScore[]>;
  createScore(score: InsertHighScore): Promise<HighScore>;
  getAllScores(): Promise<HighScore[]>;
  updateScore(id: number, data: UpdateHighScore): Promise<HighScore | null>;
  deleteScore(id: number): Promise<boolean>;
}

export class DatabaseStorage implements IStorage {
  /**
   * Top 500 normal runs of the current season, top 500 of the classic board, and the top 100 of
   * today's and yesterday's daily challenges.
   */
  async getTopScores(): Promise<HighScore[]> {
    if (!db) throw new Error("Database not configured");
    const top = (season: number) =>
      db!.select().from(highScores).where(and(eq(highScores.season, season), isNull(highScores.challenge))).orderBy(desc(highScores.score)).limit(500);
    const today = utcDay();
    const challenge = (day: string) =>
      db!.select().from(highScores).where(eq(highScores.challenge, day)).orderBy(desc(highScores.score)).limit(100);
    const [current, classic, daily, yesterday] = await Promise.all([top(CURRENT_SEASON), top(1), challenge(today), challenge(previousDay(today))]);
    return [...current, ...classic, ...daily, ...yesterday];
  }

  async createScore(insertScore: InsertHighScore): Promise<HighScore> {
    if (!db) throw new Error("Database not configured");
    const [score] = await db.insert(highScores).values({ ...insertScore, challenge: insertScore.challenge ?? null, season: CURRENT_SEASON }).returning();
    return score;
  }

  async getAllScores(): Promise<HighScore[]> {
    if (!db) throw new Error("Database not configured");
    return await db.select().from(highScores).orderBy(desc(highScores.score));
  }

  async updateScore(id: number, data: UpdateHighScore): Promise<HighScore | null> {
    if (!db) throw new Error("Database not configured");
    const [updated] = await db.update(highScores).set(data).where(eq(highScores.id, id)).returning();
    return updated ?? null;
  }

  async deleteScore(id: number): Promise<boolean> {
    if (!db) throw new Error("Database not configured");
    const result = await db.delete(highScores).where(eq(highScores.id, id));
    return (result.rowCount ?? 0) > 0;
  }
}

function isToday(d: Date): boolean {
  const now = new Date();
  return (
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear()
  );
}

function toRow({ id, name, score, level, device, createdAt, season, challenge }: HighScore): HighScore {
  return {
    id,
    name,
    score,
    level,
    device: device ?? "unknown",
    createdAt: createdAt ?? new Date(),
    season: season ?? 1,
    challenge: challenge ?? null,
  };
}

/** File-based storage that persists scores to disk when DATABASE_URL is not set. */
class FileStorage implements IStorage {
  private scores: (HighScore & { createdAt?: Date })[] = [];
  private nextId = 1;
  private filePath: string;

  constructor() {
    // Store scores file in a 'data' directory relative to the server
    const dataDir = join(process.cwd(), "data");
    this.filePath = join(dataDir, "scores.json");
    this.loadScores().catch((err) => {
      console.error("Failed to load scores from file:", err);
    });
  }

  private async ensureDataDir(): Promise<void> {
    const dataDir = join(process.cwd(), "data");
    try {
      await fs.access(dataDir);
    } catch {
      await fs.mkdir(dataDir, { recursive: true });
    }
  }

  private async loadScores(): Promise<void> {
    try {
      await this.ensureDataDir();
      const data = await fs.readFile(this.filePath, "utf-8");
      const parsed = JSON.parse(data);

      if (Array.isArray(parsed.scores)) {
        this.scores = parsed.scores.map((s: any) => {
          const createdAt = s.createdAt ? new Date(s.createdAt) : new Date();
          const device =
            s.device && ["mobile", "web", "unknown"].includes(s.device)
              ? s.device
              : isToday(createdAt)
                ? "mobile"
                : "unknown";
          return {
            ...s,
            createdAt,
            device,
            season: typeof s.season === "number" ? s.season : 1,
          };
        });
      }

      if (typeof parsed.nextId === "number") {
        this.nextId = parsed.nextId;
      } else if (this.scores.length > 0) {
        // If no nextId but we have scores, find the max ID
        this.nextId = Math.max(...this.scores.map((s) => s.id)) + 1;
      }
    } catch (err: any) {
      // File doesn't exist or is invalid, start fresh
      if (err.code !== "ENOENT") {
        console.warn("Could not load scores file, starting fresh:", err.message);
      }
      this.scores = [];
      this.nextId = 1;
    }
  }

  private async saveScores(): Promise<void> {
    try {
      await this.ensureDataDir();
      const data = {
        scores: this.scores,
        nextId: this.nextId,
      };
      await fs.writeFile(this.filePath, JSON.stringify(data, null, 2), "utf-8");
    } catch (err) {
      console.error("Failed to save scores to file:", err);
      // Don't throw - we don't want to fail the request if file write fails
    }
  }

  /** Same shape as DatabaseStorage.getTopScores. */
  async getTopScores(): Promise<HighScore[]> {
    const sorted = [...this.scores].sort((a, b) => b.score - a.score);
    const top = (season: number) => sorted.filter((s) => (s.season ?? 1) === season && !s.challenge).slice(0, 500);
    const today = utcDay();
    const challenge = (day: string) => sorted.filter((s) => s.challenge === day).slice(0, 100);
    return [...top(CURRENT_SEASON), ...top(1), ...challenge(today), ...challenge(previousDay(today))].map(toRow);
  }

  async createScore(insertScore: InsertHighScore): Promise<HighScore> {
    const row = {
      id: this.nextId++,
      name: insertScore.name,
      score: insertScore.score,
      level: insertScore.level,
      device: insertScore.device ?? "unknown",
      createdAt: new Date(),
      season: CURRENT_SEASON,
      challenge: insertScore.challenge ?? null,
    };
    this.scores.push(row);
    await this.saveScores();
    return row;
  }

  async getAllScores(): Promise<HighScore[]> {
    return [...this.scores].sort((a, b) => b.score - a.score).map(toRow);
  }

  async updateScore(id: number, data: UpdateHighScore): Promise<HighScore | null> {
    const idx = this.scores.findIndex((s) => s.id === id);
    if (idx === -1) return null;
    const row = this.scores[idx];
    if (data.name !== undefined) row.name = data.name;
    if (data.score !== undefined) row.score = data.score;
    if (data.level !== undefined) row.level = data.level;
    if (data.device !== undefined) row.device = data.device;
    await this.saveScores();
    return toRow(row);
  }

  async deleteScore(id: number): Promise<boolean> {
    const idx = this.scores.findIndex((s) => s.id === id);
    if (idx === -1) return false;
    this.scores.splice(idx, 1);
    await this.saveScores();
    return true;
  }
}

export const storage = db ? new DatabaseStorage() : new FileStorage();

import { db } from "./db";
import { highScores, type InsertHighScore, type HighScore } from "@shared/schema";
import { desc } from "drizzle-orm";

export interface IStorage {
  getTopScores(): Promise<HighScore[]>;
  createScore(score: InsertHighScore): Promise<HighScore>;
}

export class DatabaseStorage implements IStorage {
  async getTopScores(): Promise<HighScore[]> {
    return await db
      .select()
      .from(highScores)
      .orderBy(desc(highScores.score))
      .limit(10);
  }

  async createScore(insertScore: InsertHighScore): Promise<HighScore> {
    const [score] = await db.insert(highScores).values(insertScore).returning();
    return score;
  }
}

export const storage = new DatabaseStorage();

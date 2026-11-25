/**
 * One-time migration: add `device` column to high_scores and backfill.
 * - Adds column with default 'unknown' if not present.
 * - Sets device = 'mobile' for scores from today; leaves others as 'unknown'.
 *
 * Run with: npx tsx script/migrate-device.ts
 * Requires DATABASE_URL.
 */

import pg from "pg";

const { Pool } = pg;

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }

  const pool = new Pool({ connectionString: url });

  try {
    // Add column if not exists (PostgreSQL 9.5+)
    await pool.query(`
      ALTER TABLE high_scores
      ADD COLUMN IF NOT EXISTS device TEXT NOT NULL DEFAULT 'unknown'
    `);
    console.log("Column 'device' ensured.");

    // Set today's scores to 'mobile' (compare dates in UTC)
    const r = await pool.query(`
      UPDATE high_scores
      SET device = 'mobile'
      WHERE (created_at AT TIME ZONE 'UTC')::date = (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date
      RETURNING id
    `);
    console.log(`Set device = 'mobile' for ${r.rowCount ?? 0} score(s) from today.`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

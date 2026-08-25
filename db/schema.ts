import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const scores = sqliteTable(
  "scores",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id").notNull(),
    callsign: text("callsign").notNull(),
    score: integer("score").notNull(),
    mode: text("mode", {
      enum: ["campaign", "daily", "arcade"],
    }).notNull(),
    stage: integer("stage").notNull().default(-1),
    difficulty: text("difficulty", {
      enum: ["cadet", "standard", "overdrive"],
    }).notNull(),
    dailyKey: text("daily_key").notNull().default(""),
    kills: integer("kills").notNull().default(0),
    absorbed: integer("absorbed").notNull().default(0),
    comboX100: integer("combo_x100").notNull().default(100),
    durationMs: integer("duration_ms").notNull().default(0),
    completed: integer("completed", { mode: "boolean" })
      .notNull()
      .default(false),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("scores_user_scope_unique").on(
      table.userId,
      table.mode,
      table.stage,
      table.difficulty,
      table.dailyKey,
    ),
    index("scores_leaderboard_idx").on(
      table.mode,
      table.stage,
      table.difficulty,
      table.dailyKey,
      table.score,
      table.updatedAt,
    ),
    check(
      "scores_callsign_length_check",
      sql`length(${table.callsign}) BETWEEN 1 AND 24`,
    ),
    check(
      "scores_score_range_check",
      sql`${table.score} BETWEEN 1 AND 100000000`,
    ),
    check(
      "scores_stats_range_check",
      sql`${table.kills} BETWEEN 0 AND 100000 AND ${table.absorbed} BETWEEN 0 AND 100000 AND ${table.comboX100} BETWEEN 100 AND 100000 AND ${table.durationMs} BETWEEN 0 AND 3600000`,
    ),
    check(
      "scores_scope_check",
      sql`(${table.mode} = 'campaign' AND ${table.stage} BETWEEN 0 AND 5 AND ${table.dailyKey} = '') OR (${table.mode} = 'daily' AND ${table.stage} = -1 AND ${table.difficulty} = 'standard' AND length(${table.dailyKey}) = 10) OR (${table.mode} = 'arcade' AND ${table.stage} = -1 AND ${table.dailyKey} = '')`,
    ),
  ],
);

export type Score = typeof scores.$inferSelect;
export type NewScore = typeof scores.$inferInsert;

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";

function applyMigration(database, file) {
  const sql = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
  for (const statement of sql.split("--> statement-breakpoint").map((value) => value.trim()).filter(Boolean)) {
    database.exec(statement);
  }
}

test("campaign scope migration preserves scores and accepts stage 100", () => {
  const database = new DatabaseSync(":memory:");
  applyMigration(database, "drizzle/0000_sour_blindfold.sql");
  database.exec("INSERT INTO scores(user_id,callsign,score,mode,stage,difficulty) VALUES ('u1','P',100,'campaign',5,'cadet')");
  applyMigration(database, "drizzle/0001_expand_campaign_scope.sql");
  database.exec("INSERT INTO scores(user_id,callsign,score,mode,stage,difficulty) VALUES ('u2','P',200,'campaign',100,'cadet')");
  const result = database.prepare("SELECT COUNT(*) AS count, MAX(stage) AS maxStage FROM scores").get();
  assert.equal(result.count, 2);
  assert.equal(result.maxStage, 100);
  database.close();
});

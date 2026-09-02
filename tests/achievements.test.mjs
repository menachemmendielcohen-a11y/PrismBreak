import test from "node:test";
import assert from "node:assert/strict";
import { ACHIEVEMENT_DEFINITIONS, evaluateAchievements, migrateAchievementSave, recordAchievementRun } from "../app/achievements.ts";

const run = { mode: "campaign", victory: true, stageId: 1, primeId: null, threatLevel: 0, kills: 100, eliteKills: 1, absorbed: 50, bestCombo: 4, hitsTaken: 0, shardsEarned: 20 };

test("achievement definitions are unique and bilingual", () => {
  assert.ok(ACHIEVEMENT_DEFINITIONS.length >= 20);
  assert.equal(new Set(ACHIEVEMENT_DEFINITIONS.map((item) => item.id)).size, ACHIEVEMENT_DEFINITIONS.length);
  for (const item of ACHIEVEMENT_DEFINITIONS) assert.ok(item.en.title && item.he.title && item.goal > 0);
});

test("achievement migration preserves legacy progress", () => {
  const save = migrateAchievementSave(null, { stars: { "0:cadet": 3, "1:standard": 2 }, primeBestTimes: { "prime-1": 80 }, prismShards: 90, highestThreat: 25 });
  assert.deepEqual(save.campaignClears, [0, 1]);
  assert.deepEqual(save.primeClears, ["prime-1"]);
  assert.equal(save.stats.shards, 90);
  assert.equal(save.stats.threat, 25);
});

test("runs unlock achievements and rewards only once", () => {
  const first = recordAchievementRun(null, run);
  assert.ok(first.newlyUnlocked.length >= 5);
  assert.ok(first.reward > 0);
  assert.equal(first.save.stats.shards, run.shardsEarned + first.reward);
  const second = evaluateAchievements(JSON.parse(JSON.stringify(first.save)));
  assert.equal(second.newlyUnlocked.length, 0);
  assert.equal(second.reward, 0);
});

test("failed runs count stats but not clear milestones", () => {
  const result = recordAchievementRun(null, { ...run, mode: "threat", victory: false, threatLevel: 100, hitsTaken: 2 });
  assert.equal(result.save.stats.kills, 100);
  assert.equal(result.save.stats.threat, 0);
  assert.ok(!result.save.unlockedIds.includes("threat-100"));
});

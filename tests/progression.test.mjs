import test from "node:test";
import assert from "node:assert/strict";
import {
  PRIME_MISSIONS,
  PERSISTENT_POWER_IDS,
  calculateShardReward,
  canUnlockPrime,
  maxThreatAttempt,
  migrateProgressionSave,
  purchasePrime,
  selectThreatModifiers,
  threatRewardRange,
  threatScaling,
} from "../app/progression.ts";

test("new-player progression defaults are safe and preserve legacy coins", () => {
  const fresh = migrateProgressionSave(null);
  assert.equal(fresh.prismShards, 0);
  assert.equal(fresh.rank, 1);
  assert.equal(fresh.highestThreat, 0);
  assert.equal(fresh.highestThreatAvailable, 10);
  assert.deepEqual(fresh.unlockedPrimeIds, []);
  assert.deepEqual(fresh.unlockedPowerIds, []);

  const migrated = migrateProgressionSave({ coins: 87, healthBonus: 2, unlockedStage: 4 });
  assert.equal(migrated.prismShards, 87);
  assert.equal(migrated.healthBonus, 2);
});

test("rare Prism Core power unlocks migrate and persist permanently", () => {
  const restored = migrateProgressionSave(JSON.parse(JSON.stringify({
    unlockedPowerIds: ["focus", "lance", "invalid-power"],
  })));
  assert.deepEqual(restored.unlockedPowerIds, ["focus", "lance"]);
  assert.ok(restored.saveVersion >= 4);

  const legacy = migrateProgressionSave({ unlockedPowers: { overclock: true, focus: false } });
  assert.deepEqual(legacy.unlockedPowerIds, ["overclock"]);
  assert.deepEqual(PERSISTENT_POWER_IDS, ["focus", "overclock", "lance"]);
});

test("Prism Shards and permanent Prime purchases survive serialization", () => {
  const mission = PRIME_MISSIONS[0];
  const purchase = purchasePrime(100, 4, mission, []);
  assert.equal(purchase.shards, 40);
  assert.deepEqual(purchase.unlockedIds, [mission.id]);
  const restored = migrateProgressionSave(JSON.parse(JSON.stringify({ prismShards: purchase.shards, unlockedPrimeIds: purchase.unlockedIds })));
  assert.equal(restored.prismShards, 40);
  assert.deepEqual(restored.unlockedPrimeIds, [mission.id]);
  assert.equal(canUnlockPrime(restored.prismShards, 4, mission, restored.unlockedPrimeIds), false);
});

test("locked Prime missions cannot be purchased and currency never goes negative", () => {
  const mission = PRIME_MISSIONS[1];
  assert.deepEqual(purchasePrime(999, mission.requiredRank - 1, mission, []), { shards: 999, unlockedIds: [] });
  assert.deepEqual(purchasePrime(mission.unlockCost - 1, mission.requiredRank, mission, []), { shards: mission.unlockCost - 1, unlockedIds: [] });
});

test("paid Prime missions are approachable bonus stages rather than hidden Threat levels", () => {
  for (const mission of PRIME_MISSIONS) {
    assert.equal(mission.difficulty, "cadet");
    assert.deepEqual(mission.modifiers, []);
    assert.ok(mission.bonuses.includes("drop_surge"));
    assert.ok(mission.bonuses.length >= 3);
    assert.ok(mission.scaling.enemyHealth <= 0.9);
    assert.ok(mission.scaling.enemySpeed <= 0.9);
    assert.ok(mission.scaling.projectileSpeed <= 0.9);
    assert.ok(mission.scaling.dashCooldown <= 0.82);
    assert.equal(mission.scaling.integrityPenalty, 0);
    assert.equal(mission.scaling.novaDrain, 0);
    assert.ok(mission.maxActiveElites <= 1);
    assert.ok(mission.reward[0] >= 14 && mission.reward[1] > mission.reward[0]);
  }
  assert.ok(PRIME_MISSIONS.every((mission) => mission.objective === "survive" || mission.objective === "kills"));
  assert.ok(Math.max(...PRIME_MISSIONS.filter((mission) => mission.objective === "kills").map((mission) => mission.target)) <= 40);
});

test("Threat scaling stays gradual and finite from 1 through 1000+", () => {
  const levels = [1, 5, 10, 20, 40, 60, 100, 200, 500, 1000, 5000];
  const rows = levels.map((level) => threatScaling(level));
  for (const row of rows) {
    for (const value of Object.values(row)) assert.ok(Number.isFinite(value));
    assert.ok(row.enemyHealth <= 3.25);
    assert.ok(row.enemySpeed <= 1.55);
    assert.ok(row.projectileSpeed <= 1.9);
    assert.ok(row.spawnRate <= 2.2);
    assert.ok(row.maxEnemies <= 72);
  }
  assert.ok(rows[2].enemyHealth <= 1.01, "Threat 10 should remain very easy");
  assert.ok(rows.at(-1).enemyHealth >= rows[0].enemyHealth);
  assert.ok(threatRewardRange(1000)[0] > threatRewardRange(100)[0]);
});

test("Threat milestone bands match the intended difficulty curve", () => {
  const easy1 = threatScaling(1, []);
  const easy10 = threatScaling(10, []);
  const medium25 = threatScaling(25, []);
  const hardening50 = threatScaling(50, []);
  const hard100 = threatScaling(100, []);
  assert.ok(easy1.enemyHealth < 0.85 && easy1.spawnRate < 0.85);
  assert.ok(easy10.enemyHealth <= 1 && easy10.projectileSpeed <= 1);
  assert.ok(medium25.enemyHealth > easy10.enemyHealth && medium25.enemyHealth <= 1.3);
  assert.ok(hardening50.enemyHealth >= 1.5 && hardening50.spawnRate >= 1.3);
  assert.ok(hard100.enemyHealth >= 1.9 && hard100.projectileSpeed >= 1.4);
});

test("Threat milestones have no sudden boundary spikes", () => {
  const boundaries = [[25, 26], [50, 51], [80, 81], [120, 121]];
  for (const [beforeLevel, afterLevel] of boundaries) {
    const before = threatScaling(beforeLevel);
    const after = threatScaling(afterLevel);
    for (const key of ["enemyHealth", "enemySpeed", "projectileSpeed", "spawnRate", "attackRate"]) {
      assert.ok(after[key] / before[key] < 1.1, `${key} spikes at Threat ${afterLevel}`);
    }
    assert.ok(after.maxEnemies - before.maxEnemies <= 4, `enemy density spikes at Threat ${afterLevel}`);
  }
});

test("Threat unlock range allows risk without opening every level", () => {
  assert.equal(maxThreatAttempt(0), 10);
  assert.equal(maxThreatAttempt(20), 30);
  assert.equal(maxThreatAttempt(100), 150);
});

test("modifier selection avoids impossible pressure combinations", () => {
  const incompatible = [
    ["high_density", "rapid_spawn"],
    ["high_density", "low_integrity"],
    ["double_fire", "high_density"],
    ["double_fire", "low_integrity"],
    ["double_fire", "fast_projectiles"],
    ["fast_projectiles", "low_integrity"],
    ["dash_cooldown", "fast_projectiles"],
    ["low_integrity", "nova_drain"],
    ["low_integrity", "rapid_spawn"],
    ["aggressive_enemies", "low_integrity"],
    ["dash_cooldown", "nova_drain"],
    ["elite_swarm", "rapid_spawn"],
    ["dash_cooldown", "low_integrity"],
  ];
  for (const level of [1, 10, 20, 25, 26, 40, 50, 51, 60, 80, 81, 100, 120, 121, 200, 500, 1000, 5000]) {
    const modifiers = selectThreatModifiers(level);
    assert.equal(new Set(modifiers).size, modifiers.length, `duplicate modifier at Threat ${level}`);
    for (const [left, right] of incompatible) {
      assert.ok(!(modifiers.includes(left) && modifiers.includes(right)), `${left} + ${right} at Threat ${level}`);
    }
  }
});

test("failed difficult runs still grant partial progress", () => {
  const metrics = { victory: false, score: 12000, targetScore: 50000, bestCombo: 3, hitsTaken: 3, elapsed: 72, duration: 100, absorbed: 8 };
  assert.ok(calculateShardReward("threat", metrics, undefined, 50) > 0);
  const clear = calculateShardReward("threat", { ...metrics, victory: true, hitsTaken: 0 }, undefined, 50);
  assert.ok(clear > calculateShardReward("threat", metrics, undefined, 50));
});

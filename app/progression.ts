export type ProgressionRunMode = "campaign" | "prime" | "threat" | "daily" | "arcade";

export type ThreatModifierId =
  | "double_fire"
  | "elite_swarm"
  | "fast_projectiles"
  | "nova_drain"
  | "dash_cooldown"
  | "high_density"
  | "aggressive_enemies"
  | "low_integrity"
  | "rapid_spawn";

export interface ThreatScaling {
  enemyHealth: number;
  enemySpeed: number;
  projectileSpeed: number;
  spawnRate: number;
  maxEnemies: number;
  eliteChance: number;
  attackRate: number;
  dashCooldown: number;
  integrityPenalty: number;
  novaDrain: number;
}

export interface PrimeMissionDefinition {
  id: string;
  code: string;
  name: string;
  requiredRank: number;
  unlockCost: number;
  duration: number;
  objective: "survive" | "kills" | "absorb";
  target: number;
  reward: [number, number];
  modifiers: ThreatModifierId[];
}

export interface RewardMetrics {
  victory: boolean;
  score: number;
  targetScore: number;
  bestCombo: number;
  hitsTaken: number;
  elapsed: number;
  duration: number;
  absorbed: number;
}

export interface ProgressionSave {
  saveVersion: number;
  prismShards: number;
  healthBonus: number;
  unlockedPrimeIds: string[];
  primeBestTimes: Record<string, number>;
  highestThreat: number;
  highestThreatAvailable: number;
  threatBestScore: number;
  threatBestClearTime: number | null;
  rank: number;
  rankXp: number;
  totalRuns: number;
  successfulRuns: number;
}

export const PROGRESSION_BALANCE = {
  saveVersion: 3,
  campaignReward: { completion: 5, performanceMax: 5, comboMax: 5, perfectBonus: 3 },
  healthUpgradeCosts: [30, 65, 110, 170, 245, 335],
  threat: {
    initialMax: 10,
    duration: 100,
    modifierLevels: [26, 51, 81, 121],
    hpCap: 3.25,
    speedCap: 1.55,
    projectileCap: 1.9,
    spawnCap: 2.2,
    attackCap: 2.15,
    enemyCap: 72,
  },
} as const;

export const PRIME_MISSIONS: PrimeMissionDefinition[] = [
  { id: "prime-1", code: "PRIME // I", name: "VELOCITY LOCK", requiredRank: 4, unlockCost: 60, duration: 85, objective: "survive", target: 85, reward: [12, 22], modifiers: ["fast_projectiles", "elite_swarm"] },
  { id: "prime-2", code: "PRIME // II", name: "EXTERMINATION GRID", requiredRank: 8, unlockCost: 120, duration: 100, objective: "kills", target: 110, reward: [22, 38], modifiers: ["rapid_spawn", "dash_cooldown", "aggressive_enemies"] },
  { id: "prime-3", code: "PRIME // III", name: "ABSORPTION PARADOX", requiredRank: 15, unlockCost: 220, duration: 110, objective: "absorb", target: 90, reward: [35, 58], modifiers: ["nova_drain", "high_density", "fast_projectiles"] },
];

export function migrateProgressionSave(raw: unknown): ProgressionSave {
  const value = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  const highestThreat = Math.max(0, Math.floor(Number(value.highestThreat) || 0));
  const legacyCoins = Math.max(0, Math.floor(Number(value.coins) || 0));
  const prismShards = Math.max(0, Math.floor(Number(value.prismShards) || legacyCoins));
  const primeBestTimes = value.primeBestTimes && typeof value.primeBestTimes === "object" ? value.primeBestTimes as Record<string, number> : {};
  return {
    saveVersion: PROGRESSION_BALANCE.saveVersion,
    prismShards,
    healthBonus: clamp(Math.floor(Number(value.healthBonus) || 0), 0, PROGRESSION_BALANCE.healthUpgradeCosts.length),
    unlockedPrimeIds: Array.isArray(value.unlockedPrimeIds) ? value.unlockedPrimeIds.filter((id): id is string => typeof id === "string") : [],
    primeBestTimes,
    highestThreat,
    highestThreatAvailable: Math.max(PROGRESSION_BALANCE.threat.initialMax, Math.floor(Number(value.highestThreatAvailable) || maxThreatAttempt(highestThreat))),
    threatBestScore: Math.max(0, Math.floor(Number(value.threatBestScore) || 0)),
    threatBestClearTime: typeof value.threatBestClearTime === "number" && Number.isFinite(value.threatBestClearTime) ? value.threatBestClearTime : null,
    rank: Math.max(1, Math.floor(Number(value.rank) || 1)),
    rankXp: Math.max(0, Math.floor(Number(value.rankXp) || 0)),
    totalRuns: Math.max(0, Math.floor(Number(value.totalRuns) || 0)),
    successfulRuns: Math.max(0, Math.floor(Number(value.successfulRuns) || 0)),
  };
}

const MODIFIER_MIN_LEVEL: Record<ThreatModifierId, number> = {
  double_fire: 81,
  elite_swarm: 26,
  fast_projectiles: 26,
  nova_drain: 81,
  dash_cooldown: 51,
  high_density: 51,
  aggressive_enemies: 26,
  low_integrity: 121,
  rapid_spawn: 26,
};

const INCOMPATIBLE = new Set([
  "high_density+rapid_spawn",
  "high_density+low_integrity",
  "double_fire+high_density",
  "double_fire+low_integrity",
  "double_fire+fast_projectiles",
  "fast_projectiles+low_integrity",
  "dash_cooldown+fast_projectiles",
  "low_integrity+nova_drain",
  "low_integrity+rapid_spawn",
  "aggressive_enemies+low_integrity",
  "dash_cooldown+nova_drain",
  "elite_swarm+rapid_spawn",
  "dash_cooldown+low_integrity",
]);

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function calculatePlayerRank(totalStars: number, highestThreat: number, primeClears: number, rankXp = 0) {
  return Math.max(1, 1 + Math.floor(Math.max(0, totalStars) / 2) + Math.floor(Math.sqrt(Math.max(0, highestThreat)) / 2) + Math.max(0, primeClears) * 2 + Math.floor(Math.max(0, rankXp) / 5));
}

export function maxThreatAttempt(highestCompleted: number) {
  if (highestCompleted <= 0) return PROGRESSION_BALANCE.threat.initialMax;
  return Math.max(10, highestCompleted + Math.max(5, Math.ceil(highestCompleted * 0.5)));
}

export function threatRewardRange(level: number): [number, number] {
  const safe = Math.max(1, Math.round(level));
  const expected = Math.round(4 + safe * 0.78 + Math.pow(safe, 1.12) * 0.02);
  return [Math.max(5, Math.round(expected * 0.78)), Math.round(expected * 1.22)];
}

export function selectThreatModifiers(level: number): ThreatModifierId[] {
  const safe = Math.max(1, Math.round(level));
  const count = PROGRESSION_BALANCE.threat.modifierLevels.filter((threshold) => safe >= threshold).length;
  if (count === 0) return [];
  const selected: ThreatModifierId[] = [];
  for (let slot = 0; slot < count; slot += 1) {
    const anchor = PROGRESSION_BALANCE.threat.modifierLevels[slot];
    const pool = (Object.keys(MODIFIER_MIN_LEVEL) as ThreatModifierId[]).filter((id) => anchor >= MODIFIER_MIN_LEVEL[id]);
    for (let offset = 0; offset < pool.length; offset += 1) {
      const candidate = pool[(anchor * 7 + offset) % pool.length];
      const impossible = selected.some((current) => INCOMPATIBLE.has([current, candidate].sort().join("+")));
      if (!selected.includes(candidate) && !impossible) { selected.push(candidate); break; }
    }
  }
  return selected;
}

export function threatScaling(level: number, modifiers = selectThreatModifiers(level)): ThreatScaling {
  const safe = Math.max(1, Math.round(level));
  const band = safe <= 10
    ? { from: 1, to: 10, hp: [0.78, 1], speed: [0.82, 1], projectile: [0.8, 1], spawn: [0.78, 1], enemies: [18, 26], elite: [0, 0.03], attack: [0.82, 1] }
    : safe <= 25
      ? { from: 10, to: 25, hp: [1, 1.25], speed: [1, 1.1], projectile: [1, 1.1], spawn: [1, 1.15], enemies: [26, 33], elite: [0.03, 0.08], attack: [1, 1.12] }
      : safe <= 50
        ? { from: 25, to: 50, hp: [1.25, 1.55], speed: [1.1, 1.22], projectile: [1.1, 1.27], spawn: [1.15, 1.34], enemies: [33, 40], elite: [0.08, 0.15], attack: [1.12, 1.3] }
        : safe <= 100
          ? { from: 50, to: 100, hp: [1.55, 1.95], speed: [1.22, 1.36], projectile: [1.27, 1.46], spawn: [1.34, 1.58], enemies: [40, 49], elite: [0.15, 0.23], attack: [1.3, 1.52] }
          : null;
  const progress = band ? clamp((safe - band.from) / (band.to - band.from), 0, 1) : 1;
  const interpolate = (values: number[]) => values[0] + (values[1] - values[0]) * progress;
  const endless = Math.log1p(Math.max(0, safe - 100) / 100);
  const scaling: ThreatScaling = {
    enemyHealth: Math.min(PROGRESSION_BALANCE.threat.hpCap, band ? interpolate(band.hp) : 1.95 + endless * 0.24),
    enemySpeed: Math.min(PROGRESSION_BALANCE.threat.speedCap, band ? interpolate(band.speed) : 1.36 + endless * 0.045),
    projectileSpeed: Math.min(1.7, band ? interpolate(band.projectile) : 1.46 + endless * 0.06),
    spawnRate: Math.min(1.9, band ? interpolate(band.spawn) : 1.58 + endless * 0.075),
    maxEnemies: Math.min(64, Math.round(band ? interpolate(band.enemies) : 49 + endless * 3.5)),
    eliteChance: Math.min(0.4, band ? interpolate(band.elite) : 0.23 + endless * 0.035),
    attackRate: Math.min(1.9, band ? interpolate(band.attack) : 1.52 + endless * 0.075),
    dashCooldown: 1,
    integrityPenalty: 0,
    novaDrain: 0,
  };
  const strength = (id: ThreatModifierId) => {
    const index = modifiers.indexOf(id);
    if (index < 0) return 0;
    const start = PROGRESSION_BALANCE.threat.modifierLevels[Math.min(index, PROGRESSION_BALANCE.threat.modifierLevels.length - 1)];
    const full = [50, 80, 120, 180][Math.min(index, 3)];
    const progress = clamp((safe - start) / Math.max(1, full - start), 0, 1);
    const smooth = progress * progress * (3 - 2 * progress);
    return 0.15 + 0.85 * smooth;
  };
  const fastStrength = strength("fast_projectiles");
  const spawnStrength = strength("rapid_spawn");
  const densityStrength = strength("high_density");
  const eliteStrength = strength("elite_swarm");
  const aggressiveStrength = strength("aggressive_enemies");
  const doubleStrength = strength("double_fire");
  const dashStrength = strength("dash_cooldown");
  const integrityStrength = strength("low_integrity");
  const novaStrength = strength("nova_drain");
  if (fastStrength) scaling.projectileSpeed = Math.min(PROGRESSION_BALANCE.threat.projectileCap, scaling.projectileSpeed * (1 + 0.18 * fastStrength));
  if (spawnStrength) scaling.spawnRate = Math.min(PROGRESSION_BALANCE.threat.spawnCap, scaling.spawnRate * (1 + 0.2 * spawnStrength));
  if (densityStrength) scaling.maxEnemies = Math.min(PROGRESSION_BALANCE.threat.enemyCap, scaling.maxEnemies + Math.round(12 * densityStrength));
  if (eliteStrength) scaling.eliteChance = Math.min(0.58, scaling.eliteChance + 0.16 * eliteStrength);
  if (aggressiveStrength) scaling.attackRate = Math.min(PROGRESSION_BALANCE.threat.attackCap, scaling.attackRate * (1 + 0.2 * aggressiveStrength));
  if (doubleStrength) scaling.attackRate = Math.min(PROGRESSION_BALANCE.threat.attackCap, scaling.attackRate * (1 + 0.28 * doubleStrength));
  if (dashStrength) scaling.dashCooldown = 1 + 0.45 * dashStrength;
  if (integrityStrength >= 0.7) scaling.integrityPenalty = 1;
  if (novaStrength) scaling.novaDrain = 2.4 * novaStrength;
  return scaling;
}

export function calculateShardReward(mode: ProgressionRunMode, metrics: RewardMetrics, prime?: PrimeMissionDefinition, threatLevel = 1) {
  const scoreRatio = clamp(metrics.score / Math.max(1, metrics.targetScore), 0, 1);
  const comboRatio = clamp((metrics.bestCombo - 1) / 7, 0, 1);
  const speedRatio = clamp((metrics.duration - metrics.elapsed) / Math.max(1, metrics.duration * 0.35), 0, 1);
  const performance = clamp((scoreRatio * 0.42 + comboRatio * 0.35 + speedRatio * 0.23), 0, 1);
  const perfect = metrics.hitsTaken === 0 ? 1 : 0;
  if (!metrics.victory) {
    const effort = clamp(metrics.elapsed / Math.max(1, metrics.duration), 0, 1);
    const base = mode === "threat" ? threatRewardRange(threatLevel)[0] : mode === "prime" && prime ? prime.reward[0] : 4;
    return Math.max(1, Math.round(base * effort * 0.3));
  }
  if (mode === "campaign") {
    const balance = PROGRESSION_BALANCE.campaignReward;
    return balance.completion + Math.round(performance * balance.performanceMax) + Math.round(comboRatio * balance.comboMax) + perfect * balance.perfectBonus;
  }
  if (mode === "prime" && prime) {
    return Math.round(prime.reward[0] + (prime.reward[1] - prime.reward[0]) * performance + perfect * 2);
  }
  if (mode === "threat") {
    const [minimum, maximum] = threatRewardRange(threatLevel);
    return Math.round(minimum + (maximum - minimum) * performance + perfect * Math.max(1, Math.round(threatLevel / 25)));
  }
  return Math.max(1, Math.round(3 + performance * 5 + perfect * 2));
}

export function canUnlockPrime(shards: number, rank: number, mission: PrimeMissionDefinition, unlockedIds: string[]) {
  return !unlockedIds.includes(mission.id) && rank >= mission.requiredRank && shards >= mission.unlockCost;
}

export function purchasePrime(shards: number, rank: number, mission: PrimeMissionDefinition, unlockedIds: string[]) {
  if (!canUnlockPrime(shards, rank, mission, unlockedIds)) return { shards, unlockedIds };
  return { shards: shards - mission.unlockCost, unlockedIds: [...unlockedIds, mission.id] };
}

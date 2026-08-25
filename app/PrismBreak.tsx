"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const WORLD_W = 1280;
const WORLD_H = 720;
const STEP = 1 / 60;
const BOSS_TIME = 108;
const RUN_TIME = 150;
const TAU = Math.PI * 2;

type Mode = "menu" | "playing" | "paused" | "upgrade" | "gameover" | "victory";
type EnemyKind = "needle" | "halo" | "splitter" | "lancer" | "bulwark" | "boss";
type Sfx = "shoot" | "hit" | "kill" | "dash" | "absorb" | "nova" | "hurt" | "level" | "boss" | "pickup";
type UpgradeId = "split" | "rapid" | "heavy" | "chain" | "magnet" | "wake" | "phase" | "guard" | "glass" | "second";
type DropKind = "repair" | "overcharge" | "rapid" | "smashcell";
type BindingAction = "up" | "down" | "left" | "right" | "dash" | "nova" | "smash" | "pause";
type RunMode = "campaign" | "daily" | "arcade";
type Difficulty = "cadet" | "standard" | "overdrive";
type ObjectiveKind = "survive" | "kills" | "absorb" | "elites" | "boss";
type MenuView = "home" | "campaign" | "daily" | "arcade";

interface StageDefinition {
  id: number;
  code: string;
  name: string;
  subtitle: string;
  briefing: string;
  duration: number;
  bossTime: number | null;
  roster: EnemyKind[];
  objective: ObjectiveKind;
  target: number;
  eliteChance: number;
  scoreTargets: [number, number, number];
}

interface DifficultyProfile {
  id: Difficulty;
  name: string;
  description: string;
  health: number;
  enemySpeed: number;
  bulletSpeed: number;
  spawnRate: number;
  enemyHealth: number;
  scoreMultiplier: number;
  dashCooldown: number;
  dashDuration: number;
  absorbCharge: number;
}

type KeyBindings = Record<BindingAction, string>;

const DEFAULT_BINDINGS: KeyBindings = {
  up: "KeyW", down: "KeyS", left: "KeyA", right: "KeyD",
  dash: "Space", nova: "KeyE", smash: "KeyF", pause: "KeyP",
};

const DROP_INFO: Record<DropKind, { name: string; color: string; glyph: string }> = {
  repair: { name: "REPAIR SHARD", color: "#8affcf", glyph: "+" },
  overcharge: { name: "NOVA CELL", color: "#ffe486", glyph: "N" },
  rapid: { name: "RAPID MODULE", color: "#a98cff", glyph: "R" },
  smashcell: { name: "SMASH CELL", color: "#ff80c8", glyph: "S" },
};

interface RunConfig {
  runMode: RunMode;
  stageId: number;
  difficulty: Difficulty;
  duration: number;
  bossTime: number | null;
  roster: EnemyKind[];
  objective: ObjectiveKind;
  objectiveTarget: number;
  eliteChance: number;
  label: string;
  dailyKey: string | null;
}

interface LeaderboardRow {
  id: number;
  callsign: string;
  score: number;
  mode: RunMode;
  stage: number;
  difficulty: Difficulty;
  kills: number;
  absorbed: number;
  comboX100: number;
  createdAt: string;
  rank?: number;
}

interface PlayerProfile {
  unlockedStage: number;
  overdriveUnlocked: boolean;
  stars: Record<string, number>;
  bestScores: Record<string, number>;
}

interface Player {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  health: number;
  maxHealth: number;
  invuln: number;
  dashTime: number;
  dashCooldown: number;
  fireCooldown: number;
  aim: number;
  wakeClock: number;
  shield: number;
  secondUsed: boolean;
}

interface Enemy {
  id: number;
  kind: EnemyKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  hp: number;
  maxHp: number;
  fire: number;
  age: number;
  angle: number;
  hit: number;
  elite: boolean;
  dead: boolean;
  processed: boolean;
}

interface Bullet {
  id: number;
  x: number;
  y: number;
  px: number;
  py: number;
  vx: number;
  vy: number;
  r: number;
  damage: number;
  life: number;
  enemy: boolean;
  color: string;
  dead: boolean;
  homing: number;
  pierce: number;
}

interface Pickup {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  value: number;
  age: number;
  dead: boolean;
}

interface PowerDrop {
  id: number;
  kind: DropKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  dead: boolean;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  drag: number;
  ring: boolean;
}

interface FloatText {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
}

interface Game {
  mode: Mode;
  visualTime: number;
  elapsed: number;
  rng: number;
  nextId: number;
  player: Player;
  enemies: Enemy[];
  bullets: Bullet[];
  pickups: Pickup[];
  powerDrops: PowerDrop[];
  particles: Particle[];
  texts: FloatText[];
  score: number;
  combo: number;
  comboTimer: number;
  charge: number;
  level: number;
  xp: number;
  nextXp: number;
  spawnTimer: number;
  bossSpawned: boolean;
  bossDefeated: boolean;
  upgradeChoices: UpgradeId[];
  upgrades: Partial<Record<UpgradeId, number>>;
  kills: number;
  eliteKills: number;
  absorbed: number;
  hitsTaken: number;
  novasUsed: number;
  bestCombo: number;
  shake: number;
  flash: number;
  nova: number;
  smashCooldown: number;
  smashPulse: number;
  rapidBuff: number;
  hitStop: number;
  events: Sfx[];
  uiClock: number;
  reason: string;
  reducedMotion: boolean;
  config: RunConfig;
  runId: string;
}

interface InputState {
  keys: Record<string, boolean>;
  pointerX: number;
  pointerY: number;
  hasPointer: boolean;
  usingTouch: boolean;
  dash: boolean;
  nova: boolean;
  smash: boolean;
  bindings: KeyBindings;
  stickId: number | null;
  aimId: number | null;
  stickOriginX: number;
  stickOriginY: number;
  stickWorldX: number;
  stickWorldY: number;
  stickX: number;
  stickY: number;
}

interface Viewport {
  width: number;
  height: number;
  dpr: number;
  scale: number;
  offsetX: number;
  offsetY: number;
}

interface UpgradeInfo {
  name: string;
  tag: string;
  description: string;
  glyph: string;
  max: number;
}

interface UiState {
  mode: Mode;
  score: number;
  combo: number;
  health: number;
  maxHealth: number;
  shield: number;
  charge: number;
  dash: number;
  smash: number;
  rapidBuff: number;
  level: number;
  xp: number;
  nextXp: number;
  timeLeft: number;
  wave: string;
  bossHealth: number;
  bossMaxHealth: number;
  choices: UpgradeId[];
  upgrades: Partial<Record<UpgradeId, number>>;
  kills: number;
  eliteKills: number;
  absorbed: number;
  hitsTaken: number;
  novasUsed: number;
  bestCombo: number;
  reason: string;
  runMode: RunMode;
  stageId: number;
  difficulty: Difficulty;
  objectiveLabel: string;
  objectiveProgress: number;
  objectiveTarget: number;
  guide: string;
}

const UPGRADES: Record<UpgradeId, UpgradeInfo> = {
  split: { name: "SPLIT BEAM", tag: "OFFENSE", description: "Adds two refracted side shots.", glyph: "⋔", max: 2 },
  rapid: { name: "RAPID REFRACTION", tag: "FIRE RATE", description: "Fires 18% faster.", glyph: "≫", max: 4 },
  heavy: { name: "HEAVY LIGHT", tag: "DAMAGE", description: "Shots grow brighter and hit 28% harder.", glyph: "◆", max: 4 },
  chain: { name: "ARC CHAIN", tag: "VOLTAIC", description: "Kills arc damage into a nearby target.", glyph: "ϟ", max: 3 },
  magnet: { name: "MAGNETIC CORE", tag: "UTILITY", description: "Greatly expands shard attraction.", glyph: "⌁", max: 3 },
  wake: { name: "DASH WAKE", tag: "MOBILITY", description: "Your prism trail cuts through enemies.", glyph: "⟫", max: 3 },
  phase: { name: "PHASE BATTERY", tag: "COOLDOWN", description: "Dash recharges 18% faster.", glyph: "◌", max: 3 },
  guard: { name: "PRISM GUARD", tag: "DEFENSE", description: "Nova grants a temporary shield.", glyph: "⬡", max: 2 },
  glass: { name: "GLASS SPECTRUM", tag: "RISK / REWARD", description: "+55% damage, but maximum integrity drops.", glyph: "◇", max: 1 },
  second: { name: "SECOND LIGHT", tag: "FAILSAFE", description: "Survive one lethal strike each run.", glyph: "✦", max: 1 },
};

const ENEMY_COLOR: Record<EnemyKind, string> = {
  needle: "#ff4f7b",
  halo: "#46e6ff",
  splitter: "#e56bff",
  lancer: "#ffd85a",
  bulwark: "#ff8f52",
  boss: "#ad7bff",
};

const DIFFICULTIES: Record<Difficulty, DifficultyProfile> = {
  cadet: {
    id: "cadet", name: "CADET", description: "Forgiving shields, slower fire, faster dash.",
    health: 5, enemySpeed: 0.84, bulletSpeed: 0.76, spawnRate: 0.76,
    enemyHealth: 0.86, scoreMultiplier: 0.78, dashCooldown: 0.9, dashDuration: 0.29, absorbCharge: 6,
  },
  standard: {
    id: "standard", name: "STANDARD", description: "The intended PRISM BREAK experience.",
    health: 3, enemySpeed: 1, bulletSpeed: 1, spawnRate: 1,
    enemyHealth: 1, scoreMultiplier: 1, dashCooldown: 1.18, dashDuration: 0.23, absorbCharge: 4.2,
  },
  overdrive: {
    id: "overdrive", name: "OVERDRIVE", description: "Relentless patterns and amplified scoring.",
    health: 2, enemySpeed: 1.14, bulletSpeed: 1.16, spawnRate: 1.28,
    enemyHealth: 1.15, scoreMultiplier: 1.45, dashCooldown: 1.24, dashDuration: 0.21, absorbCharge: 3.8,
  },
};

const CAMPAIGN_STAGES: StageDefinition[] = [
  {
    id: 0, code: "00", name: "CALIBRATION", subtitle: "Learn the light",
    briefing: "A protected training chamber teaches movement, phase absorption, and Nova release.",
    duration: 28, bossTime: null, roster: ["needle", "halo"], objective: "survive", target: 28,
    eliteChance: 0, scoreTargets: [1800, 4200, 7600],
  },
  {
    id: 1, code: "01", name: "FIRST CONTACT", subtitle: "Hold the perimeter",
    briefing: "Needles breach the arena while Halos establish a crossfire. Survive the first incursion.",
    duration: 42, bossTime: null, roster: ["needle", "halo"], objective: "survive", target: 42,
    eliteChance: 0, scoreTargets: [5200, 11000, 20000],
  },
  {
    id: 2, code: "02", name: "CROSSFIRE", subtitle: "Break the formation",
    briefing: "Splitters seed the arena with new threats. Destroy the formation before the timer collapses.",
    duration: 68, bossTime: null, roster: ["needle", "halo", "splitter"], objective: "kills", target: 32,
    eliteChance: 0.07, scoreTargets: [18000, 34000, 56000],
  },
  {
    id: 3, code: "03", name: "FRACTURE", subtitle: "Feed on the storm",
    briefing: "Lancers weaponize the grid. Phase through their fire and absorb enough energy to fracture it.",
    duration: 76, bossTime: null, roster: ["needle", "halo", "splitter", "lancer"], objective: "absorb", target: 35,
    eliteChance: 0.11, scoreTargets: [28000, 51000, 82000],
  },
  {
    id: 4, code: "04", name: "SIEGE", subtitle: "Hunt the elites",
    briefing: "Bulwarks seal the exits. Eliminate six elite signatures and collapse the siege lattice.",
    duration: 88, bossTime: null, roster: ["needle", "halo", "splitter", "lancer", "bulwark"], objective: "elites", target: 6,
    eliteChance: 0.24, scoreTargets: [45000, 78000, 118000],
  },
  {
    id: 5, code: "05", name: "THE APERTURE", subtitle: "End the protocol",
    briefing: "The architect enters the arena. Survive its rings, reach the core, and break the Aperture.",
    duration: 120, bossTime: 76, roster: ["needle", "halo", "splitter", "lancer", "bulwark"], objective: "boss", target: 1,
    eliteChance: 0.16, scoreTargets: [72000, 125000, 190000],
  },
];

const DEFAULT_PROFILE: PlayerProfile = {
  unlockedStage: 0,
  overdriveUnlocked: false,
  stars: {},
  bestScores: {},
};

function currentDailyKey() {
  return new Date().toISOString().slice(0, 10);
}

function seedFromText(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function makeRunConfig(runMode: RunMode, stageId = 0, difficulty: Difficulty = "cadet", dailyKey: string | null = null): RunConfig {
  if (runMode === "campaign") {
    const stage = CAMPAIGN_STAGES[clamp(Math.round(stageId), 0, CAMPAIGN_STAGES.length - 1)];
    return {
      runMode, stageId: stage.id, difficulty, duration: stage.duration, bossTime: stage.bossTime,
      roster: stage.roster, objective: stage.objective, objectiveTarget: stage.target,
      eliteChance: stage.eliteChance, label: `STAGE ${stage.code} // ${stage.name}`, dailyKey: null,
    };
  }
  if (runMode === "daily") {
    return {
      runMode, stageId: -1, difficulty: "standard", duration: 135, bossTime: 96,
      roster: ["needle", "halo", "splitter", "lancer", "bulwark"], objective: "boss", objectiveTarget: 1,
      eliteChance: 0.13, label: "DAILY RIFT // GLOBAL SEED", dailyKey: dailyKey ?? currentDailyKey(),
    };
  }
  return {
    runMode, stageId: -1, difficulty, duration: RUN_TIME, bossTime: BOSS_TIME,
    roster: ["needle", "halo", "splitter", "lancer", "bulwark"], objective: "boss", objectiveTarget: 1,
    eliteChance: 0.1, label: "ARCADE RIFT // SCORE ATTACK", dailyKey: null,
  };
}

const STAR_FIELD = Array.from({ length: 150 }, (_, index) => ({
  x: (index * 79.731) % WORLD_W,
  y: (index * 43.117) % WORLD_H,
  size: 0.45 + (index % 5) * 0.34,
  pulse: index * 0.73,
  depth: 0.25 + (index % 7) / 9,
}));

const EMPTY_UI: UiState = {
  mode: "menu", score: 0, combo: 1, health: 3, maxHealth: 3, shield: 0,
  charge: 0, dash: 1, smash: 1, rapidBuff: 0, level: 1, xp: 0, nextXp: 12, timeLeft: RUN_TIME,
  wave: "CALIBRATION", bossHealth: 0, bossMaxHealth: 0, choices: [], upgrades: {}, kills: 0,
  eliteKills: 0, absorbed: 0, hitsTaken: 0, novasUsed: 0, bestCombo: 1, reason: "",
  runMode: "campaign", stageId: 0, difficulty: "cadet", objectiveLabel: "SURVIVE CALIBRATION",
  objectiveProgress: 0, objectiveTarget: CAMPAIGN_STAGES[0].target, guide: "",
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function distanceSq(ax: number, ay: number, bx: number, by: number) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

function rand(game: Game) {
  let value = game.rng | 0;
  value ^= value << 13;
  value ^= value >>> 17;
  value ^= value << 5;
  game.rng = value >>> 0;
  return (game.rng & 0xffffff) / 0x1000000;
}

function createInput(bindings: KeyBindings = DEFAULT_BINDINGS): InputState {
  return {
    keys: {}, pointerX: WORLD_W * 0.72, pointerY: WORLD_H * 0.5, hasPointer: false,
    usingTouch: false, dash: false, nova: false, smash: false, bindings, stickId: null, aimId: null,
    stickOriginX: 0, stickOriginY: 0, stickWorldX: 0, stickWorldY: 0, stickX: 0, stickY: 0,
  };
}

function createGame(seed: number, mode: Mode = "menu", config: RunConfig = makeRunConfig("campaign", 0, "cadet")): Game {
  const difficulty = DIFFICULTIES[config.difficulty];
  return {
    mode,
    visualTime: 0,
    elapsed: 0,
    rng: seed || 0x9e3779b9,
    nextId: 1,
    player: {
      x: WORLD_W * 0.5, y: WORLD_H * 0.56, vx: 0, vy: 0, r: 14,
      health: difficulty.health, maxHealth: difficulty.health, invuln: 0, dashTime: 0, dashCooldown: 0,
      fireCooldown: 0, aim: 0, wakeClock: 0, shield: config.runMode === "campaign" && config.stageId <= 1 ? 1 : 0, secondUsed: false,
    },
    enemies: [], bullets: [], pickups: [], powerDrops: [], particles: [], texts: [],
    score: 0, combo: 1, comboTimer: 0, charge: config.stageId === 0 ? 82 : config.stageId === 1 ? 28 : 0, level: 1, xp: 0, nextXp: 12,
    spawnTimer: 0.7, bossSpawned: false, bossDefeated: false, upgradeChoices: [], upgrades: {},
    kills: 0, eliteKills: 0, absorbed: 0, hitsTaken: 0, novasUsed: 0, bestCombo: 1,
    shake: 0, flash: 0, nova: 0, smashCooldown: 0, smashPulse: 0, rapidBuff: 0, hitStop: 0,
    events: [], uiClock: 0, reason: "", reducedMotion: false, config,
    runId: `menu-${seed.toString(36)}`,
  };
}

function waveLabel(game: Game) {
  if (game.config.runMode === "campaign") return game.config.label;
  if (game.bossSpawned) return "THE APERTURE";
  const elapsed = game.elapsed;
  if (elapsed < 24) return "WAVE 01 — FIRST CONTACT";
  if (elapsed < 50) return "WAVE 02 — CROSSFIRE";
  if (elapsed < 76) return "WAVE 03 — FRACTURE";
  if (elapsed < 94) return "WAVE 04 — SIEGE";
  return "FINAL WAVE — PRISM STORM";
}

function objectiveProgress(game: Game) {
  if (game.config.objective === "survive") return Math.min(game.elapsed, game.config.objectiveTarget);
  if (game.config.objective === "kills") return game.kills;
  if (game.config.objective === "absorb") return game.absorbed;
  if (game.config.objective === "elites") return game.eliteKills;
  return game.bossDefeated ? 1 : 0;
}

function objectiveLabel(game: Game) {
  if (game.config.objective === "survive") return "SURVIVE THE SEQUENCE";
  if (game.config.objective === "kills") return "DESTROY HOSTILES";
  if (game.config.objective === "absorb") return "ABSORB ENEMY FIRE";
  if (game.config.objective === "elites") return "ELIMINATE ELITES";
  return "BREAK THE APERTURE";
}

function guideText(game: Game) {
  if (game.config.runMode !== "campaign" || game.config.stageId !== 0 || game.mode !== "playing") return "";
  if (game.elapsed < 6) return "MOVE WITH WASD OR THE LEFT TOUCH FIELD";
  if (game.elapsed < 13) return "YOUR PRISM AUTO-FIRES AT THE NEAREST THREAT";
  if (game.absorbed < 3) return "PRESS SPACE AND DASH THROUGH PINK BULLETS TO ABSORB THEM";
  if (game.charge < 100) return "KEEP ABSORBING — FILL THE PRISM CORE";
  if (game.novasUsed < 1) return "CORE READY — PRESS E TO RELEASE PRISM NOVA";
  return "CALIBRATION COMPLETE — HOLD THE ARENA";
}

function event(game: Game, sound: Sfx) {
  if (game.events.length < 20) game.events.push(sound);
}

function burst(game: Game, x: number, y: number, color: string, count: number, speed = 170, size = 3) {
  const scaled = game.reducedMotion ? Math.ceil(count * 0.35) : count;
  for (let i = 0; i < scaled && game.particles.length < 900; i += 1) {
    const angle = rand(game) * TAU;
    const force = speed * (0.35 + rand(game) * 0.75);
    const life = 0.28 + rand(game) * 0.6;
    game.particles.push({
      x, y, vx: Math.cos(angle) * force, vy: Math.sin(angle) * force,
      life, maxLife: life, size: size * (0.55 + rand(game)), color,
      drag: 0.9 + rand(game) * 2.2, ring: false,
    });
  }
}

function shockwave(game: Game, x: number, y: number, color: string, size = 10) {
  if (game.particles.length < 900) {
    game.particles.push({ x, y, vx: 0, vy: 0, life: 0.55, maxLife: 0.55, size, color, drag: 0, ring: true });
  }
}

function randomEdgePosition(game: Game, padding = 55) {
  const side = Math.floor(rand(game) * 4);
  if (side === 0) return { x: padding, y: 90 + rand(game) * (WORLD_H - 180) };
  if (side === 1) return { x: WORLD_W - padding, y: 90 + rand(game) * (WORLD_H - 180) };
  if (side === 2) return { x: 90 + rand(game) * (WORLD_W - 180), y: padding };
  return { x: 90 + rand(game) * (WORLD_W - 180), y: WORLD_H - padding };
}

function spawnEnemy(game: Game, kind: EnemyKind, x?: number, y?: number, elite = false) {
  const position = kind === "boss" ? { x: WORLD_W * 0.5, y: 145 } : randomEdgePosition(game);
  const scale = 1 + Math.min(game.elapsed / 170, 0.7);
  const stats: Record<EnemyKind, { r: number; hp: number; fire: number }> = {
    needle: { r: 13, hp: 3.1, fire: 2.5 },
    halo: { r: 21, hp: 8.5, fire: 1.25 },
    splitter: { r: 24, hp: 13, fire: 2 },
    lancer: { r: 19, hp: 11, fire: 1.8 },
    bulwark: { r: 31, hp: 27, fire: 1.9 },
    boss: { r: 74, hp: 520, fire: 1.15 },
  };
  const stat = stats[kind];
  const trainingTarget = game.config.runMode === "campaign" && game.config.stageId === 0 && kind === "halo";
  const firstMissionTarget = game.config.runMode === "campaign" && game.config.stageId === 1;
  const hp = stat.hp * (kind === "boss" ? 1 : scale) * (elite ? 1.8 : 1) * DIFFICULTIES[game.config.difficulty].enemyHealth * (trainingTarget ? 4.2 : firstMissionTarget ? 0.68 : 1);
  game.enemies.push({
    id: game.nextId++, kind, x: x ?? position.x, y: y ?? position.y,
    vx: 0, vy: 0, r: stat.r * (elite ? 1.18 : 1), hp, maxHp: hp,
    fire: trainingTarget ? 0.58 + rand(game) * 0.18 : firstMissionTarget ? stat.fire + 0.75 + rand(game) * 0.5 : stat.fire + rand(game) * 0.55, age: 0, angle: rand(game) * TAU,
    hit: 0, elite, dead: false, processed: false,
  });
  if (kind === "boss") {
    game.bossSpawned = true;
    game.shake = 18;
    game.flash = 0.9;
    event(game, "boss");
    shockwave(game, WORLD_W * 0.5, 145, "#c991ff", 50);
  }
}

function selectEnemyKind(game: Game): EnemyKind {
  const roster = game.config.roster.filter((kind) => kind !== "boss");
  if (roster.length === 0) return "needle";
  const progress = clamp(game.elapsed / Math.max(1, game.config.duration * 0.45), 0, 1);
  const unlockedCount = Math.max(1, Math.min(roster.length, 1 + Math.floor(progress * roster.length)));
  const pool = roster.slice(0, unlockedCount);
  const index = Math.min(pool.length - 1, Math.floor(Math.pow(rand(game), 0.82) * pool.length));
  return pool[index];
}

function addBullet(game: Game, x: number, y: number, angle: number, speed: number, enemy: boolean, damage: number, options?: Partial<Bullet>) {
  const vx = Math.cos(angle) * speed;
  const vy = Math.sin(angle) * speed;
  game.bullets.push({
    id: game.nextId++, x, y, px: x - vx * STEP, py: y - vy * STEP, vx, vy,
    r: enemy ? 6 : 4.2, damage, life: enemy ? 6 : 2.2, enemy,
    color: enemy ? "#ff568e" : "#77f7ff", dead: false, homing: 0, pierce: 0,
    ...options,
  });
}

function nearestEnemy(game: Game, x: number, y: number, excludeId = -1) {
  let nearest: Enemy | null = null;
  let nearestDistance = Infinity;
  for (const enemy of game.enemies) {
    if (enemy.dead || enemy.id === excludeId || enemy.age < 0.35) continue;
    const value = distanceSq(x, y, enemy.x, enemy.y);
    if (value < nearestDistance) {
      nearestDistance = value;
      nearest = enemy;
    }
  }
  return nearest;
}

function playerDamage(game: Game) {
  return 2.45 * Math.pow(1.28, game.upgrades.heavy ?? 0) * (game.upgrades.glass ? 1.55 : 1);
}

function firePlayer(game: Game) {
  const player = game.player;
  const split = game.upgrades.split ?? 0;
  const damage = playerDamage(game);
  addBullet(game, player.x + Math.cos(player.aim) * 18, player.y + Math.sin(player.aim) * 18, player.aim, 790, false, damage,
    { r: 4.1 + (game.upgrades.heavy ?? 0) * 0.65, color: game.upgrades.glass ? "#f4b8ff" : "#79f8ff" });
  if (split > 0) {
    const spread = split === 1 ? 0.16 : 0.22;
    addBullet(game, player.x, player.y, player.aim - spread, 760, false, damage * 0.72, { r: 3.7, color: "#b986ff" });
    addBullet(game, player.x, player.y, player.aim + spread, 760, false, damage * 0.72, { r: 3.7, color: "#ff7fcf" });
  }
  const boost = game.rapidBuff > 0 ? 0.52 : 1;
  player.fireCooldown = 0.145 * Math.pow(0.82, game.upgrades.rapid ?? 0) * boost;
  event(game, "shoot");
}

function spawnEnemyBullet(game: Game, enemy: Enemy, angle: number, speed: number, color = ENEMY_COLOR[enemy.kind], r = 6) {
  const projectileSpeed = speed * DIFFICULTIES[game.config.difficulty].bulletSpeed;
  addBullet(game, enemy.x + Math.cos(angle) * (enemy.r + 5), enemy.y + Math.sin(angle) * (enemy.r + 5), angle, projectileSpeed, true, 1, { color, r });
}

function segmentCircle(bullet: Bullet, x: number, y: number, radius: number) {
  const dx = bullet.x - bullet.px;
  const dy = bullet.y - bullet.py;
  const length = dx * dx + dy * dy;
  if (length < 0.001) return distanceSq(bullet.x, bullet.y, x, y) <= radius * radius;
  const t = clamp(((x - bullet.px) * dx + (y - bullet.py) * dy) / length, 0, 1);
  const cx = bullet.px + dx * t;
  const cy = bullet.py + dy * t;
  return distanceSq(cx, cy, x, y) <= radius * radius;
}

function damageEnemy(game: Game, enemy: Enemy, amount: number, hitX = enemy.x, hitY = enemy.y) {
  if (enemy.dead || enemy.age < 0.3) return;
  enemy.hp -= amount;
  enemy.hit = 0.11;
  burst(game, hitX, hitY, ENEMY_COLOR[enemy.kind], enemy.kind === "boss" ? 3 : 2, 80, 2.2);
  event(game, "hit");
  if (enemy.hp <= 0) enemy.dead = true;
}

function addPickup(game: Game, x: number, y: number, value: number) {
  const angle = rand(game) * TAU;
  const force = 35 + rand(game) * 85;
  game.pickups.push({ id: game.nextId++, x, y, vx: Math.cos(angle) * force, vy: Math.sin(angle) * force, value, age: 0, dead: false });
}

function addPowerDrop(game: Game, x: number, y: number, kind: DropKind) {
  const angle = rand(game) * TAU;
  const force = 55 + rand(game) * 95;
  game.powerDrops.push({ id: game.nextId++, kind, x, y, vx: Math.cos(angle) * force, vy: Math.sin(angle) * force, age: 0, dead: false });
  shockwave(game, x, y, DROP_INFO[kind].color, 12);
}

function collectPowerDrop(game: Game, drop: PowerDrop) {
  if (drop.dead) return;
  drop.dead = true;
  const player = game.player;
  const info = DROP_INFO[drop.kind];
  if (drop.kind === "repair") {
    player.health = Math.min(player.maxHealth, player.health + 1);
    player.shield = Math.min(2, player.shield + 0.55);
  } else if (drop.kind === "overcharge") {
    game.charge = Math.min(100, game.charge + 48);
  } else if (drop.kind === "rapid") {
    game.rapidBuff = Math.max(game.rapidBuff, 11);
  } else {
    game.smashCooldown = Math.max(0, game.smashCooldown - 9);
  }
  game.score += Math.round(180 * DIFFICULTIES[game.config.difficulty].scoreMultiplier);
  game.texts.push({ x: drop.x, y: drop.y - 22, text: info.name, color: info.color, life: 1.15 });
  burst(game, drop.x, drop.y, info.color, 18, 220, 3.8);
  shockwave(game, drop.x, drop.y, info.color, 22);
  event(game, "pickup");
}

function processEnemyDeath(game: Game, enemy: Enemy) {
  if (enemy.processed) return;
  enemy.processed = true;
  const base: Record<EnemyKind, number> = { needle: 100, halo: 240, splitter: 360, lancer: 420, bulwark: 650, boss: 12000 };
  const points = Math.round(base[enemy.kind] * game.combo * (enemy.elite ? 1.8 : 1) * DIFFICULTIES[game.config.difficulty].scoreMultiplier);
  game.score += points;
  game.kills += 1;
  if (enemy.elite) game.eliteKills += 1;
  game.combo = Math.min(8, game.combo + (enemy.kind === "boss" ? 1 : 0.25));
  game.comboTimer = 2.6;
  game.bestCombo = Math.max(game.bestCombo, game.combo);
  game.texts.push({ x: enemy.x, y: enemy.y - enemy.r, text: `+${points.toLocaleString()}`, color: ENEMY_COLOR[enemy.kind], life: 0.85 });
  burst(game, enemy.x, enemy.y, ENEMY_COLOR[enemy.kind], enemy.kind === "boss" ? 70 : 13 + Math.round(enemy.r * 0.2), enemy.kind === "boss" ? 350 : 210, enemy.kind === "boss" ? 6 : 3.4);
  shockwave(game, enemy.x, enemy.y, ENEMY_COLOR[enemy.kind], enemy.r * 0.6);
  game.shake = Math.max(game.shake, enemy.kind === "boss" ? 26 : enemy.elite ? 11 : 5);
  game.hitStop = game.reducedMotion ? 0 : enemy.kind === "boss" ? 0.12 : enemy.elite ? 0.055 : 0.025;
  event(game, "kill");

  if (enemy.kind === "splitter") {
    for (let i = 0; i < 3; i += 1) spawnEnemy(game, "needle", enemy.x + Math.cos(i * TAU / 3) * 18, enemy.y + Math.sin(i * TAU / 3) * 18);
  }

  if (enemy.kind !== "boss") {
    const firstMission = game.config.runMode === "campaign" && game.config.stageId === 1;
    const dropChance = firstMission ? 0.32 : enemy.elite ? 0.38 : 0.12;
    if (rand(game) < dropChance) {
      const roll = rand(game);
      const kind: DropKind = roll < 0.31 ? "repair" : roll < 0.58 ? "overcharge" : roll < 0.82 ? "rapid" : "smashcell";
      addPowerDrop(game, enemy.x, enemy.y, kind);
    }
  }

  const shardCount = enemy.kind === "boss" ? 18 : enemy.kind === "bulwark" ? 4 : enemy.kind === "needle" ? 1 : 2;
  for (let i = 0; i < shardCount; i += 1) addPickup(game, enemy.x, enemy.y, enemy.kind === "boss" ? 3 : 1);

  const chainLevel = game.upgrades.chain ?? 0;
  if (chainLevel > 0 && enemy.kind !== "boss") {
    const target = nearestEnemy(game, enemy.x, enemy.y, enemy.id);
    if (target && distanceSq(enemy.x, enemy.y, target.x, target.y) < 280 * 280) {
      damageEnemy(game, target, 4.5 + chainLevel * 3.5);
      for (let i = 0; i < 9; i += 1) {
        const t = i / 8;
        game.particles.push({ x: enemy.x + (target.x - enemy.x) * t, y: enemy.y + (target.y - enemy.y) * t,
          vx: 0, vy: 0, life: 0.18, maxLife: 0.18, size: 2.8, color: "#8ffcff", drag: 0, ring: false });
      }
    }
  }

  if (enemy.kind === "boss") {
    game.bossDefeated = true;
    game.mode = "victory";
    game.score += Math.max(0, Math.round((game.config.duration - game.elapsed) * 160 * DIFFICULTIES[game.config.difficulty].scoreMultiplier));
    game.reason = "THE APERTURE IS SHATTERED";
  }
}

function hurtPlayer(game: Game) {
  const player = game.player;
  if (player.invuln > 0 || player.dashTime > 0 || game.mode !== "playing") return;
  if (player.shield > 0) {
    player.shield = Math.max(0, player.shield - 1);
    player.invuln = 0.55;
    shockwave(game, player.x, player.y, "#a98cff", 22);
    event(game, "hurt");
    return;
  }
  player.health -= 1;
  game.hitsTaken += 1;
  player.invuln = 1.05;
  game.combo = 1;
  game.comboTimer = 0;
  game.shake = 18;
  game.flash = 0.78;
  burst(game, player.x, player.y, "#ffffff", 22, 260, 4);
  event(game, "hurt");
  if (player.health <= 0) {
    if ((game.upgrades.second ?? 0) > 0 && !player.secondUsed) {
      player.secondUsed = true;
      player.health = 1;
      player.invuln = 2;
      game.charge = 100;
      game.texts.push({ x: player.x, y: player.y - 35, text: "SECOND LIGHT", color: "#fff3a4", life: 1.4 });
      shockwave(game, player.x, player.y, "#fff3a4", 30);
    } else if (game.config.runMode === "campaign" && game.config.stageId === 0) {
      player.health = player.maxHealth;
      player.invuln = 2.4;
      game.texts.push({ x: player.x, y: player.y - 35, text: "TRAINING SAFEGUARD", color: "#8ffcff", life: 1.4 });
    } else {
      game.mode = "gameover";
      game.reason = "PRISM INTEGRITY LOST";
    }
  }
}

function absorbBullet(game: Game, bullet: Bullet) {
  bullet.dead = true;
  game.absorbed += 1;
  game.charge = Math.min(100, game.charge + DIFFICULTIES[game.config.difficulty].absorbCharge);
  if (game.config.runMode === "campaign" && game.config.stageId === 0 && game.absorbed >= 3) game.charge = 100;
  const points = Math.round(28 * game.combo * DIFFICULTIES[game.config.difficulty].scoreMultiplier);
  game.score += points;
  game.comboTimer = Math.max(game.comboTimer, 1.1);
  burst(game, bullet.x, bullet.y, "#8ffcff", 6, 150, 2.8);
  const target = nearestEnemy(game, bullet.x, bullet.y);
  if (target) {
    const angle = Math.atan2(target.y - bullet.y, target.x - bullet.x);
    addBullet(game, bullet.x, bullet.y, angle, 620, false, playerDamage(game) * 0.72,
      { color: "#fff4b2", r: 4.6, homing: 5.5, pierce: 0 });
  }
  event(game, "absorb");
}

function triggerNova(game: Game) {
  if (game.charge < 100 || game.mode !== "playing") return;
  game.charge = 0;
  game.novasUsed += 1;
  game.nova = 1;
  game.flash = 1;
  game.shake = 24;
  let cleared = 0;
  for (const bullet of game.bullets) {
    if (bullet.enemy && !bullet.dead) {
      bullet.dead = true;
      cleared += 1;
      if (cleared < 80) burst(game, bullet.x, bullet.y, bullet.color, 2, 100, 2);
    }
  }
  for (const enemy of game.enemies) damageEnemy(game, enemy, enemy.kind === "boss" ? 42 : 30);
  game.score += Math.round(cleared * 12 * DIFFICULTIES[game.config.difficulty].scoreMultiplier);
  if ((game.upgrades.guard ?? 0) > 0) game.player.shield = Math.min(2, game.player.shield + 1);
  shockwave(game, game.player.x, game.player.y, "#ffffff", 45);
  event(game, "nova");
}

function triggerSmash(game: Game) {
  if (game.smashCooldown > 0 || game.mode !== "playing") return;
  const player = game.player;
  const radius = 310;
  game.smashCooldown = 20;
  game.smashPulse = 1;
  game.flash = 1;
  game.shake = 30;
  for (const bullet of game.bullets) {
    if (bullet.enemy && !bullet.dead && distanceSq(player.x, player.y, bullet.x, bullet.y) < radius * radius) bullet.dead = true;
  }
  for (const enemy of game.enemies) {
    if (enemy.dead || distanceSq(player.x, player.y, enemy.x, enemy.y) > radius * radius) continue;
    damageEnemy(game, enemy, enemy.kind === "boss" ? 92 : 120);
  }
  game.texts.push({ x: player.x, y: player.y - 48, text: "PRISM SMASH", color: "#fff0a3", life: 1.1 });
  burst(game, player.x, player.y, "#fff0a3", 48, 390, 5);
  shockwave(game, player.x, player.y, "#fff0a3", 46);
  shockwave(game, player.x, player.y, "#ff87d7", 26);
  event(game, "nova");
}

function chooseUpgradeSet(game: Game) {
  const basePool: UpgradeId[] = ["split", "rapid", "heavy", "magnet", "phase", "second"];
  const stage = game.config.runMode === "campaign" ? game.config.stageId : 5;
  if (stage >= 2) basePool.push("chain");
  if (stage >= 3) basePool.push("wake");
  if (stage >= 4) basePool.push("guard");
  if (stage >= 5) basePool.push("glass");
  const eligible = basePool.filter((id) => (game.upgrades[id] ?? 0) < UPGRADES[id].max);
  const choices: UpgradeId[] = [];
  while (choices.length < 3 && eligible.length > 0) {
    const index = Math.floor(rand(game) * eligible.length);
    choices.push(eligible.splice(index, 1)[0]);
  }
  return choices;
}

function applyUpgrade(game: Game, id: UpgradeId) {
  game.upgrades[id] = (game.upgrades[id] ?? 0) + 1;
  if (id === "glass" && game.player.maxHealth > 2) {
    game.player.maxHealth -= 1;
    game.player.health = Math.min(game.player.health, game.player.maxHealth);
  }
  if (id === "guard") game.player.shield = Math.min(2, game.player.shield + 1);
  game.upgradeChoices = [];
  game.mode = "playing";
  game.player.invuln = Math.max(game.player.invuln, 0.7);
  event(game, "level");
}

function updateEnemy(game: Game, enemy: Enemy, dt: number) {
  const player = game.player;
  const dx = player.x - enemy.x;
  const dy = player.y - enemy.y;
  const distance = Math.max(0.001, Math.hypot(dx, dy));
  const nx = dx / distance;
  const ny = dy / distance;
  enemy.age += dt;
  enemy.hit = Math.max(0, enemy.hit - dt);
  enemy.fire -= dt;

  if (enemy.kind === "needle") {
    const speed = enemy.elite ? 205 : 162;
    enemy.vx += nx * speed * dt * 3.4;
    enemy.vy += ny * speed * dt * 3.4;
    enemy.angle = Math.atan2(enemy.vy, enemy.vx);
  } else if (enemy.kind === "halo") {
    const tangent = enemy.id % 2 ? 1 : -1;
    const radial = distance > 305 ? 1 : distance < 235 ? -1 : 0;
    enemy.vx += (nx * radial + -ny * tangent * 0.72) * 128 * dt * 3;
    enemy.vy += (ny * radial + nx * tangent * 0.72) * 128 * dt * 3;
    enemy.angle += dt * 1.7;
    if (enemy.fire <= 0 && enemy.age > 0.7) {
      const aim = Math.atan2(dy, dx);
      [-0.13, 0, 0.13].forEach((offset) => spawnEnemyBullet(game, enemy, aim + offset, 260, "#55e8ff", 5.2));
      enemy.fire = 1.55;
    }
  } else if (enemy.kind === "splitter") {
    const tangent = enemy.id % 2 ? 0.42 : -0.42;
    enemy.vx += (nx - ny * tangent) * 105 * dt * 2.7;
    enemy.vy += (ny + nx * tangent) * 105 * dt * 2.7;
    enemy.angle -= dt * 1.25;
    if (enemy.fire <= 0 && enemy.age > 0.8) {
      const aim = Math.atan2(dy, dx);
      spawnEnemyBullet(game, enemy, aim, 220, "#ea72ff", 7);
      enemy.fire = 2.15;
    }
  } else if (enemy.kind === "lancer") {
    const radial = distance > 430 ? 1 : distance < 350 ? -1 : 0;
    enemy.vx += (nx * radial - ny * (enemy.id % 2 ? 0.35 : -0.35)) * 90 * dt * 2.4;
    enemy.vy += (ny * radial + nx * (enemy.id % 2 ? 0.35 : -0.35)) * 90 * dt * 2.4;
    if (enemy.fire < 0.52) enemy.angle = Math.atan2(dy, dx);
    if (enemy.fire <= 0 && enemy.age > 0.85) {
      spawnEnemyBullet(game, enemy, enemy.angle, 610, "#ffe170", 8);
      enemy.fire = 2.35;
      game.shake = Math.max(game.shake, 3);
    }
  } else if (enemy.kind === "bulwark") {
    const radial = distance > 285 ? 1 : -0.25;
    enemy.vx += nx * radial * 58 * dt * 2;
    enemy.vy += ny * radial * 58 * dt * 2;
    enemy.angle = Math.atan2(dy, dx);
    if (enemy.fire <= 0 && enemy.age > 1) {
      const aim = Math.atan2(dy, dx);
      for (let i = -2; i <= 2; i += 1) spawnEnemyBullet(game, enemy, aim + i * 0.16, 230, "#ff955b", 7.2);
      enemy.fire = 2.05;
    }
  } else if (enemy.kind === "boss") {
    const hpRatio = enemy.hp / enemy.maxHp;
    const targetX = WORLD_W * 0.5 + Math.sin(enemy.age * 0.44) * 235;
    const targetY = 160 + Math.sin(enemy.age * 0.73) * 36;
    enemy.vx += (targetX - enemy.x) * dt * 1.25;
    enemy.vy += (targetY - enemy.y) * dt * 1.25;
    enemy.angle += dt * (hpRatio > 0.55 ? 0.55 : hpRatio > 0.25 ? 0.9 : 1.3);
    if (enemy.fire <= 0 && enemy.age > 1.5) {
      const count = hpRatio > 0.58 ? 18 : hpRatio > 0.28 ? 22 : 26;
      const speed = hpRatio > 0.58 ? 190 : hpRatio > 0.28 ? 235 : 275;
      for (let i = 0; i < count; i += 1) {
        const angle = enemy.angle + i * TAU / count;
        if ((i + Math.floor(enemy.age)) % 6 !== 0) spawnEnemyBullet(game, enemy, angle, speed, i % 2 ? "#c179ff" : "#ff5ba8", 6.5);
      }
      if (hpRatio < 0.62) {
        const aimed = Math.atan2(dy, dx);
        [-0.22, -0.11, 0, 0.11, 0.22].forEach((offset) => spawnEnemyBullet(game, enemy, aimed + offset, 330, "#70f0ff", 6));
      }
      enemy.fire = hpRatio > 0.58 ? 1.28 : hpRatio > 0.28 ? 0.94 : 0.67;
      game.shake = Math.max(game.shake, 4);
    }
  }

  const damping = Math.exp(-dt * (enemy.kind === "boss" ? 2.4 : 3.5));
  enemy.vx *= damping;
  enemy.vy *= damping;
  const movementScale = DIFFICULTIES[game.config.difficulty].enemySpeed;
  enemy.x += enemy.vx * dt * movementScale;
  enemy.y += enemy.vy * dt * movementScale;
  enemy.x = clamp(enemy.x, 40, WORLD_W - 40);
  enemy.y = clamp(enemy.y, 55, WORLD_H - 40);
}

function completeCampaignObjective(game: Game) {
  if (game.config.runMode !== "campaign" || game.mode !== "playing") return false;
  const progress = objectiveProgress(game);
  const complete = progress >= game.config.objectiveTarget;
  if (!complete) return false;
  const remaining = Math.max(0, game.config.duration - game.elapsed);
  game.score += Math.round(remaining * 90 * DIFFICULTIES[game.config.difficulty].scoreMultiplier);
  game.mode = "victory";
  game.reason = game.config.stageId === 0 ? "CALIBRATION COMPLETE" : "MISSION OBJECTIVE COMPLETE";
  game.flash = 0.85;
  game.shake = 12;
  event(game, "level");
  return true;
}

function updateGame(game: Game, input: InputState, dt: number) {
  if (game.mode !== "playing") return;
  const player = game.player;
  const difficulty = DIFFICULTIES[game.config.difficulty];
  game.elapsed += dt;
  game.uiClock += dt;
  game.comboTimer = Math.max(0, game.comboTimer - dt);
  if (game.comboTimer <= 0) game.combo = Math.max(1, game.combo - dt * 0.72);
  player.invuln = Math.max(0, player.invuln - dt);
  player.dashCooldown = Math.max(0, player.dashCooldown - dt);
  player.fireCooldown -= dt;
  player.shield = Math.max(0, player.shield - dt * 0.035);
  game.nova = Math.max(0, game.nova - dt * 1.25);
  game.smashCooldown = Math.max(0, game.smashCooldown - dt);
  game.smashPulse = Math.max(0, game.smashPulse - dt * 1.45);
  game.rapidBuff = Math.max(0, game.rapidBuff - dt);
  game.flash = Math.max(0, game.flash - dt * 2.5);
  game.shake = Math.max(0, game.shake - dt * 28);

  if (completeCampaignObjective(game)) return;

  if (!game.bossSpawned && game.config.bossTime !== null && game.elapsed >= game.config.bossTime) {
    for (const enemy of game.enemies) {
      if (enemy.kind !== "boss") {
        enemy.processed = true;
        enemy.dead = true;
      }
    }
    spawnEnemy(game, "boss");
  }

  if (game.elapsed >= game.config.duration && !game.bossDefeated) {
    game.mode = "gameover";
    game.reason = game.config.stageId === 0 ? "COMPLETE THE NOVA SEQUENCE" : "THE RIFT COLLAPSED";
    return;
  }

  game.spawnTimer -= dt;
  const firstMission = game.config.runMode === "campaign" && game.config.stageId === 1;
  const maxEnemies = firstMission ? 12 : game.config.difficulty === "cadet" ? 28 : game.config.difficulty === "overdrive" ? 46 : 38;
  if (!game.bossSpawned && game.spawnTimer <= 0 && game.enemies.length < maxEnemies && (game.config.stageId !== 0 || game.elapsed > 4)) {
    const kind = selectEnemyKind(game);
    const eliteScale = game.config.difficulty === "cadet" ? 0.45 : game.config.difficulty === "overdrive" ? 1.45 : 1;
    const elite = game.elapsed > Math.min(24, game.config.duration * 0.38) && rand(game) < game.config.eliteChance * eliteScale;
    spawnEnemy(game, kind, undefined, undefined, elite);
    if (game.elapsed > game.config.duration * 0.55 && rand(game) < 0.24) spawnEnemy(game, rand(game) < 0.7 ? "needle" : "halo");
    const baseInterval = Math.max(0.25, 0.84 - game.elapsed * 0.0045) * (0.78 + rand(game) * 0.5);
    const trainingScale = game.config.stageId === 0 ? 1.38 : firstMission ? 1.72 : 1;
    game.spawnTimer = baseInterval * trainingScale / difficulty.spawnRate;
  }

  let moveX = (input.keys[input.bindings.right] ? 1 : 0) - (input.keys[input.bindings.left] ? 1 : 0);
  let moveY = (input.keys[input.bindings.down] ? 1 : 0) - (input.keys[input.bindings.up] ? 1 : 0);
  if (input.stickId !== null) {
    moveX += input.stickX;
    moveY += input.stickY;
  }
  const moveLength = Math.hypot(moveX, moveY);
  if (moveLength > 1) { moveX /= moveLength; moveY /= moveLength; }

  let aimTargetX = input.pointerX;
  let aimTargetY = input.pointerY;
  if (input.usingTouch || !input.hasPointer) {
    const target = nearestEnemy(game, player.x, player.y);
    if (target) { aimTargetX = target.x; aimTargetY = target.y; }
  }
  if (Math.hypot(aimTargetX - player.x, aimTargetY - player.y) > 2) player.aim = Math.atan2(aimTargetY - player.y, aimTargetX - player.x);

  if (input.dash && player.dashCooldown <= 0) {
    let dashX = moveX;
    let dashY = moveY;
    if (Math.hypot(dashX, dashY) < 0.1) { dashX = Math.cos(player.aim); dashY = Math.sin(player.aim); }
    const length = Math.max(0.001, Math.hypot(dashX, dashY));
    player.vx = dashX / length * 980;
    player.vy = dashY / length * 980;
    player.dashTime = difficulty.dashDuration;
    player.dashCooldown = difficulty.dashCooldown * Math.pow(0.82, game.upgrades.phase ?? 0);
    player.invuln = Math.max(player.invuln, difficulty.dashDuration + 0.02);
    game.shake = Math.max(game.shake, 8);
    burst(game, player.x, player.y, "#80f8ff", 15, 230, 3);
    event(game, "dash");
  }
  input.dash = false;
  if (input.nova) triggerNova(game);
  input.nova = false;
  if (input.smash) triggerSmash(game);
  input.smash = false;

  if (player.dashTime > 0) {
    player.dashTime = Math.max(0, player.dashTime - dt);
    player.wakeClock -= dt;
    if (player.wakeClock <= 0) {
      player.wakeClock = 0.025;
      game.particles.push({ x: player.x, y: player.y, vx: -player.vx * 0.08, vy: -player.vy * 0.08,
        life: 0.34, maxLife: 0.34, size: 9, color: "#75efff", drag: 2, ring: false });
      const wake = game.upgrades.wake ?? 0;
      if (wake > 0) {
        for (const enemy of game.enemies) {
          if (!enemy.dead && distanceSq(player.x, player.y, enemy.x, enemy.y) < (enemy.r + 23) ** 2) damageEnemy(game, enemy, (3.4 + wake * 2.4) * dt * 35);
        }
      }
    }
  } else {
    const acceleration = 1820;
    player.vx += moveX * acceleration * dt;
    player.vy += moveY * acceleration * dt;
    const speed = Math.hypot(player.vx, player.vy);
    const maxSpeed = 330;
    if (speed > maxSpeed) { player.vx = player.vx / speed * maxSpeed; player.vy = player.vy / speed * maxSpeed; }
    const damping = Math.exp(-dt * (moveLength > 0.05 ? 6.2 : 10));
    player.vx *= damping;
    player.vy *= damping;
  }

  player.x += player.vx * dt;
  player.y += player.vy * dt;
  player.x = clamp(player.x, 38, WORLD_W - 38);
  player.y = clamp(player.y, 52, WORLD_H - 38);

  if (player.fireCooldown <= 0 && game.enemies.some((enemy) => !enemy.dead && enemy.age > 0.3)) firePlayer(game);

  for (const enemy of game.enemies) if (!enemy.dead) updateEnemy(game, enemy, dt);

  for (const bullet of game.bullets) {
    if (bullet.dead) continue;
    bullet.px = bullet.x;
    bullet.py = bullet.y;
    bullet.life -= dt;
    if (bullet.homing > 0 && !bullet.enemy) {
      const target = nearestEnemy(game, bullet.x, bullet.y);
      if (target) {
        const speed = Math.hypot(bullet.vx, bullet.vy);
        const desired = Math.atan2(target.y - bullet.y, target.x - bullet.x);
        const current = Math.atan2(bullet.vy, bullet.vx);
        let delta = ((desired - current + Math.PI * 3) % TAU) - Math.PI;
        delta = clamp(delta, -bullet.homing * dt, bullet.homing * dt);
        bullet.vx = Math.cos(current + delta) * speed;
        bullet.vy = Math.sin(current + delta) * speed;
      }
    }
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    if (bullet.life <= 0 || bullet.x < -80 || bullet.x > WORLD_W + 80 || bullet.y < -80 || bullet.y > WORLD_H + 80) bullet.dead = true;
  }

  const magnetRadius = 120 + (game.upgrades.magnet ?? 0) * 90;
  for (const pickup of game.pickups) {
    if (pickup.dead) continue;
    pickup.age += dt;
    const dx = player.x - pickup.x;
    const dy = player.y - pickup.y;
    const distance = Math.max(1, Math.hypot(dx, dy));
    if (distance < magnetRadius || pickup.age > 5) {
      const force = 720 * (1 - Math.min(distance / (magnetRadius * 1.5), 0.8));
      pickup.vx += dx / distance * force * dt;
      pickup.vy += dy / distance * force * dt;
    }
    pickup.vx *= Math.exp(-dt * 2.3);
    pickup.vy *= Math.exp(-dt * 2.3);
    pickup.x += pickup.vx * dt;
    pickup.y += pickup.vy * dt;
    if (distance < player.r + 13) {
      pickup.dead = true;
      game.xp += pickup.value;
      game.score += Math.round(15 * pickup.value * difficulty.scoreMultiplier);
      event(game, "pickup");
    }
  }

  for (const drop of game.powerDrops) {
    if (drop.dead) continue;
    drop.age += dt;
    const dx = player.x - drop.x;
    const dy = player.y - drop.y;
    const distance = Math.max(1, Math.hypot(dx, dy));
    const pullRadius = 155 + (game.upgrades.magnet ?? 0) * 85;
    if (distance < pullRadius || drop.age > 7) {
      const force = 920 * (1 - Math.min(distance / (pullRadius * 1.35), 0.82));
      drop.vx += dx / distance * force * dt;
      drop.vy += dy / distance * force * dt;
    }
    drop.vx *= Math.exp(-dt * 2.1);
    drop.vy *= Math.exp(-dt * 2.1);
    drop.x += drop.vx * dt;
    drop.y += drop.vy * dt;
    if (distance < player.r + 18) collectPowerDrop(game, drop);
  }

  for (const bullet of game.bullets) {
    if (bullet.dead) continue;
    if (bullet.enemy) {
      if (segmentCircle(bullet, player.x, player.y, player.r + bullet.r)) {
        if (player.dashTime > 0) absorbBullet(game, bullet);
        else { bullet.dead = true; hurtPlayer(game); }
      }
    } else {
      for (const enemy of game.enemies) {
        if (enemy.dead || enemy.age < 0.3) continue;
        if (segmentCircle(bullet, enemy.x, enemy.y, enemy.r + bullet.r)) {
          let amount = bullet.damage;
          if (enemy.kind === "bulwark") {
            const incoming = Math.atan2(bullet.py - enemy.y, bullet.px - enemy.x);
            const delta = Math.abs(((incoming - enemy.angle + Math.PI * 3) % TAU) - Math.PI);
            if (delta < 1.05) amount *= 0.28;
          }
          damageEnemy(game, enemy, amount, bullet.x, bullet.y);
          if (bullet.pierce <= 0) bullet.dead = true;
          else bullet.pierce -= 1;
          break;
        }
      }
    }
  }

  for (const enemy of game.enemies) {
    if (!enemy.dead && enemy.age > 0.55 && enemy.kind !== "boss" && distanceSq(player.x, player.y, enemy.x, enemy.y) < (player.r + enemy.r) ** 2) {
      if (player.dashTime > 0) damageEnemy(game, enemy, 8 + (game.upgrades.wake ?? 0) * 3);
      else hurtPlayer(game);
    }
    if (enemy.dead) processEnemyDeath(game, enemy);
  }

  for (const particle of game.particles) {
    particle.life -= dt;
    if (particle.ring) particle.size += dt * 360;
    else {
      particle.vx *= Math.exp(-dt * particle.drag);
      particle.vy *= Math.exp(-dt * particle.drag);
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
    }
  }
  for (const text of game.texts) { text.life -= dt; text.y -= 34 * dt; }

  game.enemies = game.enemies.filter((enemy) => !enemy.dead);
  game.bullets = game.bullets.filter((bullet) => !bullet.dead);
  game.pickups = game.pickups.filter((pickup) => !pickup.dead);
  game.powerDrops = game.powerDrops.filter((drop) => !drop.dead);
  game.particles = game.particles.filter((particle) => particle.life > 0);
  game.texts = game.texts.filter((text) => text.life > 0);

  if (completeCampaignObjective(game)) return;

  if (game.xp >= game.nextXp && game.mode === "playing" && !game.bossDefeated && game.config.stageId !== 0) {
    game.xp -= game.nextXp;
    game.level += 1;
    game.nextXp = Math.round(10 + game.level * 5.5);
    game.upgradeChoices = chooseUpgradeSet(game);
    if (game.upgradeChoices.length > 0) {
      game.mode = "upgrade";
      event(game, "level");
    }
  }
}

function snapshot(game: Game): UiState {
  const boss = game.enemies.find((enemy) => enemy.kind === "boss");
  const dashTotal = DIFFICULTIES[game.config.difficulty].dashCooldown * Math.pow(0.82, game.upgrades.phase ?? 0);
  return {
    mode: game.mode,
    score: Math.round(game.score),
    combo: game.combo,
    health: game.player.health,
    maxHealth: game.player.maxHealth,
    shield: game.player.shield,
    charge: game.charge,
    dash: 1 - clamp(game.player.dashCooldown / dashTotal, 0, 1),
    smash: 1 - clamp(game.smashCooldown / 20, 0, 1),
    rapidBuff: game.rapidBuff,
    level: game.level,
    xp: game.xp,
    nextXp: game.nextXp,
    timeLeft: Math.max(0, game.config.duration - game.elapsed),
    wave: waveLabel(game),
    bossHealth: boss?.hp ?? 0,
    bossMaxHealth: boss?.maxHp ?? 0,
    choices: game.upgradeChoices,
    upgrades: { ...game.upgrades },
    kills: game.kills,
    eliteKills: game.eliteKills,
    absorbed: game.absorbed,
    hitsTaken: game.hitsTaken,
    novasUsed: game.novasUsed,
    bestCombo: game.bestCombo,
    reason: game.reason,
    runMode: game.config.runMode,
    stageId: game.config.stageId,
    difficulty: game.config.difficulty,
    objectiveLabel: objectiveLabel(game),
    objectiveProgress: objectiveProgress(game),
    objectiveTarget: game.config.objectiveTarget,
    guide: guideText(game),
  };
}

function polygon(ctx: CanvasRenderingContext2D, sides: number, radius: number, rotation = 0) {
  ctx.beginPath();
  for (let i = 0; i < sides; i += 1) {
    const angle = rotation + i * TAU / sides;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function renderBackdrop(ctx: CanvasRenderingContext2D, game: Game) {
  const time = game.visualTime;
  const gradient = ctx.createRadialGradient(WORLD_W * 0.52, WORLD_H * 0.45, 20, WORLD_W * 0.52, WORLD_H * 0.45, 720);
  gradient.addColorStop(0, game.nova > 0 ? "#171538" : "#0b1024");
  gradient.addColorStop(0.5, "#060713");
  gradient.addColorStop(1, "#020309");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);

  for (const star of STAR_FIELD) {
    const x = (star.x - time * 3 * star.depth + WORLD_W) % WORLD_W;
    const alpha = 0.12 + (Math.sin(time * 1.4 + star.pulse) + 1) * 0.08;
    ctx.fillStyle = `rgba(180,226,255,${alpha})`;
    ctx.fillRect(x, star.y, star.size, star.size);
  }

  ctx.save();
  ctx.translate(WORLD_W / 2, WORLD_H * 0.52);
  ctx.rotate(time * 0.012);
  ctx.strokeStyle = "rgba(93,117,219,.055)";
  ctx.lineWidth = 1;
  for (let ring = 1; ring <= 8; ring += 1) {
    ctx.beginPath();
    ctx.arc(0, 0, ring * 76 + Math.sin(time * 0.35 + ring) * 7, 0, TAU);
    ctx.stroke();
  }
  for (let spoke = 0; spoke < 24; spoke += 1) {
    const angle = spoke * TAU / 24;
    ctx.beginPath();
    ctx.moveTo(Math.cos(angle) * 70, Math.sin(angle) * 70);
    ctx.lineTo(Math.cos(angle) * 740, Math.sin(angle) * 740);
    ctx.stroke();
  }
  ctx.restore();

  const horizon = WORLD_H * 0.64;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, horizon, WORLD_W, WORLD_H - horizon);
  ctx.clip();
  for (let row = 0; row < 13; row += 1) {
    const progress = ((row + (time * 0.7) % 1) / 13) ** 2;
    const y = horizon + progress * (WORLD_H - horizon);
    ctx.strokeStyle = `rgba(67,211,255,${0.018 + progress * 0.11})`;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(WORLD_W, y);
    ctx.stroke();
  }
  for (let col = -15; col <= 15; col += 1) {
    ctx.strokeStyle = "rgba(117,85,255,.055)";
    ctx.beginPath();
    ctx.moveTo(WORLD_W / 2 + col * 13, horizon);
    ctx.lineTo(WORLD_W / 2 + col * 100, WORLD_H);
    ctx.stroke();
  }
  ctx.restore();

  ctx.strokeStyle = game.bossSpawned ? "rgba(199,110,255,.19)" : "rgba(91,228,255,.13)";
  ctx.lineWidth = 1;
  ctx.strokeRect(28.5, 34.5, WORLD_W - 57, WORLD_H - 69);
  const corner = 32;
  ctx.strokeStyle = game.bossSpawned ? "rgba(235,120,255,.62)" : "rgba(105,240,255,.47)";
  [[29, 35], [WORLD_W - 29, 35], [29, WORLD_H - 35], [WORLD_W - 29, WORLD_H - 35]].forEach(([x, y], index) => {
    const sx = index % 2 ? -1 : 1;
    const sy = index > 1 ? -1 : 1;
    ctx.beginPath();
    ctx.moveTo(x, y + sy * corner);
    ctx.lineTo(x, y);
    ctx.lineTo(x + sx * corner, y);
    ctx.stroke();
  });
}

function drawMenuAperture(ctx: CanvasRenderingContext2D, game: Game) {
  const x = WORLD_W * 0.79;
  const y = WORLD_H * 0.5;
  ctx.save();
  ctx.translate(x, y);
  ctx.globalCompositeOperation = "lighter";
  for (let ring = 5; ring >= 1; ring -= 1) {
    ctx.rotate((ring % 2 ? 1 : -1) * game.visualTime * 0.0009 * ring);
    ctx.strokeStyle = ring % 2 ? `rgba(88,238,255,${0.06 + ring * 0.025})` : `rgba(182,81,255,${0.07 + ring * 0.025})`;
    ctx.lineWidth = ring === 1 ? 2 : 1;
    polygon(ctx, ring % 2 ? 6 : 8, 58 + ring * 43, Math.PI / 8);
    ctx.stroke();
  }
  const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, 130);
  glow.addColorStop(0, "rgba(255,255,255,.48)");
  glow.addColorStop(0.08, "rgba(101,240,255,.28)");
  glow.addColorStop(0.45, "rgba(120,64,255,.08)");
  glow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, 130, 0, TAU);
  ctx.fill();
  ctx.rotate(game.visualTime * 0.26);
  ctx.fillStyle = "rgba(224,252,255,.82)";
  ctx.shadowColor = "#7cf5ff";
  ctx.shadowBlur = 24;
  polygon(ctx, 4, 28, Math.PI / 4);
  ctx.fill();
  ctx.restore();
}

function drawEnemy(ctx: CanvasRenderingContext2D, enemy: Enemy, time: number, highContrast: boolean) {
  const color = ENEMY_COLOR[enemy.kind];
  const appear = clamp(enemy.age / 0.55, 0, 1);
  ctx.save();
  ctx.translate(enemy.x, enemy.y);
  ctx.scale(appear, appear);
  ctx.globalAlpha = enemy.age < 0.55 ? 0.35 + appear * 0.65 : 1;
  ctx.strokeStyle = enemy.hit > 0 ? "#ffffff" : color;
  ctx.fillStyle = "rgba(3,5,14,.84)";
  ctx.lineWidth = highContrast ? 3.2 : enemy.elite ? 3 : 2;
  ctx.shadowColor = color;
  ctx.shadowBlur = enemy.hit > 0 ? 28 : 13;

  if (enemy.kind === "needle") {
    ctx.rotate(enemy.angle + Math.PI / 2);
    ctx.beginPath();
    ctx.moveTo(0, -enemy.r * 1.35);
    ctx.lineTo(enemy.r * 0.78, enemy.r);
    ctx.lineTo(0, enemy.r * 0.54);
    ctx.lineTo(-enemy.r * 0.78, enemy.r);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
  } else if (enemy.kind === "halo") {
    ctx.rotate(enemy.angle);
    ctx.beginPath();
    ctx.arc(0, 0, enemy.r, 0.2, Math.PI * 0.86);
    ctx.moveTo(-enemy.r * 0.9, enemy.r * 0.43);
    ctx.arc(0, 0, enemy.r, Math.PI * 0.86 + 0.22, TAU - 0.22);
    ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, enemy.r * 0.38, 0, TAU); ctx.stroke();
    ctx.fillStyle = color; ctx.globalAlpha *= 0.55; ctx.fill();
  } else if (enemy.kind === "splitter") {
    ctx.rotate(enemy.angle);
    polygon(ctx, 6, enemy.r, Math.PI / 6);
    ctx.fill(); ctx.stroke();
    ctx.rotate(-enemy.angle * 1.8);
    polygon(ctx, 3, enemy.r * 0.48, -Math.PI / 2);
    ctx.stroke();
  } else if (enemy.kind === "lancer") {
    ctx.rotate(enemy.angle + Math.PI / 2);
    ctx.beginPath();
    ctx.moveTo(0, -enemy.r * 1.25);
    ctx.lineTo(enemy.r * 0.82, 0);
    ctx.lineTo(0, enemy.r * 0.66);
    ctx.lineTo(-enemy.r * 0.82, 0);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, -enemy.r * 0.75); ctx.lineTo(0, enemy.r * 0.35); ctx.stroke();
  } else if (enemy.kind === "bulwark") {
    ctx.rotate(enemy.angle);
    ctx.fillRect(-enemy.r * 0.66, -enemy.r * 0.66, enemy.r * 1.32, enemy.r * 1.32);
    ctx.strokeRect(-enemy.r * 0.66, -enemy.r * 0.66, enemy.r * 1.32, enemy.r * 1.32);
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(0, 0, enemy.r * 1.12, -0.85, 0.85); ctx.stroke();
  } else {
    const hpRatio = enemy.hp / enemy.maxHp;
    ctx.rotate(enemy.angle);
    for (let ring = 3; ring >= 1; ring -= 1) {
      ctx.rotate((ring % 2 ? 1 : -1) * time * 0.006);
      ctx.lineWidth = ring === 1 ? 3 : 1.5;
      ctx.globalAlpha = 0.48 + ring * 0.14;
      polygon(ctx, ring % 2 ? 6 : 8, enemy.r * (0.46 + ring * 0.35), Math.PI / 8);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = hpRatio < 0.28 ? "#fff0a1" : "#e9c8ff";
    polygon(ctx, 4, enemy.r * 0.42, Math.PI / 4);
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.stroke();
  }

  if (enemy.elite && enemy.kind !== "boss") {
    ctx.setLineDash([3, 7]);
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.65;
    ctx.beginPath(); ctx.arc(0, 0, enemy.r + 10, time * 1.5, time * 1.5 + Math.PI * 1.55); ctx.stroke();
  }
  ctx.restore();

  if (enemy.age < 0.55) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.globalAlpha = (1 - enemy.age / 0.55) * 0.72;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(enemy.x, enemy.y, enemy.r + 44 * (1 - enemy.age / 0.55), 0, TAU);
    ctx.stroke();
    ctx.restore();
  }
}

function drawPlayer(ctx: CanvasRenderingContext2D, game: Game) {
  const player = game.player;
  if (player.invuln > 0 && player.dashTime <= 0 && Math.floor(game.visualTime * 15) % 2 === 0) return;
  const full = game.charge >= 99.9;
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate(player.aim + Math.PI / 2);
  ctx.globalCompositeOperation = "lighter";
  const halo = ctx.createRadialGradient(0, 0, 0, 0, 0, full ? 54 : 38);
  halo.addColorStop(0, full ? "rgba(255,248,188,.36)" : "rgba(115,247,255,.28)");
  halo.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = halo;
  ctx.beginPath(); ctx.arc(0, 0, full ? 54 : 38, 0, TAU); ctx.fill();
  ctx.globalCompositeOperation = "source-over";
  ctx.shadowColor = full ? "#fff3a8" : "#6ff6ff";
  ctx.shadowBlur = full ? 30 : 18;
  ctx.fillStyle = "rgba(4,12,22,.92)";
  ctx.strokeStyle = full ? "#fff5b5" : "#9cfdff";
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(0, -19);
  ctx.lineTo(13, 1);
  ctx.lineTo(0, 17);
  ctx.lineTo(-13, 1);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = full ? "#fff8d1" : "#ffffff";
  ctx.beginPath();
  ctx.moveTo(0, -9); ctx.lineTo(6.5, 1); ctx.lineTo(0, 9); ctx.lineTo(-6.5, 1); ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(211,141,255,.88)";
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(-12, 1); ctx.lineTo(12, 1); ctx.stroke();
  ctx.restore();

  const dashTotal = 1.18 * Math.pow(0.82, game.upgrades.phase ?? 0);
  const ready = 1 - clamp(player.dashCooldown / dashTotal, 0, 1);
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate(-Math.PI / 2);
  ctx.strokeStyle = "rgba(123,245,255,.18)";
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(0, 0, 25, 0, TAU); ctx.stroke();
  ctx.strokeStyle = ready >= 1 ? "#8affdd" : "rgba(115,240,255,.72)";
  ctx.beginPath(); ctx.arc(0, 0, 25, 0, TAU * ready); ctx.stroke();
  ctx.restore();
}

function renderGame(ctx: CanvasRenderingContext2D, game: Game, view: Viewport, input: InputState, highContrast: boolean) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = "#010207";
  ctx.fillRect(0, 0, Math.ceil(view.width * view.dpr), Math.ceil(view.height * view.dpr));
  ctx.setTransform(view.dpr * view.scale, 0, 0, view.dpr * view.scale, view.dpr * view.offsetX, view.dpr * view.offsetY);
  renderBackdrop(ctx, game);

  if (game.mode === "menu") {
    drawMenuAperture(ctx, game);
  } else {
    const shake = game.reducedMotion ? 0 : game.shake;
    const sx = Math.sin(game.visualTime * 71) * shake;
    const sy = Math.cos(game.visualTime * 57) * shake * 0.65;
    ctx.save();
    ctx.translate(sx, sy);

    if (game.nova > 0) {
      const radius = (1 - game.nova) * 920;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.strokeStyle = `rgba(255,255,255,${game.nova})`;
      ctx.lineWidth = 6 + game.nova * 18;
      ctx.beginPath(); ctx.arc(game.player.x, game.player.y, Math.max(1, radius), 0, TAU); ctx.stroke();
      ctx.strokeStyle = `rgba(113,236,255,${game.nova * 0.8})`;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(game.player.x, game.player.y, Math.max(1, radius * 0.94), 0, TAU); ctx.stroke();
      ctx.restore();
    }

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const particle of game.particles) {
      const alpha = clamp(particle.life / particle.maxLife, 0, 1);
      ctx.globalAlpha = alpha * (particle.ring ? 0.72 : 0.82);
      ctx.strokeStyle = particle.color;
      ctx.fillStyle = particle.color;
      if (particle.ring) {
        ctx.lineWidth = Math.max(1, alpha * 4);
        ctx.beginPath(); ctx.arc(particle.x, particle.y, particle.size, 0, TAU); ctx.stroke();
      } else {
        ctx.beginPath(); ctx.arc(particle.x, particle.y, Math.max(0.5, particle.size * alpha), 0, TAU); ctx.fill();
      }
    }
    ctx.restore();

    for (const pickup of game.pickups) {
      ctx.save();
      ctx.translate(pickup.x, pickup.y);
      ctx.rotate(game.visualTime * 2.2 + pickup.id);
      ctx.fillStyle = "#a2fff4";
      ctx.shadowColor = "#5cf8ff";
      ctx.shadowBlur = 13;
      polygon(ctx, 4, 5 + Math.sin(game.visualTime * 4 + pickup.id) * 1.2, Math.PI / 4);
      ctx.fill();
      ctx.restore();
    }

    for (const drop of game.powerDrops) {
      const info = DROP_INFO[drop.kind];
      const pulse = 1 + Math.sin(game.visualTime * 6 + drop.id) * 0.13;
      ctx.save();
      ctx.translate(drop.x, drop.y);
      ctx.rotate(game.visualTime * 1.7 + drop.id);
      ctx.fillStyle = info.color;
      ctx.strokeStyle = "#ffffff";
      ctx.shadowColor = info.color;
      ctx.shadowBlur = 22;
      polygon(ctx, 6, 10 * pulse, Math.PI / 6);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.rotate(-game.visualTime * 1.7 - drop.id);
      ctx.fillStyle = "#061017";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "700 8px Geist Mono, monospace";
      ctx.fillText(info.glyph, 0, 0.5);
      ctx.restore();
    }

    if (game.smashPulse > 0) {
      const radius = (1 - game.smashPulse) * 420;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.strokeStyle = `rgba(255,231,145,${game.smashPulse * 0.9})`;
      ctx.lineWidth = 7 * game.smashPulse + 2;
      ctx.beginPath(); ctx.arc(game.player.x, game.player.y, Math.max(2, radius), 0, TAU); ctx.stroke();
      ctx.strokeStyle = `rgba(255,111,202,${game.smashPulse * 0.65})`;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(game.player.x, game.player.y, Math.max(2, radius * 0.72), 0, TAU); ctx.stroke();
      ctx.restore();
    }

    if (game.enemies.some((enemy) => enemy.kind === "lancer" && enemy.fire < 0.52)) {
      ctx.save();
      ctx.setLineDash([7, 10]);
      for (const enemy of game.enemies) {
        if (enemy.kind !== "lancer" || enemy.fire >= 0.52 || enemy.dead) continue;
        ctx.strokeStyle = `rgba(255,222,100,${0.22 + (0.52 - enemy.fire) * 0.8})`;
        ctx.lineWidth = enemy.fire < 0.14 ? 3 : 1;
        ctx.beginPath();
        ctx.moveTo(enemy.x, enemy.y);
        ctx.lineTo(enemy.x + Math.cos(enemy.angle) * 1200, enemy.y + Math.sin(enemy.angle) * 1200);
        ctx.stroke();
      }
      ctx.restore();
    }

    for (const bullet of game.bullets) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.strokeStyle = bullet.color;
      ctx.fillStyle = bullet.color;
      ctx.globalAlpha = bullet.enemy ? 0.9 : 0.95;
      ctx.lineCap = "round";
      ctx.lineWidth = bullet.r * (highContrast && bullet.enemy ? 1.65 : 1);
      ctx.beginPath(); ctx.moveTo(bullet.px, bullet.py); ctx.lineTo(bullet.x, bullet.y); ctx.stroke();
      ctx.beginPath(); ctx.arc(bullet.x, bullet.y, bullet.r * 0.72, 0, TAU); ctx.fill();
      if (highContrast && bullet.enemy) {
        ctx.globalCompositeOperation = "source-over";
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(bullet.x, bullet.y, bullet.r + 1.5, 0, TAU); ctx.stroke();
      }
      ctx.restore();
    }

    for (const enemy of game.enemies) drawEnemy(ctx, enemy, game.visualTime, highContrast);
    drawPlayer(ctx, game);

    for (const textItem of game.texts) {
      ctx.save();
      ctx.globalAlpha = clamp(textItem.life * 1.5, 0, 1);
      ctx.fillStyle = textItem.color;
      ctx.textAlign = "center";
      ctx.font = "700 14px ui-monospace, monospace";
      ctx.fillText(textItem.text, textItem.x, textItem.y);
      ctx.restore();
    }

    if (input.stickId !== null) {
      ctx.save();
      ctx.globalAlpha = 0.38;
      ctx.strokeStyle = "#8ffaff";
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(input.stickWorldX, input.stickWorldY, 52, 0, TAU); ctx.stroke();
      ctx.fillStyle = "rgba(133,249,255,.22)";
      ctx.beginPath(); ctx.arc(input.stickWorldX + input.stickX * 34, input.stickWorldY + input.stickY * 34, 18, 0, TAU); ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  if (game.flash > 0) {
    ctx.fillStyle = `rgba(225,244,255,${game.flash * (game.reducedMotion ? 0.08 : 0.22)})`;
    ctx.fillRect(0, 0, WORLD_W, WORLD_H);
  }
  const vignette = ctx.createRadialGradient(WORLD_W / 2, WORLD_H / 2, WORLD_H * 0.25, WORLD_W / 2, WORLD_H / 2, WORLD_W * 0.72);
  vignette.addColorStop(0, "rgba(0,0,0,0)");
  vignette.addColorStop(1, "rgba(0,0,0,.64)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);
}

class AudioEngine {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private ambience: OscillatorNode[] = [];
  private enabled = true;
  private lastShot = 0;

  async unlock() {
    if (!this.context) {
      const AudioCtor = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtor) return;
      this.context = new AudioCtor();
      this.master = this.context.createGain();
      const compressor = this.context.createDynamicsCompressor();
      this.master.gain.value = this.enabled ? 0.36 : 0;
      this.master.connect(compressor);
      compressor.connect(this.context.destination);
      this.startAmbience();
    }
    if (this.context.state === "suspended") await this.context.resume();
  }

  private startAmbience() {
    if (!this.context || !this.master || this.ambience.length) return;
    [43.65, 65.41].forEach((frequency, index) => {
      const oscillator = this.context!.createOscillator();
      const gain = this.context!.createGain();
      oscillator.type = index ? "sine" : "triangle";
      oscillator.frequency.value = frequency;
      gain.gain.value = index ? 0.018 : 0.025;
      oscillator.connect(gain);
      gain.connect(this.master!);
      oscillator.start();
      this.ambience.push(oscillator);
    });
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (this.context && this.master) this.master.gain.setTargetAtTime(enabled ? 0.36 : 0, this.context.currentTime, 0.04);
  }

  play(sound: Sfx) {
    if (!this.enabled || !this.context || !this.master) return;
    const now = this.context.currentTime;
    if (sound === "shoot" && now - this.lastShot < 0.065) return;
    if (sound === "shoot") this.lastShot = now;
    const settings: Record<Sfx, [number, number, number, OscillatorType, number]> = {
      shoot: [380, 760, 0.055, "square", 0.035],
      hit: [180, 95, 0.075, "sawtooth", 0.045],
      kill: [150, 520, 0.16, "triangle", 0.08],
      dash: [120, 840, 0.2, "sawtooth", 0.075],
      absorb: [520, 980, 0.11, "sine", 0.06],
      nova: [70, 1260, 0.72, "sawtooth", 0.13],
      hurt: [170, 48, 0.28, "square", 0.11],
      level: [330, 990, 0.42, "triangle", 0.09],
      boss: [58, 118, 0.85, "sawtooth", 0.14],
      pickup: [720, 1040, 0.06, "sine", 0.027],
    };
    const [from, to, duration, type, volume] = settings[sound];
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(from, now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, to), now + duration);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + Math.min(0.015, duration * 0.2));
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain);
    gain.connect(this.master);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.02);
  }

  close() {
    for (const oscillator of this.ambience) {
      try { oscillator.stop(); } catch { /* already stopped */ }
    }
    this.ambience = [];
    void this.context?.close();
    this.context = null;
    this.master = null;
  }
}

function formatTime(seconds: number) {
  const value = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, "0")}`;
}

function formatScore(score: number) {
  return Math.round(score).toString().padStart(7, "0");
}

function scoreStars(stageId: number, score: number) {
  const stage = CAMPAIGN_STAGES[stageId];
  if (!stage) return 0;
  return stage.scoreTargets.reduce((total, target) => total + (score >= target ? 1 : 0), 0);
}

function profileRecordKey(runMode: RunMode, stageId: number, difficulty: Difficulty, dailyKey: string | null = null) {
  return [runMode, stageId, difficulty, dailyKey ?? "all"].join(":");
}

function displayKey(code: string) {
  if (code === "Space") return "SPACE";
  if (code.startsWith("Key")) return code.slice(3).toUpperCase();
  if (code.startsWith("Arrow")) return code.slice(5).toUpperCase();
  return code.replace("Digit", "");
}

export default function PrismBreak() {
  const shellRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game>(createGame(0x51f15e, "menu"));
  const inputRef = useRef<InputState>(createInput());
  const bindingsRef = useRef<KeyBindings>(DEFAULT_BINDINGS);
  const bindingCaptureRef = useRef<BindingAction | null>(null);
  const viewRef = useRef<Viewport>({ width: WORLD_W, height: WORLD_H, dpr: 1, scale: 1, offsetX: 0, offsetY: 0 });
  const audioRef = useRef<AudioEngine | null>(null);
  const rafRef = useRef(0);
  const resultSavedRef = useRef(false);
  const progressionSavedRef = useRef(false);
  const scoreSubmittedRef = useRef(false);
  const prefsRef = useRef({ sound: true, reduced: false, contrast: false });

  const [ui, setUi] = useState<UiState>(EMPTY_UI);
  const [sound, setSound] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [highContrast, setHighContrast] = useState(false);
  const [bestScore, setBestScore] = useState(0);
  const [menuView, setMenuView] = useState<MenuView>("home");
  const [selectedStage, setSelectedStage] = useState(0);
  const [difficulty, setDifficulty] = useState<Difficulty>("cadet");
  const [profile, setProfile] = useState<PlayerProfile>(DEFAULT_PROFILE);
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [leaderboardError, setLeaderboardError] = useState("");
  const [runRank, setRunRank] = useState<number | null>(null);
  const [resultStars, setResultStars] = useState(0);
  const [bindings, setBindings] = useState<KeyBindings>(DEFAULT_BINDINGS);
  const [capturingBinding, setCapturingBinding] = useState<BindingAction | null>(null);
  const [controlsOpen, setControlsOpen] = useState(false);

  const publish = useCallback(() => setUi(snapshot(gameRef.current)), []);
  const startBindingCapture = useCallback((action: BindingAction) => {
    bindingCaptureRef.current = action;
    setCapturingBinding(action);
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      try {
        const storedBest = Number(localStorage.getItem("prism-break-best") || 0);
        setBestScore(Number.isFinite(storedBest) && storedBest > 0 ? Math.round(storedBest) : 0);
        const storedProfile = JSON.parse(localStorage.getItem("prism-break-profile-v2") || "null") as Partial<PlayerProfile> | null;
        if (storedProfile) {
          const stars = Object.entries(storedProfile.stars ?? {}).reduce<Record<string, number>>((records, [key, value]) => {
            if (typeof value === "number" && Number.isFinite(value)) records[key] = clamp(Math.round(value), 0, 3);
            return records;
          }, {});
          const bestScores = Object.entries(storedProfile.bestScores ?? {}).reduce<Record<string, number>>((records, [key, value]) => {
            if (typeof value === "number" && Number.isFinite(value) && value >= 0) records[key] = Math.round(value);
            return records;
          }, {});
          const nextProfile: PlayerProfile = {
            unlockedStage: clamp(Number(storedProfile.unlockedStage) || 0, 0, CAMPAIGN_STAGES.length - 1),
            overdriveUnlocked: Boolean(storedProfile.overdriveUnlocked),
            stars,
            bestScores,
          };
          setProfile(nextProfile);
          setSelectedStage(nextProfile.unlockedStage);
        }
        const muted = localStorage.getItem("prism-break-sound") === "off";
        const reduced = localStorage.getItem("prism-break-motion") === "reduced" || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        setSound(!muted);
        setReducedMotion(reduced);
        const storedBindings = JSON.parse(localStorage.getItem("prism-break-bindings-v1") || "null") as Partial<KeyBindings> | null;
        if (storedBindings) {
          const nextBindings = (Object.keys(DEFAULT_BINDINGS) as BindingAction[]).reduce<KeyBindings>((next, action) => {
            const candidate = storedBindings[action];
            next[action] = typeof candidate === "string" && candidate.length > 0 ? candidate : DEFAULT_BINDINGS[action];
            return next;
          }, { ...DEFAULT_BINDINGS });
          bindingsRef.current = nextBindings;
          inputRef.current.bindings = nextBindings;
          setBindings(nextBindings);
        }
      } catch { /* storage is optional */ }
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    prefsRef.current = { sound, reduced: reducedMotion, contrast: highContrast };
    audioRef.current?.setEnabled(sound);
    try {
      localStorage.setItem("prism-break-sound", sound ? "on" : "off");
      localStorage.setItem("prism-break-motion", reducedMotion ? "reduced" : "full");
    } catch { /* storage is optional */ }
  }, [sound, reducedMotion, highContrast]);

  const loadLeaderboard = useCallback(async (config: RunConfig) => {
    setLeaderboardLoading(true);
    setLeaderboardError("");
    try {
      const query = new URLSearchParams({ mode: config.runMode, limit: "8" });
      if (config.runMode === "campaign") {
        query.set("stage", String(config.stageId));
        query.set("difficulty", config.difficulty);
      } else if (config.runMode === "daily") {
        query.set("date", config.dailyKey ?? currentDailyKey());
      } else {
        query.set("difficulty", config.difficulty);
      }
      const response = await fetch(`/api/scores?${query.toString()}`, { credentials: "same-origin" });
      if (!response.ok) throw new Error(`Leaderboard ${response.status}`);
      const data = await response.json() as { scores?: LeaderboardRow[] };
      setLeaderboard((data.scores ?? []).map((row, index) => ({ ...row, rank: row.rank ?? index + 1 })));
    } catch {
      setLeaderboard([]);
      setLeaderboardError("GLOBAL LINK OFFLINE — LOCAL RECORDS STILL SAVE");
    } finally {
      setLeaderboardLoading(false);
    }
  }, []);

  useEffect(() => {
    if (ui.mode !== "menu" || menuView === "home") return;
    const config = menuView === "campaign"
      ? makeRunConfig("campaign", selectedStage, difficulty)
      : menuView === "daily"
        ? makeRunConfig("daily", -1, "standard", currentDailyKey())
        : makeRunConfig("arcade", -1, difficulty);
    const timer = window.setTimeout(() => void loadLeaderboard(config), 0);
    return () => window.clearTimeout(timer);
  }, [difficulty, loadLeaderboard, menuView, selectedStage, ui.mode]);

  useEffect(() => {
    if (ui.mode !== "gameover" && ui.mode !== "victory") return;
    const game = gameRef.current;
    const config = game.config;
    if (!progressionSavedRef.current) {
      progressionSavedRef.current = true;
      const stars = config.runMode === "campaign" && ui.mode === "victory"
        ? Math.max(1, scoreStars(config.stageId, ui.score))
        : 0;
      setResultStars(stars);
      setProfile((previous) => {
        const key = profileRecordKey(config.runMode, config.stageId, config.difficulty, config.dailyKey);
        const stageKey = `${config.stageId}:${config.difficulty}`;
        const campaignClear = config.runMode === "campaign" && ui.mode === "victory";
        const next: PlayerProfile = {
          unlockedStage: campaignClear ? Math.max(previous.unlockedStage, Math.min(CAMPAIGN_STAGES.length - 1, config.stageId + 1)) : previous.unlockedStage,
          overdriveUnlocked: previous.overdriveUnlocked || (campaignClear && config.stageId === CAMPAIGN_STAGES.length - 1),
          stars: campaignClear ? { ...previous.stars, [stageKey]: Math.max(previous.stars[stageKey] ?? 0, stars) } : previous.stars,
          bestScores: { ...previous.bestScores, [key]: Math.max(previous.bestScores[key] ?? 0, ui.score) },
        };
        try { localStorage.setItem("prism-break-profile-v2", JSON.stringify(next)); } catch { /* optional */ }
        return next;
      });
    }

    if (scoreSubmittedRef.current) return;
    scoreSubmittedRef.current = true;
    const submittedRunId = game.runId;
    void (async () => {
      try {
        const response = await fetch("/api/scores", {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({
            score: Math.round(game.score), mode: config.runMode, stage: config.stageId,
            difficulty: config.difficulty, kills: game.kills, absorbed: game.absorbed,
            comboX100: Math.round(game.bestCombo * 100), durationMs: Math.round(game.elapsed * 1000),
            completed: ui.mode === "victory", dailyKey: config.dailyKey,
          }),
        });
        if (!response.ok) throw new Error(`Submission ${response.status}`);
        const data = await response.json() as { rank?: number; score?: LeaderboardRow };
        if (gameRef.current.runId === submittedRunId) {
          setRunRank(data.rank ?? data.score?.rank ?? null);
          await loadLeaderboard(config);
        }
      } catch {
        if (gameRef.current.runId === submittedRunId) setLeaderboardError("SCORE SAVED LOCALLY — GLOBAL UPLINK UNAVAILABLE");
      }
    })();
  }, [loadLeaderboard, ui.mode, ui.score]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const shell = shellRef.current;
    if (!canvas || !shell) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    audioRef.current = new AudioEngine();
    audioRef.current.setEnabled(prefsRef.current.sound);

    const resize = () => {
      const rect = shell.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const scale = Math.min(rect.width / WORLD_W, rect.height / WORLD_H);
      const width = Math.max(1, rect.width);
      const height = Math.max(1, rect.height);
      viewRef.current = {
        width, height, dpr, scale,
        offsetX: (width - WORLD_W * scale) / 2,
        offsetY: (height - WORLD_H * scale) / 2,
      };
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
    };

    const toWorld = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect();
      const view = viewRef.current;
      return {
        x: clamp((clientX - rect.left - view.offsetX) / view.scale, 0, WORLD_W),
        y: clamp((clientY - rect.top - view.offsetY) / view.scale, 0, WORLD_H),
      };
    };

    const onKeyDown = (eventValue: KeyboardEvent) => {
      const input = inputRef.current;
      const capture = bindingCaptureRef.current;
      if (capture) {
        eventValue.preventDefault();
        if (eventValue.code !== "Escape") {
          setBindings((previous) => {
            const next = { ...previous, [capture]: eventValue.code };
            const swapped = (Object.keys(previous) as BindingAction[]).find((action) => action !== capture && previous[action] === eventValue.code);
            if (swapped) next[swapped] = previous[capture];
            bindingsRef.current = next;
            inputRef.current.bindings = next;
            try { localStorage.setItem("prism-break-bindings-v1", JSON.stringify(next)); } catch { /* optional */ }
            return next;
          });
        }
        bindingCaptureRef.current = null;
        setCapturingBinding(null);
        return;
      }
      input.keys[eventValue.code] = true;
      const game = gameRef.current;
      if (Object.values(input.bindings).includes(eventValue.code) && game.mode !== "menu") eventValue.preventDefault();
      if (!eventValue.repeat && eventValue.code === input.bindings.dash) input.dash = true;
      if (!eventValue.repeat && eventValue.code === input.bindings.nova) input.nova = true;
      if (!eventValue.repeat && eventValue.code === input.bindings.smash) input.smash = true;
      if (!eventValue.repeat && (eventValue.code === input.bindings.pause || eventValue.code === "Escape")) {
        if (game.mode === "playing") game.mode = "paused";
        else if (game.mode === "paused") game.mode = "playing";
        publish();
      }
    };
    const onKeyUp = (eventValue: KeyboardEvent) => { inputRef.current.keys[eventValue.code] = false; };
    const clearInput = () => {
      inputRef.current.keys = {};
      inputRef.current.stickId = null;
      inputRef.current.aimId = null;
      inputRef.current.stickX = 0;
      inputRef.current.stickY = 0;
    };
    const pauseForVisibility = () => {
      clearInput();
      const game = gameRef.current;
      if (game.mode === "playing") { game.mode = "paused"; publish(); }
    };
    const onVisibility = () => { if (document.hidden) pauseForVisibility(); };
    const onPointerDown = (pointer: PointerEvent) => {
      const input = inputRef.current;
      const point = toWorld(pointer.clientX, pointer.clientY);
      input.pointerX = point.x; input.pointerY = point.y; input.hasPointer = true;
      if (pointer.pointerType === "touch") {
        pointer.preventDefault();
        input.usingTouch = true;
        const rect = canvas.getBoundingClientRect();
        if (pointer.clientX < rect.left + rect.width * 0.52 && input.stickId === null) {
          input.stickId = pointer.pointerId;
          input.stickOriginX = pointer.clientX;
          input.stickOriginY = pointer.clientY;
          input.stickWorldX = point.x;
          input.stickWorldY = point.y;
          input.stickX = 0; input.stickY = 0;
        } else if (input.aimId === null) {
          input.aimId = pointer.pointerId;
        }
        canvas.setPointerCapture(pointer.pointerId);
      } else if (pointer.button === 2) {
        input.nova = true;
      }
    };
    const onPointerMove = (pointer: PointerEvent) => {
      const input = inputRef.current;
      const point = toWorld(pointer.clientX, pointer.clientY);
      if (pointer.pointerType !== "touch" || input.aimId === pointer.pointerId) {
        input.pointerX = point.x; input.pointerY = point.y; input.hasPointer = true;
      }
      if (input.stickId === pointer.pointerId) {
        pointer.preventDefault();
        const dx = pointer.clientX - input.stickOriginX;
        const dy = pointer.clientY - input.stickOriginY;
        const length = Math.max(1, Math.hypot(dx, dy));
        const strength = Math.min(1, length / 54);
        input.stickX = dx / length * strength;
        input.stickY = dy / length * strength;
      }
    };
    const onPointerUp = (pointer: PointerEvent) => {
      const input = inputRef.current;
      if (input.stickId === pointer.pointerId) { input.stickId = null; input.stickX = 0; input.stickY = 0; }
      if (input.aimId === pointer.pointerId) input.aimId = null;
    };
    const onContextMenu = (eventValue: MouseEvent) => eventValue.preventDefault();

    const observer = new ResizeObserver(resize);
    observer.observe(shell);
    window.addEventListener("keydown", onKeyDown, { passive: false });
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", pauseForVisibility);
    document.addEventListener("visibilitychange", onVisibility);
    canvas.addEventListener("pointerdown", onPointerDown, { passive: false });
    canvas.addEventListener("pointermove", onPointerMove, { passive: false });
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);
    canvas.addEventListener("contextmenu", onContextMenu);
    resize();
    publish();

    let last = performance.now();
    let accumulator = 0;
    let lastMode: Mode = gameRef.current.mode;
    const frame = (now: number) => {
      const frameDt = Math.min((now - last) / 1000, 0.1);
      last = now;
      const game = gameRef.current;
      game.visualTime += frameDt;
      game.reducedMotion = prefsRef.current.reduced;

      if (game.mode === "playing") {
        if (game.hitStop > 0) game.hitStop = Math.max(0, game.hitStop - frameDt);
        else {
          accumulator += frameDt;
          let steps = 0;
          while (accumulator >= STEP && steps < 5 && game.mode === "playing") {
            updateGame(game, inputRef.current, STEP);
            accumulator -= STEP;
            steps += 1;
          }
          if (steps === 5) accumulator = 0;
        }
      } else accumulator = 0;

      while (game.events.length) audioRef.current?.play(game.events.shift()!);
      if (game.uiClock >= 0.08 || game.mode !== lastMode) {
        game.uiClock = 0;
        lastMode = game.mode;
        setUi(snapshot(game));
      }
      if ((game.mode === "gameover" || game.mode === "victory") && !resultSavedRef.current) {
        resultSavedRef.current = true;
        setBestScore((previous) => {
          const next = Math.max(previous, Math.round(game.score));
          try { localStorage.setItem("prism-break-best", String(next)); } catch { /* optional */ }
          return next;
        });
      }
      renderGame(ctx, game, viewRef.current, inputRef.current, prefsRef.current.contrast);
      rafRef.current = requestAnimationFrame(frame);
    };
    rafRef.current = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(rafRef.current);
      observer.disconnect();
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", pauseForVisibility);
      document.removeEventListener("visibilitychange", onVisibility);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      canvas.removeEventListener("contextmenu", onContextMenu);
      audioRef.current?.close();
      audioRef.current = null;
    };
  }, [publish]);

  const launchGame = useCallback((runMode: RunMode, stageId = 0, requestedDifficulty: Difficulty = difficulty) => {
    const dailyKey = runMode === "daily" ? currentDailyKey() : null;
    const safeDifficulty = runMode === "daily"
      ? "standard"
      : requestedDifficulty === "overdrive" && !profile.overdriveUnlocked ? "standard" : requestedDifficulty;
    const config = makeRunConfig(runMode, stageId, safeDifficulty, dailyKey);
    const seed = runMode === "daily"
      ? seedFromText(`PRISM-BREAK-DAILY:${dailyKey}`)
      : (((performance.now() * 1000) ^ seedFromText(`${runMode}:${stageId}:${safeDifficulty}`)) >>> 0);
    const game = createGame(seed, "playing", config);
    game.runId = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${seed}`;
    game.reducedMotion = prefsRef.current.reduced;
    gameRef.current = game;
    inputRef.current = createInput(bindingsRef.current);
    resultSavedRef.current = false;
    progressionSavedRef.current = false;
    scoreSubmittedRef.current = false;
    setRunRank(null);
    setResultStars(0);
    setLeaderboardError("");
    void audioRef.current?.unlock();
    setUi(snapshot(game));
  }, [difficulty, profile.overdriveUnlocked]);

  const replayGame = useCallback(() => {
    const config = gameRef.current.config;
    launchGame(config.runMode, config.stageId, config.difficulty);
  }, [launchGame]);

  const returnToMenu = useCallback(() => {
    bindingCaptureRef.current = null;
    setCapturingBinding(null);
    setControlsOpen(false);
    const previousConfig = gameRef.current.config;
    setMenuView(previousConfig.runMode === "campaign" ? "campaign" : previousConfig.runMode);
    if (previousConfig.runMode === "campaign") setSelectedStage(previousConfig.stageId);
    if (previousConfig.runMode !== "daily") setDifficulty(previousConfig.difficulty);
    gameRef.current = createGame(0x51f15e, "menu", previousConfig);
    inputRef.current = createInput(bindingsRef.current);
    setUi(snapshot(gameRef.current));
  }, []);

  const togglePause = useCallback(() => {
    const game = gameRef.current;
    if (game.mode === "playing") game.mode = "paused";
    else if (game.mode === "paused") game.mode = "playing";
    setUi(snapshot(game));
  }, []);

  const pickUpgrade = useCallback((id: UpgradeId) => {
    const game = gameRef.current;
    if (game.mode !== "upgrade" || !game.upgradeChoices.includes(id)) return;
    applyUpgrade(game, id);
    setUi(snapshot(game));
  }, []);

  const requestFullscreen = useCallback(() => {
    const shell = shellRef.current;
    if (!shell) return;
    if (!document.fullscreenElement) void shell.requestFullscreen?.();
    else void document.exitFullscreen?.();
  }, []);

  const tutorialVisible = ui.mode === "playing" && Boolean(ui.guide);
  const isEnd = ui.mode === "gameover" || ui.mode === "victory";
  const activeStage = CAMPAIGN_STAGES[selectedStage];
  const selectedConfig = menuView === "campaign"
    ? makeRunConfig("campaign", selectedStage, difficulty)
    : menuView === "daily"
      ? makeRunConfig("daily", -1, "standard", currentDailyKey())
      : makeRunConfig("arcade", -1, difficulty);
  const localRecord = profile.bestScores[profileRecordKey(selectedConfig.runMode, selectedConfig.stageId, selectedConfig.difficulty, selectedConfig.dailyKey)] ?? 0;
  const totalStars = Object.values(profile.stars).reduce((total, stars) => total + stars, 0);
  const difficultySelector = (
    <div className="difficulty-selector" aria-label="Difficulty">
      {(Object.keys(DIFFICULTIES) as Difficulty[]).map((id) => {
        const locked = id === "overdrive" && !profile.overdriveUnlocked;
        return (
          <button key={id} className={difficulty === id ? "is-selected" : ""} disabled={locked} onClick={() => setDifficulty(id)}>
            <span>{DIFFICULTIES[id].name}</span>
            <small>{locked ? "CLEAR STAGE 05" : id === "cadet" ? "RECOMMENDED" : `${DIFFICULTIES[id].scoreMultiplier.toFixed(2)}× SCORE`}</small>
          </button>
        );
      })}
    </div>
  );
  const leaderboardPanel = (
    <aside className="leaderboard-panel" aria-label="Global leaderboard">
      <div className="leaderboard-heading"><span>GLOBAL RANKING</span><small>{"LIVE // TOP 8"}</small></div>
      {leaderboardLoading ? <p className="leaderboard-status">SYNCING PRISM SIGNALS…</p> : leaderboardError ? <p className="leaderboard-status is-error">{leaderboardError}</p> : leaderboard.length === 0 ? (
        <p className="leaderboard-status">NO SIGNALS YET — CLAIM RANK 01</p>
      ) : (
        <ol className="leaderboard-list">
          {leaderboard.map((row, index) => (
            <li key={`${row.id}-${index}`}>
              <b>{String(row.rank ?? index + 1).padStart(2, "0")}</b>
              <span>{row.callsign || "UNKNOWN PRISM"}</span>
              <strong>{formatScore(row.score)}</strong>
            </li>
          ))}
        </ol>
      )}
      <div className="local-record"><span>YOUR RECORD</span><strong>{formatScore(localRecord)}</strong></div>
    </aside>
  );

  return (
    <main ref={shellRef} className={`game-shell prism-game ${highContrast ? "is-high-contrast" : ""}`}>
      <canvas ref={canvasRef} className="world-canvas" aria-label="PRISM BREAK game arena" />
      <div className="screen-noise" aria-hidden="true" />
      <div className="screen-vignette" aria-hidden="true" />

      {ui.mode === "menu" && (
        <section className="menu-screen">
          <header className="menu-nav">
            <div className="game-logo" aria-label="Prism Break"><span>PB</span></div>
            <p>PRISM PROTOCOL <b>{"// 02"}</b></p>
            <div className="menu-tools">
              <button className={sound ? "is-active" : ""} onClick={() => setSound((value) => !value)} aria-pressed={sound}>
                <span className="tool-dot" />{sound ? "SOUND ON" : "SOUND OFF"}
              </button>
              <button className={reducedMotion ? "is-active" : ""} onClick={() => setReducedMotion((value) => !value)} aria-pressed={reducedMotion}>MOTION</button>
              <button onClick={requestFullscreen}>FULLSCREEN</button>
            </div>
          </header>

          {menuView === "home" ? (
            <div className="menu-content home-content">
              <div className="menu-kicker"><span>{"CAMPAIGN // GLOBAL COMPETITION"}</span><i /><span>BUILD 02</span></div>
              <h1 className="game-title"><span>PRISM</span><span>BREAK</span></h1>
              <p className="game-tagline">Six missions. Three difficulty circuits. One global ranking. Learn the prism, master the storm, break the Aperture.</p>
              <div className="menu-actions">
                <button className="launch-button" onClick={() => { setSelectedStage(profile.unlockedStage); setMenuView("campaign"); }}>
                  <span><small>{profile.unlockedStage === 0 ? "BEGIN WITH CALIBRATION" : `CONTINUE AT STAGE ${String(profile.unlockedStage).padStart(2, "0")}`}</small>ENTER CAMPAIGN</span>
                  <b>→</b>
                </button>
                <div className="best-score"><small>LIFETIME BEST</small><strong>{formatScore(bestScore)}</strong></div>
              </div>
              <div className="mode-card-grid" aria-label="Game modes">
                <button onClick={() => setMenuView("campaign")}><small>{"01 // PROGRESSION"}</small><strong>CAMPAIGN</strong><span>{profile.unlockedStage + 1}/6 STAGES · {totalStars} PRISM STARS</span></button>
                <button onClick={() => setMenuView("daily")}><small>{"02 // SAME SEED"}</small><strong>DAILY RIFT</strong><span>{currentDailyKey()} · GLOBAL BOARD</span></button>
                <button onClick={() => setMenuView("arcade")}><small>{"03 // ENDLESS MASTERY"}</small><strong>ARCADE RIFT</strong><span>150 SEC · FULL APERTURE RUN</span></button>
              </div>
            </div>
          ) : (
            <div className="mode-menu">
              <div className="mode-menu-heading">
                <button className="back-button" onClick={() => setMenuView("home")}>← TITLE</button>
                <div><small>{menuView === "campaign" ? "PRISM PROTOCOL // SIX MISSIONS" : menuView === "daily" ? "SYNCHRONIZED GLOBAL EVENT" : "UNBOUNDED SCORE ATTACK"}</small><h2>{menuView === "campaign" ? "CAMPAIGN" : menuView === "daily" ? "DAILY RIFT" : "ARCADE RIFT"}</h2></div>
                <div className="profile-summary"><span>STARS</span><strong>{String(totalStars).padStart(2, "0")}</strong><small>{profile.overdriveUnlocked ? "OVERDRIVE ONLINE" : "OVERDRIVE LOCKED"}</small></div>
              </div>

              {menuView === "campaign" && (
                <>
                  {difficultySelector}
                  <div className="stage-path" aria-label="Campaign stages">
                    {CAMPAIGN_STAGES.map((stage) => {
                      const locked = stage.id > profile.unlockedStage;
                      const stars = profile.stars[`${stage.id}:${difficulty}`] ?? 0;
                      return (
                        <button key={stage.id} disabled={locked} className={`${selectedStage === stage.id ? "is-selected" : ""} ${locked ? "is-locked" : ""}`} onClick={() => setSelectedStage(stage.id)}>
                          <span>{locked ? "LOCK" : stage.code}</span><i /><small>{stage.name}</small><b>{locked ? "◇◇◇" : `${"◆".repeat(stars)}${"◇".repeat(3 - stars)}`}</b>
                        </button>
                      );
                    })}
                  </div>
                  <div className="mission-layout">
                    <section className="mission-brief">
                      <p>{`STAGE ${activeStage.code} // ${activeStage.subtitle.toUpperCase()}`}</p>
                      <h3>{activeStage.name}</h3>
                      <span>{activeStage.briefing}</span>
                      <div className="mission-specs">
                        <div><small>PRIMARY OBJECTIVE</small><strong>{activeStage.objective === "survive" ? `SURVIVE ${activeStage.target}s` : activeStage.objective === "kills" ? `DESTROY ${activeStage.target}` : activeStage.objective === "absorb" ? `ABSORB ${activeStage.target}` : activeStage.objective === "elites" ? `ELIMINATE ${activeStage.target} ELITES` : "BREAK THE APERTURE"}</strong></div>
                        <div><small>THREAT PROFILE</small><strong>{activeStage.roster.length} SIGNATURES</strong></div>
                        <div><small>MASTERY TARGETS</small><strong>{activeStage.scoreTargets.map((target) => Math.round(target / 1000) + "K").join(" / ")}</strong></div>
                      </div>
                      <p className="difficulty-copy">{DIFFICULTIES[difficulty].description}</p>
                      <button className="mission-launch" onClick={() => launchGame("campaign", selectedStage, difficulty)}><span><small>{`DEPLOY // ${DIFFICULTIES[difficulty].name}`}</small>START STAGE {activeStage.code}</span><b>→</b></button>
                    </section>
                    {leaderboardPanel}
                  </div>
                </>
              )}

              {menuView === "daily" && (
                <div className="challenge-layout">
                  <section className="challenge-card">
                    <p>{`DAILY SIGNATURE // ${currentDailyKey()}`}</p><h3>ONE SEED.<br />ONE GLOBAL BOARD.</h3>
                    <span>Every prism faces the exact same enemy sequence on Standard difficulty. Your highest signal owns the rank until midnight UTC.</span>
                    <div className="daily-seed"><small>RIFT SEED</small><strong>{seedFromText(`PRISM-BREAK-DAILY:${currentDailyKey()}`).toString(16).toUpperCase().padStart(8, "0")}</strong></div>
                    <button className="mission-launch" onClick={() => launchGame("daily", -1, "standard")}><span><small>{"STANDARD // 135 SECONDS"}</small>ENTER DAILY RIFT</span><b>→</b></button>
                  </section>
                  {leaderboardPanel}
                </div>
              )}

              {menuView === "arcade" && (
                <>
                  {difficultySelector}
                  <div className="challenge-layout">
                    <section className="challenge-card arcade-card">
                      <p>{"ARCADE PROTOCOL // OPEN CIRCUIT"}</p><h3>CHASE THE<br />PERFECT RUN.</h3>
                      <span>The original full-length assault: escalating waves, all enemy signatures, evolving upgrades, and the Aperture at 108 seconds.</span>
                      <div className="arcade-facts"><div><small>RUN</small><strong>02:30</strong></div><div><small>SCORE MULTIPLIER</small><strong>{DIFFICULTIES[difficulty].scoreMultiplier.toFixed(2)}×</strong></div></div>
                      <button className="mission-launch" onClick={() => launchGame("arcade", -1, difficulty)}><span><small>{`${DIFFICULTIES[difficulty].name} // GLOBAL RANK`}</small>START ARCADE RIFT</span><b>→</b></button>
                    </section>
                    {leaderboardPanel}
                  </div>
                </>
              )}
            </div>
          )}

          {menuView === "home" && <aside className="menu-lore"><span>THE APERTURE</span><strong>LEARNS<br />EVERY MOVE.</strong><p>Now the protocol remembers your victories too.</p></aside>}
          <footer className="menu-footer"><span>002</span><i /><span>ABSORB · REFRACT · ASCEND</span></footer>
        </section>
      )}

      {ui.mode !== "menu" && (
        <>
          <header className="game-hud">
            <section className="hud-block integrity-block">
              <small>PRISM INTEGRITY</small>
              <div className="health-row">
                {Array.from({ length: ui.maxHealth }, (_, index) => <i key={index} className={index < ui.health ? "health-on" : ""} />)}
                {ui.shield > 0.05 && <span className="shield-readout">SHIELD {Math.ceil(ui.shield)}</span>}
              </div>
            </section>
            <section className="wave-readout">
              <small>{ui.wave}</small>
              <strong>{formatTime(ui.timeLeft)}</strong>
              <span>RIFT STABILITY</span>
            </section>
            <section className="hud-block score-block">
              <small>SCORE</small>
              <strong>{formatScore(ui.score)}</strong>
              <span className={ui.combo > 1.05 ? "combo-hot" : ""}>×{ui.combo.toFixed(2)} REFRACTION</span>
            </section>
          </header>

          <div className="level-track">
            <span>LV.{String(ui.level).padStart(2, "0")}</span>
            <i><b style={{ width: `${clamp(ui.xp / ui.nextXp * 100, 0, 100)}%` }} /></i>
          </div>

          <div className="objective-tracker">
            <div><small>{`PRIMARY // ${DIFFICULTIES[ui.difficulty].name}`}</small><strong>{ui.objectiveLabel}</strong></div>
            <span>{Math.floor(Math.min(ui.objectiveProgress, ui.objectiveTarget))}<b>/ {ui.objectiveTarget}</b></span>
            <i><b style={{ width: `${clamp(ui.objectiveProgress / Math.max(1, ui.objectiveTarget) * 100, 0, 100)}%` }} /></i>
          </div>

          {ui.bossMaxHealth > 0 && (
            <div className="boss-hud">
              <div><small>OMEGA ENTITY</small><strong>THE APERTURE</strong><span>PHASE {ui.bossHealth / ui.bossMaxHealth > 0.58 ? "I" : ui.bossHealth / ui.bossMaxHealth > 0.28 ? "II" : "III"}</span></div>
              <i><b style={{ width: `${clamp(ui.bossHealth / ui.bossMaxHealth * 100, 0, 100)}%` }} /></i>
            </div>
          )}

          <div className="ability-hud">
            <div className="ability-label"><span>PRISM NOVA</span><small>{ui.rapidBuff > 0 ? `RAPID MODULE ${Math.ceil(ui.rapidBuff)}s` : ui.charge >= 100 ? "CORE OVERCHARGED" : "ABSORB FIRE TO CHARGE"}</small></div>
            <i className={ui.charge >= 100 ? "charge-track is-ready" : "charge-track"}><b style={{ width: `${ui.charge}%` }} /></i>
            <strong>{Math.floor(ui.charge)}<small>%</small></strong>
            <div className="dash-chip"><span style={{ "--dash": `${ui.dash * 360}deg` } as React.CSSProperties}>{displayKey(bindings.dash)}</span><small>{ui.dash >= 0.995 ? "DASH READY" : "PHASING"}</small></div>
            <div className="smash-chip"><span className={ui.smash >= 0.995 ? "is-ready" : ""}>{displayKey(bindings.smash)}</span><small>{ui.smash >= 0.995 ? "PRISM SMASH" : `${Math.ceil((1 - ui.smash) * 20)}s COOLDOWN`}</small></div>
          </div>

          <button className="pause-trigger" onClick={togglePause} aria-label="Pause game">Ⅱ</button>

          {tutorialVisible && (
            <div className="tutorial-strip" role="status">
              <span><kbd>GUIDE</kbd>{ui.guide}</span>
            </div>
          )}

          {ui.mode === "playing" && (
            <div className="touch-controls" aria-label="Touch controls">
              <button className="smash-touch" disabled={ui.smash < 0.995} onPointerDown={(eventValue) => { eventValue.stopPropagation(); inputRef.current.smash = true; }}>SMASH</button>
              <button className="nova-touch" disabled={ui.charge < 100} onPointerDown={(eventValue) => { eventValue.stopPropagation(); inputRef.current.nova = true; }}>NOVA</button>
              <button className="dash-touch" disabled={ui.dash < 0.995} onPointerDown={(eventValue) => { eventValue.stopPropagation(); inputRef.current.dash = true; }}>DASH</button>
            </div>
          )}
        </>
      )}

      {ui.mode === "paused" && (
        <section className="modal-layer pause-modal" role="dialog" aria-modal="true" aria-labelledby="pause-title">
          <div className="modal-panel compact-panel">
            <p className="modal-kicker">SIMULATION SUSPENDED</p>
            <h2 id="pause-title">PAUSED</h2>
            <button className="modal-primary" onClick={togglePause}>RESUME</button>
            <div className="modal-row">
              <button onClick={() => setSound((value) => !value)}>{sound ? "SOUND ON" : "SOUND OFF"}</button>
              <button onClick={() => setHighContrast((value) => !value)}>{highContrast ? "HIGH CONTRAST" : "STANDARD CONTRAST"}</button>
              <button onClick={() => setControlsOpen((value) => !value)}>{controlsOpen ? "HIDE KEYS" : "CHANGE KEYS"}</button>
            </div>
            {controlsOpen && (
              <div className="controls-panel" aria-label="Keyboard controls">
                <p>{capturingBinding ? `PRESS A KEY FOR ${capturingBinding.toUpperCase()}` : "CLICK A CONTROL, THEN PRESS A KEY"}</p>
                <div>
                  {(Object.keys(bindings) as BindingAction[]).map((action) => (
                    <button key={action} className={capturingBinding === action ? "is-capturing" : ""} onClick={() => startBindingCapture(action)}>
                      <span>{action.toUpperCase()}</span><b>{capturingBinding === action ? "PRESS KEY" : displayKey(bindings[action])}</b>
                    </button>
                  ))}
                </div>
                <button className="controls-reset" onClick={() => {
                  bindingsRef.current = DEFAULT_BINDINGS;
                  inputRef.current.bindings = DEFAULT_BINDINGS;
                  setBindings(DEFAULT_BINDINGS);
                  try { localStorage.setItem("prism-break-bindings-v1", JSON.stringify(DEFAULT_BINDINGS)); } catch { /* optional */ }
                }}>RESTORE DEFAULT KEYS</button>
              </div>
            )}
            <button className="modal-link" onClick={returnToMenu}>ABORT RUN</button>
          </div>
        </section>
      )}

      {ui.mode === "upgrade" && (
        <section className="modal-layer upgrade-modal" role="dialog" aria-modal="true" aria-labelledby="upgrade-title">
          <div className="upgrade-heading">
            <p className="modal-kicker">{`PRISM EVOLUTION // LEVEL ${String(ui.level).padStart(2, "0")}`}</p>
            <h2 id="upgrade-title">CHOOSE A REFRACTION</h2>
            <span>Time is suspended while the prism adapts.</span>
          </div>
          <div className="upgrade-grid">
            {ui.choices.map((id, index) => {
              const info = UPGRADES[id];
              const nextLevel = (ui.upgrades[id] ?? 0) + 1;
              return (
                <button key={id} className="upgrade-card" onClick={() => pickUpgrade(id)}>
                  <span className="card-index">0{index + 1}</span>
                  <span className="card-glyph">{info.glyph}</span>
                  <small>{info.tag}</small>
                  <strong>{info.name}</strong>
                  <p>{info.description}</p>
                  <span className="card-level">TIER {"I".repeat(Math.min(nextLevel, 4))}</span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {isEnd && (
        <section className={`modal-layer result-modal ${ui.mode === "victory" ? "victory-modal" : ""}`} role="dialog" aria-modal="true" aria-labelledby="result-title">
          <div className="result-panel">
            <p className="modal-kicker">{ui.mode === "victory" ? "PROTOCOL COMPLETE" : "SIGNAL TERMINATED"}</p>
            <h2 id="result-title">{ui.mode === "victory" ? ui.runMode === "campaign" && ui.stageId < 5 ? "STAGE\nCLEARED" : "APERTURE\nBROKEN" : "PRISM\nFALLEN"}</h2>
            <p className="result-reason">{ui.reason}</p>
            {ui.mode === "victory" && ui.runMode === "campaign" && <div className="result-grade"><span>MISSION MASTERY</span><strong>{"◆".repeat(resultStars)}{"◇".repeat(3 - resultStars)}</strong></div>}
            <div className="final-score"><small>FINAL SCORE</small><strong>{formatScore(ui.score)}</strong>{ui.score >= bestScore && ui.score > 0 && <span>NEW BEST</span>}</div>
            <div className="result-stats">
              <div><strong>{ui.kills}</strong><span>HOSTILES</span></div>
              <div><strong>{ui.absorbed}</strong><span>ABSORBED</span></div>
              <div><strong>×{ui.bestCombo.toFixed(2)}</strong><span>BEST COMBO</span></div>
            </div>
            <div className="rank-readout"><span>PERSONAL BEST RANK</span><strong>{runRank ? `RANK ${String(runRank).padStart(2, "0")}` : leaderboardError ? "UPLINK PENDING" : "SYNCING…"}</strong></div>
            <div className="result-actions">
              {ui.mode === "victory" && ui.runMode === "campaign" && ui.stageId < CAMPAIGN_STAGES.length - 1 && (
                <button className="modal-primary" onClick={() => launchGame("campaign", ui.stageId + 1, ui.difficulty)}>NEXT STAGE</button>
              )}
              <button className={ui.mode === "victory" && ui.runMode === "campaign" && ui.stageId < CAMPAIGN_STAGES.length - 1 ? "modal-secondary" : "modal-primary"} onClick={replayGame}>RUN IT AGAIN</button>
              <button className="modal-link" onClick={returnToMenu}>RETURN TO MODE SELECT</button>
            </div>
          </div>
        </section>
      )}

      <div className="sr-only" aria-live="polite">
        {ui.mode === "upgrade" ? "Level up. Choose an upgrade." : ui.mode === "gameover" ? "Game over." : ui.mode === "victory" ? "Victory." : ""}
      </div>
    </main>
  );
}

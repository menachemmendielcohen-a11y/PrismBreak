"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ACHIEVEMENT_DEFINITIONS,
  achievementProgress,
  migrateAchievementSave,
  recordAchievementRun,
  type AchievementDefinition,
  type AchievementSave,
} from "./achievements";
import {
  PRIME_MISSIONS,
  PROGRESSION_BALANCE,
  calculatePlayerRank,
  calculateShardReward,
  canUnlockPrime,
  maxThreatAttempt,
  migrateProgressionSave,
  purchasePrime,
  selectThreatModifiers,
  threatRewardRange,
  threatScaling,
  type PrimeBonusId,
  type PrimeMissionDefinition,
  type ThreatModifierId,
  type ThreatScaling,
} from "./progression";
import {
  PRISM_ENGINE,
  SPECTRUM_IDS,
  SPECTRUM_INFO,
  addSpectrum,
  consumeRefraction,
  emptySpectrumStore,
  perfectAbsorbWindow,
  prismStability,
  resolveRefraction,
  spectrumTotal,
  type RefractionRecipe,
  type SpectrumId,
  type SpectrumStore,
} from "./spectrum";
import { ENEMY_VISUALS } from "./enemyVisuals";
import dropIconSheetUrl from "./assets/prism-drop-icons.png";

const WORLD_W = 1280;
const WORLD_H = 720;
const STEP = 1 / 60;
const BOSS_TIME = 108;
const RUN_TIME = 150;
const TAU = Math.PI * 2;
const NOVA_COIN_COST = 1;

const isStaticBuild = () => typeof window !== "undefined"
  && (window as typeof window & { __PRISM_STATIC_BUILD__?: boolean }).__PRISM_STATIC_BUILD__ === true;

type Mode = "menu" | "playing" | "paused" | "nova-confirm" | "upgrade" | "gameover" | "victory";
type EnemyKind = "needle" | "halo" | "splitter" | "lancer" | "bulwark" | "skimmer" | "weaver" | "warden" | "siphon" | "phantom" | "oracle" | "boss";
type EliteTier = "minor" | "major";
type WorldUpgradeId = "origin_guard" | "chroma_array" | "void_drive" | "eternal_resonance";
type Sfx = "shoot" | "hit" | "kill" | "dash" | "absorb" | "perfect" | "refract" | "break" | "nova" | "hurt" | "level" | "boss" | "pickup";
type UpgradeId = "split" | "rapid" | "heavy" | "chain" | "magnet" | "wake" | "phase" | "guard" | "glass" | "second" | "focus" | "overclock" | "lance" | "echo" | "spectrumLock" | "horizon" | "shatterpoint";
type UpgradeRarity = "COMMON" | "RARE" | "PRISMATIC" | "ANOMALOUS";
type DamageSource = "normal" | "refraction" | "nova" | "smash" | "dash" | "ally";
type DropKind = "repair" | "overcharge" | "rapid" | "smashcell" | "double" | "alliance" | "powercore" | "cooldown" | "aegis" | "pierce" | "stasis" | "resonance";
type BindingAction = "up" | "down" | "left" | "right" | "dash" | "nova" | "smash" | "blast" | "pause";
type RunMode = "campaign" | "prime" | "threat" | "daily" | "arcade";
type Difficulty = "cadet" | "standard" | "overdrive";
type ObjectiveKind = "survive" | "kills" | "absorb" | "elites" | "boss";
type MicroObjectiveKind = "perfect" | "refraction" | "combo" | "full-spectrum";
type MenuView = "home" | "campaign" | "prime" | "threat" | "daily" | "arcade" | "powers" | "shop" | "achievements";
type Language = "en" | "he";

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
  world?: 1 | 2 | 3 | 4;
  modifiers?: ThreatModifierId[];
  maxHostiles?: number;
  maxActiveElites?: number;
  eliteTierCap?: EliteTier;
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
  dash: "Space", nova: "KeyE", smash: "KeyF", blast: "KeyQ", pause: "KeyP",
};
const REMAPPABLE_ACTIONS: BindingAction[] = ["dash", "nova", "smash", "blast", "pause"];

const DROP_INFO: Record<DropKind, { name: string; color: string; glyph: string }> = {
  repair: { name: "REPAIR SHARD", color: "#8affcf", glyph: "+" },
  overcharge: { name: "NOVA CELL", color: "#ffe486", glyph: "N" },
  rapid: { name: "RAPID MODULE", color: "#a98cff", glyph: "R" },
  smashcell: { name: "SMASH CELL", color: "#ff80c8", glyph: "S" },
  double: { name: "TWIN BEAM", color: "#74f7ff", glyph: "II" },
  alliance: { name: "CHROMA PACT", color: "#83ffc0", glyph: "A" },
  powercore: { name: "PRISM CORE", color: "#ffcf72", glyph: "✦" },
  cooldown: { name: "TIME FRACTURE", color: "#d2a0ff", glyph: "↻" },
  aegis: { name: "AEGIS PLATE", color: "#8affda", glyph: "⬡" },
  pierce: { name: "PHASE NEEDLE", color: "#f0b3ff", glyph: "⇢" },
  stasis: { name: "STASIS BLOOM", color: "#9eb4ff", glyph: "◷" },
  resonance: { name: "ABSORPTION COIL", color: "#ffe37a", glyph: "∞" },
};
// The supplied drop artwork is a 4x3 atlas. Keeping the order here makes it
// easy to swap the artwork later without touching gameplay or drop logic.
const DROP_ICON_ORDER: DropKind[] = [
  "aegis", "smashcell", "repair", "overcharge",
  "pierce", "powercore", "double", "alliance",
  "stasis", "cooldown", "rapid", "resonance",
];
const DROP_ICON_COLUMNS = 4;
const DROP_ICON_ROWS = 3;
const dropIconSrc = typeof dropIconSheetUrl === "string"
  ? dropIconSheetUrl
  : (dropIconSheetUrl as { src: string }).src;
const dropIconImage = typeof Image !== "undefined" ? new Image() : null;
if (dropIconImage) dropIconImage.src = dropIconSrc;

const enemyVisualImages: HTMLImageElement[] = [];
const PLAYER_SHIP_VISUAL_INDEX = 5;
if (typeof Image !== "undefined") {
  for (const source of ENEMY_VISUALS) {
    const image = new Image();
    image.decoding = "async";
    image.src = source;
    enemyVisualImages.push(image);
  }
}

function dropIconCell(kind: DropKind) {
  const index = Math.max(0, DROP_ICON_ORDER.indexOf(kind));
  return { column: index % DROP_ICON_COLUMNS, row: Math.floor(index / DROP_ICON_COLUMNS) };
}

const DROP_GUIDE = {
  repair: { en: "REPAIR SHARD", he: "רסיס תיקון", enDetail: "Restores one full integrity point. It cannot raise health above the maximum.", heDetail: "מחזיר נקודת חיים מלאה אחת. לא יכול להעלות חיים מעל המקסימום.", enTip: "Best when one hit away from defeat.", heTip: "כדאי לאסוף כשנשארה לך נקודת חיים אחת." },
  overcharge: { en: "NOVA CELL", he: "תא נובה", enDetail: "Adds 48% to the Nova meter. At 100%, press E and authorize the one-coin activation.", heDetail: "מוסיף 48% למד הנובה. כשהמד מגיע ל־100%, לחץ E ואשר הפעלה תמורת מטבע אחד.", enTip: "Save it for crowded bullet patterns.", heTip: "שמור אותו לרגע שבו המסך מלא ביריות." },
  rapid: { en: "RAPID MODULE", he: "מודול ירי מהיר", enDetail: "Shortens the time between automatic shots for 14 seconds. It stacks well with rapid-fire upgrades.", heDetail: "מקצר את הזמן בין יריות אוטומטיות למשך 14 שניות. עובד מצוין יחד עם שדרוגי ירי מהיר.", enTip: "Use it against elite enemies or the boss.", heTip: "חזק במיוחד נגד אליטות או בוס." },
  smashcell: { en: "SMASH CELL", he: "תא מחץ", enDetail: "Removes 9 seconds from Prism Smash recharge. It does not activate Smash by itself.", heDetail: "מוריד 9 שניות מזמן הטעינה של מתקפת מחץ. הוא לא מפעיל את המחץ בעצמו.", enTip: "Collect it after using Smash to get it back sooner.", heTip: "אסוף אחרי שהפעלת מחץ כדי לקבל אותו שוב מהר." },
  double: { en: "TWIN BEAM", he: "קרן כפולה", enDetail: "Fires two parallel beams instead of one for 14 seconds. Both beams can hit the same large enemy.", heDetail: "יורה שתי קרניים מקבילות במקום אחת למשך 14 שניות. שתיהן יכולות לפגוע באותו אויב גדול.", enTip: "Stay close to a boss for maximum damage.", heTip: "התקרב לבוס כדי ששתי הקרניים יפגעו בו." },
  alliance: { en: "CHROMA PACT", he: "ברית כרומה", enDetail: "Converts nearby enemies matching the drop color into allies. Allies shoot hostile enemies until they are destroyed.", heDetail: "הופך אויבים קרובים בצבע של הדרופ לבעלי ברית. הם יורים באויבים עד שמושמדים.", enTip: "Grab it near a group of matching-color enemies.", heTip: "אסוף ליד קבוצה של אויבים באותו צבע." },
} as Record<DropKind, { en: string; he: string; enDetail: string; heDetail: string; enTip: string; heTip: string }>;

const ENEMY_GUIDE: Array<{ kind: EnemyKind; en: string; he: string; enDetail: string; heDetail: string }> = [
  { kind: "needle", en: "NEEDLE", he: "מחט", enDetail: "Fast interceptor that closes distance and fires focused shots.", heDetail: "מיירט מהיר שסוגר מרחק ויורה יריות ממוקדות." },
  { kind: "halo", en: "HALO", he: "הילה", enDetail: "Orbiting unit that builds crossfire around the arena.", heDetail: "יחידה מסתובבת שיוצרת אש צולבת בזירה." },
  { kind: "splitter", en: "SPLITTER", he: "מפצל", enDetail: "Seeds the field with projectiles that divide into extra threats.", heDetail: "מפזר קליעים שמתפצלים לאיומים נוספים." },
  { kind: "lancer", en: "LANCER", he: "נושא רומח", enDetail: "Telegraphs a piercing lance line before releasing its volley.", heDetail: "מסמן קו חדירה לפני שהוא משחרר מטח." },
  { kind: "bulwark", en: "BULWARK", he: "מבצר", enDetail: "Heavy square unit protected by a rotating guard ring.", heDetail: "יחידה כבדה עם טבעת הגנה מסתובבת." },
  { kind: "skimmer", en: "SKIMMER", he: "מרחף", enDetail: "Low-profile flier that skims across the grid at an angle.", heDetail: "חללית נמוכה שמרחפת באלכסון על פני הרשת." },
  { kind: "weaver", en: "WEAVER", he: "אורג", enDetail: "Links the battlefield with four directional energy arms.", heDetail: "מחבר את שדה הקרב בארבע זרועות אנרגיה." },
  { kind: "warden", en: "WARDEN", he: "שומר", enDetail: "Area guardian whose large orbit marks its control radius.", heDetail: "שומר אזורי שטבעת המסלול שלו מסמנת את רדיוס השליטה." },
  { kind: "siphon", en: "SIPHON", he: "סופח", enDetail: "Drains space around it with a three-arm absorption coil.", heDetail: "שואב אנרגיה סביבו בעזרת סליל בעל שלוש זרועות." },
  { kind: "phantom", en: "PHANTOM", he: "פנטום", enDetail: "Flickering stealth craft that phases through the rift.", heDetail: "חללית חמקנית מהבהבת שחולפת דרך הקרע." },
  { kind: "oracle", en: "ORACLE", he: "אורקל", enDetail: "Predictive prism unit surrounded by a rotating signal ring.", heDetail: "יחידת פריזמה חיזויית מוקפת בטבעת אות מסתובבת." },
  { kind: "boss", en: "THE APERTURE", he: "המפתח", enDetail: "Omega entity with layered rings, spectrum shields and a breakable core.", heDetail: "ישות אומגה עם טבעות שכבתיות, מגני ספקטרום וליבה שבירה." },
];
DROP_GUIDE.powercore = { en: "PRISM CORE", he: "ליבת פריזמה", enDetail: "A rare special drop that permanently unlocks a new power for future upgrade choices.", heDetail: "דרופ מיוחד ונדיר שפותח לצמיתות כוח חדש שיופיע בבחירות השדרוג.", enTip: "Collect every core to expand your arsenal.", heTip: "אספו כל ליבה כדי להרחיב את ארסנל הכוחות." };
DROP_GUIDE.cooldown = { en: "TIME FRACTURE", he: "שבר זמן", enDetail: "Cuts 10 seconds from every active ability cooldown: Smash, Prism Lance and Dash.", heDetail: "מוריד 10 שניות מכל זמני הקירור הפעילים: מחץ, רומח פריזמה ודאש.", enTip: "Save it for a moment when several abilities are cooling down.", heTip: "שמרו אותו לרגע שבו כמה כוחות נמצאים בקירור." };
DROP_GUIDE.aegis = { en: "AEGIS PLATE", he: "לוח מגן", enDetail: "Adds one full shield charge, up to two charges, without replacing your normal integrity.", heDetail: "מוסיף טעינת מגן מלאה אחת, עד שתי טעינות, בלי להחליף את החיים הרגילים.", enTip: "Take it before a dense wave or boss phase.", heTip: "כדאי לאסוף לפני גל צפוף או שלב בוס." };
DROP_GUIDE.pierce = { en: "PHASE NEEDLE", he: "מחט חודרת", enDetail: "For 12 seconds, regular shots pierce through two additional enemies.", heDetail: "למשך 12 שניות, היריות הרגילות חודרות דרך שני אויבים נוספים.", enTip: "Line up groups to multiply its damage.", heTip: "סדר קבוצות אויבים בקו כדי להכפיל את הנזק." };
DROP_GUIDE.stasis = { en: "STASIS BLOOM", he: "פריחת קיפאון", enDetail: "Slows hostile movement and projectiles for 5 seconds while their attack timers continue.", heDetail: "מאט תנועת אויבים וקליעים למשך 5 שניות, בזמן שמוני ההתקפה ממשיכים.", enTip: "Use the opening to reposition or absorb safely.", heTip: "נצל את החלון כדי להתמקם מחדש או לספוג בבטחה." };
DROP_GUIDE.resonance = { en: "ABSORPTION COIL", he: "סליל ספיגה", enDetail: "For 10 seconds, absorbed shots grant 75% more Nova charge and stronger reflected fire.", heDetail: "למשך 10 שניות, ספיגת יריות נותנת 75% יותר טעינת נובה ומחזירה ירי חזק יותר.", enTip: "Dash through a readable projectile pattern.", heTip: "בצע דאש דרך דפוס ירי ברור כדי למלא נובה במהירות." };

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
  primeId: string | null;
  primeBonuses: PrimeBonusId[];
  threatLevel: number;
  modifiers: ThreatModifierId[];
  scaling: ThreatScaling;
  maxHostiles: number | null;
  maxActiveElites: number;
  eliteTierCap: EliteTier;
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
  saveVersion: number;
  unlockedStage: number;
  overdriveUnlocked: boolean;
  stars: Record<string, number>;
  bestScores: Record<string, number>;
  prismShards: number;
  healthBonus: number;
  unlockedPrimeIds: string[];
  primeBestTimes: Record<string, number>;
  highestThreat: number;
  threatBestScore: number;
  threatBestClearTime: number | null;
  highestThreatAvailable: number;
  rank: number;
  rankXp: number;
  totalRuns: number;
  successfulRuns: number;
  worldCoreUpgrades: WorldUpgradeId[];
  achievements: AchievementSave;
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
  eliteTier: EliteTier | null;
  phase: number;
  phaseTimer: number;
  ally: boolean;
  dead: boolean;
  processed: boolean;
  defeatedBy: DamageSource | null;
  shieldSpectrum: SpectrumId | null;
  weakPointTimer: number;
  visualIndex: number;
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
  hitEnemyIds: number[];
  spectrum: SpectrumId | null;
  absorbable: boolean;
  energyValue: number;
  refraction: boolean;
  recipeId: string | null;
  chain: number;
  burstRadius: number;
  detonatesBullets: boolean;
}

interface DelayedRefraction {
  time: number;
  recipe: RefractionRecipe;
  angle: number;
  damageScale: number;
}

interface Pickup {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  value: number;
  kind: "shard" | "coin";
  age: number;
  dead: boolean;
}

interface PowerDrop {
  id: number;
  kind: DropKind;
  allyKind: EnemyKind | null;
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
  worldCoreUpgrades: WorldUpgradeId[];
  unlockedPowers: Partial<Record<UpgradeId, boolean>>;
  coinsCollected: number;
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
  specialCooldown: number;
  smashPulse: number;
  rapidBuff: number;
  doubleShotBuff: number;
  pierceBuff: number;
  stasisBuff: number;
  resonanceBuff: number;
  spectrum: SpectrumStore;
  spectrumCapacity: number;
  perfectAbsorbs: number;
  perfectChain: number;
  lastPerfectTime: number;
  refractionKills: number;
  refractionsFired: number;
  spectrumCombos: number;
  prismBreakTime: number;
  prismBreaks: number;
  prismBreakKills: number;
  lastSpectrum: SpectrumId | null;
  spectrumStreak: number;
  lastRefractionName: string;
  delayedRefractions: DelayedRefraction[];
  microObjective: MicroObjectiveKind;
  microProgress: number;
  microTarget: number;
  microComplete: boolean;
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
  blast: boolean;
  refract: boolean;
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
  rarity?: UpgradeRarity;
}

interface UiState {
  mode: Mode;
  score: number;
  combo: number;
  health: number;
  maxHealth: number;
  coinsCollected: number;
  shield: number;
  charge: number;
  dash: number;
  smash: number;
  rapidBuff: number;
  doubleShotBuff: number;
  pierceBuff: number;
  stasisBuff: number;
  resonanceBuff: number;
  allyCount: number;
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
  spectrum: SpectrumStore;
  spectrumTotal: number;
  spectrumCapacity: number;
  refractionName: string;
  prismStability: ReturnType<typeof prismStability>;
  prismBreakTime: number;
  perfectAbsorbs: number;
  refractionKills: number;
  bossSpectrum: SpectrumId | null;
  bossWeakPoint: number;
  microObjective: MicroObjectiveKind;
  microProgress: number;
  microTarget: number;
  microComplete: boolean;
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
  focus: { name: "FOCUS LENS", tag: "PRECISION", description: "Every shot deals 14% more damage.", glyph: "◉", max: 4 },
  overclock: { name: "OVERDRIVE COIL", tag: "FIRE RATE", description: "Fires 12% faster per tier.", glyph: "≋", max: 3 },
  lance: { name: "PRISM LANCE", tag: "SPECIAL", description: "Unlocks a devastating piercing shot with a 5 second cooldown.", glyph: "⚡", max: 1 },
  echo: { name: "ECHO REFRACTION", tag: "PRISMATIC", description: "Every spectrum refraction repeats after a short delay at 58% power.", glyph: "↯", max: 1, rarity: "PRISMATIC" },
  spectrumLock: { name: "SPECTRUM LOCK", tag: "RESONANCE", description: "Absorb the same color three times to store one bonus unit.", glyph: "◎", max: 1, rarity: "RARE" },
  horizon: { name: "EVENT HORIZON", tag: "PERFECT ABSORB", description: "Perfect Absorb captures up to two nearby absorbable projectiles.", glyph: "◉", max: 1, rarity: "ANOMALOUS" },
  shatterpoint: { name: "SHATTERPOINT", tag: "PRISM BREAK", description: "Kills during PRISM BREAK release four damaging spectrum fragments.", glyph: "✦", max: 1, rarity: "PRISMATIC" },
};

const HEBREW_UPGRADES: Record<UpgradeId, Pick<UpgradeInfo, "name" | "tag" | "description">> = {
  split: { name: "קרן מפוצלת", tag: "התקפה", description: "מוסיף שתי יריות צד." },
  rapid: { name: "ירי מהיר", tag: "קצב ירי", description: "יורה מהר יותר ב־18%." },
  heavy: { name: "אור כבד", tag: "נזק", description: "היריות חזקות יותר ב־28%." },
  chain: { name: "שרשרת ברק", tag: "חשמל", description: "חיסול פוגע גם במטרה קרובה." },
  magnet: { name: "ליבה מגנטית", tag: "איסוף", description: "מושכת רסיסים מטווח גדול." },
  wake: { name: "שובל דאש", tag: "תנועה", description: "השובל שלך חותך אויבים." },
  phase: { name: "סוללת פאזה", tag: "טעינה", description: "הדאש נטען מהר יותר ב־18%." },
  guard: { name: "מגן פריזמה", tag: "הגנה", description: "נובה נותנת מגן זמני." },
  glass: { name: "ספקטרום זכוכית", tag: "סיכון / תגמול", description: "+55% נזק, אבל פחות חיים מרביים." },
  second: { name: "אור שני", tag: "הצלה", description: "שורד פגיעה קטלנית אחת בכל ריצה." },
  focus: { name: "עדשת מיקוד", tag: "דיוק", description: "כל ירייה גורמת 14% יותר נזק." },
  overclock: { name: "סליל טורבו", tag: "קצב ירי", description: "יורה מהר יותר ב־12% לכל דרגה." },
  lance: { name: "רומח פריזמה", tag: "כוח מיוחד", description: "פותח ירייה חודרת ועוצמתית עם זמן קירור של 5 שניות." },
  echo: { name: "הד שבירה", tag: "פריזמטי", description: "כל שבירת ספקטרום חוזרת לאחר השהיה קצרה בעוצמה מופחתת." },
  spectrumLock: { name: "נעילת ספקטרום", tag: "תהודה", description: "ספיגת אותו צבע שלוש פעמים מוסיפה יחידת אנרגיה נוספת." },
  horizon: { name: "אופק אירועים", tag: "ספיגה מושלמת", description: "ספיגה מושלמת לוכדת עד שני קליעים סמוכים שניתנים לספיגה." },
  shatterpoint: { name: "נקודת שבר", tag: "שבירת פריזמה", description: "חיסולים בזמן שבירת פריזמה משחררים ארבעה רסיסי ספקטרום." },
};

const HEBREW_STAGES = [
  ["כיול", "למד את האור", "תא אימונים מוגן מלמד תנועה, ספיגה ושחרור נובה."],
  ["מגע ראשון", "שמור על ההיקף", "שרוד את הפלישה הראשונה."],
  ["אש צולבת", "שבור את המבנה", "השמד את המבנה לפני שהזמן נגמר."],
  ["שבר", "היזון מהסערה", "ספוג אנרגיה כדי לשבור את הרשת."],
  ["מצור", "צוד אליטות", "חסל את יחידות העלית."],
  ["המפתח", "סיים את הפרוטוקול", "שבור את המפתח וסיים את הפרוטוקול."],
] as const;

function tr(language: Language, english: string, hebrew: string) { return language === "he" ? hebrew : english; }
function modifierCopy(id: ThreatModifierId, language: Language) {
  if (language === "en") return id.replaceAll("_", " ").toUpperCase();
  const labels: Record<ThreatModifierId, string> = {
    double_fire: "ירי כפול",
    elite_swarm: "נחיל אליטות",
    fast_projectiles: "קליעים מהירים",
    nova_drain: "דליפת נובה",
    dash_cooldown: "קירור דאש ארוך",
    high_density: "צפיפות גבוהה",
    aggressive_enemies: "אויבים תוקפניים",
    low_integrity: "חיים מופחתים",
    rapid_spawn: "הופעה מהירה",
  };
  return labels[id];
}
function primeBonusCopy(id: PrimeBonusId, language: Language) {
  const labels: Record<PrimeBonusId, [string, string]> = {
    twin_array: ["FULL-RUN TWIN BEAM", "ירי כפול לכל השלב"],
    rapid_array: ["FULL-RUN RAPID FIRE", "ירי מהיר לכל השלב"],
    drop_surge: ["BONUS DROP SURGE", "גשם דרופי בונוס"],
    resonance_field: ["BOOSTED ABSORPTION", "ספיגה מוגברת"],
    aegis_start: ["DOUBLE STARTING SHIELD", "מגן כפול בהתחלה"],
  };
  return labels[id][language === "he" ? 1 : 0];
}
function primeObjectiveCopy(mission: PrimeMissionDefinition, language: Language) {
  if (mission.objective === "survive") return language === "he" ? `שרוד ${mission.target} שניות` : `SURVIVE ${mission.target} SECONDS`;
  if (mission.objective === "kills") return language === "he" ? `חסל ${mission.target} מטרות` : `DESTROY ${mission.target} TARGETS`;
  return language === "he" ? `ספוג ${mission.target} קליעים` : `ABSORB ${mission.target} PROJECTILES`;
}
function achievementMetricCopy(metric: AchievementDefinition["metric"], language: Language) {
  if (language === "en") return metric.toUpperCase();
  return ({ campaign: "מערכה", kills: "חיסולים", elites: "אליטות", absorbed: "ספיגה", perfect: "ספיגה מושלמת", refraction: "שבירה", combo: "קומבו", noHit: "ללא פגיעה", shards: "שברים", prime: "פריים", threat: "איום" } as const)[metric];
}
function upgradeCopy(id: UpgradeId, language: Language) { return language === "he" ? { ...UPGRADES[id], ...HEBREW_UPGRADES[id] } : UPGRADES[id]; }
function spectrumCopy(id: SpectrumId, language: Language) {
  if (language === "en") return SPECTRUM_INFO[id];
  const localized: Record<SpectrumId, { name: string; behavior: string }> = {
    cyan: { name: "תכלת // חדירה", behavior: "חותך דרך מטרות ומבני קליעים עוינים." },
    violet: { name: "סגול // פיצול", behavior: "מתפצל למניפה רחבה של קליעים מוחזרים." },
    gold: { name: "זהב // שרשרת", behavior: "קופץ בין מטרות קרובות." },
    crimson: { name: "ארגמן // פיצוץ", behavior: "מתפוצץ במכת הדף חזקה." },
  };
  return { ...SPECTRUM_INFO[id], ...localized[id] };
}
function difficultyName(id: Difficulty, language: Language) {
  return language === "he" ? ({ cadet: "צוער", standard: "רגיל", overdrive: "טורבו" } as const)[id] : DIFFICULTIES[id].name;
}
function stageCopy(stage: StageDefinition, language: Language) {
  if (language === "en") return stage;
  const localized = HEBREW_STAGES[stage.id];
  if (localized) {
    const [name, subtitle, briefing] = localized;
    return { ...stage, name, subtitle, briefing };
  }
  const world = campaignWorldForStage(stage.id);
  const objective = stage.objective === "boss" ? "שבור את ליבת העולם" : stage.objective === "elites" ? `חסל ${stage.target} אליטות` : stage.objective === "absorb" ? `ספוג ${stage.target} יריות` : stage.objective === "kills" ? `חסל ${stage.target} אויבים` : `שרוד ${stage.target} שניות`;
  return { ...stage, name: `שלב ${stage.code}`, subtitle: world.hebrewName, briefing: `${objective}. למד את דפוסי האויבים החדשים והתקדם לעבר הליבה הבאה.` };
}
function runtimeCopy(value: string, language: Language) {
  if (language === "en") return value;
  const copy: Record<string, string> = {
    "CALIBRATION COMPLETE": "הכיול הושלם", "MISSION OBJECTIVE COMPLETE": "מטרת המשימה הושלמה", "THE RIFT COLLAPSED": "הקרע קרס",
    "THE APERTURE IS SHATTERED": "המפתח נשבר", "PRISM INTEGRITY LOST": "שלמות הפריזמה אבדה",
    "SURVIVE THE SEQUENCE": "שרוד את הרצף", "DESTROY HOSTILES": "השמד אויבים", "ABSORB ENEMY FIRE": "ספוג אש אויב", "ELIMINATE ELITES": "חסל אליטות", "BREAK THE APERTURE": "שבור את המפתח",
    "CORE READY — PRESS E TO AUTHORIZE PRISM NOVA": "הליבה מוכנה — לחץ E כדי לאשר נובה", "CALIBRATION COMPLETE — HOLD THE ARENA": "הכיול הושלם — שמור על הזירה",
    "THREAT CONTAINED": "האיום נבלם", "PRIME OBJECTIVE COMPLETE": "משימת פריים הושלמה",
  };
  return copy[value] ?? value;
}

const ENEMY_COLOR: Record<EnemyKind, string> = {
  needle: "#ff4f7b",
  halo: "#46e6ff",
  splitter: "#e56bff",
  lancer: "#ffd85a",
  bulwark: "#ff8f52",
  skimmer: "#ff776b",
  weaver: "#7dff9f",
  warden: "#c89bff",
  siphon: "#6ef1d2",
  phantom: "#ff6fd8",
  oracle: "#ffcf70",
  boss: "#ad7bff",
};

const MAX_HOSTILE_ELITES = 2;
const ELITE_PROFILES: Record<EliteTier, {
  healthMultiplier: number;
  sizeMultiplier: number;
  needleSpeed: number;
  bulwarkShots: number;
  bulwarkProjectileSpeed: number;
  bulwarkProjectileRadius: number;
  bulwarkFireDelay: number;
}> = {
  minor: {
    healthMultiplier: 1.25, sizeMultiplier: 1.05, needleSpeed: 178,
    bulwarkShots: 3, bulwarkProjectileSpeed: 205, bulwarkProjectileRadius: 6, bulwarkFireDelay: 2.3,
  },
  major: {
    healthMultiplier: 1.8, sizeMultiplier: 1.24, needleSpeed: 205,
    bulwarkShots: 5, bulwarkProjectileSpeed: 230, bulwarkProjectileRadius: 7.2, bulwarkFireDelay: 2.05,
  },
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

const CORE_CAMPAIGN_STAGES: StageDefinition[] = [
  {
    id: 0, code: "00", name: "CALIBRATION", subtitle: "Learn the light",
    briefing: "A protected playable chamber teaches movement, Perfect Absorb, spectrum storage, Refraction and Prism Break through action.",
    duration: 60, bossTime: null, roster: ["needle", "halo", "splitter", "lancer"], objective: "survive", target: 60,
    eliteChance: 0, scoreTargets: [4200, 9000, 16000], maxHostiles: 8,
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
    briefing: "Lancers weaponize the grid. Survive the storm and use phase absorption as a powerful bonus, not a hard requirement.",
    duration: 88, bossTime: null, roster: ["needle", "halo", "splitter", "lancer"], objective: "survive", target: 88,
    eliteChance: 0.05, scoreTargets: [19000, 36000, 61000],
  },
  {
    id: 4, code: "04", name: "SIEGE", subtitle: "Hunt the elites",
    briefing: "Minor elite signatures breach in pairs. Eliminate six of them to collapse the siege lattice.",
    duration: 88, bossTime: null, roster: ["needle", "halo", "splitter", "lancer", "bulwark"], objective: "elites", target: 6,
    eliteChance: 0.16, scoreTargets: [45000, 78000, 118000], maxHostiles: 14, maxActiveElites: 2, eliteTierCap: "minor",
  },
  {
    id: 5, code: "05", name: "THE APERTURE", subtitle: "End the protocol",
    briefing: "The architect enters the arena. Survive its rings, reach the core, and break the Aperture.",
    duration: 120, bossTime: 76, roster: ["needle", "halo", "splitter", "lancer", "bulwark"], objective: "boss", target: 1,
    eliteChance: 0.16, scoreTargets: [72000, 125000, 190000],
  },
];

interface CampaignWorldDefinition {
  id: 1 | 2 | 3 | 4;
  start: number;
  end: number;
  name: string;
  hebrewName: string;
  subtitle: string;
}

interface WorldCoreUpgradeDefinition {
  id: WorldUpgradeId;
  world: 1 | 2 | 3 | 4;
  glyph: string;
  en: { name: string; description: string };
  he: { name: string; description: string };
}

const CAMPAIGN_WORLDS: CampaignWorldDefinition[] = [
  { id: 1, start: 0, end: 10, name: "ORIGIN GRID", hebrewName: "רשת המקור", subtitle: "VERY EASY // LEARN AND ADVANCE" },
  { id: 2, start: 11, end: 25, name: "CHROMA FRONTIER", hebrewName: "חזית הכרומה", subtitle: "MEDIUM // ADAPT TO NEW SIGNALS" },
  { id: 3, start: 26, end: 50, name: "VOID ENGINE", hebrewName: "מנוע הריק", subtitle: "HARDENING // BREAK THE FORMATIONS" },
  { id: 4, start: 51, end: 100, name: "ETERNAL APERTURE", hebrewName: "המפתח הנצחי", subtitle: "HARD // MASTER THE PROTOCOL" },
];

const WORLD_CORE_UPGRADES: Record<1 | 2 | 3 | 4, WorldCoreUpgradeDefinition> = {
  1: { id: "origin_guard", world: 1, glyph: "⬡", en: { name: "ORIGIN GUARD", description: "Start every run with one Prism Shield charge." }, he: { name: "מגן המקור", description: "כל ריצה מתחילה עם טעינת מגן פריזמה אחת." } },
  2: { id: "chroma_array", world: 2, glyph: "✦", en: { name: "CHROMA ARRAY", description: "All normal ship fire deals 12% more damage." }, he: { name: "מערך כרומה", description: "כל הירי הרגיל של החללית חזק ב־12%." } },
  3: { id: "void_drive", world: 3, glyph: "⟫", en: { name: "VOID DRIVE", description: "Dash recharges 14% faster in every mode." }, he: { name: "מנוע ריק", description: "הדאש נטען ב־14% מהר יותר בכל מצב." } },
  4: { id: "eternal_resonance", world: 4, glyph: "∞", en: { name: "ETERNAL RESONANCE", description: "Absorbed fire grants 20% more Nova charge." }, he: { name: "תהודה נצחית", description: "ספיגת ירי נותנת 20% יותר טעינת נובה." } },
};

const WORLD_ROSTERS: Record<1 | 2 | 3 | 4, EnemyKind[]> = {
  1: ["needle", "halo", "splitter", "lancer", "bulwark"],
  2: ["skimmer", "weaver", "needle", "halo"],
  3: ["warden", "siphon", "splitter", "bulwark"],
  4: ["phantom", "oracle", "lancer", "weaver"],
};

const WORLD_BACKDROPS = {
  0: { core: "#0b1024", middle: "#060713", edge: "#020309", star: "180,226,255", ring: "93,117,219", grid: "67,211,255", accent: "117,85,255", border: "105,240,255" },
  1: { core: "#0b1830", middle: "#060b1a", edge: "#020309", star: "156,236,255", ring: "76,158,240", grid: "67,211,255", accent: "95,119,255", border: "105,240,255" },
  2: { core: "#201038", middle: "#10081e", edge: "#05020b", star: "255,134,219", ring: "233,86,205", grid: "101,232,201", accent: "245,91,202", border: "162,247,214" },
  3: { core: "#160f2a", middle: "#080614", edge: "#010106", star: "193,158,255", ring: "143,95,247", grid: "129,103,255", accent: "85,226,205", border: "192,157,255" },
  4: { core: "#291420", middle: "#130914", edge: "#050207", star: "255,218,137", ring: "255,110,190", grid: "255,187,101", accent: "237,89,201", border: "255,219,126" },
} as const;

function visualWorldId(game: Game) {
  return game.config.runMode === "campaign" ? campaignWorldForStage(game.config.stageId).id : 0;
}

function campaignWorldForStage(stageId: number) {
  return CAMPAIGN_WORLDS.find((world) => stageId >= world.start && stageId <= world.end) ?? CAMPAIGN_WORLDS[0];
}

const GENERATED_STAGE_NAMES = [
  "AFTERGLOW", "MIRRORLINE", "RESONANCE", "GATEKEEPER", "ORIGIN BREAKER",
  "RED VECTOR", "CHROMA WAKE", "TWIN HORIZON", "SIGNAL MAZE", "PRISM FORGE",
  "VOID CURRENT", "DARK REFRACTION", "GRAVITY KNOT", "SHATTERFIELD", "NIGHT ENGINE",
  "PHANTOM ARRAY", "CROWN OF STATIC", "NULL CASCADE", "LAST SPECTRUM", "ETERNAL BREAK",
] as const;

function generatedCampaignStage(id: number): StageDefinition {
  const world = campaignWorldForStage(id);
  const worldProgress = (id - world.start) / Math.max(1, world.end - world.start);
  const isWorldBoss = id === world.end;
  const roster: EnemyKind[] = [...WORLD_ROSTERS[world.id]];
  const objective: ObjectiveKind = isWorldBoss
    ? "boss"
    : id <= 10
      ? id % 3 === 0 ? "kills" : "survive"
      : id % 5 === 0 ? "elites" : id % 4 === 0 ? "absorb" : id % 3 === 0 ? "kills" : "survive";
  const duration = Math.round(54 + world.id * 10 + worldProgress * 22);
  const target = objective === "boss"
    ? 1
    : objective === "elites"
      ? Math.min(10, 4 + world.id)
      : objective === "absorb"
        ? 16 + world.id * 7 + Math.floor(worldProgress * 12)
        : objective === "kills"
          ? id <= 10 ? 20 + id * 2 : 28 + world.id * 9 + Math.floor(worldProgress * 15)
          : duration;
  const mastery = Math.round(8500 + id * 2400 + Math.pow(id, 1.18) * 380);
  const modifiers = id >= 26 ? selectThreatModifiers(id) : [];
  const titleIndex = (id * 7 + world.id * 3) % GENERATED_STAGE_NAMES.length;
  return {
    id,
    code: String(id).padStart(2, "0"),
    name: isWorldBoss ? `${world.name} CORE` : GENERATED_STAGE_NAMES[titleIndex],
    subtitle: isWorldBoss ? `Break World ${world.id}` : `${world.name} // Sector ${String(id - world.start + 1).padStart(2, "0")}`,
    briefing: isWorldBoss
      ? `The ${world.name.toLowerCase()} core is exposed. Survive its final pattern and break the world signal.`
      : `Advance through ${world.name.toLowerCase()}, read the new formations, and complete the marked objective.`,
    duration,
    bossTime: isWorldBoss ? Math.round(duration * 0.62) : null,
    roster,
    objective,
    target,
    eliteChance: id <= 10 ? 0.06 : id <= 25 ? 0.09 : id <= 50 ? 0.12 : 0.15,
    scoreTargets: [Math.round(mastery * 0.62), mastery, Math.round(mastery * 1.5)],
    world: world.id,
    modifiers,
    maxHostiles: id <= 10 ? 18 : id <= 25 ? 24 : id <= 50 ? 30 : 36,
    maxActiveElites: MAX_HOSTILE_ELITES,
    eliteTierCap: id <= 10 ? "minor" : "major",
  };
}

const CAMPAIGN_STAGES: StageDefinition[] = Array.from({ length: 101 }, (_, id) => {
  const existing = CORE_CAMPAIGN_STAGES[id];
  if (existing) {
    return {
      ...existing,
      world: 1,
      modifiers: [],
      maxHostiles: existing.maxHostiles ?? (id <= 1 ? 12 : 18),
      maxActiveElites: existing.maxActiveElites ?? MAX_HOSTILE_ELITES,
      eliteTierCap: existing.eliteTierCap ?? "minor",
    };
  }
  return generatedCampaignStage(id);
});

const DEFAULT_PROFILE: PlayerProfile = {
  saveVersion: PROGRESSION_BALANCE.saveVersion,
  unlockedStage: 0,
  overdriveUnlocked: false,
  stars: {},
  bestScores: {},
  prismShards: 0,
  healthBonus: 0,
  unlockedPrimeIds: [],
  primeBestTimes: {},
  highestThreat: 0,
  threatBestScore: 0,
  threatBestClearTime: null,
  highestThreatAvailable: PROGRESSION_BALANCE.threat.initialMax,
  rank: 1,
  rankXp: 0,
  totalRuns: 0,
  successfulRuns: 0,
  worldCoreUpgrades: [],
  achievements: migrateAchievementSave(null),
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
  const baseScaling = threatScaling(1, []);
  if (runMode === "campaign") {
    const stage = CAMPAIGN_STAGES[clamp(Math.round(stageId), 0, CAMPAIGN_STAGES.length - 1)];
    const stageScaling = threatScaling(Math.max(1, stage.id), stage.modifiers ?? []);
    return {
      runMode, stageId: stage.id, difficulty, duration: stage.duration, bossTime: stage.bossTime,
      roster: stage.roster, objective: stage.objective, objectiveTarget: stage.target,
      eliteChance: stage.eliteChance, label: `STAGE ${stage.code} // ${stage.name}`, dailyKey: null,
      primeId: null, primeBonuses: [], threatLevel: 0, modifiers: stage.modifiers ?? [], scaling: stageScaling,
      maxHostiles: stage.maxHostiles ?? null, maxActiveElites: stage.maxActiveElites ?? MAX_HOSTILE_ELITES, eliteTierCap: stage.eliteTierCap ?? "major",
    };
  }
  if (runMode === "prime") {
    const mission = PRIME_MISSIONS[clamp(Math.round(stageId), 0, PRIME_MISSIONS.length - 1)];
    return {
      runMode, stageId: PRIME_MISSIONS.indexOf(mission), difficulty: mission.difficulty, duration: mission.duration, bossTime: null,
      roster: ["needle", "halo", "splitter", "lancer", "bulwark"], objective: mission.objective, objectiveTarget: mission.target,
      eliteChance: mission.scaling.eliteChance, label: `${mission.code} // ${mission.name}`, dailyKey: null,
      primeId: mission.id, primeBonuses: mission.bonuses, threatLevel: 0, modifiers: mission.modifiers, scaling: mission.scaling,
      maxHostiles: mission.maxHostiles, maxActiveElites: mission.maxActiveElites, eliteTierCap: "minor",
    };
  }
  if (runMode === "threat") {
    const level = Math.max(1, Math.round(stageId));
    const modifiers = selectThreatModifiers(level);
    return {
      runMode, stageId: level, difficulty: "standard", duration: PROGRESSION_BALANCE.threat.duration, bossTime: null,
      roster: ["needle", "halo", "splitter", "lancer", "bulwark"], objective: "survive", objectiveTarget: PROGRESSION_BALANCE.threat.duration,
      eliteChance: threatScaling(level, modifiers).eliteChance, label: `THREAT LEVEL ${level}`, dailyKey: null,
      primeId: null, primeBonuses: [], threatLevel: level, modifiers, scaling: threatScaling(level, modifiers),
      maxHostiles: null, maxActiveElites: MAX_HOSTILE_ELITES, eliteTierCap: "major",
    };
  }
  if (runMode === "daily") {
    return {
      runMode, stageId: -1, difficulty: "standard", duration: 135, bossTime: 96,
      roster: ["needle", "halo", "splitter", "lancer", "bulwark"], objective: "boss", objectiveTarget: 1,
      eliteChance: 0.13, label: "DAILY RIFT // GLOBAL SEED", dailyKey: dailyKey ?? currentDailyKey(),
      primeId: null, primeBonuses: [], threatLevel: 0, modifiers: [], scaling: baseScaling,
      maxHostiles: null, maxActiveElites: MAX_HOSTILE_ELITES, eliteTierCap: "major",
    };
  }
  return {
    runMode, stageId: -1, difficulty, duration: RUN_TIME, bossTime: BOSS_TIME,
    roster: ["needle", "halo", "splitter", "lancer", "bulwark"], objective: "boss", objectiveTarget: 1,
    eliteChance: 0.1, label: "ARCADE RIFT // SCORE ATTACK", dailyKey: null,
    primeId: null, primeBonuses: [], threatLevel: 0, modifiers: [], scaling: baseScaling,
    maxHostiles: null, maxActiveElites: MAX_HOSTILE_ELITES, eliteTierCap: "major",
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
  mode: "menu", score: 0, combo: 1, health: 3, maxHealth: 3, coinsCollected: 0, shield: 0,
  charge: 0, dash: 1, smash: 1, rapidBuff: 0, doubleShotBuff: 0, pierceBuff: 0, stasisBuff: 0, resonanceBuff: 0, allyCount: 0,
  level: 1, xp: 0, nextXp: 12, timeLeft: RUN_TIME,
  wave: "CALIBRATION", bossHealth: 0, bossMaxHealth: 0, choices: [], upgrades: {}, kills: 0,
  eliteKills: 0, absorbed: 0, hitsTaken: 0, novasUsed: 0, bestCombo: 1, reason: "",
  runMode: "campaign", stageId: 0, difficulty: "cadet", objectiveLabel: "SURVIVE CALIBRATION",
  objectiveProgress: 0, objectiveTarget: CAMPAIGN_STAGES[0].target, guide: "",
  spectrum: emptySpectrumStore(), spectrumTotal: 0, spectrumCapacity: PRISM_ENGINE.capacity,
  refractionName: "ABSORB A SPECTRUM", prismStability: "stable", prismBreakTime: 0,
  perfectAbsorbs: 0, refractionKills: 0, bossSpectrum: null, bossWeakPoint: 0,
  microObjective: "refraction", microProgress: 0, microTarget: 1, microComplete: false,
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
    usingTouch: false, dash: false, nova: false, smash: false, blast: false, refract: false, bindings, stickId: null, aimId: null,
    stickOriginX: 0, stickOriginY: 0, stickWorldX: 0, stickWorldY: 0, stickX: 0, stickY: 0,
  };
}

function microObjectiveFor(config: RunConfig): { kind: MicroObjectiveKind; target: number } {
  if (config.runMode === "campaign" && config.stageId === 0) return { kind: "refraction", target: 1 };
  const index = Math.abs(config.stageId + config.threatLevel + (config.primeId?.length ?? 0)) % 4;
  return [
    { kind: "perfect" as const, target: 3 },
    { kind: "refraction" as const, target: 5 },
    { kind: "combo" as const, target: 3 },
    { kind: "full-spectrum" as const, target: 1 },
  ][index];
}

function createGame(seed: number, mode: Mode = "menu", config: RunConfig = makeRunConfig("campaign", 0, "cadet")): Game {
  const difficulty = DIFFICULTIES[config.difficulty];
  const microObjective = microObjectiveFor(config);
  const primeBuffDuration = config.runMode === "prime" ? config.duration + 5 : 0;
  return {
    mode,
    visualTime: 0,
    elapsed: 0,
    rng: seed || 0x9e3779b9,
    nextId: 1,
    player: {
      x: WORLD_W * 0.5, y: WORLD_H * 0.56, vx: 0, vy: 0, r: 14,
      health: difficulty.health, maxHealth: difficulty.health, invuln: 0, dashTime: 0, dashCooldown: 0,
      fireCooldown: 0, aim: 0, wakeClock: 0, shield: config.primeBonuses.includes("aegis_start") ? 2 : config.runMode === "campaign" && config.stageId <= 1 ? 1 : 0, secondUsed: false,
    },
    enemies: [], bullets: [], pickups: [], powerDrops: [], particles: [], texts: [],
    score: 0, combo: 1, comboTimer: 0, charge: config.runMode === "campaign" && config.stageId === 0 ? 82 : config.runMode === "campaign" && config.stageId === 1 ? 28 : 0, level: 1, xp: 0, nextXp: 12,
    spawnTimer: 0.7, bossSpawned: false, bossDefeated: false, upgradeChoices: [], upgrades: {}, worldCoreUpgrades: [], unlockedPowers: {}, coinsCollected: 0,
    kills: 0, eliteKills: 0, absorbed: 0, hitsTaken: 0, novasUsed: 0, bestCombo: 1,
    shake: 0, flash: 0, nova: 0, smashCooldown: 0, specialCooldown: 0, smashPulse: 0,
    rapidBuff: config.primeBonuses.includes("rapid_array") ? primeBuffDuration : 0,
    doubleShotBuff: config.primeBonuses.includes("twin_array") ? primeBuffDuration : 0,
    pierceBuff: 0, stasisBuff: 0,
    resonanceBuff: config.primeBonuses.includes("resonance_field") ? primeBuffDuration : 0,
    spectrum: emptySpectrumStore(), spectrumCapacity: PRISM_ENGINE.capacity,
    perfectAbsorbs: 0, perfectChain: 0, lastPerfectTime: -99, refractionKills: 0, refractionsFired: 0,
    spectrumCombos: 0, prismBreakTime: 0, prismBreaks: 0, prismBreakKills: 0,
    lastSpectrum: null, spectrumStreak: 0, lastRefractionName: "ABSORB A SPECTRUM", delayedRefractions: [], hitStop: 0,
    microObjective: microObjective.kind, microProgress: 0, microTarget: microObjective.target, microComplete: false,
    events: [], uiClock: 0, reason: "", reducedMotion: false, config,
    runId: `menu-${seed.toString(36)}`,
  };
}

function waveLabel(game: Game) {
  if (game.config.runMode === "campaign" || game.config.runMode === "prime" || game.config.runMode === "threat") return game.config.label;
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
  if (game.elapsed < 5) return "MOVE WITH THE MOUSE OR THE LEFT TOUCH FIELD";
  if (game.elapsed < 10) return "YOUR PRISM AUTO-FIRES AT THE NEAREST THREAT";
  if (game.absorbed < 1) return "SPACE // DASH THROUGH A COLORED BULLET TO ABSORB IT";
  if (game.refractionsFired < 1) return "LEFT CLICK OR Q // REFRACT THE STORED COLOR";
  if (game.perfectAbsorbs < 1) return "DASH JUST BEFORE IMPACT // PERFECT ABSORB";
  if (game.spectrumCombos < 1) return "COLLECT TWO COLORS // CREATE A REFRACTION COMBO";
  if (game.prismBreaks < 1) return "FILL THE SPECTRUM // REFRACT TO TRIGGER PRISM BREAK";
  return "CALIBRATION COMPLETE // ABSORB • REFRACT • ASCEND";
}

function microObjectiveLabel(kind: MicroObjectiveKind, language: Language) {
  const english: Record<MicroObjectiveKind, string> = { perfect: "PERFECT ABSORBS", refraction: "REFRACTIONS", combo: "SPECTRUM COMBOS", "full-spectrum": "FULL SPECTRUM" };
  const hebrew: Record<MicroObjectiveKind, string> = { perfect: "ספיגות מושלמות", refraction: "שבירות", combo: "שילובי ספקטרום", "full-spectrum": "ספקטרום מלא" };
  return (language === "he" ? hebrew : english)[kind];
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

function hostileEliteCount(game: Game) {
  return game.enemies.reduce((count, enemy) => count + (enemy.elite && !enemy.ally && !enemy.dead ? 1 : 0), 0);
}

function selectEliteTier(game: Game): EliteTier {
  if (game.config.eliteTierCap === "minor") return "minor";
  const campaignStage = game.config.runMode === "campaign" ? game.config.stageId : game.config.runMode === "threat" ? game.config.threatLevel : Math.round(game.elapsed);
  if (campaignStage <= 25) return "minor";
  const majorChance = clamp((campaignStage - 25) / 115, 0.08, 0.65);
  return rand(game) < majorChance ? "major" : "minor";
}

const ENEMY_VISUAL_KIND_ORDER: Exclude<EnemyKind, "boss">[] = [
  "needle", "halo", "splitter", "lancer", "bulwark", "skimmer",
  "weaver", "warden", "siphon", "phantom", "oracle",
];

function enemyVisualIndex(game: Game, kind: EnemyKind, eliteTier: EliteTier | null) {
  if (kind === "boss") return 29;
  const world = game.config.runMode === "campaign"
    ? campaignWorldForStage(game.config.stageId).id
    : game.config.runMode === "threat"
      ? ((Math.floor(Math.max(1, game.config.threatLevel) - 1) / 25) | 0) % 4 + 1
      : game.config.runMode === "prime"
        ? Math.min(4, game.config.stageId + 2)
        : Math.min(4, Math.floor(game.elapsed / 38) + 1);
  const base = ENEMY_VISUAL_KIND_ORDER.indexOf(kind);
  const eliteOffset = eliteTier === "major" ? 4 : eliteTier === "minor" ? 2 : 0;
  return (base + (world - 1) * 6 + eliteOffset) % 29;
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
    skimmer: { r: 16, hp: 7.5, fire: 1.55 },
    weaver: { r: 23, hp: 15, fire: 2.1 },
    warden: { r: 27, hp: 21, fire: 2.2 },
    siphon: { r: 22, hp: 18, fire: 2.3 },
    phantom: { r: 18, hp: 13, fire: 2.4 },
    oracle: { r: 30, hp: 25, fire: 2.6 },
    boss: { r: 74, hp: 520, fire: 1.15 },
  };
  const stat = stats[kind];
  const eliteAllowed = elite && kind !== "boss" && kind !== "warden" && kind !== "siphon" && kind !== "phantom" && kind !== "oracle" && hostileEliteCount(game) < game.config.maxActiveElites;
  const eliteTier = eliteAllowed ? selectEliteTier(game) : null;
  const eliteProfile = eliteTier ? ELITE_PROFILES[eliteTier] : null;
  const trainingTarget = game.config.runMode === "campaign" && game.config.stageId === 0 && kind === "halo";
  const firstMissionTarget = game.config.runMode === "campaign" && game.config.stageId === 1;
  const hp = stat.hp * (kind === "boss" ? 1 : scale) * (eliteProfile?.healthMultiplier ?? 1) * DIFFICULTIES[game.config.difficulty].enemyHealth * game.config.scaling.enemyHealth * (trainingTarget ? 4.2 : firstMissionTarget ? 0.68 : 1);
  game.enemies.push({
    id: game.nextId++, kind, x: x ?? position.x, y: y ?? position.y,
    vx: 0, vy: 0, r: stat.r * (eliteProfile?.sizeMultiplier ?? 1), hp, maxHp: hp,
    fire: trainingTarget ? 0.58 + rand(game) * 0.18 : firstMissionTarget ? stat.fire + 0.75 + rand(game) * 0.5 : stat.fire + rand(game) * 0.55, age: 0, angle: rand(game) * TAU,
    hit: 0, elite: eliteTier !== null, eliteTier, phase: 0, phaseTimer: 0, ally: false, dead: false, processed: false,
    defeatedBy: null, shieldSpectrum: kind === "boss" ? "cyan" : null, weakPointTimer: 0,
    visualIndex: enemyVisualIndex(game, kind, eliteTier),
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
  const activeWardens = game.enemies.reduce((count, enemy) => count + (!enemy.dead && !enemy.ally && enemy.kind === "warden" ? 1 : 0), 0);
  const activeSiphons = game.enemies.reduce((count, enemy) => count + (!enemy.dead && !enemy.ally && enemy.kind === "siphon" ? 1 : 0), 0);
  const activePhantoms = game.enemies.reduce((count, enemy) => count + (!enemy.dead && !enemy.ally && enemy.kind === "phantom" ? 1 : 0), 0);
  const activeOracles = game.enemies.reduce((count, enemy) => count + (!enemy.dead && !enemy.ally && enemy.kind === "oracle" ? 1 : 0), 0);
  const roster = game.config.roster.filter((kind) => kind !== "boss" && (kind !== "warden" || activeWardens < 1) && (kind !== "siphon" || activeSiphons < 2) && (kind !== "phantom" || activePhantoms < 1) && (kind !== "oracle" || activeOracles < 1));
  if (roster.length === 0) return "needle";
  const progress = clamp(game.elapsed / Math.max(1, game.config.duration * 0.45), 0, 1);
  const unlockedCount = Math.max(1, Math.min(roster.length, 1 + Math.floor(progress * roster.length)));
  const pool = roster.slice(0, unlockedCount);
  const index = Math.min(pool.length - 1, Math.floor(Math.pow(rand(game), 0.82) * pool.length));
  return pool[index];
}

function addBullet(game: Game, x: number, y: number, angle: number, speed: number, enemy: boolean, damage: number, options?: Partial<Bullet>) {
  const hostileCount = game.bullets.reduce((count, bullet) => count + (bullet.enemy && !bullet.dead ? 1 : 0), 0);
  if (enemy && hostileCount >= 720) return;
  if (!enemy && game.bullets.length >= 1080) return;
  const vx = Math.cos(angle) * speed;
  const vy = Math.sin(angle) * speed;
  game.bullets.push({
    id: game.nextId++, x, y, px: x - vx * STEP, py: y - vy * STEP, vx, vy,
    r: enemy ? 6 : 4.2, damage, life: enemy ? 6 : 2.2, enemy,
    color: enemy ? "#ff568e" : "#77f7ff", dead: false, homing: 0, pierce: 0,
    hitEnemyIds: [], spectrum: null, absorbable: false, energyValue: 1, refraction: false,
    recipeId: null, chain: 0, burstRadius: 0, detonatesBullets: false,
    ...options,
  });
}

function nearestEnemy(game: Game, x: number, y: number, excludeId = -1) {
  let nearest: Enemy | null = null;
  let nearestDistance = Infinity;
  for (const enemy of game.enemies) {
    if (enemy.dead || enemy.ally || enemy.id === excludeId || enemy.age < 0.35) continue;
    const value = distanceSq(x, y, enemy.x, enemy.y);
    if (value < nearestDistance) {
      nearestDistance = value;
      nearest = enemy;
    }
  }
  return nearest;
}

function playerDamage(game: Game) {
  const worldBonus = game.worldCoreUpgrades.includes("chroma_array") ? 1.12 : 1;
  const breakBonus = game.prismBreakTime > 0 ? 1.35 : 1;
  return 2.45 * worldBonus * breakBonus * Math.pow(1.28, game.upgrades.heavy ?? 0) * Math.pow(1.14, game.upgrades.focus ?? 0) * (game.upgrades.glass ? 1.55 : 1);
}

function firePlayer(game: Game) {
  const player = game.player;
  const split = game.upgrades.split ?? 0;
  const damage = playerDamage(game);
  const doubleShot = game.doubleShotBuff > 0;
  const barrels = doubleShot ? [-7.5, 7.5] : [0];
  for (const barrel of barrels) {
    const originX = player.x + Math.cos(player.aim) * 18 + Math.cos(player.aim + Math.PI / 2) * barrel;
    const originY = player.y + Math.sin(player.aim) * 18 + Math.sin(player.aim + Math.PI / 2) * barrel;
    addBullet(game, originX, originY, player.aim, 790, false, damage,
      { r: 4.1 + (game.upgrades.heavy ?? 0) * 0.65, color: game.pierceBuff > 0 ? "#f2bdff" : doubleShot ? "#ffffff" : game.upgrades.glass ? "#ff9edb" : "#fff1a6", pierce: game.pierceBuff > 0 ? 2 : 0 });
  }
  if (split > 0) {
    const spread = split === 1 ? 0.16 : 0.22;
    addBullet(game, player.x, player.y, player.aim - spread, 760, false, damage * 0.72, { r: 3.7, color: "#b986ff" });
    addBullet(game, player.x, player.y, player.aim + spread, 760, false, damage * 0.72, { r: 3.7, color: "#ff7fcf" });
  }
  if (game.particles.length < 850) {
    const muzzleX = player.x + Math.cos(player.aim) * 22;
    const muzzleY = player.y + Math.sin(player.aim) * 22;
    const flashLife = 0.09;
    game.particles.push({ x: muzzleX, y: muzzleY, vx: Math.cos(player.aim) * 110, vy: Math.sin(player.aim) * 110, life: flashLife, maxLife: flashLife, size: 8.5, color: "#ffffff", drag: 8, ring: false });
    for (const side of [-1, 1]) {
      const sparkAngle = player.aim + side * 0.55;
      game.particles.push({ x: muzzleX, y: muzzleY, vx: Math.cos(sparkAngle) * 95, vy: Math.sin(sparkAngle) * 95, life: 0.13, maxLife: 0.13, size: 3.2, color: side < 0 ? "#67efff" : "#ff8ddd", drag: 6, ring: false });
    }
  }
  const boost = game.rapidBuff > 0 ? 0.52 : 1;
  player.fireCooldown = 0.145 * Math.pow(0.82, game.upgrades.rapid ?? 0) * Math.pow(0.88, game.upgrades.overclock ?? 0) * boost;
  event(game, "shoot");
}

function enemySpectrum(enemy: Enemy, shotIndex = 0): SpectrumId {
  const mapping: Record<EnemyKind, SpectrumId[]> = {
    needle: ["crimson"], halo: ["cyan"], splitter: ["violet"], lancer: ["gold"],
    bulwark: ["crimson", "gold"], skimmer: ["cyan", "crimson"], weaver: ["gold", "violet"],
    warden: ["violet"], siphon: ["cyan", "gold"], phantom: ["violet", "crimson"],
    oracle: ["gold", "cyan", "violet"], boss: ["cyan", "violet", "gold", "crimson"],
  };
  const spectra = mapping[enemy.kind];
  return spectra[Math.abs(shotIndex + enemy.id + Math.floor(enemy.age)) % spectra.length];
}

function spawnEnemyBullet(
  game: Game,
  enemy: Enemy,
  angle: number,
  speed: number,
  _color = ENEMY_COLOR[enemy.kind],
  r = 6,
  options?: { spectrum?: SpectrumId; absorbable?: boolean; energyValue?: number; homing?: number },
) {
  void _color;
  const projectileSpeed = speed * DIFFICULTIES[game.config.difficulty].bulletSpeed * game.config.scaling.projectileSpeed;
  const spectrum = options?.spectrum ?? enemySpectrum(enemy, Math.round(angle * 10));
  const absorbable = options?.absorbable ?? true;
  const color = absorbable ? SPECTRUM_INFO[spectrum].color : "#f4f6ff";
  addBullet(game, enemy.x + Math.cos(angle) * (enemy.r + 5), enemy.y + Math.sin(angle) * (enemy.r + 5), angle, projectileSpeed, true, 1, {
    color, r: r + (options?.energyValue && options.energyValue > 1 ? 1.5 : 0), spectrum: absorbable ? spectrum : null,
    absorbable, energyValue: Math.max(1, options?.energyValue ?? 1), homing: options?.homing ?? 0,
  });
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

function damageEnemy(
  game: Game,
  enemy: Enemy,
  amount: number,
  hitX = enemy.x,
  hitY = enemy.y,
  source: DamageSource = "normal",
  spectrum: SpectrumId | null = null,
) {
  if (enemy.dead || enemy.ally || enemy.age < 0.3) return;
  const guarded = enemy.kind !== "warden" && game.enemies.some((candidate) => !candidate.dead && !candidate.ally && candidate.kind === "warden" && distanceSq(candidate.x, candidate.y, enemy.x, enemy.y) <= 145 * 145);
  let multiplier = guarded ? 0.65 : 1;
  if (enemy.kind === "boss") {
    if (enemy.weakPointTimer > 0) multiplier *= 1.65;
    else if (source === "refraction" && spectrum === enemy.shieldSpectrum) {
      enemy.weakPointTimer = 4.2;
      multiplier *= 2.35;
      game.hitStop = game.reducedMotion ? 0 : 0.085;
      game.shake = Math.max(game.shake, 18);
      game.texts.push({ x: enemy.x, y: enemy.y - enemy.r - 25, text: "SPECTRUM MATCH // APERTURE OPEN", color: spectrum ? SPECTRUM_INFO[spectrum].color : "#ffffff", life: 1.35 });
      shockwave(game, enemy.x, enemy.y, spectrum ? SPECTRUM_INFO[spectrum].color : "#ffffff", 38);
    } else multiplier *= source === "refraction" ? 0.58 : 0.28;
  }
  enemy.hp -= amount * multiplier;
  enemy.hit = 0.11;
  burst(game, hitX, hitY, ENEMY_COLOR[enemy.kind], enemy.kind === "boss" ? 3 : 2, 80, 2.2);
  event(game, "hit");
  if (enemy.hp <= 0) {
    enemy.dead = true;
    enemy.defeatedBy = source;
  }
}

function damageAlly(game: Game, ally: Enemy, amount: number, hitX: number, hitY: number) {
  if (ally.dead || !ally.ally) return;
  ally.hp -= amount;
  ally.hit = 0.13;
  burst(game, hitX, hitY, "#9dffe4", 3, 95, 2.4);
  if (ally.hp > 0) return;
  ally.dead = true;
  ally.processed = true;
  game.texts.push({ x: ally.x, y: ally.y - ally.r, text: "ALLY SIGNAL LOST", color: "#9dffe4", life: 0.9 });
  burst(game, ally.x, ally.y, ENEMY_COLOR[ally.kind], 12, 190, 3.2);
  shockwave(game, ally.x, ally.y, "#9dffe4", ally.r * 0.55);
}

function addPickup(game: Game, x: number, y: number, value: number, kind: "shard" | "coin" = "shard") {
  const angle = rand(game) * TAU;
  const force = 35 + rand(game) * 85;
  game.pickups.push({ id: game.nextId++, x, y, vx: Math.cos(angle) * force, vy: Math.sin(angle) * force, value, kind, age: 0, dead: false });
}

function powerDropColor(drop: Pick<PowerDrop, "kind" | "allyKind">) {
  return drop.kind === "alliance" && drop.allyKind ? ENEMY_COLOR[drop.allyKind] : DROP_INFO[drop.kind].color;
}

function addPowerDrop(game: Game, x: number, y: number, kind: DropKind, allyKind: EnemyKind | null = null) {
  const angle = rand(game) * TAU;
  const force = 55 + rand(game) * 95;
  const drop = { id: game.nextId++, kind, allyKind, x, y, vx: Math.cos(angle) * force, vy: Math.sin(angle) * force, age: 0, dead: false };
  game.powerDrops.push(drop);
  const color = powerDropColor(drop);
  shockwave(game, x, y, color, 12);
  shockwave(game, x, y, "#ffffff", 6);
}

function collectPowerDrop(game: Game, drop: PowerDrop) {
  if (drop.dead) return;
  drop.dead = true;
  const player = game.player;
  const info = DROP_INFO[drop.kind];
  const color = powerDropColor(drop);
  let pickupText = info.name;
  if (drop.kind === "repair") {
    player.health = Math.min(player.maxHealth, player.health + 1);
    player.shield = Math.min(2, player.shield + 0.55);
  } else if (drop.kind === "overcharge") {
    game.charge = Math.min(100, game.charge + 48);
  } else if (drop.kind === "rapid") {
    game.rapidBuff = Math.max(game.rapidBuff, 11);
  } else if (drop.kind === "smashcell") {
    game.smashCooldown = Math.max(0, game.smashCooldown - 9);
  } else if (drop.kind === "cooldown") {
    game.smashCooldown = Math.max(0, game.smashCooldown - 10);
    game.specialCooldown = Math.max(0, game.specialCooldown - 10);
    player.dashCooldown = Math.max(0, player.dashCooldown - 10);
    pickupText = "COOLDOWN FRACTURE // -10s";
  } else if (drop.kind === "double") {
    game.doubleShotBuff = Math.max(game.doubleShotBuff, 14);
    pickupText = "TWIN BEAM // ONLINE";
  } else if (drop.kind === "aegis") {
    player.shield = Math.min(2, player.shield + 1);
    pickupText = "AEGIS PLATE // +1 SHIELD";
  } else if (drop.kind === "pierce") {
    game.pierceBuff = Math.max(game.pierceBuff, 12);
    pickupText = "PHASE NEEDLE // 12s";
  } else if (drop.kind === "stasis") {
    game.stasisBuff = Math.max(game.stasisBuff, 5);
    pickupText = "STASIS BLOOM // 5s";
  } else if (drop.kind === "resonance") {
    game.resonanceBuff = Math.max(game.resonanceBuff, 10);
    pickupText = "ABSORPTION COIL // 10s";
  } else if (drop.kind === "powercore") {
    const locked = (["focus", "overclock", "lance"] as UpgradeId[]).filter((id) => !game.unlockedPowers[id]);
    const unlock = locked.length > 0 ? locked[Math.floor(rand(game) * locked.length)] : null;
    if (unlock) {
      game.unlockedPowers[unlock] = true;
      pickupText = `${UPGRADES[unlock].name} // UNLOCKED`;
    } else {
      game.charge = Math.min(100, game.charge + 35);
      pickupText = "CORE SURPLUS // +35%";
    }
  } else if (drop.allyKind && drop.allyKind !== "boss") {
    let converted = 0;
    for (const enemy of game.enemies) {
      if (enemy.dead || enemy.ally || enemy.kind !== drop.allyKind) continue;
      enemy.ally = true;
      enemy.fire = 0.25;
      enemy.hp = Math.max(enemy.hp, enemy.maxHp * 0.65);
      enemy.vx *= 0.25;
      enemy.vy *= 0.25;
      converted += 1;
    }
    if (converted === 0) {
      spawnEnemy(game, drop.allyKind, drop.x, drop.y);
      const ally = game.enemies.at(-1);
      if (ally) {
        ally.ally = true;
        ally.fire = 0.25;
        ally.age = Math.max(ally.age, 0.8);
        converted = 1;
      }
    }
    pickupText = `${drop.allyKind.toUpperCase()} SQUAD // ALLIED ×${converted}`;
  }
  game.score += Math.round(180 * DIFFICULTIES[game.config.difficulty].scoreMultiplier);
  game.texts.push({ x: drop.x, y: drop.y - 22, text: pickupText, color, life: 1.35 });
  burst(game, drop.x, drop.y, color, 24, 260, 4.2);
  shockwave(game, drop.x, drop.y, color, 22);
  shockwave(game, drop.x, drop.y, "#ffffff", 12);
  event(game, "pickup");
}

function processEnemyDeath(game: Game, enemy: Enemy) {
  if (enemy.processed) return;
  enemy.processed = true;
  const base: Record<EnemyKind, number> = { needle: 100, halo: 240, splitter: 360, lancer: 420, bulwark: 650, skimmer: 310, weaver: 520, warden: 780, siphon: 720, phantom: 690, oracle: 920, boss: 12000 };
  const points = Math.round(base[enemy.kind] * game.combo * (enemy.elite ? 1.8 : 1) * (game.prismBreakTime > 0 ? 2 : 1) * DIFFICULTIES[game.config.difficulty].scoreMultiplier);
  game.score += points;
  game.kills += 1;
  if (enemy.defeatedBy === "refraction") {
    game.refractionKills += 1;
    game.score += Math.round(120 * game.combo * DIFFICULTIES[game.config.difficulty].scoreMultiplier);
    if (game.refractionKills <= 3 || game.refractionKills % 5 === 0) {
      game.texts.push({ x: enemy.x, y: enemy.y - enemy.r - 18, text: "REFRACTION KILL", color: "#9ffcff", life: 0.85 });
    }
  }
  if (game.prismBreakTime > 0) game.prismBreakKills += 1;
  if (enemy.elite) game.eliteKills += 1;
  game.combo = Math.min(8, game.combo + (enemy.kind === "boss" ? 1 : 0.25));
  game.comboTimer = 2.6;
  game.bestCombo = Math.max(game.bestCombo, game.combo);
  game.texts.push({ x: enemy.x, y: enemy.y - enemy.r, text: `+${points.toLocaleString()}`, color: ENEMY_COLOR[enemy.kind], life: 0.85 });
  burst(game, enemy.x, enemy.y, ENEMY_COLOR[enemy.kind], enemy.kind === "boss" ? 70 : 13 + Math.round(enemy.r * 0.2), enemy.kind === "boss" ? 350 : 210, enemy.kind === "boss" ? 6 : 3.4);
  shockwave(game, enemy.x, enemy.y, ENEMY_COLOR[enemy.kind], enemy.r * 0.6);
  if (enemy.elite || enemy.kind === "boss") {
    shockwave(game, enemy.x, enemy.y, "#ffffff", enemy.r * 0.25);
    shockwave(game, enemy.x, enemy.y, enemy.eliteTier === "major" ? "#ffd76c" : "#b47cff", enemy.r * 0.9);
  }
  game.shake = Math.max(game.shake, enemy.kind === "boss" ? 26 : enemy.elite ? 11 : 5);
  game.hitStop = game.reducedMotion ? 0 : enemy.kind === "boss" ? 0.12 : enemy.elite ? 0.055 : 0.025;
  event(game, "kill");

  if (game.prismBreakTime > 0 && (game.upgrades.shatterpoint ?? 0) > 0 && enemy.kind !== "boss") {
    for (let index = 0; index < 4; index += 1) {
      const spectrum = SPECTRUM_IDS[index];
      addBullet(game, enemy.x, enemy.y, index * TAU / 4 + enemy.id, 540, false, playerDamage(game) * 1.7, {
        color: SPECTRUM_INFO[spectrum].color, spectrum, refraction: true, recipeId: "shatterpoint", pierce: 1,
      });
    }
  }

  if (enemy.kind === "splitter") {
    for (let i = 0; i < 3; i += 1) spawnEnemy(game, "needle", enemy.x + Math.cos(i * TAU / 3) * 18, enemy.y + Math.sin(i * TAU / 3) * 18);
  }

  if (enemy.kind !== "boss") {
    const firstMission = game.config.runMode === "campaign" && game.config.stageId === 1;
    const primeDropSurge = game.config.primeBonuses.includes("drop_surge");
    const dropChance = primeDropSurge ? enemy.elite ? 0.72 : 0.38 : firstMission ? 0.32 : enemy.elite ? 0.38 : 0.12;
    if (rand(game) < dropChance) {
      const stage = game.config.runMode === "campaign" ? game.config.stageId : 100;
      const pool: DropKind[] = ["repair", "repair", "overcharge", "overcharge", "rapid", "rapid", "smashcell", "cooldown", "double", "alliance", "powercore"];
      if (stage >= 8) pool.push("aegis", "aegis");
      if (stage >= 11) pool.push("pierce", "pierce");
      if (stage >= 26) pool.push("stasis");
      if (stage >= 51) pool.push("resonance");
      const kind = pool[Math.floor(rand(game) * pool.length)];
      addPowerDrop(game, enemy.x, enemy.y, kind, kind === "alliance" ? enemy.kind : null);
    }
  }

  const shardCount = enemy.kind === "boss" ? 18 : enemy.kind === "bulwark" || enemy.kind === "warden" || enemy.kind === "oracle" ? 4 : enemy.kind === "siphon" || enemy.kind === "needle" ? 1 : 2;
  for (let i = 0; i < shardCount; i += 1) addPickup(game, enemy.x, enemy.y, enemy.kind === "boss" ? 3 : 1);
  const primeDropSurge = game.config.primeBonuses.includes("drop_surge");
  const coinChance = enemy.kind === "boss" ? 1 : primeDropSurge ? enemy.elite ? 0.9 : enemy.kind === "bulwark" ? 0.65 : 0.38 : enemy.elite ? 0.72 : enemy.kind === "bulwark" ? 0.34 : 0.16;
  const coinRoll = rand(game);
  const guaranteedCalibrationCoin = game.config.runMode === "campaign" && game.config.stageId === 0 && game.kills === 1;
  if (guaranteedCalibrationCoin || coinRoll < coinChance) {
    const coinCount = enemy.kind === "boss" ? 12 : enemy.elite ? 3 : 1;
    for (let i = 0; i < coinCount; i += 1) addPickup(game, enemy.x, enemy.y, 1, "coin");
  }

  const chainLevel = game.upgrades.chain ?? 0;
  if (chainLevel > 0 && enemy.kind !== "boss") {
    const target = nearestEnemy(game, enemy.x, enemy.y, enemy.id);
    if (target && distanceSq(enemy.x, enemy.y, target.x, target.y) < 280 * 280) {
      damageEnemy(game, target, 4.5 + chainLevel * 3.5, target.x, target.y, "normal");
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
  const unstable = prismStability(game.spectrum, game.spectrumCapacity) === "unstable";
  if (game.prismBreakTime > 0 || unstable) {
    game.spectrum = emptySpectrumStore();
    game.prismBreakTime = 0;
    game.lastRefractionName = "PRISM FRACTURED";
    game.texts.push({ x: player.x, y: player.y - 42, text: "PRISM FRACTURED", color: "#ff6b9d", life: 1.05 });
  }
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

function advanceMicroObjective(game: Game, kind: MicroObjectiveKind, amount = 1) {
  if (game.microComplete || game.microObjective !== kind) return;
  game.microProgress = Math.min(game.microTarget, game.microProgress + amount);
  if (game.microProgress < game.microTarget) return;
  game.microComplete = true;
  const reward = 750 * DIFFICULTIES[game.config.difficulty].scoreMultiplier;
  game.score += Math.round(reward);
  game.charge = Math.min(100, game.charge + 18);
  game.texts.push({ x: game.player.x, y: game.player.y - 68, text: "MASTERY SIGNAL // +750", color: "#fff0a3", life: 1.35 });
  event(game, "level");
}

function storeAbsorbedSpectrum(game: Game, bullet: Bullet, perfect: boolean) {
  if (!bullet.spectrum) return;
  let amount = (perfect ? PRISM_ENGINE.perfectAbsorbEnergy : PRISM_ENGINE.normalAbsorbEnergy) * bullet.energyValue;
  if ((game.upgrades.spectrumLock ?? 0) > 0) {
    game.spectrumStreak = game.lastSpectrum === bullet.spectrum ? game.spectrumStreak + 1 : 1;
    game.lastSpectrum = bullet.spectrum;
    if (game.spectrumStreak % 3 === 0) amount += 1;
  }
  game.spectrum = addSpectrum(game.spectrum, bullet.spectrum, amount, game.spectrumCapacity).store;
  game.lastRefractionName = resolveRefraction(game.spectrum)?.name ?? "ABSORB A SPECTRUM";
}

function absorbBullet(game: Game, bullet: Bullet, perfect: boolean, secondary = false) {
  bullet.dead = true;
  game.absorbed += 1;
  storeAbsorbedSpectrum(game, bullet, perfect);
  const resonance = (game.resonanceBuff > 0 ? 1.75 : 1) * (game.worldCoreUpgrades.includes("eternal_resonance") ? 1.2 : 1);
  game.charge = Math.min(100, game.charge + DIFFICULTIES[game.config.difficulty].absorbCharge * resonance * (perfect ? 1.7 : 1));
  const points = Math.round((perfect ? 175 : 35) * game.combo * DIFFICULTIES[game.config.difficulty].scoreMultiplier);
  game.score += points;
  game.comboTimer = Math.max(game.comboTimer, perfect ? 2.4 : 1.1);
  if (perfect) {
    game.perfectAbsorbs += 1;
    advanceMicroObjective(game, "perfect");
    game.perfectChain = game.elapsed - game.lastPerfectTime < 2.3 ? game.perfectChain + 1 : 1;
    game.lastPerfectTime = game.elapsed;
    game.combo = Math.min(8, game.combo + 0.18);
    game.bestCombo = Math.max(game.bestCombo, game.combo);
    game.hitStop = game.reducedMotion ? 0 : 0.045;
    game.flash = Math.max(game.flash, 0.38);
    game.shake = Math.max(game.shake, 8);
    const label = game.perfectChain >= 3 ? `PERFECT CHAIN ×${game.perfectChain}` : "PERFECT ABSORB";
    if (!secondary) game.texts.push({ x: bullet.x, y: bullet.y - 20, text: label, color: bullet.color, life: 0.9 });
    shockwave(game, bullet.x, bullet.y, bullet.color, 18);
    event(game, "perfect");
  } else event(game, "absorb");
  burst(game, bullet.x, bullet.y, bullet.color, perfect ? 15 : 7, perfect ? 230 : 150, perfect ? 3.8 : 2.8);

  if (perfect && !secondary && (game.upgrades.horizon ?? 0) > 0) {
    let captured = 0;
    for (const nearby of game.bullets) {
      if (nearby.dead || !nearby.enemy || !nearby.absorbable || nearby === bullet) continue;
      if (distanceSq(bullet.x, bullet.y, nearby.x, nearby.y) > 105 * 105) continue;
      absorbBullet(game, nearby, false, true);
      captured += 1;
      if (captured >= 2) break;
    }
  }
}

function emitRefraction(game: Game, recipe: RefractionRecipe, angle: number, damageScale = 1) {
  const count = recipe.projectiles;
  const center = (count - 1) / 2;
  const dominant = recipe.spectra[0];
  for (let index = 0; index < count; index += 1) {
    const shotAngle = angle + (index - center) * recipe.spread;
    const spectrum = recipe.spectra[index % recipe.spectra.length];
    addBullet(game, game.player.x + Math.cos(shotAngle) * 22, game.player.y + Math.sin(shotAngle) * 22, shotAngle, 870, false,
      playerDamage(game) * recipe.damage * damageScale * (game.prismBreakTime > 0 ? 1.3 : 1), {
        r: recipe.id === "full-spectrum" ? 9 : 6.2,
        color: SPECTRUM_INFO[spectrum ?? dominant].color,
        homing: recipe.chain > 0 ? 1.25 : 0,
        pierce: recipe.pierce,
        spectrum,
        refraction: true,
        recipeId: recipe.id,
        chain: recipe.chain,
        burstRadius: recipe.burstRadius,
        detonatesBullets: recipe.detonatesBullets,
        life: 2.5,
      });
  }
}

function triggerRefraction(game: Game) {
  if (game.mode !== "playing") return;
  const recipe = resolveRefraction(game.spectrum);
  if (!recipe) {
    if (game.elapsed > 4) game.texts.push({ x: game.player.x, y: game.player.y - 40, text: "ABSORB A COLORED BULLET", color: "#8aa0b8", life: 0.65 });
    return;
  }
  const wasBreakReady = spectrumTotal(game.spectrum) >= game.spectrumCapacity;
  emitRefraction(game, recipe, game.player.aim);
  game.spectrum = consumeRefraction(game.spectrum, recipe);
  game.refractionsFired += 1;
  advanceMicroObjective(game, "refraction");
  if (recipe.spectra.length >= 2) game.spectrumCombos += 1;
  if (recipe.spectra.length >= 2) advanceMicroObjective(game, "combo");
  if (recipe.id === "full-spectrum") advanceMicroObjective(game, "full-spectrum");
  game.lastRefractionName = resolveRefraction(game.spectrum)?.name ?? "ABSORB A SPECTRUM";
  game.combo = Math.min(8, game.combo + 0.12 * recipe.spectra.length);
  game.comboTimer = Math.max(game.comboTimer, 2.2);
  game.score += Math.round(90 * recipe.scoreMultiplier * game.combo * DIFFICULTIES[game.config.difficulty].scoreMultiplier);
  game.texts.push({ x: game.player.x, y: game.player.y - 46, text: recipe.name, color: SPECTRUM_INFO[recipe.spectra[0]].color, life: 1.05 });
  burst(game, game.player.x, game.player.y, SPECTRUM_INFO[recipe.spectra[0]].color, 20, 290, 3.8);
  game.shake = Math.max(game.shake, recipe.spectra.length * 4.5);
  game.flash = Math.max(game.flash, recipe.spectra.length * 0.12);
  if ((game.upgrades.echo ?? 0) > 0) game.delayedRefractions.push({ time: 0.42, recipe, angle: game.player.aim, damageScale: 0.58 });
  if (wasBreakReady) {
    game.spectrum = emptySpectrumStore();
    game.lastRefractionName = "PRISM BREAK ACTIVE";
    game.prismBreakTime = PRISM_ENGINE.prismBreakDuration;
    game.prismBreaks += 1;
    game.combo = Math.max(game.combo, 4);
    game.texts.push({ x: game.player.x, y: game.player.y - 74, text: "PRISM BREAK", color: "#ffffff", life: 1.55 });
    shockwave(game, game.player.x, game.player.y, "#ffffff", 52);
    event(game, "break");
  } else event(game, "refract");
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
  for (const enemy of game.enemies) damageEnemy(game, enemy, enemy.kind === "boss" ? 42 : 30, enemy.x, enemy.y, "nova");
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
    damageEnemy(game, enemy, enemy.kind === "boss" ? 92 : 120, enemy.x, enemy.y, "smash");
  }
  game.texts.push({ x: player.x, y: player.y - 48, text: "PRISM SMASH", color: "#fff0a3", life: 1.1 });
  burst(game, player.x, player.y, "#fff0a3", 48, 390, 5);
  shockwave(game, player.x, player.y, "#fff0a3", 46);
  shockwave(game, player.x, player.y, "#ff87d7", 26);
  event(game, "nova");
}

function triggerPrismLance(game: Game) {
  if ((game.upgrades.lance ?? 0) <= 0 || game.specialCooldown > 0 || game.mode !== "playing") return;
  const player = game.player;
  addBullet(game, player.x + Math.cos(player.aim) * 20, player.y + Math.sin(player.aim) * 20, player.aim, 1120, false, playerDamage(game) * 9, { r: 13, color: "#ffe27a", life: 1.2 });
  game.specialCooldown = 5;
  game.flash = 0.8;
  game.shake = 18;
  burst(game, player.x, player.y, "#ffe27a", 24, 280, 4);
  game.texts.push({ x: player.x, y: player.y - 48, text: "PRISM LANCE", color: "#ffe27a", life: 0.9 });
  event(game, "nova");
}

function chooseUpgradeSet(game: Game) {
  const basePool: UpgradeId[] = ["split", "rapid", "heavy", "magnet", "phase", "second", "spectrumLock"];
  if (game.unlockedPowers.focus) basePool.push("focus");
  if (game.unlockedPowers.overclock) basePool.push("overclock");
  if (game.unlockedPowers.lance) basePool.push("lance");
  const stage = game.config.runMode === "campaign" ? game.config.stageId : 5;
  if (stage >= 2) basePool.push("chain");
  if (stage >= 2) basePool.push("echo");
  if (stage >= 3) basePool.push("wake");
  if (stage >= 3) basePool.push("horizon");
  if (stage >= 4) basePool.push("guard");
  if (stage >= 4) basePool.push("shatterpoint");
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

function updateAlly(game: Game, ally: Enemy, dt: number) {
  const player = game.player;
  const target = nearestEnemy(game, ally.x, ally.y, ally.id);
  ally.age += dt;
  ally.hit = Math.max(0, ally.hit - dt);
  ally.fire -= dt;

  let targetX: number;
  let targetY: number;
  if (target) {
    targetX = target.x;
    targetY = target.y;
  } else {
    const orbit = game.visualTime * 0.65 + ally.id * 1.77;
    targetX = player.x + Math.cos(orbit) * (74 + ally.r);
    targetY = player.y + Math.sin(orbit) * (58 + ally.r * 0.5);
  }

  const dx = targetX - ally.x;
  const dy = targetY - ally.y;
  const distance = Math.max(0.001, Math.hypot(dx, dy));
  const nx = dx / distance;
  const ny = dy / distance;
  const tangent = ally.id % 2 ? 0.22 : -0.22;
  const radial = target ? (distance > 225 ? 1 : distance < 125 ? -0.42 : 0) : 1;
  ally.vx += (nx * radial - ny * tangent) * 155 * dt * 3;
  ally.vy += (ny * radial + nx * tangent) * 155 * dt * 3;
  ally.angle = Math.atan2(dy, dx);

  if (target && ally.fire <= 0 && target.age > 0.35) {
    const shotAngle = Math.atan2(target.y - ally.y, target.x - ally.x);
    const damage = 2.1 + Math.min(1.9, ally.r * 0.045) + (ally.elite ? 1.25 : 0);
    addBullet(game, ally.x + Math.cos(shotAngle) * (ally.r + 5), ally.y + Math.sin(shotAngle) * (ally.r + 5),
      shotAngle, 650, false, damage, { color: "#9dffe4", r: ally.elite ? 5.2 : 4.3, homing: 0.65 });
    const cadence: Record<Exclude<EnemyKind, "boss">, number> = {
      needle: 0.78, halo: 0.92, splitter: 1.12, lancer: 1.25, bulwark: 1.42,
      skimmer: 0.88, weaver: 1.18, warden: 1.35, siphon: 1.22, phantom: 1.05, oracle: 1.46,
    };
    ally.fire = cadence[ally.kind as Exclude<EnemyKind, "boss">];
  }

  const damping = Math.exp(-dt * 3.8);
  ally.vx *= damping;
  ally.vy *= damping;
  ally.x += ally.vx * dt * 1.08;
  ally.y += ally.vy * dt * 1.08;
  ally.x = clamp(ally.x, 40, WORLD_W - 40);
  ally.y = clamp(ally.y, 55, WORLD_H - 40);
}

function updateEnemy(game: Game, enemy: Enemy, dt: number) {
  if (enemy.ally) {
    updateAlly(game, enemy, dt);
    return;
  }
  const player = game.player;
  const dx = player.x - enemy.x;
  const dy = player.y - enemy.y;
  const distance = Math.max(0.001, Math.hypot(dx, dy));
  const nx = dx / distance;
  const ny = dy / distance;
  enemy.age += dt;
  enemy.hit = Math.max(0, enemy.hit - dt);
  enemy.fire -= dt * game.config.scaling.attackRate;

  if (enemy.kind === "needle") {
    const speed = enemy.eliteTier ? ELITE_PROFILES[enemy.eliteTier].needleSpeed : 162;
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
      [-0.13, 0, 0.13].forEach((offset) => spawnEnemyBullet(game, enemy, aim + offset, 260, "#ff557f", 5.2));
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
      const profile = enemy.eliteTier ? ELITE_PROFILES[enemy.eliteTier] : null;
      const shots = profile?.bulwarkShots ?? 5;
      const middle = (shots - 1) / 2;
      for (let i = 0; i < shots; i += 1) spawnEnemyBullet(game, enemy, aim + (i - middle) * 0.16, profile?.bulwarkProjectileSpeed ?? 230, "#ff955b", profile?.bulwarkProjectileRadius ?? 7.2);
      enemy.fire = profile?.bulwarkFireDelay ?? 2.05;
    }
  } else if (enemy.kind === "skimmer") {
    const tangent = enemy.id % 2 ? 1 : -1;
    const radial = distance > 355 ? 0.75 : distance < 275 ? -0.72 : 0;
    enemy.vx += (nx * radial - ny * tangent) * 165 * dt * 2.8;
    enemy.vy += (ny * radial + nx * tangent) * 165 * dt * 2.8;
    enemy.angle = Math.atan2(dy, dx);
    if (enemy.fire <= 0 && enemy.age > 0.75) {
      const aim = Math.atan2(dy, dx);
      [-0.18, 0.18].forEach((offset) => spawnEnemyBullet(game, enemy, aim + offset, 215, "#ff8a68", 5.7));
      enemy.fire = 1.9;
    }
  } else if (enemy.kind === "weaver") {
    const radial = distance > 390 ? 1 : distance < 330 ? -0.55 : 0;
    enemy.vx += (nx * radial - ny * 0.28) * 82 * dt * 2.4;
    enemy.vy += (ny * radial + nx * 0.28) * 82 * dt * 2.4;
    enemy.angle += dt * 0.9;
    if (enemy.fire <= 0 && enemy.age > 0.9) {
      for (let i = 0; i < 4; i += 1) spawnEnemyBullet(game, enemy, enemy.angle + i * TAU / 4, 178, "#9dff7a", 6.2);
      enemy.fire = 2.45;
    }
  } else if (enemy.kind === "warden") {
    const radial = distance > 340 ? 1 : distance < 275 ? -0.35 : 0;
    enemy.vx += nx * radial * 52 * dt * 2;
    enemy.vy += ny * radial * 52 * dt * 2;
    enemy.angle += dt * 0.5;
    if (enemy.fire <= 0 && enemy.age > 1) {
      spawnEnemyBullet(game, enemy, Math.atan2(dy, dx), 205, "#c996ff", 7);
      enemy.fire = 2.55;
    }
  } else if (enemy.kind === "siphon") {
    const tangent = enemy.id % 2 ? 0.55 : -0.55;
    const radial = distance > 340 ? 0.8 : distance < 270 ? -0.65 : 0;
    enemy.vx += (nx * radial - ny * tangent) * 92 * dt * 2.5;
    enemy.vy += (ny * radial + nx * tangent) * 92 * dt * 2.5;
    enemy.angle += dt * 1.05;
    if (enemy.fire <= 0 && enemy.age > 1) {
      const aim = Math.atan2(dy, dx);
      spawnEnemyBullet(game, enemy, aim, 166, "#6ef1d2", 7.2, { spectrum: enemy.id % 2 ? "cyan" : "gold", energyValue: 2, homing: 1.45 });
      enemy.fire = 2.75;
    }
  } else if (enemy.kind === "phantom") {
    const tangent = enemy.id % 2 ? 0.75 : -0.75;
    const huntsOverload = spectrumTotal(game.spectrum) >= game.spectrumCapacity * 0.76 ? 1.45 : 1;
    enemy.vx += (-ny * tangent + nx * (distance > 360 ? 0.35 : -0.2)) * 105 * dt * 2.6 * huntsOverload;
    enemy.vy += (nx * tangent + ny * (distance > 360 ? 0.35 : -0.2)) * 105 * dt * 2.6 * huntsOverload;
    enemy.angle = Math.atan2(dy, dx);
    if (enemy.fire <= 0 && enemy.age > 1.1) {
      const lateral = enemy.id % 2 ? 1 : -1;
      enemy.vx += -ny * lateral * 260;
      enemy.vy += nx * lateral * 260;
      [-0.26, 0, 0.26].forEach((offset) => spawnEnemyBullet(game, enemy, enemy.angle + offset, 190, "#ff74d8", 6));
      enemy.fire = 2.8;
    }
  } else if (enemy.kind === "oracle") {
    const tangent = enemy.id % 2 ? 0.22 : -0.22;
    const radial = distance > 420 ? 0.9 : distance < 355 ? -0.8 : 0;
    enemy.vx += (nx * radial - ny * tangent) * 72 * dt * 2.25;
    enemy.vy += (ny * radial + nx * tangent) * 72 * dt * 2.25;
    enemy.angle += dt * 0.55;
    if (enemy.fire <= 0 && enemy.age > 1.15) {
      const aim = Math.atan2(dy, dx);
      [-0.32, -0.16, 0, 0.16, 0.32].forEach((offset, index) => spawnEnemyBullet(game, enemy, aim + offset, 198, "#ffd174", 6.4, index === 2 ? { absorbable: false } : undefined));
      enemy.fire = 3.05;
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
        if ((i + Math.floor(enemy.age)) % 6 !== 0) spawnEnemyBullet(game, enemy, angle, speed, i % 2 ? "#c179ff" : "#ff5ba8", 6.5, { spectrum: SPECTRUM_IDS[(i + Math.floor(enemy.age / 2)) % SPECTRUM_IDS.length] });
      }
      if (hpRatio < 0.62) {
        const aimed = Math.atan2(dy, dx);
        [-0.22, -0.11, 0, 0.11, 0.22].forEach((offset) => spawnEnemyBullet(game, enemy, aimed + offset, 330, "#ff704d", 6));
      }
      enemy.fire = hpRatio > 0.58 ? 1.28 : hpRatio > 0.28 ? 0.94 : 0.67;
      game.shake = Math.max(game.shake, 4);
    }
  }

  const damping = Math.exp(-dt * (enemy.kind === "boss" ? 2.4 : 3.5));
  enemy.vx *= damping;
  enemy.vy *= damping;
  const movementScale = DIFFICULTIES[game.config.difficulty].enemySpeed * game.config.scaling.enemySpeed * (game.stasisBuff > 0 ? 0.62 : 1);
  enemy.x += enemy.vx * dt * movementScale;
  enemy.y += enemy.vy * dt * movementScale;
  enemy.x = clamp(enemy.x, 40, WORLD_W - 40);
  enemy.y = clamp(enemy.y, 55, WORLD_H - 40);
}

function completeRunObjective(game: Game) {
  if (!["campaign", "prime", "threat"].includes(game.config.runMode) || game.mode !== "playing") return false;
  const progress = objectiveProgress(game);
  const complete = progress >= game.config.objectiveTarget;
  if (!complete) return false;
  const remaining = Math.max(0, game.config.duration - game.elapsed);
  game.score += Math.round(remaining * 90 * DIFFICULTIES[game.config.difficulty].scoreMultiplier);
  game.mode = "victory";
  game.reason = game.config.runMode === "threat" ? "THREAT CONTAINED" : game.config.runMode === "prime" ? "PRIME OBJECTIVE COMPLETE" : game.config.stageId === 0 ? "CALIBRATION COMPLETE" : "MISSION OBJECTIVE COMPLETE";
  game.flash = 0.85;
  game.shake = 12;
  event(game, "level");
  return true;
}

function updateGame(game: Game, input: InputState, dt: number) {
  if (game.mode !== "playing") return;
  if (input.nova) {
    input.nova = false;
    if (game.charge >= 100) {
      input.dash = false;
      input.smash = false;
      input.blast = false;
      input.refract = false;
      game.mode = "nova-confirm";
      return;
    }
    game.texts.push({
      x: game.player.x,
      y: game.player.y - 42,
      text: "NOVA CORE NOT READY",
      color: "#ffe486",
      life: 0.75,
    });
  }
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
  game.specialCooldown = Math.max(0, game.specialCooldown - dt);
  game.smashPulse = Math.max(0, game.smashPulse - dt * 1.45);
  game.rapidBuff = Math.max(0, game.rapidBuff - dt);
  game.doubleShotBuff = Math.max(0, game.doubleShotBuff - dt);
  game.pierceBuff = Math.max(0, game.pierceBuff - dt);
  game.stasisBuff = Math.max(0, game.stasisBuff - dt);
  game.resonanceBuff = Math.max(0, game.resonanceBuff - dt);
  game.prismBreakTime = Math.max(0, game.prismBreakTime - dt);
  for (const enemy of game.enemies) {
    if (enemy.kind !== "boss") continue;
    enemy.weakPointTimer = Math.max(0, enemy.weakPointTimer - dt);
    if (enemy.weakPointTimer === 0 && enemy.shieldSpectrum) {
      const phaseIndex = enemy.hp / Math.max(1, enemy.maxHp) > 0.58 ? 0 : enemy.hp / Math.max(1, enemy.maxHp) > 0.28 ? 1 : 2;
      enemy.shieldSpectrum = SPECTRUM_IDS[(phaseIndex + Math.floor(enemy.age / 8)) % SPECTRUM_IDS.length];
    }
  }
  for (const delayed of game.delayedRefractions) delayed.time -= dt;
  for (const delayed of game.delayedRefractions) {
    if (delayed.time <= 0) emitRefraction(game, delayed.recipe, delayed.angle, delayed.damageScale);
  }
  game.delayedRefractions = game.delayedRefractions.filter((delayed) => delayed.time > 0);
  if (game.config.scaling.novaDrain > 0) game.charge = Math.max(0, game.charge - dt * game.config.scaling.novaDrain);
  game.flash = Math.max(0, game.flash - dt * 2.5);
  game.shake = Math.max(0, game.shake - dt * 28);

  if (completeRunObjective(game)) return;

  if (!game.bossSpawned && game.config.bossTime !== null && game.elapsed >= game.config.bossTime) {
    for (const enemy of game.enemies) {
      if (enemy.kind !== "boss" && !enemy.ally) {
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
  const maxEnemies = game.config.maxHostiles ?? (firstMission ? 12 : game.config.runMode === "threat" || game.config.runMode === "prime" ? game.config.scaling.maxEnemies : game.config.difficulty === "cadet" ? 28 : game.config.difficulty === "overdrive" ? 46 : 38);
  const hostileCount = game.enemies.reduce((count, enemy) => count + (!enemy.dead && !enemy.ally ? 1 : 0), 0);
  if (!game.bossSpawned && game.spawnTimer <= 0 && hostileCount < maxEnemies && (game.config.stageId !== 0 || game.elapsed > 4)) {
    const selectedKind = selectEnemyKind(game);
    const eliteScale = game.config.difficulty === "cadet" ? 0.45 : game.config.difficulty === "overdrive" ? 1.45 : 1;
    const eliteCadence = Math.max(6, (game.config.duration - 18) / Math.max(1, game.config.objectiveTarget));
    const objectiveEliteDue = game.config.objective === "elites"
      && game.eliteKills < game.config.objectiveTarget
      && game.elapsed >= 8 + game.eliteKills * eliteCadence;
    const elite = hostileEliteCount(game) < game.config.maxActiveElites
      && (objectiveEliteDue || (game.elapsed > Math.min(24, game.config.duration * 0.38) && rand(game) < game.config.eliteChance * eliteScale));
    const kind = elite && (selectedKind === "warden" || selectedKind === "siphon" || selectedKind === "phantom" || selectedKind === "oracle") ? "needle" : selectedKind;
    spawnEnemy(game, kind, undefined, undefined, elite);
    if (game.elapsed > game.config.duration * 0.55 && rand(game) < 0.24) spawnEnemy(game, rand(game) < 0.7 ? "needle" : "halo");
    const baseInterval = Math.max(0.25, 0.84 - game.elapsed * 0.0045) * (0.78 + rand(game) * 0.5);
    const trainingScale = game.config.stageId === 0 ? 1.38 : firstMission ? 1.72 : 1;
    game.spawnTimer = baseInterval * trainingScale / (difficulty.spawnRate * game.config.scaling.spawnRate);
  }

  let moveX = 0;
  let moveY = 0;
  const pointerControlled = !input.usingTouch && input.hasPointer;
  if (input.stickId !== null) {
    moveX += input.stickX;
    moveY += input.stickY;
  } else if (pointerControlled) {
    // Direction is retained for dash effects; position itself is locked 1:1
    // to the pointer farther below.
    const pointerDx = input.pointerX - player.x;
    const pointerDy = input.pointerY - player.y;
    const pointerDistance = Math.hypot(pointerDx, pointerDy);
    if (pointerDistance > 0.001) {
      moveX = pointerDx / pointerDistance;
      moveY = pointerDy / pointerDistance;
    }
  }
  const moveLength = Math.hypot(moveX, moveY);
  if (moveLength > 1) { moveX /= moveLength; moveY /= moveLength; }

  let aimTargetX = input.pointerX;
  let aimTargetY = input.pointerY;
  if (pointerControlled || input.usingTouch || !input.hasPointer) {
    const target = nearestEnemy(game, player.x, player.y);
    if (target) { aimTargetX = target.x; aimTargetY = target.y; }
  }
  if (Math.hypot(aimTargetX - player.x, aimTargetY - player.y) > 2) player.aim = Math.atan2(aimTargetY - player.y, aimTargetX - player.x);

  if (input.dash && player.dashCooldown <= 0) {
    let dashX = moveX;
    let dashY = moveY;
    if (Math.hypot(dashX, dashY) < 0.1) { dashX = Math.cos(player.aim); dashY = Math.sin(player.aim); }
    const length = Math.max(0.001, Math.hypot(dashX, dashY));
    player.vx = pointerControlled ? 0 : dashX / length * 980;
    player.vy = pointerControlled ? 0 : dashY / length * 980;
    player.dashTime = difficulty.dashDuration;
    player.dashCooldown = difficulty.dashCooldown * game.config.scaling.dashCooldown * Math.pow(0.82, game.upgrades.phase ?? 0) * (game.worldCoreUpgrades.includes("void_drive") ? 0.86 : 1);
    player.invuln = Math.max(player.invuln, difficulty.dashDuration + 0.02);
    game.shake = Math.max(game.shake, 8);
    burst(game, player.x, player.y, "#80f8ff", 15, 230, 3);
    event(game, "dash");
  }
  input.dash = false;
  if (input.smash) triggerSmash(game);
  input.smash = false;
  if (input.blast) {
    if (spectrumTotal(game.spectrum) > 0) triggerRefraction(game);
    else triggerPrismLance(game);
  }
  input.blast = false;
  if (input.refract) triggerRefraction(game);
  input.refract = false;

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
          if (!enemy.dead && distanceSq(player.x, player.y, enemy.x, enemy.y) < (enemy.r + 23) ** 2) damageEnemy(game, enemy, (3.4 + wake * 2.4) * dt * 35, enemy.x, enemy.y, "dash");
        }
      }
    }
  } else if (!pointerControlled) {
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

  if (pointerControlled) {
    const nextX = clamp(input.pointerX, 38, WORLD_W - 38);
    const nextY = clamp(input.pointerY, 52, WORLD_H - 38);
    const deltaX = nextX - player.x;
    const deltaY = nextY - player.y;
    const directSpeed = Math.hypot(deltaX, deltaY) / Math.max(dt, 0.001);
    const velocityScale = directSpeed > 1500 ? 1500 / directSpeed : 1;
    player.vx = deltaX / Math.max(dt, 0.001) * velocityScale;
    player.vy = deltaY / Math.max(dt, 0.001) * velocityScale;
    player.x = nextX;
    player.y = nextY;
  } else {
    player.x += player.vx * dt;
    player.y += player.vy * dt;
    player.x = clamp(player.x, 38, WORLD_W - 38);
    player.y = clamp(player.y, 52, WORLD_H - 38);
  }

  const visualSpeed = Math.hypot(player.vx, player.vy);
  if (player.dashTime <= 0 && visualSpeed > 42 && game.particles.length < 820) {
    player.wakeClock -= dt;
    if (player.wakeClock <= 0) {
      player.wakeClock = game.reducedMotion ? 0.11 : 0.045;
      const forwardX = Math.cos(player.aim);
      const forwardY = Math.sin(player.aim);
      const lateralX = -forwardY;
      const lateralY = forwardX;
      for (const side of [-1, 1]) {
        const x = player.x - forwardX * 17 + lateralX * side * 6.5;
        const y = player.y - forwardY * 17 + lateralY * side * 6.5;
        const velocity = 62 + Math.min(visualSpeed, 700) * 0.1;
        const life = game.reducedMotion ? 0.2 : 0.34;
        game.particles.push({
          x, y,
          vx: -forwardX * velocity - player.vx * 0.055,
          vy: -forwardY * velocity - player.vy * 0.055,
          life, maxLife: life, size: 2.8 + Math.min(visualSpeed / 500, 1.2) * 2.1,
          color: side < 0 ? "#65f4ff" : "#c97aff", drag: 2.8, ring: false,
        });
      }
    }
  }

  if (player.fireCooldown <= 0 && nearestEnemy(game, player.x, player.y)) firePlayer(game);

  for (const enemy of game.enemies) if (!enemy.dead) updateEnemy(game, enemy, dt);

  for (const bullet of game.bullets) {
    if (bullet.dead) continue;
    bullet.px = bullet.x;
    bullet.py = bullet.y;
    bullet.life -= dt;
    if (bullet.homing > 0) {
      const target = bullet.enemy ? game.player : nearestEnemy(game, bullet.x, bullet.y);
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
    const bulletTimeScale = bullet.enemy && game.stasisBuff > 0 ? 0.62 : 1;
    bullet.x += bullet.vx * dt * bulletTimeScale;
    bullet.y += bullet.vy * dt * bulletTimeScale;
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
      if (pickup.kind === "coin") {
        game.coinsCollected += pickup.value;
        game.score += Math.round(25 * pickup.value * difficulty.scoreMultiplier);
        game.texts.push({ x: pickup.x, y: pickup.y - 10, text: `+${pickup.value} SHARD`, color: "#ffd76a", life: 0.75 });
      } else {
        game.xp += pickup.value;
        game.score += Math.round(15 * pickup.value * difficulty.scoreMultiplier);
      }
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
      for (const ally of game.enemies) {
        if (bullet.dead || ally.dead || !ally.ally || ally.age < 0.3) continue;
        if (segmentCircle(bullet, ally.x, ally.y, ally.r + bullet.r)) {
          bullet.dead = true;
          damageAlly(game, ally, bullet.damage, bullet.x, bullet.y);
        }
      }
      const absorbRadius = player.r + bullet.r + ((game.upgrades.horizon ?? 0) > 0 ? 4 : 0);
      if (!bullet.dead && segmentCircle(bullet, player.x, player.y, absorbRadius)) {
        if (player.dashTime > 0 && bullet.absorbable) {
          const dashAge = Math.max(0, difficulty.dashDuration - player.dashTime);
          const load = spectrumTotal(game.spectrum) / Math.max(1, game.spectrumCapacity);
          absorbBullet(game, bullet, dashAge <= perfectAbsorbWindow(game.config.difficulty, load));
        } else if (player.dashTime > 0 && !bullet.absorbable) {
          bullet.dead = true;
          game.spectrum = emptySpectrumStore();
          game.charge = Math.max(0, game.charge - 20);
          game.texts.push({ x: player.x, y: player.y - 35, text: "NULL FRACTURE", color: "#ffffff", life: 0.85 });
          game.shake = Math.max(game.shake, 7);
        }
        else { bullet.dead = true; hurtPlayer(game); }
      }
    } else {
      for (const enemy of game.enemies) {
        if (enemy.dead || enemy.ally || enemy.age < 0.3 || bullet.hitEnemyIds.includes(enemy.id)) continue;
        if (segmentCircle(bullet, enemy.x, enemy.y, enemy.r + bullet.r)) {
          let amount = bullet.damage;
          if (enemy.kind === "bulwark") {
            const incoming = Math.atan2(bullet.py - enemy.y, bullet.px - enemy.x);
            const delta = Math.abs(((incoming - enemy.angle + Math.PI * 3) % TAU) - Math.PI);
            if (delta < 1.05) amount *= 0.28;
          }
          damageEnemy(game, enemy, amount, bullet.x, bullet.y, bullet.refraction ? "refraction" : "normal", bullet.spectrum);
          if (bullet.refraction && bullet.detonatesBullets) {
            let detonated = 0;
            for (const hostile of game.bullets) {
              if (!hostile.enemy || hostile.dead || distanceSq(bullet.x, bullet.y, hostile.x, hostile.y) > 72 * 72) continue;
              hostile.dead = true;
              detonated += 1;
              if (detonated < 14) burst(game, hostile.x, hostile.y, hostile.color, 3, 125, 2.2);
            }
            if (detonated > 0) game.score += Math.round(detonated * 24 * game.combo);
          }
          if (bullet.refraction && bullet.burstRadius > 0) {
            for (const target of game.enemies) {
              if (target === enemy || target.dead || target.ally || distanceSq(enemy.x, enemy.y, target.x, target.y) > bullet.burstRadius ** 2) continue;
              damageEnemy(game, target, bullet.damage * 0.42, target.x, target.y, "refraction", bullet.spectrum);
            }
            shockwave(game, bullet.x, bullet.y, bullet.color, bullet.burstRadius * 0.18);
          }
          if (bullet.refraction && bullet.chain > 0) {
            let origin = enemy;
            for (let jump = 0; jump < bullet.chain; jump += 1) {
              const target = nearestEnemy(game, origin.x, origin.y, origin.id);
              if (!target || distanceSq(origin.x, origin.y, target.x, target.y) > 260 * 260) break;
              damageEnemy(game, target, bullet.damage * Math.pow(0.68, jump + 1), target.x, target.y, "refraction", bullet.spectrum);
              for (let segment = 0; segment < 7; segment += 1) {
                const t = segment / 6;
                game.particles.push({ x: origin.x + (target.x - origin.x) * t, y: origin.y + (target.y - origin.y) * t, vx: 0, vy: 0, life: 0.14, maxLife: 0.14, size: 2.6, color: bullet.color, drag: 0, ring: false });
              }
              origin = target;
            }
          }
          bullet.hitEnemyIds.push(enemy.id);
          if (bullet.pierce <= 0) bullet.dead = true;
          else bullet.pierce -= 1;
          break;
        }
      }
    }
  }

  for (const enemy of game.enemies) {
    if (!enemy.dead && !enemy.ally && enemy.age > 0.55 && enemy.kind !== "boss" && distanceSq(player.x, player.y, enemy.x, enemy.y) < (player.r + enemy.r) ** 2) {
      if (player.dashTime > 0) damageEnemy(game, enemy, 8 + (game.upgrades.wake ?? 0) * 3, enemy.x, enemy.y, "dash");
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

  if (completeRunObjective(game)) return;

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
  const dashTotal = DIFFICULTIES[game.config.difficulty].dashCooldown * game.config.scaling.dashCooldown * Math.pow(0.82, game.upgrades.phase ?? 0) * (game.worldCoreUpgrades.includes("void_drive") ? 0.86 : 1);
  return {
    mode: game.mode,
    score: Math.round(game.score),
    combo: game.combo,
    health: game.player.health,
    maxHealth: game.player.maxHealth,
    coinsCollected: game.coinsCollected,
    shield: game.player.shield,
    charge: game.charge,
    dash: 1 - clamp(game.player.dashCooldown / dashTotal, 0, 1),
    smash: 1 - clamp(game.smashCooldown / 20, 0, 1),
    rapidBuff: game.rapidBuff,
    doubleShotBuff: game.doubleShotBuff,
    pierceBuff: game.pierceBuff,
    stasisBuff: game.stasisBuff,
    resonanceBuff: game.resonanceBuff,
    allyCount: game.enemies.reduce((count, enemy) => count + (!enemy.dead && enemy.ally ? 1 : 0), 0),
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
    spectrum: { ...game.spectrum },
    spectrumTotal: spectrumTotal(game.spectrum),
    spectrumCapacity: game.spectrumCapacity,
    refractionName: resolveRefraction(game.spectrum)?.name ?? game.lastRefractionName,
    prismStability: prismStability(game.spectrum, game.spectrumCapacity),
    prismBreakTime: game.prismBreakTime,
    perfectAbsorbs: game.perfectAbsorbs,
    refractionKills: game.refractionKills,
    bossSpectrum: boss?.shieldSpectrum ?? null,
    bossWeakPoint: boss?.weakPointTimer ?? 0,
    microObjective: game.microObjective,
    microProgress: game.microProgress,
    microTarget: game.microTarget,
    microComplete: game.microComplete,
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
  const worldId = visualWorldId(game);
  const backdrop = WORLD_BACKDROPS[worldId];
  const gradient = ctx.createRadialGradient(WORLD_W * 0.52, WORLD_H * 0.45, 20, WORLD_W * 0.52, WORLD_H * 0.45, 720);
  gradient.addColorStop(0, game.nova > 0 ? "#171538" : backdrop.core);
  gradient.addColorStop(0.5, backdrop.middle);
  gradient.addColorStop(1, backdrop.edge);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);

  if (game.mode !== "menu") {
    const playerBloom = ctx.createRadialGradient(game.player.x, game.player.y, 8, game.player.x, game.player.y, 245);
    playerBloom.addColorStop(0, game.player.dashTime > 0 ? "rgba(255,225,133,.11)" : "rgba(95,238,255,.075)");
    playerBloom.addColorStop(0.45, "rgba(125,92,255,.028)");
    playerBloom.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = playerBloom;
    ctx.fillRect(0, 0, WORLD_W, WORLD_H);
  }

  for (const star of STAR_FIELD) {
    const x = (star.x - time * 3 * star.depth + WORLD_W) % WORLD_W;
    const alpha = 0.12 + (Math.sin(time * 1.4 + star.pulse) + 1) * 0.08;
    ctx.fillStyle = `rgba(${backdrop.star},${alpha})`;
    ctx.fillRect(x, star.y, star.size, star.size);
  }

  if (worldId === 2) {
    ctx.save();
    ctx.globalAlpha = 0.2;
    for (let ribbon = -2; ribbon <= 3; ribbon += 1) {
      ctx.strokeStyle = ribbon % 2 ? "#ed72d7" : "#7bf4d2";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(-80, 130 + ribbon * 110 + Math.sin(time + ribbon) * 30);
      ctx.bezierCurveTo(WORLD_W * 0.32, 30 + ribbon * 70, WORLD_W * 0.68, 650 - ribbon * 55, WORLD_W + 80, 540 + ribbon * 75);
      ctx.stroke();
    }
    ctx.restore();
  } else if (worldId === 3) {
    ctx.save();
    for (let voidIndex = 0; voidIndex < 3; voidIndex += 1) {
      const x = 220 + voidIndex * 420;
      const y = 180 + (voidIndex % 2) * 250;
      const radius = 72 + Math.sin(time * 0.6 + voidIndex) * 10;
      const voidGlow = ctx.createRadialGradient(x, y, 4, x, y, radius * 1.6);
      voidGlow.addColorStop(0, "rgba(0,0,0,.88)");
      voidGlow.addColorStop(0.55, "rgba(69,37,120,.24)");
      voidGlow.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = voidGlow;
      ctx.beginPath(); ctx.arc(x, y, radius * 1.6, 0, TAU); ctx.fill();
      ctx.strokeStyle = "rgba(169,121,255,.18)";
      ctx.beginPath(); ctx.arc(x, y, radius, time * (voidIndex + 1) * 0.12, time * (voidIndex + 1) * 0.12 + Math.PI * 1.55); ctx.stroke();
    }
    ctx.restore();
  } else if (worldId === 4) {
    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.translate(WORLD_W * 0.5, WORLD_H * 0.42);
    for (let shard = 0; shard < 8; shard += 1) {
      ctx.rotate(TAU / 8);
      ctx.strokeStyle = shard % 2 ? "#ffda85" : "#ff78d2";
      ctx.beginPath();
      ctx.moveTo(145, -18); ctx.lineTo(480, -52); ctx.lineTo(590, 12); ctx.lineTo(245, 36); ctx.closePath();
      ctx.stroke();
    }
    ctx.restore();
  }

  ctx.save();
  ctx.translate(WORLD_W / 2, WORLD_H * 0.52);
  ctx.rotate(time * 0.012);
  ctx.strokeStyle = `rgba(${backdrop.ring},.055)`;
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
    ctx.strokeStyle = `rgba(${backdrop.grid},${0.018 + progress * 0.11})`;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(WORLD_W, y);
    ctx.stroke();
  }
  for (let col = -15; col <= 15; col += 1) {
    ctx.strokeStyle = `rgba(${backdrop.accent},.055)`;
    ctx.beginPath();
    ctx.moveTo(WORLD_W / 2 + col * 13, horizon);
    ctx.lineTo(WORLD_W / 2 + col * 100, WORLD_H);
    ctx.stroke();
  }
  ctx.restore();

  ctx.strokeStyle = game.bossSpawned ? "rgba(199,110,255,.19)" : `rgba(${backdrop.border},.13)`;
  ctx.lineWidth = 1;
  ctx.strokeRect(28.5, 34.5, WORLD_W - 57, WORLD_H - 69);
  const corner = 32;
  ctx.strokeStyle = game.bossSpawned ? "rgba(235,120,255,.62)" : `rgba(${backdrop.border},.47)`;
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

function drawEnemy(ctx: CanvasRenderingContext2D, enemy: Enemy, time: number, highContrast: boolean, reducedMotion = false) {
  const color = ENEMY_COLOR[enemy.kind];
  const appearLinear = clamp(enemy.age / 0.55, 0, 1);
  const appear = reducedMotion || appearLinear >= 1
    ? appearLinear
    : 1 - Math.pow(1 - appearLinear, 3) + Math.sin(appearLinear * Math.PI) * 0.16;
  const hoverX = reducedMotion ? 0 : Math.cos(time * 1.9 + enemy.id * 1.73) * Math.min(2.2, enemy.r * 0.06);
  const hoverY = reducedMotion ? 0 : Math.sin(time * 2.35 + enemy.id * 0.91) * Math.min(2.8, enemy.r * 0.075);
  ctx.save();
  ctx.translate(enemy.x + hoverX, enemy.y + hoverY);
  ctx.scale(appear, appear);
  ctx.globalAlpha = enemy.age < 0.55 ? 0.35 + appear * 0.65 : 1;
  ctx.strokeStyle = enemy.hit > 0 ? "#ffffff" : color;
  ctx.fillStyle = "rgba(3,5,14,.84)";
  ctx.lineWidth = highContrast ? 3.2 : enemy.elite ? 3 : 2;
  ctx.shadowColor = color;
  ctx.shadowBlur = enemy.hit > 0 ? 28 : 13;

  if (enemy.kind === "warden") {
    ctx.save();
    ctx.shadowBlur = 0;
    ctx.globalAlpha *= 0.18;
    ctx.fillStyle = "rgba(200,155,255,.08)";
    ctx.strokeStyle = "rgba(200,155,255,.72)";
    ctx.lineWidth = 1;
    ctx.setLineDash([9, 13]);
    ctx.beginPath(); ctx.arc(0, 0, 145, time * 0.45, time * 0.45 + TAU); ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  const enemyImage = enemyVisualImages[enemy.visualIndex];
  const spriteReady = Boolean(enemyImage?.complete && enemyImage.naturalWidth > 0);
  if (spriteReady && enemyImage) {
    const directional = enemy.kind === "needle" || enemy.kind === "lancer" || enemy.kind === "skimmer" || enemy.kind === "phantom";
    const rotation = directional ? enemy.angle + Math.PI / 2 : enemy.angle * 0.32;
    const livingPulse = reducedMotion ? 1 : 1 + Math.sin(time * (enemy.elite ? 5.2 : 3.1) + enemy.id) * (enemy.elite ? 0.055 : 0.027);
    const attackPulse = enemy.fire < 0.24 ? 1 + (0.24 - enemy.fire) * 0.22 : 1;
    const size = enemy.r * (enemy.kind === "boss" ? 3.25 : 2.85) * livingPulse * attackPulse;
    ctx.save();
    ctx.rotate(rotation);
    ctx.globalAlpha *= enemy.kind === "phantom" ? 0.78 + Math.sin(time * 7 + enemy.id) * 0.16 : 1;
    if (enemy.hit > 0) {
      ctx.shadowColor = "#ffffff";
      ctx.shadowBlur = 30;
    }
    if (enemy.age < 0.55 && !reducedMotion) {
      const split = (1 - appearLinear) * 12;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = (1 - appearLinear) * 0.42;
      ctx.drawImage(enemyImage, -size / 2 - split, -size / 2, size, size);
      ctx.drawImage(enemyImage, -size / 2 + split, -size / 2, size, size);
      ctx.restore();
    }
    ctx.drawImage(enemyImage, -size / 2, -size / 2, size, size);
    ctx.restore();
    if (enemy.kind === "boss") {
      ctx.save();
      ctx.rotate(enemy.angle * 0.35);
      ctx.strokeStyle = enemy.weakPointTimer > 0 ? "#fff0a1" : color;
      ctx.globalAlpha = 0.7;
      for (let ring = 2; ring >= 1; ring -= 1) {
        ctx.rotate((ring % 2 ? 1 : -1) * time * 0.006);
        ctx.lineWidth = ring === 1 ? 2.5 : 1.2;
        polygon(ctx, ring === 1 ? 6 : 8, enemy.r * (0.88 + ring * 0.35), Math.PI / 8);
        ctx.stroke();
      }
      ctx.restore();
    }
  } else if (enemy.kind === "needle") {
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
  } else if (enemy.kind === "skimmer") {
    ctx.rotate(enemy.angle + Math.PI / 2);
    polygon(ctx, 4, enemy.r, Math.PI / 4); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-enemy.r * 1.25, enemy.r * 0.2); ctx.lineTo(0, enemy.r * 0.62); ctx.lineTo(enemy.r * 1.25, enemy.r * 0.2); ctx.stroke();
  } else if (enemy.kind === "weaver") {
    ctx.rotate(enemy.angle);
    polygon(ctx, 6, enemy.r, Math.PI / 6); ctx.fill(); ctx.stroke();
    for (let i = 0; i < 4; i += 1) { ctx.rotate(TAU / 4); ctx.beginPath(); ctx.moveTo(enemy.r * 0.35, 0); ctx.lineTo(enemy.r * 1.15, 0); ctx.stroke(); }
    ctx.beginPath(); ctx.arc(0, 0, enemy.r * 0.34, 0, TAU); ctx.stroke();
  } else if (enemy.kind === "warden") {
    ctx.save();
    ctx.shadowBlur = 0;
    ctx.globalAlpha *= 0.18;
    ctx.fillStyle = "rgba(200,155,255,.08)";
    ctx.strokeStyle = "rgba(200,155,255,.72)";
    ctx.lineWidth = 1;
    ctx.setLineDash([9, 13]);
    ctx.beginPath(); ctx.arc(0, 0, 145, time * 0.45, time * 0.45 + TAU); ctx.fill(); ctx.stroke();
    ctx.restore();
    ctx.rotate(enemy.angle);
    polygon(ctx, 8, enemy.r, Math.PI / 8); ctx.fill(); ctx.stroke();
    ctx.setLineDash([5, 4]);
    ctx.beginPath(); ctx.arc(0, 0, enemy.r * 1.18, time, time + Math.PI * 1.5); ctx.stroke();
    ctx.setLineDash([]);
    polygon(ctx, 4, enemy.r * 0.4, Math.PI / 4); ctx.stroke();
  } else if (enemy.kind === "siphon") {
    ctx.rotate(enemy.angle);
    ctx.setLineDash([3, 5]);
    ctx.beginPath(); ctx.arc(0, 0, enemy.r * 1.18, 0, TAU); ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath(); ctx.arc(0, 0, enemy.r * 0.54, 0, TAU); ctx.fill(); ctx.stroke();
    for (let arm = 0; arm < 3; arm += 1) { ctx.rotate(TAU / 3); ctx.beginPath(); ctx.moveTo(enemy.r * 0.58, 0); ctx.lineTo(enemy.r * 1.28, 0); ctx.stroke(); }
  } else if (enemy.kind === "phantom") {
    ctx.rotate(enemy.angle + Math.PI / 2);
    ctx.globalAlpha *= 0.82 + Math.sin(time * 7 + enemy.id) * 0.16;
    ctx.beginPath();
    ctx.moveTo(0, -enemy.r * 1.3); ctx.lineTo(enemy.r * 0.82, -enemy.r * 0.1); ctx.lineTo(enemy.r * 0.38, enemy.r);
    ctx.lineTo(0, enemy.r * 0.58); ctx.lineTo(-enemy.r * 0.38, enemy.r); ctx.lineTo(-enemy.r * 0.82, -enemy.r * 0.1); ctx.closePath();
    ctx.fill(); ctx.stroke();
  } else if (enemy.kind === "oracle") {
    ctx.rotate(enemy.angle);
    polygon(ctx, 5, enemy.r, -Math.PI / 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, enemy.r * 0.48, 0, TAU); ctx.stroke();
    ctx.fillStyle = "rgba(255,232,151,.55)";
    ctx.beginPath(); ctx.arc(0, 0, enemy.r * 0.2, 0, TAU); ctx.fill();
    ctx.setLineDash([4, 5]);
    ctx.beginPath(); ctx.arc(0, 0, enemy.r * 1.32, time * 0.8, time * 0.8 + Math.PI * 1.6); ctx.stroke();
    ctx.setLineDash([]);
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
    const major = enemy.eliteTier === "major";
    ctx.setLineDash(major ? [4, 5] : [2, 8]);
    ctx.strokeStyle = major ? "#ffd86b" : "#baf7ff";
    ctx.lineWidth = major ? 1.6 : 1;
    ctx.globalAlpha = major ? 0.82 : 0.56;
    ctx.beginPath(); ctx.arc(0, 0, enemy.r + (major ? 13 : 7), time * (major ? 2 : 1.35), time * (major ? 2 : 1.35) + Math.PI * 1.55); ctx.stroke();
  }
  if (enemy.ally) {
    ctx.globalAlpha = 0.92;
    ctx.setLineDash([4, 6]);
    ctx.strokeStyle = "#9dffe4";
    ctx.lineWidth = 2;
    ctx.shadowColor = "#67ffcc";
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.arc(0, 0, enemy.r + 12, time * 1.4 + enemy.id, time * 1.4 + enemy.id + Math.PI * 1.55);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#d9fff4";
    ctx.beginPath();
    ctx.moveTo(0, -enemy.r - 18);
    ctx.lineTo(5, -enemy.r - 11);
    ctx.lineTo(0, -enemy.r - 13);
    ctx.lineTo(-5, -enemy.r - 11);
    ctx.closePath();
    ctx.fill();
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

function EnemyPreview({ kind }: { kind: EnemyKind }) {
  const previewRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = previewRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const width = 180;
    const height = 126;
    canvas.width = width;
    canvas.height = height;
    const preview: Enemy = {
      id: 1, kind, x: 0, y: 0, vx: 0, vy: 0,
      r: kind === "boss" ? 52 : kind === "warden" ? 38 : 31,
      hp: 100, maxHp: 100, fire: 1, age: 1, angle: 0.28,
      hit: 0, elite: false, eliteTier: null, phase: 0, phaseTimer: 0,
      ally: false, dead: false, processed: false, defeatedBy: null,
      shieldSpectrum: null, weakPointTimer: 0,
      visualIndex: kind === "boss" ? 29 : Math.max(0, ENEMY_VISUAL_KIND_ORDER.indexOf(kind as Exclude<EnemyKind, "boss">)),
    };
    const render = () => {
      ctx.clearRect(0, 0, width, height);
      ctx.save();
      ctx.translate(width / 2, height / 2);
      ctx.scale(0.43, 0.43);
      drawEnemy(ctx, preview, 1.2, false);
      ctx.restore();
    };
    render();
    const image = enemyVisualImages[preview.visualIndex];
    image?.addEventListener("load", render, { once: true });
    return () => image?.removeEventListener("load", render);
  }, [kind]);
  return <canvas ref={previewRef} className="enemy-guide-preview" aria-hidden="true" />;
}

function drawPlayer(ctx: CanvasRenderingContext2D, game: Game) {
  const player = game.player;
  const damageBlink = player.invuln > 0 && player.dashTime <= 0 && Math.floor(game.visualTime * 18) % 2 === 0;
  const full = game.charge >= 99.9 || spectrumTotal(game.spectrum) >= game.spectrumCapacity;
  const breaking = game.prismBreakTime > 0;
  ctx.save();
  ctx.translate(player.x, player.y);
  if (game.elapsed < 0.9 && !game.reducedMotion) {
    const arrival = clamp(game.elapsed / 0.9, 0, 1);
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = (1 - arrival) * 0.8;
    for (let ray = 0; ray < 10; ray += 1) {
      const angle = ray * TAU / 10 + game.visualTime * 0.24;
      const outer = 155 - arrival * 92;
      const inner = 42 + arrival * 8;
      ctx.strokeStyle = ray % 2 ? "#a76bff" : "#70f4ff";
      ctx.lineWidth = ray % 3 === 0 ? 2.4 : 1.1;
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * outer, Math.sin(angle) * outer);
      ctx.lineTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
      ctx.stroke();
    }
    ctx.restore();
  }
  ctx.save();
  ctx.rotate(-game.visualTime * 0.7);
  ctx.strokeStyle = breaking ? "rgba(255,255,255,.94)" : player.dashTime > 0 ? "rgba(255,244,174,.88)" : "rgba(126,246,255,.38)";
  ctx.lineWidth = player.dashTime > 0 ? 2.4 : 1.2;
  ctx.setLineDash([3, 7]);
  ctx.beginPath(); ctx.arc(0, 0, 27 + Math.sin(game.visualTime * 4) * 1.5, 0, TAU); ctx.stroke();
  ctx.setLineDash([]);
  for (let mark = 0; mark < 4; mark += 1) {
    ctx.rotate(TAU / 4);
    ctx.beginPath(); ctx.moveTo(31, 0); ctx.lineTo(36, 0); ctx.stroke();
  }
  ctx.restore();
  const speed = Math.hypot(player.vx, player.vy);
  const throttle = clamp(speed / 520 + (player.dashTime > 0 ? 0.75 : 0), 0.16, 1.45);
  const rightX = -Math.sin(player.aim);
  const rightY = Math.cos(player.aim);
  const bank = game.reducedMotion ? 0 : clamp((player.vx * rightX + player.vy * rightY) / 560, -1, 1);
  const breathing = game.reducedMotion ? 1 : 1 + Math.sin(game.visualTime * 5.4) * 0.018;
  const introTime = clamp(game.elapsed / 0.68, 0, 1);
  const introScale = game.reducedMotion ? 1 : 1 + 1.55 * Math.pow(introTime - 1, 3) + 0.55 * Math.pow(introTime - 1, 2);
  const shipSize = 47 * breathing;
  const shipImage = enemyVisualImages[PLAYER_SHIP_VISUAL_INDEX];
  const shipReady = Boolean(shipImage?.complete && shipImage.naturalWidth > 0);

  // ship-06 points down in its source artwork, so -PI/2 maps its nose to aim=0 (right).
  ctx.rotate(player.aim - Math.PI / 2);
  ctx.scale(Math.max(0.45, introScale), Math.max(0.45, introScale));
  ctx.transform(1 - Math.abs(bank) * 0.045, bank * 0.055, bank * 0.09, 1, 0, 0);

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let engine = -1; engine <= 1; engine += 2) {
    const flicker = game.reducedMotion ? 1 : 0.82 + Math.sin(game.visualTime * 32 + engine * 1.7) * 0.18;
    const plume = (13 + throttle * 18) * flicker;
    const exhaust = ctx.createLinearGradient(engine * 6.5, -14, engine * 6.5, -18 - plume);
    exhaust.addColorStop(0, full ? "rgba(255,246,175,.95)" : "rgba(225,255,255,.94)");
    exhaust.addColorStop(0.28, "rgba(94,244,255,.72)");
    exhaust.addColorStop(0.72, "rgba(188,91,255,.3)");
    exhaust.addColorStop(1, "rgba(80,220,255,0)");
    ctx.fillStyle = exhaust;
    ctx.beginPath();
    ctx.moveTo(engine * 6.5 - 2.8, -13);
    ctx.quadraticCurveTo(engine * 6.5, -22 - plume * 0.42, engine * 6.5, -18 - plume);
    ctx.quadraticCurveTo(engine * 6.5, -22 - plume * 0.42, engine * 6.5 + 2.8, -13);
    ctx.closePath();
    ctx.fill();
  }
  const halo = ctx.createRadialGradient(0, 2, 0, 0, 2, full ? 55 : 40);
  halo.addColorStop(0, full ? "rgba(255,248,188,.38)" : "rgba(115,247,255,.3)");
  halo.addColorStop(0.46, breaking ? "rgba(211,112,255,.18)" : "rgba(90,225,255,.08)");
  halo.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = halo;
  ctx.beginPath(); ctx.arc(0, 2, full ? 55 : 40, 0, TAU); ctx.fill();
  ctx.restore();

  if (shipReady && shipImage) {
    if (player.dashTime > 0 && !game.reducedMotion) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (let echo = 3; echo >= 1; echo -= 1) {
        const echoSize = shipSize * (1 + echo * 0.035);
        ctx.globalAlpha = 0.08 + echo * 0.035;
        ctx.drawImage(shipImage, -echoSize / 2, -echoSize / 2 - echo * 9, echoSize, echoSize);
      }
      ctx.restore();
    }
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = full ? 0.28 : 0.16;
    ctx.shadowColor = breaking ? SPECTRUM_INFO[SPECTRUM_IDS[Math.floor(game.visualTime * 9) % 4]].color : full ? "#fff1a0" : "#65efff";
    ctx.shadowBlur = full ? 30 : 18;
    ctx.drawImage(shipImage, -shipSize * 0.54, -shipSize * 0.54, shipSize * 1.08, shipSize * 1.08);
    ctx.restore();

    if (damageBlink) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = 0.48;
      ctx.drawImage(shipImage, -shipSize / 2 - 2, -shipSize / 2, shipSize, shipSize);
      ctx.globalAlpha = 0.3;
      ctx.drawImage(shipImage, -shipSize / 2 + 2, -shipSize / 2, shipSize, shipSize);
      ctx.restore();
    }
    ctx.save();
    ctx.globalAlpha = damageBlink ? 0.48 : 1;
    ctx.shadowColor = breaking ? "#ff8fdf" : full ? "#fff2aa" : "#6ff6ff";
    ctx.shadowBlur = breaking ? 24 : full ? 18 : 11;
    ctx.drawImage(shipImage, -shipSize / 2, -shipSize / 2, shipSize, shipSize);
    ctx.restore();
  } else {
    ctx.fillStyle = damageBlink ? "rgba(255,255,255,.5)" : "#dffeff";
    ctx.shadowColor = "#6ff6ff";
    ctx.shadowBlur = 18;
    ctx.beginPath(); ctx.moveTo(0, 18); ctx.lineTo(12, -9); ctx.lineTo(0, -3); ctx.lineTo(-12, -9); ctx.closePath(); ctx.fill();
  }

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const corePulse = game.reducedMotion ? 1 : 0.82 + Math.sin(game.visualTime * 9) * 0.18;
  ctx.fillStyle = full ? `rgba(255,246,171,${0.68 * corePulse})` : `rgba(255,111,218,${0.58 * corePulse})`;
  ctx.shadowColor = full ? "#fff0a1" : "#ff63d3";
  ctx.shadowBlur = 16 + corePulse * 9;
  ctx.beginPath(); ctx.arc(0, 2.5, 3.4 + corePulse * 1.2, 0, TAU); ctx.fill();
  if (breaking) {
    for (let spectrumIndex = 0; spectrumIndex < SPECTRUM_IDS.length; spectrumIndex += 1) {
      ctx.strokeStyle = SPECTRUM_INFO[SPECTRUM_IDS[spectrumIndex]].color;
      ctx.globalAlpha = 0.72;
      ctx.lineWidth = 1.4;
      const start = game.visualTime * (1.8 + spectrumIndex * 0.08) + spectrumIndex * TAU / 4;
      ctx.beginPath(); ctx.arc(0, 1, 23 + spectrumIndex * 2.2, start, start + 0.75); ctx.stroke();
    }
  }
  ctx.restore();
  ctx.restore();

  const dashTotal = DIFFICULTIES[game.config.difficulty].dashCooldown * game.config.scaling.dashCooldown * Math.pow(0.82, game.upgrades.phase ?? 0) * (game.worldCoreUpgrades.includes("void_drive") ? 0.86 : 1);
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

    if (game.prismBreakTime > 0) {
      const pulse = 0.5 + Math.sin(game.visualTime * 14) * 0.5;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (let index = 0; index < SPECTRUM_IDS.length; index += 1) {
        ctx.strokeStyle = SPECTRUM_INFO[SPECTRUM_IDS[index]].color;
        ctx.globalAlpha = 0.11 + pulse * 0.07;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(game.player.x, game.player.y);
        ctx.lineTo(game.player.x + Math.cos(game.visualTime * 0.65 + index * TAU / 4) * 760, game.player.y + Math.sin(game.visualTime * 0.65 + index * TAU / 4) * 760);
        ctx.stroke();
      }
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
        const particleSpeed = Math.hypot(particle.vx, particle.vy);
        if (particleSpeed > 48 && !game.reducedMotion) {
          const trailScale = Math.min(0.055, 8 / Math.max(1, particleSpeed));
          ctx.lineCap = "round";
          ctx.lineWidth = Math.max(0.8, particle.size * alpha * 1.15);
          ctx.beginPath();
          ctx.moveTo(particle.x - particle.vx * trailScale, particle.y - particle.vy * trailScale);
          ctx.lineTo(particle.x, particle.y);
          ctx.stroke();
          ctx.beginPath(); ctx.arc(particle.x, particle.y, Math.max(0.45, particle.size * alpha * 0.55), 0, TAU); ctx.fill();
        } else {
          ctx.beginPath(); ctx.arc(particle.x, particle.y, Math.max(0.5, particle.size * alpha), 0, TAU); ctx.fill();
        }
      }
    }
    ctx.restore();

    for (const pickup of game.pickups) {
      ctx.save();
      ctx.translate(pickup.x, pickup.y);
      ctx.rotate(game.visualTime * 2.2 + pickup.id);
      if (pickup.kind === "coin") {
        const radius = 7 + Math.sin(game.visualTime * 5 + pickup.id) * 0.8;
        ctx.fillStyle = "#ffd65e";
        ctx.strokeStyle = "#fff2a8";
        ctx.lineWidth = 1.5;
        ctx.shadowColor = "#ffb72e";
        ctx.shadowBlur = 18;
        ctx.beginPath(); ctx.arc(0, 0, radius, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.fillStyle = "#694000";
        ctx.font = "800 8px Geist Mono, monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("C", 0, 0.5);
      } else {
        ctx.fillStyle = "#a2fff4";
        ctx.shadowColor = "#5cf8ff";
        ctx.shadowBlur = 13;
        polygon(ctx, 4, 5 + Math.sin(game.visualTime * 4 + pickup.id) * 1.2, Math.PI / 4);
        ctx.fill();
      }
      ctx.restore();
    }

    for (const drop of game.powerDrops) {
      const info = DROP_INFO[drop.kind];
      const color = powerDropColor(drop);
      const pulse = 1 + Math.sin(game.visualTime * 6 + drop.id) * 0.1;
      const spin = game.visualTime * 1.55 + drop.id;
      ctx.save();
      ctx.translate(drop.x, drop.y);
      ctx.globalCompositeOperation = "lighter";
      const halo = ctx.createRadialGradient(0, 0, 1, 0, 0, 31);
      halo.addColorStop(0, `${color}88`);
      halo.addColorStop(0.38, `${color}28`);
      halo.addColorStop(1, `${color}00`);
      ctx.fillStyle = halo;
      ctx.beginPath(); ctx.arc(0, 0, 31 * pulse, 0, TAU); ctx.fill();
      ctx.rotate(spin);
      ctx.setLineDash([3, 5]);
      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.75;
      ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.arc(0, 0, 18 * pulse, 0, TAU); ctx.stroke();
      ctx.setLineDash([]);
      for (let tick = 0; tick < 4; tick += 1) {
        ctx.rotate(TAU / 4);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(20, -1, 5, 2);
      }
      ctx.rotate(-spin * 2);
      ctx.globalCompositeOperation = "source-over";
      ctx.shadowColor = color;
      ctx.shadowBlur = 24;
      const iconReady = Boolean(dropIconImage?.complete && dropIconImage.naturalWidth > 0);
      if (iconReady && dropIconImage) {
        // Draw the matching cell from the supplied artwork atlas. The outer
        // ring remains animated so the pickup still reads clearly in motion.
        const cell = dropIconCell(drop.kind);
        const sourceWidth = dropIconImage.naturalWidth / DROP_ICON_COLUMNS;
        const sourceHeight = dropIconImage.naturalHeight / DROP_ICON_ROWS;
        ctx.globalAlpha = 0.98;
        ctx.drawImage(
          dropIconImage,
          cell.column * sourceWidth,
          cell.row * sourceHeight,
          sourceWidth,
          sourceHeight,
          -17 * pulse,
          -17 * pulse,
          34 * pulse,
          34 * pulse,
        );
      } else {
        // Keep a crisp fallback while the atlas is loading (and for older
        // browsers that fail to decode an image).
        ctx.fillStyle = "rgba(3,13,28,.94)";
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.6;
        ctx.fillRect(-12 * pulse, -12 * pulse, 24 * pulse, 24 * pulse);
        ctx.strokeRect(-12 * pulse, -12 * pulse, 24 * pulse, 24 * pulse);
        ctx.globalAlpha = 0.92;
        ctx.shadowBlur = 0;
        ctx.fillStyle = "#ffffff";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = `${drop.kind === "double" ? 700 : 800} ${drop.kind === "double" ? 6.5 : 9}px Geist Mono, monospace`;
        ctx.fillText(info.glyph, 0, 0.5);
      }
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

    if (game.enemies.some((enemy) => !enemy.ally && enemy.kind === "lancer" && enemy.fire < 0.52)) {
      ctx.save();
      ctx.setLineDash([7, 10]);
      for (const enemy of game.enemies) {
        if (enemy.ally || enemy.kind !== "lancer" || enemy.fire >= 0.52 || enemy.dead) continue;
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
      ctx.lineCap = "round";
      const bulletSpeed = Math.max(1, Math.hypot(bullet.vx, bullet.vy));
      const trailLength = game.reducedMotion ? Math.max(4, bulletSpeed * STEP) : clamp(bulletSpeed * (bullet.refraction ? 0.052 : bullet.enemy ? 0.032 : 0.026), 9, bullet.refraction ? 52 : 34);
      const trailX = bullet.x - bullet.vx / bulletSpeed * trailLength;
      const trailY = bullet.y - bullet.vy / bulletSpeed * trailLength;
      ctx.globalAlpha = bullet.enemy ? 0.2 : 0.24;
      ctx.lineWidth = bullet.r * (bullet.refraction ? 3.2 : 2.45);
      ctx.beginPath(); ctx.moveTo(trailX, trailY); ctx.lineTo(bullet.x, bullet.y); ctx.stroke();
      ctx.globalAlpha = bullet.enemy ? 0.9 : 0.97;
      ctx.lineWidth = bullet.r * (highContrast && bullet.enemy ? 1.65 : 1);
      ctx.beginPath(); ctx.moveTo(trailX, trailY); ctx.lineTo(bullet.x, bullet.y); ctx.stroke();
      ctx.globalAlpha = 0.98;
      ctx.strokeStyle = "rgba(255,255,255,.88)";
      ctx.lineWidth = Math.max(0.8, bullet.r * 0.32);
      ctx.beginPath(); ctx.moveTo(bullet.x - bullet.vx / bulletSpeed * trailLength * 0.58, bullet.y - bullet.vy / bulletSpeed * trailLength * 0.58); ctx.lineTo(bullet.x, bullet.y); ctx.stroke();
      ctx.strokeStyle = bullet.color;
      ctx.beginPath(); ctx.arc(bullet.x, bullet.y, bullet.r * 0.72, 0, TAU); ctx.fill();
      if (bullet.enemy && bullet.absorbable && bullet.spectrum) {
        ctx.globalCompositeOperation = "source-over";
        ctx.strokeStyle = SPECTRUM_INFO[bullet.spectrum].color;
        ctx.globalAlpha = 0.72;
        ctx.lineWidth = bullet.energyValue > 1 ? 2.2 : 1;
        ctx.beginPath(); ctx.arc(bullet.x, bullet.y, bullet.r + 3 + Math.sin(game.visualTime * 8 + bullet.id) * 1.2, 0, TAU); ctx.stroke();
      } else if (bullet.enemy && !bullet.absorbable) {
        ctx.globalCompositeOperation = "source-over";
        ctx.strokeStyle = "#ffffff";
        ctx.globalAlpha = 0.9;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(bullet.x - bullet.r, bullet.y - bullet.r); ctx.lineTo(bullet.x + bullet.r, bullet.y + bullet.r);
        ctx.moveTo(bullet.x + bullet.r, bullet.y - bullet.r); ctx.lineTo(bullet.x - bullet.r, bullet.y + bullet.r);
        ctx.stroke();
      }
      if (!bullet.enemy) {
        ctx.globalCompositeOperation = "source-over";
        ctx.strokeStyle = "rgba(255,255,255,.92)";
        ctx.lineWidth = 1.25;
        ctx.beginPath(); ctx.arc(bullet.x, bullet.y, bullet.r * 0.44, 0, TAU); ctx.stroke();
      }
      if (highContrast && bullet.enemy) {
        ctx.globalCompositeOperation = "source-over";
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(bullet.x, bullet.y, bullet.r + 1.5, 0, TAU); ctx.stroke();
      }
      ctx.restore();
    }

    for (const enemy of game.enemies) {
      drawEnemy(ctx, enemy, game.visualTime, highContrast, game.reducedMotion);
      if (enemy.kind === "boss" && enemy.shieldSpectrum) {
        ctx.save();
        ctx.translate(enemy.x, enemy.y);
        ctx.rotate(game.visualTime * (enemy.weakPointTimer > 0 ? -0.9 : 0.45));
        ctx.strokeStyle = enemy.weakPointTimer > 0 ? "rgba(255,255,255,.42)" : SPECTRUM_INFO[enemy.shieldSpectrum].color;
        ctx.globalAlpha = enemy.weakPointTimer > 0 ? 0.35 : 0.76;
        ctx.lineWidth = enemy.weakPointTimer > 0 ? 1 : 3;
        ctx.setLineDash(enemy.weakPointTimer > 0 ? [3, 12] : [13, 7]);
        polygon(ctx, 6, enemy.r + 18 + Math.sin(game.visualTime * 4) * 3, Math.PI / 6);
        ctx.stroke();
        ctx.restore();
      }
    }
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
      perfect: [760, 1480, 0.18, "sine", 0.085],
      refract: [310, 1180, 0.24, "triangle", 0.085],
      break: [92, 1640, 0.68, "sawtooth", 0.12],
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

const KEYBOARD_CONTROL_SELECTOR = [
  "input",
  "textarea",
  "select",
  "button",
  "a[href]",
  "summary",
  "[contenteditable]:not([contenteditable='false'])",
  "[role='button']",
  "[role='link']",
  "[role='checkbox']",
  "[role='radio']",
  "[role='switch']",
  "[role='slider']",
  "[role='spinbutton']",
  "[role='combobox']",
  "[role='listbox']",
  "[role='menuitem']",
  "[role='option']",
  "[role='tab']",
].join(",");

function eventTargetElement(target: EventTarget | null) {
  if (target instanceof Element) return target;
  return target instanceof Node ? target.parentElement : null;
}

function isKeyboardControlTarget(target: EventTarget | null) {
  return eventTargetElement(target)?.closest(KEYBOARD_CONTROL_SELECTOR) != null;
}

function isEditableTarget(target: EventTarget | null) {
  return eventTargetElement(target)?.closest(
    "input, textarea, select, [contenteditable]:not([contenteditable='false'])",
  ) != null;
}

function canConsumeWheel(target: EventTarget | null, shell: HTMLElement, deltaX: number, deltaY: number) {
  let element = eventTargetElement(target) as HTMLElement | null;
  while (element && shell.contains(element)) {
    const style = window.getComputedStyle(element);
    const scrollsY = /(auto|scroll)/.test(style.overflowY) && element.scrollHeight > element.clientHeight;
    const scrollsX = /(auto|scroll)/.test(style.overflowX) && element.scrollWidth > element.clientWidth;
    if (scrollsY && ((deltaY < 0 && element.scrollTop > 0)
      || (deltaY > 0 && element.scrollTop + element.clientHeight < element.scrollHeight - 1))) return true;
    if (scrollsX && ((deltaX < 0 && element.scrollLeft > 0)
      || (deltaX > 0 && element.scrollLeft + element.clientWidth < element.scrollWidth - 1))) return true;
    if (element === shell) break;
    element = element.parentElement;
  }
  return false;
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
  const languageRef = useRef<Language>("en");

  const [ui, setUi] = useState<UiState>(EMPTY_UI);
  const [sound, setSound] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [highContrast, setHighContrast] = useState(false);
  const [bestScore, setBestScore] = useState(0);
  const [menuView, setMenuView] = useState<MenuView>("home");
  const [selectedStage, setSelectedStage] = useState(0);
  const [selectedPrime, setSelectedPrime] = useState(0);
  const [selectedThreat, setSelectedThreat] = useState(1);
  const [difficulty, setDifficulty] = useState<Difficulty>("cadet");
  const [profile, setProfile] = useState<PlayerProfile>(DEFAULT_PROFILE);
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [leaderboardError, setLeaderboardError] = useState("");
  const [runRank, setRunRank] = useState<number | null>(null);
  const [resultStars, setResultStars] = useState(0);
  const [resultShards, setResultShards] = useState(0);
  const [resultAchievements, setResultAchievements] = useState<AchievementDefinition[]>([]);
  const [resultWorldUpgrade, setResultWorldUpgrade] = useState<WorldCoreUpgradeDefinition | null>(null);
  const [bindings, setBindings] = useState<KeyBindings>(DEFAULT_BINDINGS);
  const [capturingBinding, setCapturingBinding] = useState<BindingAction | null>(null);
  const [controlsOpen, setControlsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [language, setLanguage] = useState<Language>("en");
  const [minimalHud, setMinimalHud] = useState(false);
  const [tutorialSkipped, setTutorialSkipped] = useState(false);

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
          const migratedProgression = migrateProgressionSave(storedProfile);
          const stars = Object.entries(storedProfile.stars ?? {}).reduce<Record<string, number>>((records, [key, value]) => {
            if (typeof value === "number" && Number.isFinite(value)) records[key] = clamp(Math.round(value), 0, 3);
            return records;
          }, {});
          const bestScores = Object.entries(storedProfile.bestScores ?? {}).reduce<Record<string, number>>((records, [key, value]) => {
            if (typeof value === "number" && Number.isFinite(value) && value >= 0) records[key] = Math.round(value);
            return records;
          }, {});
          const storedUnlockedStage = clamp(Number(storedProfile.unlockedStage) || 0, 0, CAMPAIGN_STAGES.length - 1);
          const clearedLegacyFinal = Boolean(storedProfile.overdriveUnlocked)
            || Object.entries(stars).some(([key, value]) => key.startsWith("5:") && value > 0);
          const migratedUnlockedStage = storedUnlockedStage === 5 && clearedLegacyFinal ? 6 : storedUnlockedStage;
          const validWorldUpgrades = new Set(Object.values(WORLD_CORE_UPGRADES).map((upgrade) => upgrade.id));
          const worldCoreUpgrades = Array.isArray(storedProfile.worldCoreUpgrades)
            ? [...new Set(storedProfile.worldCoreUpgrades.filter((upgrade): upgrade is WorldUpgradeId => typeof upgrade === "string" && validWorldUpgrades.has(upgrade as WorldUpgradeId)))]
            : [];
          const nextProfile: PlayerProfile = {
            unlockedStage: migratedUnlockedStage,
            overdriveUnlocked: Boolean(storedProfile.overdriveUnlocked),
            stars,
            bestScores,
            ...migratedProgression,
            worldCoreUpgrades,
            achievements: migrateAchievementSave(storedProfile.achievements, storedProfile),
          };
          setProfile(nextProfile);
          setSelectedStage(nextProfile.unlockedStage);
        }
        const muted = localStorage.getItem("prism-break-sound") === "off";
        const storedLanguage = localStorage.getItem("prism-break-language-v1");
        if (storedLanguage === "he" || storedLanguage === "en") { languageRef.current = storedLanguage; setLanguage(storedLanguage); }
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

  useEffect(() => {
    languageRef.current = language;
    try { localStorage.setItem("prism-break-language-v1", language); } catch { /* storage is optional */ }
  }, [language]);

  const loadLeaderboard = useCallback(async (config: RunConfig) => {
    if (isStaticBuild()) {
      setLeaderboard([]);
      setLeaderboardError("GLOBAL LEADERBOARD UNAVAILABLE — LOCAL RECORDS STILL SAVE");
      setLeaderboardLoading(false);
      return;
    }
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
    if (menuView === "prime" || menuView === "threat" || menuView === "powers" || menuView === "shop" || menuView === "achievements") {
      return;
    }
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
      const primeMission = config.primeId ? PRIME_MISSIONS.find((mission) => mission.id === config.primeId) : undefined;
      const earnedShards = ui.coinsCollected + calculateShardReward(config.runMode, {
        victory: ui.mode === "victory", score: ui.score,
        targetScore: config.runMode === "campaign" ? CAMPAIGN_STAGES[config.stageId]?.scoreTargets[1] ?? 50000 : Math.max(30000, config.objectiveTarget * 700),
        bestCombo: ui.bestCombo, hitsTaken: game.hitsTaken, elapsed: game.elapsed, duration: config.duration, absorbed: ui.absorbed,
      }, primeMission, config.threatLevel);
      setResultStars(stars);
      setResultShards(earnedShards);
      const previous = profile;
      const key = profileRecordKey(config.runMode, config.stageId, config.difficulty, config.dailyKey);
      const stageKey = `${config.stageId}:${config.difficulty}`;
      const campaignClear = config.runMode === "campaign" && ui.mode === "victory";
      const threatClear = config.runMode === "threat" && ui.mode === "victory";
      const primeClear = config.runMode === "prime" && ui.mode === "victory" && Boolean(config.primeId);
      const completedWorld = campaignClear && CAMPAIGN_STAGES[config.stageId]?.objective === "boss" && campaignWorldForStage(config.stageId).end === config.stageId
        ? campaignWorldForStage(config.stageId)
        : null;
      const earnedWorldUpgrade = completedWorld ? WORLD_CORE_UPGRADES[completedWorld.id] : null;
      const nextWorldCoreUpgrades = earnedWorldUpgrade && !previous.worldCoreUpgrades.includes(earnedWorldUpgrade.id)
        ? [...previous.worldCoreUpgrades, earnedWorldUpgrade.id]
        : previous.worldCoreUpgrades;
      const nextStars = campaignClear ? { ...previous.stars, [stageKey]: Math.max(previous.stars[stageKey] ?? 0, stars) } : previous.stars;
      const nextPrimeTimes = primeClear && config.primeId ? { ...previous.primeBestTimes, [config.primeId]: Math.min(previous.primeBestTimes[config.primeId] ?? Number.POSITIVE_INFINITY, game.elapsed) } : previous.primeBestTimes;
      const nextHighestThreat = threatClear ? Math.max(previous.highestThreat, config.threatLevel) : previous.highestThreat;
      const nextRankXp = previous.rankXp + (ui.mode === "victory" ? 2 : 1);
      const nextRank = Math.max(previous.rank, calculatePlayerRank(Object.values(nextStars).reduce((total, value) => total + value, 0), nextHighestThreat, Object.keys(nextPrimeTimes).length, nextRankXp));
      const achievementEvaluation = recordAchievementRun(previous.achievements, {
        mode: config.runMode,
        victory: ui.mode === "victory",
        stageId: config.stageId,
        primeId: config.primeId,
        threatLevel: config.threatLevel,
        kills: ui.kills,
        eliteKills: ui.eliteKills,
        absorbed: ui.absorbed,
        perfectAbsorbs: ui.perfectAbsorbs,
        refractionKills: ui.refractionKills,
        bestCombo: ui.bestCombo,
        hitsTaken: game.hitsTaken,
        shardsEarned: earnedShards,
      });
      const next: PlayerProfile = {
        saveVersion: PROGRESSION_BALANCE.saveVersion,
        unlockedStage: campaignClear ? Math.max(previous.unlockedStage, Math.min(CAMPAIGN_STAGES.length - 1, config.stageId + 1)) : previous.unlockedStage,
        overdriveUnlocked: previous.overdriveUnlocked || (campaignClear && config.stageId >= 10),
        stars: nextStars,
        bestScores: { ...previous.bestScores, [key]: Math.max(previous.bestScores[key] ?? 0, ui.score) },
        prismShards: previous.prismShards + earnedShards + achievementEvaluation.reward,
        healthBonus: previous.healthBonus,
        unlockedPrimeIds: previous.unlockedPrimeIds,
        primeBestTimes: nextPrimeTimes,
        highestThreat: nextHighestThreat,
        threatBestScore: config.runMode === "threat" ? Math.max(previous.threatBestScore, ui.score) : previous.threatBestScore,
        threatBestClearTime: threatClear ? Math.min(previous.threatBestClearTime ?? Number.POSITIVE_INFINITY, game.elapsed) : previous.threatBestClearTime,
        highestThreatAvailable: threatClear ? Math.max(previous.highestThreatAvailable, maxThreatAttempt(nextHighestThreat)) : previous.highestThreatAvailable,
        rank: nextRank,
        rankXp: nextRankXp,
        totalRuns: previous.totalRuns + 1,
        successfulRuns: previous.successfulRuns + (ui.mode === "victory" ? 1 : 0),
        worldCoreUpgrades: nextWorldCoreUpgrades,
        achievements: achievementEvaluation.save,
      };
      setResultShards(earnedShards + achievementEvaluation.reward);
      setResultAchievements(achievementEvaluation.newlyUnlocked);
      setResultWorldUpgrade(earnedWorldUpgrade && !previous.worldCoreUpgrades.includes(earnedWorldUpgrade.id) ? earnedWorldUpgrade : null);
      setProfile(next);
      try { localStorage.setItem("prism-break-profile-v2", JSON.stringify(next)); } catch { /* optional */ }
    }

    if (scoreSubmittedRef.current) return;
    scoreSubmittedRef.current = true;
    if (config.runMode === "prime" || config.runMode === "threat") {
      setLeaderboardError("LOCAL RANKING READY // ONLINE BOARD FUTURE HOOK");
      return;
    }
    if (isStaticBuild()) {
      setLeaderboardError("SCORE SAVED LOCALLY — GLOBAL UPLINK UNAVAILABLE");
      return;
    }
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
  }, [loadLeaderboard, profile, ui.absorbed, ui.bestCombo, ui.coinsCollected, ui.eliteKills, ui.kills, ui.mode, ui.perfectAbsorbs, ui.refractionKills, ui.score]);

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
      if (isEditableTarget(eventValue.target)) return;
      const input = inputRef.current;
      const capture = bindingCaptureRef.current;
      if (capture) {
        eventValue.preventDefault();
        if (eventValue.code !== "Escape" && eventValue.code !== "KeyB") {
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
      if (isKeyboardControlTarget(eventValue.target)) return;
      input.keys[eventValue.code] = true;
      const game = gameRef.current;
      // B is a presentation toggle, so it should remain available while any
      // in-game screen is open (playing, paused, or an upgrade choice). It is
      // intentionally ignored only on the main menu and inside text inputs.
      if (!eventValue.repeat && eventValue.code === "KeyB" && game.mode !== "menu") {
        eventValue.preventDefault();
        setMinimalHud((value) => !value);
        return;
      }
      if (["ArrowUp", "ArrowDown", " "].includes(eventValue.key)) eventValue.preventDefault();
      if (Object.values(input.bindings).includes(eventValue.code) && game.mode !== "menu") eventValue.preventDefault();
      if (game.mode === "playing") {
        if (!eventValue.repeat && eventValue.code === input.bindings.dash) input.dash = true;
        if (!eventValue.repeat && eventValue.code === input.bindings.nova) input.nova = true;
        if (!eventValue.repeat && eventValue.code === input.bindings.smash) input.smash = true;
        if (!eventValue.repeat && eventValue.code === input.bindings.blast) input.blast = true;
      }
      if (!eventValue.repeat && eventValue.code === input.bindings.pause) {
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
      inputRef.current.dash = false;
      inputRef.current.nova = false;
      inputRef.current.smash = false;
      inputRef.current.blast = false;
      inputRef.current.refract = false;
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
          input.refract = true;
        }
        canvas.setPointerCapture(pointer.pointerId);
      } else if (pointer.button === 2) {
        input.nova = true;
      } else if (pointer.button === 0) {
        input.refract = true;
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
    const onWheel = (eventValue: WheelEvent) => {
      if (!canConsumeWheel(eventValue.target, shell, eventValue.deltaX, eventValue.deltaY)) {
        eventValue.preventDefault();
      }
    };
    const onContextMenu = (eventValue: MouseEvent) => {
      if (!isEditableTarget(eventValue.target)) eventValue.preventDefault();
    };
    const nonPassiveListener: AddEventListenerOptions = { passive: false };

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
    shell.addEventListener("wheel", onWheel, nonPassiveListener);
    shell.addEventListener("contextmenu", onContextMenu);
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
      shell.removeEventListener("wheel", onWheel, nonPassiveListener);
      shell.removeEventListener("contextmenu", onContextMenu);
      audioRef.current?.close();
      audioRef.current = null;
    };
  }, [publish]);

  const launchGame = useCallback((runMode: RunMode, stageId = 0, requestedDifficulty: Difficulty = difficulty) => {
    if (runMode === "prime") {
      const mission = PRIME_MISSIONS[stageId];
      if (!mission || !profile.unlockedPrimeIds.includes(mission.id)) return;
    }
    if (runMode === "threat" && (stageId < 1 || stageId > maxThreatAttempt(profile.highestThreat))) return;
    const dailyKey = runMode === "daily" ? currentDailyKey() : null;
    const safeDifficulty = runMode === "daily"
      ? "standard"
      : requestedDifficulty === "overdrive" && !profile.overdriveUnlocked ? "standard" : requestedDifficulty;
    const config = makeRunConfig(runMode, stageId, safeDifficulty, dailyKey);
    const seed = runMode === "daily"
      ? seedFromText(`PRISM-BREAK-DAILY:${dailyKey}`)
      : (((performance.now() * 1000) ^ seedFromText(`${runMode}:${stageId}:${safeDifficulty}`)) >>> 0);
    const game = createGame(seed, "playing", config);
    game.worldCoreUpgrades = profile.worldCoreUpgrades;
    game.player.maxHealth += profile.healthBonus;
    game.player.maxHealth = Math.max(1, game.player.maxHealth - config.scaling.integrityPenalty);
    game.player.health = game.player.maxHealth;
    if (game.worldCoreUpgrades.includes("origin_guard")) game.player.shield = Math.min(2, game.player.shield + 1);
    game.runId = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${seed}`;
    game.reducedMotion = prefsRef.current.reduced;
    gameRef.current = game;
    inputRef.current = createInput(bindingsRef.current);
    resultSavedRef.current = false;
    progressionSavedRef.current = false;
    scoreSubmittedRef.current = false;
    setTutorialSkipped(false);
    setRunRank(null);
    setResultStars(0);
    setResultShards(0);
    setResultAchievements([]);
    setResultWorldUpgrade(null);
    setLeaderboardError("");
    void audioRef.current?.unlock();
    setUi(snapshot(game));
  }, [difficulty, profile]);

  const replayGame = useCallback(() => {
    const config = gameRef.current.config;
    launchGame(config.runMode, config.stageId, config.difficulty);
  }, [launchGame]);

  const returnToMenu = useCallback(() => {
    bindingCaptureRef.current = null;
    setCapturingBinding(null);
    setControlsOpen(false);
    const finishedGame = gameRef.current;
    const previousConfig = finishedGame.config;
    if (!progressionSavedRef.current && finishedGame.coinsCollected > 0) {
      setProfile((previous) => {
        const next = { ...previous, prismShards: previous.prismShards + finishedGame.coinsCollected };
        try { localStorage.setItem("prism-break-profile-v2", JSON.stringify(next)); } catch { /* optional */ }
        return next;
      });
      progressionSavedRef.current = true;
    }
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

  const confirmNovaPurchase = useCallback(() => {
    const game = gameRef.current;
    if (game.mode !== "nova-confirm" || game.coinsCollected < NOVA_COIN_COST || game.charge < 100) return;
    game.coinsCollected -= NOVA_COIN_COST;
    game.mode = "playing";
    inputRef.current.dash = false;
    inputRef.current.nova = false;
    inputRef.current.smash = false;
    inputRef.current.blast = false;
    inputRef.current.refract = false;
    triggerNova(game);
    setUi(snapshot(game));
  }, []);

  const cancelNovaPurchase = useCallback(() => {
    const game = gameRef.current;
    if (game.mode !== "nova-confirm") return;
    game.mode = "playing";
    inputRef.current.dash = false;
    inputRef.current.nova = false;
    inputRef.current.smash = false;
    inputRef.current.blast = false;
    inputRef.current.refract = false;
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

  const tutorialVisible = ui.mode === "playing" && Boolean(ui.guide) && !tutorialSkipped;
  const isEnd = ui.mode === "gameover" || ui.mode === "victory";
  const buyHealthUpgrade = useCallback(() => {
    setProfile((previous) => {
      const cost = PROGRESSION_BALANCE.healthUpgradeCosts[previous.healthBonus];
      if (cost === undefined || previous.prismShards < cost) return previous;
      const next = { ...previous, prismShards: previous.prismShards - cost, healthBonus: previous.healthBonus + 1 };
      try { localStorage.setItem("prism-break-profile-v2", JSON.stringify(next)); } catch { /* optional */ }
      return next;
    });
  }, []);

  const unlockPrimeMission = useCallback((mission: PrimeMissionDefinition, rank: number) => {
    setProfile((previous) => {
      if (!canUnlockPrime(previous.prismShards, rank, mission, previous.unlockedPrimeIds)) return previous;
      const purchase = purchasePrime(previous.prismShards, rank, mission, previous.unlockedPrimeIds);
      const next = { ...previous, prismShards: purchase.shards, unlockedPrimeIds: purchase.unlockedIds };
      try { localStorage.setItem("prism-break-profile-v2", JSON.stringify(next)); } catch { /* optional */ }
      return next;
    });
  }, []);

  const activeStage = CAMPAIGN_STAGES[selectedStage];
  const displayedStage = stageCopy(activeStage, language);
  const activeCampaignWorld = campaignWorldForStage(selectedStage);
  const campaignPageStart = activeCampaignWorld.id === 1 ? 0 : activeCampaignWorld.start + Math.floor((selectedStage - activeCampaignWorld.start) / 10) * 10;
  const campaignPageEnd = activeCampaignWorld.id === 1 ? 10 : Math.min(activeCampaignWorld.end, campaignPageStart + 9);
  const visibleCampaignStages = CAMPAIGN_STAGES.slice(campaignPageStart, campaignPageEnd + 1);
  const campaignPageStarts = activeCampaignWorld.id === 1
    ? [0]
    : Array.from({ length: Math.ceil((activeCampaignWorld.end - activeCampaignWorld.start + 1) / 10) }, (_, index) => activeCampaignWorld.start + index * 10);
  const selectedConfig = menuView === "campaign"
    ? makeRunConfig("campaign", selectedStage, difficulty)
    : menuView === "prime"
      ? makeRunConfig("prime", selectedPrime, "cadet")
      : menuView === "threat"
        ? makeRunConfig("threat", selectedThreat, "standard")
    : menuView === "daily"
      ? makeRunConfig("daily", -1, "standard", currentDailyKey())
      : makeRunConfig("arcade", -1, difficulty);
  const localRecord = profile.bestScores[profileRecordKey(selectedConfig.runMode, selectedConfig.stageId, selectedConfig.difficulty, selectedConfig.dailyKey)] ?? 0;
  const totalStars = Object.values(profile.stars).reduce((total, stars) => total + stars, 0);
  const primeClears = Object.keys(profile.primeBestTimes).length;
  const playerRank = Math.max(profile.rank, calculatePlayerRank(totalStars, profile.highestThreat, primeClears, profile.rankXp));
  const threatCap = Math.max(profile.highestThreatAvailable, maxThreatAttempt(profile.highestThreat));
  const selectedThreatModifiers = selectThreatModifiers(selectedThreat);
  const selectedThreatScaling = threatScaling(selectedThreat, selectedThreatModifiers);
  const selectedThreatYield = threatRewardRange(selectedThreat);
  const achievementCount = profile.achievements.unlockedIds.filter((id) => ACHIEVEMENT_DEFINITIONS.some((achievement) => achievement.id === id)).length;
  const campaignClearedCount = new Set(profile.achievements.campaignClears.filter((stageId) => stageId > 0 && stageId <= 100)).size;
  const activeEffects: Array<{ id: string; glyph: string; name: string; detail: string; className: string }> = [];
  if (ui.doubleShotBuff > 0) activeEffects.push({ id: "double", glyph: "II", name: tr(language, "TWIN BEAM", "קרן כפולה"), detail: `${Math.ceil(ui.doubleShotBuff)}s`, className: "effect-double" });
  if (ui.rapidBuff > 0) activeEffects.push({ id: "rapid", glyph: "R", name: tr(language, "RAPID FIRE", "ירי מהיר"), detail: `${Math.ceil(ui.rapidBuff)}s`, className: "effect-rapid" });
  if (ui.pierceBuff > 0) activeEffects.push({ id: "pierce", glyph: "⇢", name: tr(language, "PHASE NEEDLE", "מחט חודרת"), detail: `${Math.ceil(ui.pierceBuff)}s`, className: "effect-upgrade" });
  if (ui.stasisBuff > 0) activeEffects.push({ id: "stasis", glyph: "◷", name: tr(language, "STASIS BLOOM", "פריחת קיפאון"), detail: `${Math.ceil(ui.stasisBuff)}s`, className: "effect-upgrade" });
  if (ui.resonanceBuff > 0) activeEffects.push({ id: "resonance", glyph: "∞", name: tr(language, "ABSORPTION COIL", "סליל ספיגה"), detail: `${Math.ceil(ui.resonanceBuff)}s`, className: "effect-upgrade" });
  if (ui.prismBreakTime > 0) activeEffects.push({ id: "prism-break", glyph: "△", name: "PRISM BREAK", detail: `${ui.prismBreakTime.toFixed(1)}s`, className: "effect-prism-break" });
  if (ui.shield > 0) activeEffects.push({ id: "shield", glyph: "◇", name: tr(language, "PRISM SHIELD", "מגן פריזמה"), detail: `${ui.shield.toFixed(1)} ${tr(language, "CHARGE", "טעינה")}`, className: "effect-shield" });
  if (ui.allyCount > 0) activeEffects.push({ id: "allies", glyph: "A", name: tr(language, "ALLIED WING", "כנף בעלות ברית"), detail: `×${ui.allyCount}`, className: "effect-allies" });
  for (const [id, tier] of Object.entries(ui.upgrades) as [UpgradeId, number][]) {
    if (tier <= 0) continue;
    const upgrade = upgradeCopy(id, language);
    activeEffects.push({ id: `upgrade-${id}`, glyph: upgrade.glyph, name: upgrade.name, detail: `TIER ${tier}`, className: "effect-upgrade" });
  }
  const difficultySelector = (
    <div className="difficulty-selector" aria-label="Difficulty">
      {(Object.keys(DIFFICULTIES) as Difficulty[]).map((id) => {
        const locked = id === "overdrive" && !profile.overdriveUnlocked;
        return (
          <button key={id} className={difficulty === id ? "is-selected" : ""} disabled={locked} onClick={() => setDifficulty(id)}>
            <span>{difficultyName(id, language)}</span>
            <small>{locked ? tr(language, "CLEAR STAGE 10", "סיים שלב 10") : id === "cadet" ? tr(language, "RECOMMENDED", "מומלץ") : `${DIFFICULTIES[id].scoreMultiplier.toFixed(2)}× ${tr(language, "SCORE", "ניקוד")}`}</small>
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
    <main ref={shellRef} dir={language === "he" ? "rtl" : "ltr"} className={`game-shell prism-game ${highContrast ? "is-high-contrast" : ""} ${ui.mode === "playing" ? "is-playing" : ""} ${minimalHud && ui.mode !== "menu" ? "is-minimal-ui" : ""} ${language === "he" ? "is-hebrew" : ""}`}>
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
              <button className={reducedMotion ? "is-active" : ""} onClick={() => setReducedMotion((value) => !value)} aria-pressed={reducedMotion}>{tr(language, "MOTION", "תנועה")}</button>
              <button onClick={requestFullscreen}>{tr(language, "FULLSCREEN", "מסך מלא")}</button>
              <button className="coin-balance" onClick={() => setMenuView("shop")}>◇ {profile.prismShards}</button>
              <button onClick={() => setSettingsOpen(true)}>{tr(language, "SETTINGS", "הגדרות")}</button>
            </div>
          </header>

          {menuView === "home" ? (
            <div className="menu-content home-content">
              <div className="menu-kicker"><span>{"CAMPAIGN // GLOBAL COMPETITION"}</span><i /><span>BUILD 02</span></div>
              <h1 className="game-title"><span>PRISM</span><span>BREAK</span></h1>
              <p className="game-tagline">{tr(language, "Absorb enemy bullets, combine their spectrum, and refract them back. Four worlds, one hundred stages, and an endless threat protocol.", "ספוג את קליעי האויב, שלב את הספקטרום שלהם ושבור אותם בחזרה. ארבעה עולמות, מאה שלבים ופרוטוקול איום אינסופי.")}</p>
              <div className="menu-actions">
                <button className="launch-button" onClick={() => { setSelectedStage(profile.unlockedStage); setMenuView("campaign"); }}>
                  <span><small>{profile.unlockedStage === 0 ? tr(language, "BEGIN WITH CALIBRATION", "התחל בכיול") : `${tr(language, "CONTINUE AT STAGE", "המשך בשלב")} ${String(profile.unlockedStage).padStart(2, "0")}`}</small>{tr(language, "ENTER CAMPAIGN", "כניסה למערכה")}</span>
                  <b>→</b>
                </button>
                <div className="best-score"><small>LIFETIME BEST</small><strong>{formatScore(bestScore)}</strong></div>
              </div>
              <div className="mode-card-grid" aria-label="Game modes">
                <button onClick={() => setMenuView("campaign")}><small>{tr(language, "01 // PROGRESSION", "01 // התקדמות")}</small><strong>{tr(language, "CAMPAIGN", "מערכה")}</strong><span>{campaignClearedCount}/100 {tr(language, "STAGES CLEARED", "שלבים הושלמו")} · {totalStars} {tr(language, "PRISM STARS", "כוכבים")}</span></button>
                <button onClick={() => setMenuView("daily")}><small>{tr(language, "02 // SAME SEED", "02 // זרע זהה")}</small><strong>{tr(language, "DAILY RIFT", "קרע יומי")}</strong><span>{currentDailyKey()} · {tr(language, "GLOBAL BOARD", "דירוג עולמי")}</span></button>
                <button onClick={() => setMenuView("arcade")}><small>{tr(language, "03 // ENDLESS MASTERY", "03 // שליטה אינסופית")}</small><strong>{tr(language, "ARCADE RIFT", "קרע ארקייד")}</strong><span>150 {tr(language, "SEC", "שניות")} · {tr(language, "FULL APERTURE RUN", "ריצת מפתח מלאה")}</span></button>
                <button onClick={() => setMenuView("powers")}><small>{tr(language, "04 // FIELD GUIDE", "04 // מדריך")}</small><strong>{tr(language, "POWER GUIDE", "מדריך כוחות")}</strong><span>{tr(language, "SEE WHAT EVERY SYMBOL DOES", "ראה מה עושה כל סמל")}</span></button>
                <button onClick={() => setMenuView("shop")}><small>{tr(language, "05 // PERMANENT UPGRADES", "05 // שדרוגים קבועים")}</small><strong>{tr(language, "PRISM SHOP", "חנות הפריזמה")}</strong><span>◇ {profile.prismShards} · {tr(language, "STARTING INTEGRITY", "חיים התחלתיים")} +{profile.healthBonus}</span></button>
                <button onClick={() => setMenuView("prime")}><small>{tr(language, "06 // POWER BONUS STAGES", "06 // שלבי בונוס עוצמתיים")}</small><strong>{tr(language, "PRIME BONUS", "בונוס PRIME")}</strong><span>{primeClears}/3 {tr(language, "CLEARED", "הושלמו")} · {tr(language, "RANK", "דרגה")} {playerRank}</span></button>
                <button onClick={() => setMenuView("threat")}><small>{tr(language, "07 // ENDLESS PROGRESSION", "07 // התקדמות אינסופית")}</small><strong>THREAT LEVEL</strong><span>{tr(language, "HIGHEST CLEARED", "השיא שהושלם")} {profile.highestThreat} · {tr(language, "AVAILABLE", "זמין")} {threatCap}</span></button>
                <button onClick={() => setMenuView("achievements")}><small>{tr(language, "08 // MILESTONES", "08 // אבני דרך")}</small><strong>{tr(language, "ACHIEVEMENTS", "הישגים")}</strong><span>{achievementCount}/{ACHIEVEMENT_DEFINITIONS.length} {tr(language, "UNLOCKED", "נפתחו")} · ◆ {profile.achievements.stats.shards}</span></button>
              </div>
            </div>
          ) : (
            <div className="mode-menu">
              <div className="mode-menu-heading">
                <button className="back-button" onClick={() => setMenuView("home")}>← TITLE</button>
                <div><small>{menuView === "campaign" ? tr(language, "PRISM PROTOCOL // FOUR WORLDS // 100 STAGES", "פרוטוקול פריזמה // ארבעה עולמות // 100 שלבים") : menuView === "daily" ? tr(language, "SYNCHRONIZED GLOBAL EVENT", "אירוע עולמי מסונכרן") : menuView === "powers" ? tr(language, "COMPLETE FIELD GUIDE", "מדריך שדה מלא") : menuView === "shop" ? tr(language, "PERMANENT SHIP UPGRADES", "שדרוגים קבועים לחללית") : menuView === "prime" ? tr(language, "OPTIONAL POWER BONUS OPERATIONS", "מבצעי בונוס עוצמתיים לבחירה") : menuView === "threat" ? tr(language, "ENDLESS RIFT PROTOCOL", "פרוטוקול קרע אינסופי") : menuView === "achievements" ? tr(language, "PERMANENT MILESTONE ARCHIVE", "ארכיון הישגים קבוע") : tr(language, "UNBOUNDED SCORE ATTACK", "מתקפת ניקוד ללא גבול")}</small><h2>{menuView === "campaign" ? tr(language, "CAMPAIGN", "מערכה") : menuView === "daily" ? tr(language, "DAILY RIFT", "קרע יומי") : menuView === "powers" ? tr(language, "POWER GUIDE", "מדריך כוחות") : menuView === "shop" ? tr(language, "PRISM SHOP", "חנות הפריזמה") : menuView === "prime" ? tr(language, "PRIME BONUS MISSIONS", "משימות בונוס PRIME") : menuView === "threat" ? "THREAT LEVEL" : menuView === "achievements" ? tr(language, "ACHIEVEMENTS", "הישגים") : tr(language, "ARCADE RIFT", "קרע ארקייד")}</h2></div>
                <div className="profile-summary"><span>PRISM SHARDS</span><strong>◇ {profile.prismShards}</strong><small>{tr(language, "RANK", "דרגה")} {playerRank} · {tr(language, "THREAT", "איום")} {profile.highestThreat}</small></div>
              </div>

              {menuView === "campaign" && (
                <>
                  {difficultySelector}
                  <div className="campaign-worlds" aria-label="Campaign worlds">
                    {CAMPAIGN_WORLDS.map((world) => {
                      const locked = world.start > profile.unlockedStage;
                      const selected = world.id === activeCampaignWorld.id;
                      const worldUpgrade = WORLD_CORE_UPGRADES[world.id];
                      const upgradeUnlocked = profile.worldCoreUpgrades.includes(worldUpgrade.id);
                      const upgradeCopy = language === "he" ? worldUpgrade.he : worldUpgrade.en;
                      return <button
                        key={world.id}
                        disabled={locked}
                        className={selected ? "is-selected" : ""}
                        onClick={() => setSelectedStage(clamp(profile.unlockedStage, world.start, world.end))}
                      >
                        <small>{tr(language, `WORLD ${world.id}`, `עולם ${world.id}`)}</small>
                        <strong>{language === "he" ? world.hebrewName : world.name}</strong>
                        <span>{String(world.start).padStart(2, "0")}—{String(world.end).padStart(2, "0")}</span>
                        <em>{worldUpgrade.glyph} {upgradeUnlocked ? upgradeCopy.name : tr(language, "CORE REWARD", "פרס ליבה")}</em>
                      </button>;
                    })}
                  </div>
                  <div className="campaign-sectors" aria-label="World sectors">
                    {campaignPageStarts.map((pageStart) => {
                      const pageEnd = Math.min(activeCampaignWorld.end, pageStart + 9);
                      const locked = pageStart > profile.unlockedStage;
                      return <button key={pageStart} disabled={locked} className={pageStart === campaignPageStart ? "is-selected" : ""} onClick={() => setSelectedStage(Math.min(profile.unlockedStage, pageEnd))}>
                        {String(pageStart).padStart(2, "0")}—{String(pageEnd).padStart(2, "0")}
                      </button>;
                    })}
                  </div>
                  <div className={`stage-path ${visibleCampaignStages.length === 11 ? "has-eleven" : ""}`} aria-label="Campaign stages">
                    {visibleCampaignStages.map((stage) => {
                      const locked = stage.id > profile.unlockedStage;
                      const stars = profile.stars[`${stage.id}:${difficulty}`] ?? 0;
                      const stageLabel = stageCopy(stage, language);
                      return (
                        <button key={stage.id} disabled={locked} className={`${selectedStage === stage.id ? "is-selected" : ""} ${locked ? "is-locked" : ""}`} onClick={() => setSelectedStage(stage.id)}>
                          <span>{locked ? tr(language, "LOCK", "נעול") : stage.code}</span><i /><small>{stageLabel.name}</small><b>{locked ? "◇◇◇" : `${"◆".repeat(stars)}${"◇".repeat(3 - stars)}`}</b>
                        </button>
                      );
                    })}
                  </div>
                  <div className="mission-layout">
                    <section className="mission-brief">
                      <p>{`${tr(language, "STAGE", "שלב")} ${displayedStage.code} // ${displayedStage.subtitle}`}</p>
                      <h3>{displayedStage.name}</h3>
                      <span>{displayedStage.briefing}</span>
                      <div className="mission-specs">
                        <div><small>{tr(language, "PRIMARY OBJECTIVE", "מטרה ראשית")}</small><strong>{activeStage.objective === "survive" ? tr(language, `SURVIVE ${activeStage.target}s`, `שרוד ${activeStage.target} שניות`) : activeStage.objective === "kills" ? tr(language, `DESTROY ${activeStage.target}`, `חסל ${activeStage.target} אויבים`) : activeStage.objective === "absorb" ? tr(language, `ABSORB ${activeStage.target}`, `ספוג ${activeStage.target} יריות`) : activeStage.objective === "elites" ? tr(language, `ELIMINATE ${activeStage.target} ELITES`, `חסל ${activeStage.target} אליטות`) : tr(language, "BREAK THE WORLD CORE", "שבור את ליבת העולם")}</strong></div>
                        <div><small>{tr(language, "THREAT PROFILE", "פרופיל איום")}</small><strong>{activeStage.roster.length} {tr(language, "SIGNATURES", "סוגי אויב")}</strong></div>
                        <div><small>{tr(language, "MASTERY TARGETS", "יעדי שליטה")}</small><strong>{activeStage.scoreTargets.map((target) => Math.round(target / 1000) + "K").join(" / ")}</strong></div>
                      </div>
                      {(activeStage.modifiers?.length ?? 0) > 0 && <div className="modifier-tags" aria-label={tr(language, "Stage challenges", "אתגרי השלב")}>{activeStage.modifiers?.map((modifier) => <span key={modifier}>{modifierCopy(modifier, language)}</span>)}</div>}
                      <p className="difficulty-copy">{language === "he" ? ({ cadet: "מגנים נדיבים, אש איטית ודאש מהיר.", standard: "חוויית PRISM BREAK המלאה.", overdrive: "דפוסים בלתי פוסקים וניקוד מוגבר." } as const)[difficulty] : DIFFICULTIES[difficulty].description}</p>
                      <button className="mission-launch" onClick={() => launchGame("campaign", selectedStage, difficulty)}><span><small>{`${tr(language, "DEPLOY", "צא למשימה")} // ${difficultyName(difficulty, language)}`}</small>{tr(language, "START STAGE", "התחל שלב")} {activeStage.code}</span><b>→</b></button>
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

              {menuView === "prime" && (
                <section className="progression-panel prime-panel">
                  <div className="progression-intro"><p>{tr(language, "PRIME BONUS MISSIONS", "משימות בונוס PRIME")}</p><h3>{tr(language, "PAY ONCE. POWER UP. HAVE FUN.", "שלם פעם אחת. התחזק. ותיהנה.")}</h3><span>{tr(language, "Short, generous bonus stages with powerful full-run boosts, frequent drops and lighter enemies. Extreme difficulty belongs in Threat Level.", "שלבי בונוס קצרים ונדיבים עם כוחות חזקים לכל השלב, דרופים תכופים ואויבים חלשים יותר. הקושי הקיצוני נשאר במצב רמת איום.")}</span></div>
                  <div className="prime-grid">
                    {PRIME_MISSIONS.map((mission, index) => {
                      const unlocked = profile.unlockedPrimeIds.includes(mission.id);
                      const rankReady = playerRank >= mission.requiredRank;
                      const canBuy = canUnlockPrime(profile.prismShards, playerRank, mission, profile.unlockedPrimeIds);
                      return <article
                        key={mission.id}
                        className={`${selectedPrime === index ? "is-selected" : ""} ${unlocked ? "is-unlocked" : ""}`}
                        onFocusCapture={() => setSelectedPrime(index)}
                      >
                        <small>{mission.code} // {tr(language, "BONUS", "בונוס")}</small><h4>{language === "he" ? mission.hebrewName : mission.name}</h4>
                        <p className="prime-description">{language === "he" ? mission.hebrewDescription : mission.description}</p>
                        <p className="prime-objective"><b>{tr(language, "FUN OBJECTIVE", "מטרת הבונוס")}</b>{primeObjectiveCopy(mission, language)}</p>
                        <div className="modifier-tags prime-bonus-tags">{mission.bonuses.map((id) => <span key={id}>{primeBonusCopy(id, language)}</span>)}</div>
                        <dl><div><dt>{tr(language, "REQUIRED RANK", "דרגה נדרשת")}</dt><dd>{mission.requiredRank}</dd></div><div><dt>{tr(language, "POTENTIAL YIELD", "תגמול אפשרי")}</dt><dd>◇ {mission.reward[0]}–{mission.reward[1]}</dd></div></dl>
                        {unlocked ? <button onClick={(eventValue) => { eventValue.stopPropagation(); launchGame("prime", index, "cadet"); }}>{tr(language, "START BONUS STAGE", "התחל שלב בונוס")}</button> : <button disabled={!canBuy} onClick={(eventValue) => { eventValue.stopPropagation(); unlockPrimeMission(mission, playerRank); }}>{rankReady ? `◇ ${mission.unlockCost} // ${tr(language, "UNLOCK ONCE", "פתיחה חד־פעמית")}` : `${tr(language, "RANK", "דרגה")} ${mission.requiredRank}`}</button>}
                      </article>;
                    })}
                  </div>
                  <p className="nearby-goal">{tr(language, "CURRENT RANK", "דרגה נוכחית")}: {playerRank} · PRISM SHARDS: ◇ {profile.prismShards}</p>
                </section>
              )}

              {menuView === "threat" && (
                <section className="progression-panel threat-panel">
                  <div className="progression-intro"><p>THREAT LEVEL</p><h3>{tr(language, "HOW FAR CAN YOU PUSH THE RIFT?", "כמה רחוק תוכל לדחוף את הקרע?")}</h3><span>{tr(language, "Levels scale forever with soft stat curves and increasingly complex modifier combinations.", "הרמות ממשיכות ללא סוף עם עקומות נתונים רכות ושילובי משנים מורכבים יותר.")}</span></div>
                  <div className="threat-console">
                    <div className="threat-selector">
                      <label htmlFor="threat-level-input">{tr(language, "SELECTED THREAT", "רמת איום נבחרת")}</label>
                      <input id="threat-level-input" type="number" min="1" max={threatCap} value={selectedThreat} onChange={(eventValue) => setSelectedThreat(clamp(Math.round(Number(eventValue.target.value) || 1), 1, threatCap))} />
                      <input type="range" min="1" max={threatCap} value={selectedThreat} onChange={(eventValue) => setSelectedThreat(Number(eventValue.target.value))} />
                      <div>{[1, 5, 10, profile.highestThreat, threatCap].filter((value, index, values) => value >= 1 && values.indexOf(value) === index).map((value) => <button key={value} onClick={() => setSelectedThreat(value)}>{value}</button>)}</div>
                    </div>
                    <div className="risk-profile">
                      <div><small>{tr(language, "EXPECTED DANGER", "סכנה צפויה")}</small><strong>{selectedThreat <= 10 ? tr(language, "VERY EASY", "קל מאוד") : selectedThreat <= 25 ? tr(language, "MEDIUM", "בינוני") : selectedThreat <= 50 ? tr(language, "GETTING HARD", "מתחיל להיות קשה") : selectedThreat <= 100 ? tr(language, "HARD", "קשה") : tr(language, "MASTER THREAT", "איום למומחים")}</strong></div>
                      <div><small>{tr(language, "POTENTIAL YIELD", "תגמול אפשרי")}</small><strong>◇ {selectedThreatYield[0]}–{selectedThreatYield[1]}</strong></div>
                      <div><small>{tr(language, "HIGHEST CLEARED", "השיא שהושלם")}</small><strong>{profile.highestThreat}</strong></div>
                      <div><small>{tr(language, "AVAILABLE RANGE", "טווח זמין")}</small><strong>1–{threatCap}</strong></div>
                    </div>
                    <div className="threat-modifiers"><small>{tr(language, "ACTIVE MODIFIERS", "משנים פעילים")}</small><div>{selectedThreatModifiers.length ? selectedThreatModifiers.map((id) => <span key={id}>{modifierCopy(id, language)}</span>) : <span>{tr(language, "NONE // LEARNING BAND", "ללא // אזור למידה")}</span>}</div></div>
                    <div className="scaling-readout"><span>HP ×{selectedThreatScaling.enemyHealth.toFixed(2)}</span><span>SPD ×{selectedThreatScaling.enemySpeed.toFixed(2)}</span><span>FIRE ×{selectedThreatScaling.projectileSpeed.toFixed(2)}</span><span>ELITE {Math.round(selectedThreatScaling.eliteChance * 100)}%</span></div>
                    <button className="mission-launch" onClick={() => launchGame("threat", selectedThreat, "standard")}><span><small>{tr(language, "RISK PROFILE ACCEPTED", "פרופיל הסיכון אושר")}</small>{tr(language, "ENTER THREAT LEVEL", "התחל רמת איום")} {selectedThreat}</span><b>→</b></button>
                  </div>
                  <p className="nearby-goal">{profile.highestThreat > 0 ? `${tr(language, "Clear", "השלם")} ${Math.min(threatCap, profile.highestThreat + Math.max(1, Math.ceil(profile.highestThreat * .2)))} ${tr(language, "to expand the next range", "כדי להרחיב את הטווח הבא")}` : tr(language, "Clear your first Threat run to expand the available range.", "השלם את ריצת האיום הראשונה כדי להרחיב את הטווח הזמין.")}</p>
                </section>
              )}

              {menuView === "powers" && (
                <section className="power-guide" aria-label="Power guide">
                  <p>{tr(language, "PRISM REFRACTION ENGINE", "מנוע שבירת הפריזמה")}</p>
                  <h3>{tr(language, "ENEMY BULLETS\nBECOME YOUR WEAPONS.", "קליעי האויב\nהופכים לנשק שלך.")}</h3>
                  <p className="guide-callout">{tr(language, "Dash through a colored projectile to store its spectrum. Dash just before impact for PERFECT ABSORB, then press Q or left click to refract the stored energy. Fill the entire Prism and refract to enter PRISM BREAK.", "בצע דאש דרך קליע צבעוני כדי לאגור את הספקטרום שלו. דאש ממש לפני הפגיעה יוצר ספיגה מושלמת; לאחר מכן לחץ Q או לחיצה שמאלית כדי לשבור ולהחזיר את האנרגיה. מלא את הפריזמה ושבור כדי להיכנס למצב שבירת פריזמה.")}</p>
                  <button type="button" className="guide-jump" onClick={() => document.getElementById("enemy-archive")?.scrollIntoView({ behavior: "smooth", block: "start" })}>
                    {tr(language, "VIEW HOSTILE ARCHIVE ↓", "הצג ארכיון אויבים ↓")}
                  </button>
                  <div className="spectrum-guide-grid">
                    {SPECTRUM_IDS.map((id) => {
                      const info = spectrumCopy(id, language);
                      return <article key={id} style={{ "--drop-color": info.color } as React.CSSProperties}>
                        <b>{info.glyph}</b><strong>{info.name}</strong><p>{info.behavior}</p>
                      </article>;
                    })}
                  </div>
                  <p className="guide-section-title">{tr(language, "SPECTRUM COMBINATIONS", "שילובי ספקטרום")}</p>
                  <div className="combo-guide-grid">
                    {(language === "he" ? [{ colors: "תכלת + סגול", name: "רומח פריזמה", effect: "שבירה חודרת של שלושה קליעים." }, { colors: "זהב + ארגמן", name: "מפל שמש", effect: "תגובת שרשרת מתפוצצת." }, { colors: "תכלת + זהב", name: "קרן קשת", effect: "חודרת וקופצת דרך מבנים." }, { colors: "סגול + ארגמן", name: "פריחת ריק", effect: "פיצול רחב עם הדף." }, { colors: "כל הארבעה", name: "ספקטרום מלא", effect: "השבירה המשולבת החזקה ביותר." }] : [{ colors: "CYAN + VIOLET", name: "PRISM LANCE", effect: "Piercing three-shot refraction." }, { colors: "GOLD + CRIMSON", name: "SOLAR CASCADE", effect: "Explosive chain reaction." }, { colors: "CYAN + GOLD", name: "ARC BEAM", effect: "Pierces and chains through formations." }, { colors: "VIOLET + CRIMSON", name: "VOID BLOOM", effect: "Wide splitting burst." }, { colors: "ALL FOUR", name: "FULL SPECTRUM", effect: "The strongest combined refraction." }]).map((combo) => <article key={combo.name}><small>{combo.colors}</small><strong>{combo.name}</strong><p>{combo.effect}</p></article>)}
                  </div>
                  <p>{tr(language, "PRISM ARMORY", "מחסן הפריזמה")}</p>
                  <h3>{tr(language, "EVERY SYMBOL.\nONE CLEAR EFFECT.", "כל סמל.\nכוח ברור.")}</h3>
                  <p className="guide-callout">{tr(language, "Special powers are unlocked only by rare Prism Core drops.", "כוחות מיוחדים נפתחים רק באמצעות דרופ נדיר: ליבת פריזמה.")}</p>
                  <div>
                    {(Object.keys(UPGRADES) as UpgradeId[]).map((id) => {
                      const info = upgradeCopy(id, language);
                      return <article key={id}><span className={`power-preview preview-${id}`} aria-hidden="true"><i /><i /><i /></span><b>{info.glyph}</b><strong>{info.name}</strong><p>{info.description}</p></article>;
                    })}
                  </div>
                  <p className="guide-section-title">{tr(language, "ENEMY DROPS", "דרופים מאויבים")}</p>
                  <h3>{tr(language, "PICK IT UP.\nCHANGE THE FIGHT.", "אסוף אותו.\nשנה את הקרב.")}</h3>
                  <div className="drop-guide-grid">
                    {(Object.keys(DROP_INFO) as DropKind[]).map((id) => {
                      const drop = DROP_INFO[id];
                      const detail = DROP_GUIDE[id];
                      const cell = dropIconCell(id);
                      return <article key={id} style={{ "--drop-color": drop.color } as React.CSSProperties}><b
                        className="drop-art"
                        aria-label={language === "he" ? detail.he : detail.en}
                        style={{
                          backgroundImage: `url(${dropIconSrc})`,
                          backgroundSize: `${DROP_ICON_COLUMNS * 100}% ${DROP_ICON_ROWS * 100}%`,
                          backgroundPosition: `${cell.column * (100 / (DROP_ICON_COLUMNS - 1))}% ${cell.row * (100 / (DROP_ICON_ROWS - 1))}%`,
                        }}
                      >{drop.glyph}</b><strong>{language === "he" ? detail.he : detail.en}</strong><p>{language === "he" ? detail.heDetail : detail.enDetail}</p></article>;
                    })}
                  </div>
                </section>
              )}

              {menuView === "achievements" && (
                <section className="achievements-panel" aria-label={tr(language, "Achievements", "הישגים")}>
                  <div className="achievement-summary">
                    <div><small>{tr(language, "PRISM ARCHIVE", "ארכיון הפריזמה")}</small><h3>{tr(language, "EVERY RUN LEAVES A SIGNAL.", "כל ריצה משאירה אות.")}</h3></div>
                    <strong>{achievementCount}<span>/{ACHIEVEMENT_DEFINITIONS.length}</span></strong>
                  </div>
                  <div className="achievement-grid">
                    {ACHIEVEMENT_DEFINITIONS.map((achievement) => {
                      const progress = achievementProgress(profile.achievements, achievement);
                      const copy = language === "he" ? achievement.he : achievement.en;
                      return <article key={achievement.id} className={`${progress.unlocked ? "is-unlocked" : ""} tier-${achievement.tier}`}>
                        <b>{achievement.icon}</b>
                        <div><small>{achievementMetricCopy(achievement.metric, language)}{" // "}{achievement.tier.toUpperCase()}</small><strong>{copy.title}</strong><p>{copy.description}</p></div>
                        <span>◆ {achievement.reward}</span>
                        <i><em style={{ width: `${progress.ratio * 100}%` }} /></i>
                        <footer>{progress.unlocked ? tr(language, "UNLOCKED", "נפתח") : `${Math.floor(progress.current).toLocaleString()} / ${achievement.goal.toLocaleString()}`}</footer>
                      </article>;
                    })}
                  </div>
                  <p className="guide-section-title">{tr(language, "HOSTILE ARCHIVE", "ארכיון אויבים")}</p>
                  {/*
ONE TRUE SHAPE.", "כל חתימה.
צורה אמיתית.")}</h3>
                  <p className="guide-callout">{tr(language, "These previews use the same live renderer as the arena, so every silhouette, ring and spectrum color matches the real enemy.", "התצוגות משתמשות באותו מנוע ציור של הזירה, ולכן כל צורה, טבעת וצבע ספקטרום תואמים לאויב האמיתי.")}</p>
                  */}
                  <h3>{tr(language, "EVERY SIGNATURE.\\nONE TRUE SHAPE.", "כל חתימה.\\nצורה אמיתית.")}</h3>
                  <p className="guide-callout">{tr(language, "These previews use the same live renderer as the arena, so every silhouette, ring and spectrum color matches the real enemy.", "התצוגות משתמשות באותו מנוע ציור של הזירה, ולכן כל צורה, טבעת וצבע ספקטרום תואמים לאויב האמיתי.")}</p>
                  <div id="enemy-archive" className="enemy-guide-grid">
                    {ENEMY_GUIDE.map((enemy) => (
                      <article key={enemy.kind} style={{ "--drop-color": ENEMY_COLOR[enemy.kind] } as React.CSSProperties}>
                        <EnemyPreview kind={enemy.kind} />
                        <strong>{language === "he" ? enemy.he : enemy.en}</strong>
                        <p>{language === "he" ? enemy.heDetail : enemy.enDetail}</p>
                      </article>
                    ))}
                  </div>
                </section>
              )}

              {menuView === "shop" && (
                <section className="prism-shop" aria-label={tr(language, "Prism shop", "חנות הפריזמה")}>
                  <div className="shop-balance"><small>PRISM SHARDS</small><strong>◇ {profile.prismShards}</strong></div>
                  <div className="shop-item">
                    <span className="shop-heart" aria-hidden="true">◆</span>
                    <div>
                      <small>{tr(language, "PERMANENT UPGRADE", "שדרוג קבוע")}</small>
                      <h3>{tr(language, "STARTING INTEGRITY", "חיים התחלתיים")}</h3>
                      <p>{tr(language, "Begin every run with one additional full integrity point. The upgrade works in every stage and difficulty.", "התחל כל משחק עם נקודת חיים מלאה נוספת. השדרוג פועל בכל שלב ובכל רמת קושי.")}</p>
                      <div className="shop-health-preview">
                        {Array.from({ length: Math.min(11, DIFFICULTIES[difficulty].health + profile.healthBonus) }, (_, index) => <i key={index} />)}
                      </div>
                    </div>
                    {profile.healthBonus < PROGRESSION_BALANCE.healthUpgradeCosts.length ? (
                      <button disabled={profile.prismShards < PROGRESSION_BALANCE.healthUpgradeCosts[profile.healthBonus]} onClick={buyHealthUpgrade}>
                        <span>{tr(language, "BUY +1 HEALTH", "קנה 1+ חיים")}</span>
                        <strong>◇ {PROGRESSION_BALANCE.healthUpgradeCosts[profile.healthBonus]}</strong>
                      </button>
                    ) : <b className="shop-maxed">{tr(language, "MAXIMUM UPGRADE", "שדרוג מרבי")}</b>}
                  </div>
                  <p className="shop-note">{tr(language, "Prism Shard fragments can drop in every stage. Runs also award Shards for completion and performance.", "רסיסי פריזמה יכולים ליפול בכל שלב. משחקים מעניקים שברים נוספים על השלמה וביצועים.")}</p>
                </section>
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
              <small>{tr(language, "PRISM INTEGRITY", "שלמות פריזמה")}</small>
              <div className="health-row">
                {Array.from({ length: ui.maxHealth }, (_, index) => <i key={index} className={index < ui.health ? "health-on" : ""} />)}
                {ui.shield > 0.05 && <span className="shield-readout">SHIELD {Math.ceil(ui.shield)}</span>}
              </div>
            </section>
            <section className="wave-readout">
              <small>{ui.wave}</small>
              <strong>{formatTime(ui.timeLeft)}</strong>
              <span>{tr(language, "RIFT STABILITY", "יציבות הקרע")}</span>
            </section>
            <section className="hud-block score-block">
              <small>{tr(language, "SCORE", "ניקוד")}</small>
              <strong>{formatScore(ui.score)}</strong>
              <span className={ui.combo > 1.05 ? "combo-hot" : ""}>×{ui.combo.toFixed(2)} REFRACTION</span>
              <span className="run-coins">◇ {ui.coinsCollected} {tr(language, "SHARD FRAGMENTS", "רסיסי פריזמה")}</span>
            </section>
          </header>

          <div className="level-track">
            <span>LV.{String(ui.level).padStart(2, "0")}</span>
            <i><b style={{ width: `${clamp(ui.xp / ui.nextXp * 100, 0, 100)}%` }} /></i>
          </div>

          <div className="objective-tracker">
            <div><small>{`${tr(language, "PRIMARY", "ראשי")} // ${difficultyName(ui.difficulty, language)}`}</small><strong>{runtimeCopy(ui.objectiveLabel, language)}</strong></div>
            <span>{Math.floor(Math.min(ui.objectiveProgress, ui.objectiveTarget))}<b>/ {ui.objectiveTarget}</b></span>
            <i><b style={{ width: `${clamp(ui.objectiveProgress / Math.max(1, ui.objectiveTarget) * 100, 0, 100)}%` }} /></i>
            <small className={ui.microComplete ? "micro-objective is-complete" : "micro-objective"}>{ui.microComplete ? "✓ " : "◇ "}{microObjectiveLabel(ui.microObjective, language)} {ui.microProgress}/{ui.microTarget}</small>
          </div>

          <section className={`spectrum-hud is-${ui.prismStability}`} aria-label="Prism Refraction Engine">
            <header>
              <span>PRISM REFRACTION ENGINE</span>
              <strong>{ui.prismBreakTime > 0 ? "PRISM BREAK" : ui.refractionName}</strong>
              <small>{ui.spectrumTotal}/{ui.spectrumCapacity}{" // "}{ui.prismStability.replace("-", " ").toUpperCase()}</small>
            </header>
            <div className="spectrum-cells">
              {SPECTRUM_IDS.map((id) => (
                <span key={id} className={`spectrum-${id}`} style={{ "--spectrum-color": SPECTRUM_INFO[id].color } as React.CSSProperties}>
                  <b>{SPECTRUM_INFO[id].glyph}</b><i>{ui.spectrum[id]}</i><em>{id.toUpperCase()}</em>
                </span>
              ))}
            </div>
            <footer><kbd>{displayKey(bindings.blast)}</kbd><span>{tr(language, "OR LEFT CLICK // REFRACT", "או לחיצה שמאלית // שבירה")}</span></footer>
          </section>

          {ui.bossMaxHealth > 0 && (
            <div className="boss-hud">
              <div><small>OMEGA ENTITY</small><strong>THE APERTURE</strong><span>{ui.bossWeakPoint > 0 ? `WEAK POINT OPEN ${ui.bossWeakPoint.toFixed(1)}s` : ui.bossSpectrum ? `REFRACT ${ui.bossSpectrum.toUpperCase()} // BREAK SHIELD` : `PHASE ${ui.bossHealth / ui.bossMaxHealth > 0.58 ? "I" : ui.bossHealth / ui.bossMaxHealth > 0.28 ? "II" : "III"}`}</span></div>
              <i><b style={{ width: `${clamp(ui.bossHealth / ui.bossMaxHealth * 100, 0, 100)}%` }} /></i>
            </div>
          )}

          <aside className="active-effects-panel" aria-label="Current active effects">
            <header><span>{tr(language, "ACTIVE EFFECTS", "אפקטים פעילים")}</span><b>{String(activeEffects.length).padStart(2, "0")}</b></header>
            <div>
              {activeEffects.length === 0 ? <p>NO ACTIVE MODIFIERS</p> : activeEffects.map((effect) => (
                <span key={effect.id} className={effect.className}>
                  <b>{effect.glyph}</b><em>{effect.name}</em><i>{effect.detail}</i>
                </span>
              ))}
            </div>
          </aside>

          <div className="power-shortcuts" aria-label="Power keyboard shortcuts">
            <span><kbd>{displayKey(bindings.dash)}</kbd><b>DASH</b></span>
            <span><kbd>{displayKey(bindings.blast)}</kbd><b>REFRACT</b></span>
            <span><kbd>{displayKey(bindings.nova)}</kbd><b>NOVA ◇1</b></span>
            <span><kbd>{displayKey(bindings.smash)}</kbd><b>SMASH</b></span>
            <span><kbd>B</kbd><b>{tr(language, "CLEAN UI", "מסך נקי")}</b></span>
          </div>

          <div className="ability-hud">
            <div className="ability-label"><span>PRISM NOVA <kbd>{displayKey(bindings.nova)}</kbd></span><small>{ui.doubleShotBuff > 0 && ui.rapidBuff > 0 ? "TWIN RAPID ARRAY ONLINE" : ui.doubleShotBuff > 0 ? `TWIN BEAM ${Math.ceil(ui.doubleShotBuff)}s` : ui.rapidBuff > 0 ? `RAPID MODULE ${Math.ceil(ui.rapidBuff)}s` : ui.charge >= 100 ? tr(language, "CORE READY // COST ◇ 1", "הליבה מוכנה // מחיר ◇ 1") : tr(language, "ABSORB FIRE TO CHARGE", "ספוג אש כדי לטעון")}</small></div>
            <i className={ui.charge >= 100 ? "charge-track is-ready" : "charge-track"}><b style={{ width: `${ui.charge}%` }} /></i>
            <strong>{Math.floor(ui.charge)}<small>%</small></strong>
            <div className="dash-chip"><span style={{ "--dash": `${ui.dash * 360}deg` } as React.CSSProperties}>{displayKey(bindings.dash)}</span><small>{ui.dash >= 0.995 ? "DASH READY" : "PHASING"}</small></div>
            <button
              type="button"
              className={`smash-chip ${ui.smash >= 0.995 ? "is-ready" : "is-cooling"}`}
              style={{ "--smash": `${ui.smash * 360}deg` } as React.CSSProperties}
              disabled={ui.smash < 0.995}
              aria-label={ui.smash >= 0.995 ? "Activate Prism Smash" : "Prism Smash is cooling down"}
              onPointerDown={(eventValue) => { eventValue.stopPropagation(); inputRef.current.smash = true; }}
            >
              <span><b>{displayKey(bindings.smash)}</b></span>
              <small>{ui.smash >= 0.995 ? "PRISM SMASH" : `${Math.ceil((1 - ui.smash) * 20)}s COOLDOWN`}</small>
            </button>
          </div>

          <button className="pause-trigger" onClick={togglePause} aria-label="Pause game">Ⅱ</button>

          {tutorialVisible && (
            <div className="tutorial-strip" role="status">
              <span><kbd>GUIDE</kbd>{ui.guide}</span>
              <button type="button" onClick={() => setTutorialSkipped(true)} aria-label="Skip tutorial">SKIP</button>
            </div>
          )}

          {ui.mode === "playing" && (
            <div className="touch-controls" aria-label="Touch controls">
              <button className="refract-touch" disabled={ui.spectrumTotal <= 0} onPointerDown={(eventValue) => { eventValue.stopPropagation(); inputRef.current.refract = true; }}>REFRACT</button>
              <button className="smash-touch" disabled={ui.smash < 0.995} onPointerDown={(eventValue) => { eventValue.stopPropagation(); inputRef.current.smash = true; }}><span>SMASH</span></button>
              <button className="nova-touch" disabled={ui.charge < 100} onPointerDown={(eventValue) => { eventValue.stopPropagation(); inputRef.current.nova = true; }}>NOVA</button>
              <button className="dash-touch" disabled={ui.dash < 0.995} onPointerDown={(eventValue) => { eventValue.stopPropagation(); inputRef.current.dash = true; }}>DASH</button>
            </div>
          )}
        </>
      )}

      {settingsOpen && (
        <section className="modal-layer settings-modal" role="dialog" aria-modal="true" aria-labelledby="settings-title">
          <div className="modal-panel compact-panel">
            <p className="modal-kicker">{tr(language, "SYSTEM SETTINGS", "הגדרות מערכת")}</p>
            <h2 id="settings-title">{tr(language, "SETTINGS", "הגדרות")}</h2>
            <div className="settings-section">
              <span>{tr(language, "LANGUAGE", "שפה")}</span>
              <div>
                <button className={language === "en" ? "is-selected" : ""} onClick={() => setLanguage("en")}>ENGLISH</button>
                <button className={language === "he" ? "is-selected" : ""} onClick={() => setLanguage("he")}>עברית</button>
              </div>
            </div>
            <button className="modal-primary" onClick={() => setSettingsOpen(false)}>{tr(language, "CLOSE", "סגור")}</button>
          </div>
        </section>
      )}

      {ui.mode === "nova-confirm" && (
        <section className="modal-layer nova-confirm-modal" role="dialog" aria-modal="true" aria-labelledby="nova-confirm-title" aria-describedby="nova-confirm-description">
          <div className="modal-panel compact-panel">
            <p className="modal-kicker">{tr(language, "NOVA AUTHORIZATION // CORE READY", "אישור נובה // הליבה מוכנה")}</p>
            <div className="nova-confirm-emblem" aria-hidden="true"><i /><b>✦</b><i /></div>
            <h2 id="nova-confirm-title">{tr(language, "DEPLOY NOVA?", "להפעיל נובה?")}</h2>
            <div className="nova-confirm-cost">
              <span aria-hidden="true">◇</span>
              <div><small>{tr(language, "ACTIVATION COST", "מחיר הפעלה")}</small><strong>{NOVA_COIN_COST} {tr(language, "PRISM COIN", "מטבע פריזמה")}</strong></div>
              <em>{tr(language, "BALANCE", "יתרה")} {ui.coinsCollected}</em>
            </div>
            <p id="nova-confirm-description" className={ui.coinsCollected >= NOVA_COIN_COST ? "nova-confirm-note" : "nova-confirm-note is-insufficient"}>
              {ui.coinsCollected >= NOVA_COIN_COST
                ? tr(language, "One collected coin will be consumed. The battle is paused while you decide.", "מטבע אחד שנאסף ייצרך. הקרב מושהה בזמן הבחירה.")
                : tr(language, "You need one collected coin. Return to the fight and collect one from an enemy.", "צריך מטבע אחד שנאסף. חזור לקרב ואסוף מטבע מאויב.")}
            </p>
            <div className="nova-confirm-actions">
              <button type="button" className="modal-primary nova-confirm-yes" disabled={ui.coinsCollected < NOVA_COIN_COST} onClick={confirmNovaPurchase}>
                {tr(language, "YES // PAY 1 COIN", "כן // שלם מטבע אחד")}
              </button>
              <button type="button" className="modal-link" onClick={cancelNovaPurchase}>
                {tr(language, "NO // RETURN TO FIGHT", "לא // חזור לקרב")}
              </button>
            </div>
          </div>
        </section>
      )}

      {ui.mode === "paused" && (
        <section className="modal-layer pause-modal" role="dialog" aria-modal="true" aria-labelledby="pause-title">
          <div className="modal-panel compact-panel">
            <p className="modal-kicker">{tr(language, "SIMULATION SUSPENDED", "הסימולציה הושהתה")}</p>
            <h2 id="pause-title">{tr(language, "PAUSED", "מושהה")}</h2>
            <button className="modal-primary" onClick={togglePause}>{tr(language, "RESUME", "המשך")}</button>
            <div className="modal-row">
              <button onClick={() => setSound((value) => !value)}>{sound ? "SOUND ON" : "SOUND OFF"}</button>
              <button onClick={() => setHighContrast((value) => !value)}>{highContrast ? "HIGH CONTRAST" : "STANDARD CONTRAST"}</button>
              <button onClick={() => setControlsOpen((value) => !value)}>{controlsOpen ? "HIDE KEYS" : "CHANGE KEYS"}</button>
              <button onClick={() => setSettingsOpen(true)}>{tr(language, "SETTINGS", "הגדרות")}</button>
            </div>
            {controlsOpen && (
              <div className="controls-panel" aria-label="Keyboard controls">
                <p>{capturingBinding ? `PRESS A KEY FOR ${capturingBinding.toUpperCase()}` : "CLICK A CONTROL, THEN PRESS A KEY"}</p>
                <div>
                  {REMAPPABLE_ACTIONS.map((action) => (
                    <button key={action} className={capturingBinding === action ? "is-capturing" : ""} onClick={() => startBindingCapture(action)}>
                      <span>{action === "blast" ? tr(language, "REFRACT / LANCE", "שבירה / רומח") : action.toUpperCase()}</span><b>{capturingBinding === action ? "PRESS KEY" : displayKey(bindings[action])}</b>
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
            <h2 id="upgrade-title">{tr(language, "CHOOSE A REFRACTION", "בחר כוח")}</h2>
            <span>{tr(language, "Pick the symbol you want — time is paused.", "בחר את הסמל שאתה רוצה — הזמן עצור.")}</span>
          </div>
          <div className="upgrade-grid">
            {ui.choices.map((id, index) => {
              const info = upgradeCopy(id, language);
              const nextLevel = (ui.upgrades[id] ?? 0) + 1;
              return (
                <button key={id} className={`upgrade-card rarity-${(info.rarity ?? "COMMON").toLowerCase()}`} onClick={() => pickUpgrade(id)}>
                  <span className="card-index">0{index + 1}</span>
                  <span className="card-glyph" aria-hidden="true">{info.glyph}</span>
                  <span className={`power-preview preview-${id}`} aria-hidden="true"><i /><i /><i /></span>
                  <small>{info.rarity ?? "COMMON"}{" // "}{info.tag}</small>
                  <strong>{info.name}</strong>
                  <p>{info.description}</p>
                  <span className="card-level">{tr(language, "TIER", "דרגה")} {"I".repeat(Math.min(nextLevel, 4))}</span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {isEnd && (
        <section className={`modal-layer result-modal ${ui.mode === "victory" ? "victory-modal" : ""}`} role="dialog" aria-modal="true" aria-labelledby="result-title">
          <div className="result-panel">
            <p className="modal-kicker">{ui.mode === "victory" ? tr(language, "PROTOCOL COMPLETE", "הפרוטוקול הושלם") : tr(language, "SIGNAL TERMINATED", "האות נותק")}</p>
            <h2 id="result-title">{ui.mode === "victory"
              ? ui.runMode === "campaign"
                ? CAMPAIGN_STAGES[ui.stageId]?.objective === "boss"
                  ? tr(language, "CORE\nBROKEN", "הליבה\nנשברה")
                  : tr(language, "STAGE\nCLEARED", "השלב\nהושלם")
                : ui.runMode === "prime"
                  ? tr(language, "PRIME\nCOMPLETE", "פריים\nהושלם")
                  : ui.runMode === "threat"
                    ? tr(language, "THREAT\nCONTAINED", "האיום\nנבלם")
                    : tr(language, "RIFT\nCLEARED", "הקרע\nהושלם")
              : tr(language, "PRISM\nFALLEN", "הפריזמה\nנפלה")}</h2>
            <p className="result-reason">{runtimeCopy(ui.reason, language)}</p>
            {ui.mode === "victory" && ui.runMode === "campaign" && <div className="result-grade"><span>{tr(language, "MISSION MASTERY", "שליטה במשימה")}</span><strong>{"◆".repeat(resultStars)}{"◇".repeat(3 - resultStars)}</strong></div>}
            <div className="final-score"><small>{tr(language, "FINAL SCORE", "ניקוד סופי")}</small><strong>{formatScore(ui.score)}</strong>{ui.score >= bestScore && ui.score > 0 && <span>{tr(language, "NEW BEST", "שיא חדש")}</span>}</div>
            <div className="result-stats">
              <div><strong>{ui.kills}</strong><span>{tr(language, "HOSTILES", "אויבים")}</span></div>
              <div><strong>{ui.absorbed}</strong><span>{tr(language, "ABSORBED", "נספגו")}</span></div>
              <div><strong>{ui.perfectAbsorbs}</strong><span>{tr(language, "PERFECT ABSORB", "ספיגה מושלמת")}</span></div>
              <div><strong>{ui.refractionKills}</strong><span>{tr(language, "REFRACTION KILLS", "חיסולי שבירה")}</span></div>
              <div><strong>×{ui.bestCombo.toFixed(2)}</strong><span>{tr(language, "BEST COMBO", "קומבו שיא")}</span></div>
              <div><strong>◇ {resultShards}</strong><span>{tr(language, "PRISM SHARDS", "שברי פריזמה")}</span></div>
            </div>
            {resultAchievements.length > 0 && <div className="result-achievements"><small>{tr(language, "ACHIEVEMENT UNLOCKED", "הישג נפתח")}</small>{resultAchievements.map((achievement) => <span key={achievement.id}><b>{achievement.icon}</b>{(language === "he" ? achievement.he : achievement.en).title}<em>+{achievement.reward} ◆</em></span>)}</div>}
            {resultWorldUpgrade && <div className="result-world-upgrade"><small>{tr(language, "WORLD CORE UPGRADE ACQUIRED", "שדרוג ליבת עולם התקבל")}</small><span><b>{resultWorldUpgrade.glyph}</b><strong>{(language === "he" ? resultWorldUpgrade.he : resultWorldUpgrade.en).name}</strong><em>{(language === "he" ? resultWorldUpgrade.he : resultWorldUpgrade.en).description}</em></span></div>}
            <div className="rank-readout"><span>{tr(language, "PERSONAL BEST RANK", "דירוג שיא אישי")}</span><strong>{runRank ? `${tr(language, "RANK", "דרגה")} ${String(runRank).padStart(2, "0")}` : leaderboardError ? tr(language, "UPLINK PENDING", "ממתין לקישור") : tr(language, "SYNCING…", "מסנכרן…")}</strong></div>
            <div className="result-actions">
              {ui.mode === "victory" && ui.runMode === "campaign" && ui.stageId < CAMPAIGN_STAGES.length - 1 && (
                <button className="modal-primary" onClick={() => launchGame("campaign", ui.stageId + 1, ui.difficulty)}>{tr(language, "NEXT STAGE", "לשלב הבא")}</button>
              )}
              <button className={ui.mode === "victory" && ui.runMode === "campaign" && ui.stageId < CAMPAIGN_STAGES.length - 1 ? "modal-secondary" : "modal-primary"} onClick={replayGame}>{tr(language, "RUN IT AGAIN", "שחק שוב")}</button>
              <button className="modal-link" onClick={returnToMenu}>{tr(language, "RETURN TO MODE SELECT", "חזרה לבחירת מצב")}</button>
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

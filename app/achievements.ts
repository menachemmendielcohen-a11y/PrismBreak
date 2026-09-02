export type AchievementMetric = "campaign" | "kills" | "elites" | "absorbed" | "perfect" | "refraction" | "combo" | "noHit" | "shards" | "prime" | "threat";
export type AchievementTier = "bronze" | "silver" | "gold" | "prism";

export interface AchievementDefinition {
  id: string;
  metric: AchievementMetric;
  goal: number;
  reward: number;
  tier: AchievementTier;
  icon: string;
  en: { title: string; description: string };
  he: { title: string; description: string };
}

export interface AchievementSave {
  version: number;
  unlockedIds: string[];
  campaignClears: number[];
  primeClears: string[];
  stats: { kills: number; elites: number; absorbed: number; perfect: number; refraction: number; combo: number; noHit: number; shards: number; threat: number };
}

export interface AchievementRun {
  mode: "campaign" | "prime" | "threat" | "daily" | "arcade";
  victory: boolean;
  stageId: number;
  primeId: string | null;
  threatLevel: number;
  kills: number;
  eliteKills: number;
  absorbed: number;
  perfectAbsorbs?: number;
  refractionKills?: number;
  bestCombo: number;
  hitsTaken: number;
  shardsEarned: number;
}

const make = (id: string, metric: AchievementMetric, goal: number, reward: number, tier: AchievementTier, icon: string, titleEn: string, titleHe: string, descriptionEn: string, descriptionHe: string): AchievementDefinition => ({
  id, metric, goal, reward, tier, icon,
  en: { title: titleEn, description: descriptionEn },
  he: { title: titleHe, description: descriptionHe },
});

export const ACHIEVEMENT_DEFINITIONS: AchievementDefinition[] = [
  make("campaign-1", "campaign", 1, 5, "bronze", "01", "FIRST REFRACTION", "השבירה הראשונה", "Clear one Campaign stage.", "השלם שלב אחד במערכה."),
  make("campaign-10", "campaign", 10, 20, "silver", "I", "WORLD I SECURED", "עולם 1 הושלם", "Clear 10 unique Campaign stages.", "השלם 10 שלבים שונים במערכה."),
  make("campaign-25", "campaign", 25, 35, "gold", "II", "WORLD II SECURED", "עולם 2 הושלם", "Clear 25 unique Campaign stages.", "השלם 25 שלבים שונים במערכה."),
  make("campaign-50", "campaign", 50, 60, "gold", "III", "VOID ENGINE BROKEN", "מנוע הריק נשבר", "Clear 50 unique Campaign stages.", "השלם 50 שלבים שונים במערכה."),
  make("campaign-100", "campaign", 100, 120, "prism", "IV", "PRISM LIBERATED", "הפריזמה שוחררה", "Clear 100 unique Campaign stages.", "השלם 100 שלבים שונים במערכה."),
  make("kills-100", "kills", 100, 8, "bronze", "✦", "SIGNAL HUNTER", "צייד אותות", "Destroy 100 hostiles.", "השמד 100 אויבים."),
  make("kills-1000", "kills", 1000, 30, "gold", "✦", "RIFT ERASER", "מוחק הקרעים", "Destroy 1,000 hostiles.", "השמד 1,000 אויבים."),
  make("kills-10000", "kills", 10000, 100, "prism", "✦", "TEN THOUSAND SILENCES", "עשרת אלפים דממות", "Destroy 10,000 hostiles.", "השמד 10,000 אויבים."),
  make("elites-1", "elites", 1, 5, "bronze", "▲", "ELITE CONTACT", "מפגש אליטה", "Destroy your first elite.", "השמד את האליטה הראשונה שלך."),
  make("elites-50", "elites", 50, 28, "gold", "▲", "APEX HUNTER", "צייד פסגה", "Destroy 50 elites.", "השמד 50 אליטות."),
  make("elites-250", "elites", 250, 80, "prism", "▲", "NO SIGNAL ABOVE", "אין אות מעליך", "Destroy 250 elites.", "השמד 250 אליטות."),
  make("absorb-50", "absorbed", 50, 8, "bronze", "◉", "ENERGY RECYCLE", "מחזור אנרגיה", "Absorb 50 hostile shots.", "ספוג 50 יריות אויב."),
  make("absorb-500", "absorbed", 500, 30, "gold", "◉", "PERFECT CONDUCTOR", "מוליך מושלם", "Absorb 500 hostile shots.", "ספוג 500 יריות אויב."),
  make("perfect-25", "perfect", 25, 12, "silver", "◎", "EDGE OF IMPACT", "על סף הפגיעה", "Perform 25 Perfect Absorbs.", "בצע 25 ספיגות מושלמות."),
  make("perfect-250", "perfect", 250, 55, "prism", "◎", "TIME BETWEEN SHARDS", "הזמן שבין הרסיסים", "Perform 250 Perfect Absorbs.", "בצע 250 ספיגות מושלמות."),
  make("refraction-50", "refraction", 50, 14, "silver", "△", "TURN THE STORM", "הפוך את הסערה", "Destroy 50 enemies with refracted energy.", "השמד 50 אויבים באנרגיה שבורה."),
  make("refraction-500", "refraction", 500, 65, "prism", "△", "ENEMY FIRE, YOUR WILL", "אש האויב, הרצון שלך", "Destroy 500 enemies with refracted energy.", "השמד 500 אויבים באנרגיה שבורה."),
  make("combo-4", "combo", 4, 12, "silver", "×", "CHAIN REACTION", "תגובת שרשרת", "Reach a 4× combo.", "הגע למכפיל 4×."),
  make("combo-8", "combo", 8, 40, "prism", "×", "MAXIMUM REFRACTION", "שבירה מרבית", "Reach the maximum 8× combo.", "הגע למכפיל המרבי 8×."),
  make("nohit-1", "noHit", 1, 12, "silver", "◇", "UNTOUCHED", "ללא פגע", "Complete a run without taking damage.", "השלם ריצה בלי לספוג נזק."),
  make("nohit-20", "noHit", 20, 60, "prism", "◇", "PHASE GHOST", "רוח פאזה", "Complete 20 no-hit runs.", "השלם 20 ריצות בלי לספוג נזק."),
  make("shards-250", "shards", 250, 15, "silver", "◆", "PRISM RESERVE", "עתודת פריזמה", "Earn 250 Prism Shards in total.", "הרווח 250 שברי פריזמה בסך הכול."),
  make("shards-2500", "shards", 2500, 75, "prism", "◆", "REFRACTION VAULT", "כספת השבירה", "Earn 2,500 Prism Shards in total.", "הרווח 2,500 שברי פריזמה בסך הכול."),
  make("prime-1", "prime", 1, 15, "silver", "P", "PRIME INITIATE", "חניך PRIME", "Complete one PRIME mission.", "השלם משימת PRIME אחת."),
  make("prime-3", "prime", 3, 45, "prism", "P", "PRIME TRIAD", "שלישיית PRIME", "Complete all three PRIME missions.", "השלם את כל שלוש משימות PRIME."),
  make("threat-10", "threat", 10, 12, "bronze", "!", "THREAT PROVEN", "האיום הוכח", "Clear Threat Level 10.", "השלם רמת איום 10."),
  make("threat-50", "threat", 50, 35, "gold", "!", "RIFT VETERAN", "ותיק הקרע", "Clear Threat Level 50.", "השלם רמת איום 50."),
  make("threat-100", "threat", 100, 60, "prism", "!", "CENTURY BREAKER", "שובר המאה", "Clear Threat Level 100.", "השלם רמת איום 100."),
  make("threat-1000", "threat", 1000, 180, "prism", "∞", "ENDLESS WITNESS", "עד האינסוף", "Clear Threat Level 1,000.", "השלם רמת איום 1,000."),
];

const safeInt = (value: unknown) => Number.isFinite(Number(value)) ? Math.max(0, Math.floor(Number(value))) : 0;
const uniqueStrings = (value: unknown) => Array.isArray(value) ? [...new Set(value.filter((item): item is string => typeof item === "string"))] : [];
const uniqueNumbers = (value: unknown) => Array.isArray(value)
  ? [...new Set(value.map(Number).filter((item) => Number.isFinite(item) && item >= 0).map((item) => Math.floor(item)))].sort((a, b) => a - b)
  : [];

export function migrateAchievementSave(raw: unknown, legacy?: { stars?: unknown; primeBestTimes?: unknown; prismShards?: unknown; highestThreat?: unknown }): AchievementSave {
  const value = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  const stats = value.stats && typeof value.stats === "object" ? value.stats as Record<string, unknown> : {};
  const legacyStars = legacy?.stars && typeof legacy.stars === "object" ? legacy.stars as Record<string, unknown> : {};
  const legacyCampaign = Object.entries(legacyStars).filter(([, stars]) => safeInt(stars) > 0).map(([key]) => safeInt(key.split(":")[0]));
  const legacyPrime = legacy?.primeBestTimes && typeof legacy.primeBestTimes === "object" ? Object.keys(legacy.primeBestTimes) : [];
  return {
    version: 2,
    unlockedIds: uniqueStrings(value.unlockedIds),
    campaignClears: [...new Set([...uniqueNumbers(value.campaignClears), ...legacyCampaign])].sort((a, b) => a - b),
    primeClears: [...new Set([...uniqueStrings(value.primeClears), ...legacyPrime])],
    stats: {
      kills: safeInt(stats.kills), elites: safeInt(stats.elites), absorbed: safeInt(stats.absorbed), perfect: safeInt(stats.perfect), refraction: safeInt(stats.refraction), combo: Math.max(0, Number(stats.combo) || 0), noHit: safeInt(stats.noHit),
      shards: Math.max(safeInt(stats.shards), safeInt(legacy?.prismShards)), threat: Math.max(safeInt(stats.threat), safeInt(legacy?.highestThreat)),
    },
  };
}

export function achievementValue(save: AchievementSave, metric: AchievementMetric) {
  if (metric === "campaign") return save.campaignClears.filter((stageId) => stageId > 0).length;
  if (metric === "prime") return save.primeClears.length;
  return save.stats[metric];
}

export function evaluateAchievements(saveValue: unknown) {
  const save = migrateAchievementSave(saveValue);
  const unlocked = new Set(save.unlockedIds);
  const newlyUnlocked = ACHIEVEMENT_DEFINITIONS.filter((achievement) => !unlocked.has(achievement.id) && achievementValue(save, achievement.metric) >= achievement.goal);
  return {
    save: { ...save, unlockedIds: [...save.unlockedIds, ...newlyUnlocked.map((achievement) => achievement.id)] },
    newlyUnlocked,
    reward: newlyUnlocked.reduce((total, achievement) => total + achievement.reward, 0),
  };
}

export function recordAchievementRun(saveValue: unknown, run: AchievementRun) {
  const save = migrateAchievementSave(saveValue);
  const campaignClears = run.victory && run.mode === "campaign" ? [...new Set([...save.campaignClears, run.stageId])].sort((a, b) => a - b) : save.campaignClears;
  const primeClears = run.victory && run.mode === "prime" && run.primeId ? [...new Set([...save.primeClears, run.primeId])] : save.primeClears;
  let candidate = migrateAchievementSave({
    ...save, campaignClears, primeClears,
    stats: {
      kills: save.stats.kills + safeInt(run.kills), elites: save.stats.elites + safeInt(run.eliteKills), absorbed: save.stats.absorbed + safeInt(run.absorbed),
      perfect: save.stats.perfect + safeInt(run.perfectAbsorbs), refraction: save.stats.refraction + safeInt(run.refractionKills),
      combo: Math.max(save.stats.combo, run.bestCombo), noHit: save.stats.noHit + (run.victory && run.hitsTaken === 0 ? 1 : 0), shards: save.stats.shards + safeInt(run.shardsEarned),
      threat: run.victory && run.mode === "threat" ? Math.max(save.stats.threat, run.threatLevel) : save.stats.threat,
    },
  });
  const newlyUnlocked: AchievementDefinition[] = [];
  let reward = 0;
  for (let pass = 0; pass <= ACHIEVEMENT_DEFINITIONS.length; pass += 1) {
    const evaluation = evaluateAchievements(candidate);
    candidate = evaluation.save;
    if (evaluation.newlyUnlocked.length === 0) break;
    newlyUnlocked.push(...evaluation.newlyUnlocked);
    reward += evaluation.reward;
    candidate = { ...candidate, stats: { ...candidate.stats, shards: candidate.stats.shards + evaluation.reward } };
  }
  return { save: candidate, newlyUnlocked, reward };
}

export function achievementProgress(save: AchievementSave, achievement: AchievementDefinition) {
  const current = achievementValue(save, achievement.metric);
  return { current, ratio: Math.min(1, current / achievement.goal), unlocked: save.unlockedIds.includes(achievement.id) };
}

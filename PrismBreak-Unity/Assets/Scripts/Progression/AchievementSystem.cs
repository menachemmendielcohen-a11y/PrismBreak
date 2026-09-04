using System;
using System.Collections.Generic;
using UnityEngine;

namespace PrismBreak
{
    public static class AchievementCatalog
    {
        public static readonly AchievementDefinition[] All =
        {
            Make("campaign-1", "campaign", 1, 5, UpgradeRarity.Common, "01", "FIRST REFRACTION", "השבירה הראשונה", "Clear one Campaign stage.", "השלם שלב אחד במערכה."),
            Make("campaign-10", "campaign", 10, 20, UpgradeRarity.Rare, "I", "WORLD I SECURED", "עולם 1 הושלם", "Clear 10 unique Campaign stages.", "השלם 10 שלבים שונים במערכה."),
            Make("campaign-25", "campaign", 25, 35, UpgradeRarity.Rare, "II", "WORLD II SECURED", "עולם 2 הושלם", "Clear 25 unique Campaign stages.", "השלם 25 שלבים שונים במערכה."),
            Make("campaign-50", "campaign", 50, 60, UpgradeRarity.Prismatic, "III", "VOID ENGINE BROKEN", "מנוע הריק נשבר", "Clear 50 unique Campaign stages.", "השלם 50 שלבים שונים במערכה."),
            Make("campaign-100", "campaign", 100, 120, UpgradeRarity.Prismatic, "IV", "PRISM LIBERATED", "הפריזמה שוחררה", "Clear 100 unique Campaign stages.", "השלם 100 שלבים שונים במערכה."),
            Make("kills-100", "kills", 100, 8, UpgradeRarity.Common, "✦", "SIGNAL HUNTER", "צייד אותות", "Destroy 100 hostiles.", "השמד 100 אויבים."),
            Make("kills-1000", "kills", 1000, 30, UpgradeRarity.Rare, "✦", "RIFT ERASER", "מוחק הקרעים", "Destroy 1,000 hostiles.", "השמד 1,000 אויבים."),
            Make("kills-10000", "kills", 10000, 100, UpgradeRarity.Prismatic, "✦", "TEN THOUSAND SILENCES", "עשרת אלפים דממות", "Destroy 10,000 hostiles.", "השמד 10,000 אויבים."),
            Make("elites-1", "elites", 1, 5, UpgradeRarity.Common, "▲", "ELITE CONTACT", "מפגש אליטה", "Destroy your first elite.", "השמד את האליטה הראשונה שלך."),
            Make("elites-50", "elites", 50, 28, UpgradeRarity.Rare, "▲", "APEX HUNTER", "צייד פסגה", "Destroy 50 elites.", "השמד 50 אליטות."),
            Make("elites-250", "elites", 250, 80, UpgradeRarity.Prismatic, "▲", "NO SIGNAL ABOVE", "אין אות מעליך", "Destroy 250 elites.", "השמד 250 אליטות."),
            Make("absorb-50", "absorbed", 50, 8, UpgradeRarity.Common, "◉", "ENERGY RECYCLE", "מחזור אנרגיה", "Absorb 50 hostile shots.", "ספוג 50 יריות אויב."),
            Make("absorb-500", "absorbed", 500, 30, UpgradeRarity.Rare, "◉", "PERFECT CONDUCTOR", "מוליך מושלם", "Absorb 500 hostile shots.", "ספוג 500 יריות אויב."),
            Make("perfect-25", "perfect", 25, 12, UpgradeRarity.Rare, "◎", "EDGE OF IMPACT", "על סף הפגיעה", "Perform 25 Perfect Absorbs.", "בצע 25 ספיגות מושלמות."),
            Make("perfect-250", "perfect", 250, 55, UpgradeRarity.Prismatic, "◎", "TIME BETWEEN SHARDS", "הזמן שבין הרסיסים", "Perform 250 Perfect Absorbs.", "בצע 250 ספיגות מושלמות."),
            Make("refraction-50", "refraction", 50, 14, UpgradeRarity.Rare, "△", "TURN THE STORM", "הפוך את הסערה", "Destroy 50 enemies with refracted energy.", "השמד 50 אויבים באנרגיה שבורה."),
            Make("refraction-500", "refraction", 500, 65, UpgradeRarity.Prismatic, "△", "ENEMY FIRE, YOUR WILL", "אש האויב, הרצון שלך", "Destroy 500 enemies with refracted energy.", "השמד 500 אויבים באנרגיה שבורה."),
            Make("combo-4", "combo", 4, 12, UpgradeRarity.Rare, "×", "CHAIN REACTION", "תגובת שרשרת", "Reach a 4× combo.", "הגע למכפיל 4×."),
            Make("combo-8", "combo", 8, 40, UpgradeRarity.Prismatic, "×", "MAXIMUM REFRACTION", "שבירה מרבית", "Reach the maximum 8× combo.", "הגע למכפיל המרבי 8×."),
            Make("nohit-1", "noHit", 1, 12, UpgradeRarity.Rare, "◇", "UNTOUCHED", "ללא פגע", "Complete a run without taking damage.", "השלם ריצה בלי לספוג נזק."),
            Make("nohit-20", "noHit", 20, 60, UpgradeRarity.Prismatic, "◇", "PHASE GHOST", "רוח פאזה", "Complete 20 no-hit runs.", "השלם 20 ריצות בלי לספוג נזק."),
            Make("shards-250", "shards", 250, 15, UpgradeRarity.Rare, "◆", "PRISM RESERVE", "עתודת פריזמה", "Earn 250 Prism Shards in total.", "הרווח 250 שברי פריזמה בסך הכול."),
            Make("shards-2500", "shards", 2500, 75, UpgradeRarity.Prismatic, "◆", "REFRACTION VAULT", "כספת השבירה", "Earn 2,500 Prism Shards in total.", "הרווח 2,500 שברי פריזמה בסך הכול."),
            Make("prime-1", "prime", 1, 15, UpgradeRarity.Rare, "P", "PRIME INITIATE", "חניך PRIME", "Complete one PRIME mission.", "השלם משימת PRIME אחת."),
            Make("prime-3", "prime", 3, 45, UpgradeRarity.Prismatic, "P", "PRIME TRIAD", "שלישיית PRIME", "Complete all three PRIME missions.", "השלם את כל שלוש משימות PRIME."),
            Make("threat-10", "threat", 10, 12, UpgradeRarity.Common, "!", "THREAT PROVEN", "האיום הוכח", "Clear Threat Level 10.", "השלם רמת איום 10."),
            Make("threat-50", "threat", 50, 35, UpgradeRarity.Rare, "!", "RIFT VETERAN", "ותיק הקרע", "Clear Threat Level 50.", "השלם רמת איום 50."),
            Make("threat-100", "threat", 100, 60, UpgradeRarity.Prismatic, "!", "CENTURY BREAKER", "שובר המאה", "Clear Threat Level 100.", "השלם רמת איום 100."),
            Make("threat-1000", "threat", 1000, 180, UpgradeRarity.Prismatic, "∞", "ENDLESS WITNESS", "עד האינסוף", "Clear Threat Level 1,000.", "השלם רמת איום 1,000."),
        };

        public static AchievementDefinition Get(string id)
        {
            for (int i = 0; i < All.Length; i++) if (All[i].id == id) return All[i];
            return null;
        }

        private static AchievementDefinition Make(string id, string metric, int goal, int reward, UpgradeRarity tier,
            string glyph, string name, string heName, string description, string heDescription)
        {
            return new AchievementDefinition
            {
                id = id, metric = metric, goal = goal, shardReward = reward, tier = tier, glyph = glyph,
                title = name, hebrewTitle = heName, description = description, hebrewDescription = heDescription,
            };
        }
    }

    public sealed class AchievementEvaluation
    {
        public readonly List<AchievementDefinition> newlyUnlocked = new List<AchievementDefinition>();
        public int reward;
    }

    public static class AchievementSystem
    {
        public static AchievementEvaluation RecordRun(PlayerProfile profile, RunConfig config, RunResult result, int shardsEarned)
        {
            AchievementEvaluation evaluation = new AchievementEvaluation();
            if (profile == null || config == null || result == null) return evaluation;
            Ensure(profile);
            AchievementSaveData save = profile.achievements;

            if (result.victory && config.mode == RunMode.Campaign) AddUnique(save.campaignClears, config.stageId);
            if (result.victory && config.mode == RunMode.Prime && !string.IsNullOrEmpty(config.primeId)) AddUnique(save.primeClears, config.primeId);
            save.stats.kills = SafeAdd(save.stats.kills, result.kills);
            save.stats.elites = SafeAdd(save.stats.elites, result.eliteKills);
            save.stats.absorbed = SafeAdd(save.stats.absorbed, result.absorbed);
            save.stats.perfect = SafeAdd(save.stats.perfect, result.perfectAbsorbs);
            save.stats.refraction = SafeAdd(save.stats.refraction, result.refractionKills);
            save.stats.combo = Mathf.Max(save.stats.combo, result.bestCombo);
            if (result.victory && result.hitsTaken == 0) save.stats.noHit = SafeAdd(save.stats.noHit, 1);
            save.stats.shards = SafeAdd(save.stats.shards, Math.Max(0, shardsEarned));
            if (result.victory && config.mode == RunMode.Threat) save.stats.threat = Math.Max(save.stats.threat, config.threatLevel);

            // Rewards can themselves unlock lifetime-shard milestones, so evaluate
            // until reaching a stable state.
            for (int pass = 0; pass <= AchievementCatalog.All.Length; pass++)
            {
                bool changed = false;
                for (int i = 0; i < AchievementCatalog.All.Length; i++)
                {
                    AchievementDefinition achievement = AchievementCatalog.All[i];
                    if (save.unlockedIds.Contains(achievement.id) || Value(save, achievement.metric) < achievement.goal) continue;
                    save.unlockedIds.Add(achievement.id);
                    evaluation.newlyUnlocked.Add(achievement);
                    evaluation.reward = SafeAdd(evaluation.reward, achievement.shardReward);
                    save.stats.shards = SafeAdd(save.stats.shards, achievement.shardReward);
                    changed = true;
                }
                if (!changed) break;
            }
            return evaluation;
        }

        public static float Progress(AchievementDefinition achievement, PlayerProfile profile)
        {
            if (achievement == null || profile == null || profile.achievements == null) return 0;
            return Mathf.Clamp01(Value(profile.achievements, achievement.metric) / Mathf.Max(1f, achievement.goal));
        }

        public static int Value(AchievementSaveData save, string metric)
        {
            if (save == null) return 0;
            Ensure(save);
            switch (metric)
            {
                case "campaign":
                    int count = 0;
                    for (int i = 0; i < save.campaignClears.Count; i++) if (save.campaignClears[i] > 0) count++;
                    return count;
                case "prime": return save.primeClears.Count;
                case "kills": return save.stats.kills;
                case "elites": return save.stats.elites;
                case "absorbed": return save.stats.absorbed;
                case "perfect": return save.stats.perfect;
                case "refraction": return save.stats.refraction;
                case "combo": return Mathf.FloorToInt(save.stats.combo);
                case "noHit": return save.stats.noHit;
                case "shards": return save.stats.shards;
                case "threat": return save.stats.threat;
                default: return 0;
            }
        }

        public static void Ensure(PlayerProfile profile)
        {
            if (profile.achievements == null) profile.achievements = new AchievementSaveData();
            Ensure(profile.achievements);
        }

        private static void Ensure(AchievementSaveData save)
        {
            if (save.unlockedIds == null) save.unlockedIds = new List<string>();
            if (save.campaignClears == null) save.campaignClears = new List<int>();
            if (save.primeClears == null) save.primeClears = new List<string>();
            if (save.stats == null) save.stats = new AchievementStatsData();
            save.version = 2;
        }

        private static void AddUnique<T>(List<T> values, T value)
        {
            if (!values.Contains(value)) values.Add(value);
        }

        private static int SafeAdd(int value, int add)
        {
            long total = (long)Math.Max(0, value) + Math.Max(0, add);
            return total >= int.MaxValue ? int.MaxValue : (int)total;
        }
    }
}

using System;
using System.Collections.Generic;
using UnityEngine;

namespace PrismBreak
{
    internal static class LegacyProfileMigrator
    {
        public static PlayerProfile FromBrowserJson(string json)
        {
            Dictionary<string, object> root = MiniJsonReader.Parse(json) as Dictionary<string, object>;
            if (root == null) return null;
            PlayerProfile profile = PlayerProfile.CreateDefault();
            profile.unlockedStage = Int(root, "unlockedStage");
            profile.overdriveUnlocked = Bool(root, "overdriveUnlocked");
            profile.prismShards = Math.Max(Int(root, "prismShards"), Int(root, "coins"));
            profile.healthBonus = Int(root, "healthBonus");
            profile.selectedShip = Int(root, "selectedShip");
            profile.highestThreat = Int(root, "highestThreat");
            profile.highestThreatAvailable = Int(root, "highestThreatAvailable");
            profile.threatBestScore = Int(root, "threatBestScore");
            profile.threatBestClearTime = Float(root, "threatBestClearTime", -1);
            profile.rank = Math.Max(1, Int(root, "rank"));
            profile.rankXp = Int(root, "rankXp");
            profile.totalRuns = Int(root, "totalRuns");
            profile.successfulRuns = Int(root, "successfulRuns");
            profile.stars = NumberEntries(Object(root, "stars"));
            profile.bestScores = NumberEntries(Object(root, "bestScores"));
            profile.primeBestTimes = FloatEntries(Object(root, "primeBestTimes"));

            foreach (string id in Strings(root, "unlockedPrimeIds")) profile.AddPrime(id);
            foreach (string id in Strings(root, "unlockedPowerIds")) AddPower(profile, id);
            Dictionary<string, object> legacyPowers = Object(root, "unlockedPowers");
            if (legacyPowers != null)
                foreach (KeyValuePair<string, object> item in legacyPowers) if (AsBool(item.Value)) AddPower(profile, item.Key);
            foreach (string id in Strings(root, "worldCoreUpgrades")) AddWorldUpgrade(profile, id);

            Dictionary<string, object> achievements = Object(root, "achievements");
            if (achievements != null) profile.achievements = ParseAchievements(achievements, profile);
            else
            {
                // Older saves had enough information to reconstruct unique clears.
                for (int i = 0; i < profile.stars.Count; i++)
                {
                    string[] pieces = profile.stars[i].key.Split(':');
                    int stage;
                    if (profile.stars[i].value > 0 && pieces.Length > 0 && int.TryParse(pieces[0], out stage) && !profile.achievements.campaignClears.Contains(stage))
                        profile.achievements.campaignClears.Add(stage);
                }
                for (int i = 0; i < profile.primeBestTimes.Count; i++) profile.achievements.primeClears.Add(profile.primeBestTimes[i].key);
                profile.achievements.stats.shards = profile.prismShards;
                profile.achievements.stats.threat = profile.highestThreat;
            }
            return ProfileSanitizer.Sanitize(profile);
        }

        public static void ApplyLegacySettings(PlayerProfile profile)
        {
            if (profile == null) return;
            if (profile.settings == null) profile.settings = new GameSettingsData();
            string sound = LegacyWebSaveBridge.LoadValue("prism-break-sound");
            if (!string.IsNullOrEmpty(sound)) profile.settings.soundEnabled = !string.Equals(sound, "off", StringComparison.OrdinalIgnoreCase);
            string language = LegacyWebSaveBridge.LoadValue("prism-break-language-v1");
            if (language == "he") profile.settings.language = LanguageId.Hebrew;
            else if (language == "en") profile.settings.language = LanguageId.English;
            string motion = LegacyWebSaveBridge.LoadValue("prism-break-motion");
            if (!string.IsNullOrEmpty(motion)) profile.settings.reducedMotion = motion == "reduced";
            string contrast = LegacyWebSaveBridge.LoadValue("prism-break-contrast");
            if (!string.IsNullOrEmpty(contrast)) profile.settings.highContrast = contrast == "high";

            Dictionary<string, object> bindings = MiniJsonReader.Parse(LegacyWebSaveBridge.LoadValue("prism-break-bindings-v1")) as Dictionary<string, object>;
            if (bindings != null)
                foreach (KeyValuePair<string, object> item in bindings)
                    if (item.Value is string) profile.settings.SetBinding(item.Key, (string)item.Value);
        }

        private static AchievementSaveData ParseAchievements(Dictionary<string, object> value, PlayerProfile profile)
        {
            AchievementSaveData save = new AchievementSaveData();
            save.unlockedIds.AddRange(Strings(value, "unlockedIds"));
            foreach (object item in Array(value, "campaignClears")) save.campaignClears.Add(AsInt(item));
            save.primeClears.AddRange(Strings(value, "primeClears"));
            Dictionary<string, object> stats = Object(value, "stats");
            if (stats != null)
            {
                save.stats.kills = Int(stats, "kills"); save.stats.elites = Int(stats, "elites");
                save.stats.absorbed = Int(stats, "absorbed"); save.stats.perfect = Int(stats, "perfect");
                save.stats.refraction = Int(stats, "refraction"); save.stats.combo = Float(stats, "combo", 0);
                save.stats.noHit = Int(stats, "noHit"); save.stats.shards = Int(stats, "shards");
                save.stats.threat = Int(stats, "threat");
            }
            save.stats.shards = Math.Max(save.stats.shards, profile.prismShards);
            save.stats.threat = Math.Max(save.stats.threat, profile.highestThreat);
            return save;
        }

        private static List<StringIntEntry> NumberEntries(Dictionary<string, object> value)
        {
            List<StringIntEntry> result = new List<StringIntEntry>();
            if (value != null) foreach (KeyValuePair<string, object> item in value) result.Add(new StringIntEntry(item.Key, AsInt(item.Value)));
            return result;
        }

        private static List<StringFloatEntry> FloatEntries(Dictionary<string, object> value)
        {
            List<StringFloatEntry> result = new List<StringFloatEntry>();
            if (value != null) foreach (KeyValuePair<string, object> item in value)
            {
                float number = AsFloat(item.Value, -1);
                if (number >= 0) result.Add(new StringFloatEntry(item.Key, number));
            }
            return result;
        }

        private static void AddPower(PlayerProfile profile, string id)
        {
            PersistentPowerId power;
            switch ((id ?? string.Empty).Replace("_", string.Empty).ToLowerInvariant())
            {
                case "focus": power = PersistentPowerId.Focus; break;
                case "overclock": power = PersistentPowerId.Overclock; break;
                case "lance": power = PersistentPowerId.Lance; break;
                default: return;
            }
            if (!profile.unlockedPowerIds.Contains(power)) profile.unlockedPowerIds.Add(power);
        }

        private static void AddWorldUpgrade(PlayerProfile profile, string id)
        {
            WorldUpgradeId value;
            switch ((id ?? string.Empty).Replace("_", string.Empty).ToLowerInvariant())
            {
                case "originguard": value = WorldUpgradeId.OriginGuard; break;
                case "chromaarray": value = WorldUpgradeId.ChromaArray; break;
                case "voiddrive": value = WorldUpgradeId.VoidDrive; break;
                case "eternalresonance": value = WorldUpgradeId.EternalResonance; break;
                default: return;
            }
            if (!profile.worldCoreUpgrades.Contains(value)) profile.worldCoreUpgrades.Add(value);
        }

        private static Dictionary<string, object> Object(Dictionary<string, object> value, string key)
        {
            object item; return value != null && value.TryGetValue(key, out item) ? item as Dictionary<string, object> : null;
        }
        private static List<object> Array(Dictionary<string, object> value, string key)
        {
            object item; List<object> result = value != null && value.TryGetValue(key, out item) ? item as List<object> : null;
            return result ?? new List<object>();
        }
        private static List<string> Strings(Dictionary<string, object> value, string key)
        {
            List<string> result = new List<string>();
            List<object> array = Array(value, key);
            for (int i = 0; i < array.Count; i++) if (array[i] is string) result.Add((string)array[i]);
            return result;
        }
        private static int Int(Dictionary<string, object> value, string key) { object item; return value != null && value.TryGetValue(key, out item) ? AsInt(item) : 0; }
        private static float Float(Dictionary<string, object> value, string key, float fallback) { object item; return value != null && value.TryGetValue(key, out item) ? AsFloat(item, fallback) : fallback; }
        private static bool Bool(Dictionary<string, object> value, string key) { object item; return value != null && value.TryGetValue(key, out item) && AsBool(item); }
        private static int AsInt(object value)
        {
            double number = value is double ? (double)value : 0;
            if (double.IsNaN(number) || double.IsInfinity(number)) return 0;
            return number <= 0 ? 0 : number >= int.MaxValue ? int.MaxValue : (int)Math.Floor(number);
        }
        private static float AsFloat(object value, float fallback)
        {
            if (!(value is double)) return fallback;
            double number = (double)value;
            return double.IsNaN(number) || double.IsInfinity(number) ? fallback : (float)number;
        }
        private static bool AsBool(object value) { return value is bool && (bool)value; }
    }
}

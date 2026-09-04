using System;
using System.Collections.Generic;
using UnityEngine;

namespace PrismBreak
{
    /// <summary>Repairs missing/legacy fields and rejects invalid or negative values.</summary>
    public static class ProfileSanitizer
    {
        public static PlayerProfile Sanitize(PlayerProfile profile)
        {
            if (profile == null) profile = PlayerProfile.CreateDefault();
            profile.saveVersion = ProgressionBalance.SaveVersion;
            profile.unlockedStage = Mathf.Clamp(profile.unlockedStage, 0, CampaignCatalog.Stages.Length - 1);
            profile.prismShards = Math.Max(0, profile.prismShards);
            profile.healthBonus = Mathf.Clamp(profile.healthBonus, 0, ProgressionBalance.HealthUpgradeCosts.Length);
            profile.selectedShip = Mathf.Clamp(profile.selectedShip, 0, 29);
            profile.highestThreat = Math.Max(0, profile.highestThreat);
            profile.highestThreatAvailable = Math.Max(ProgressionBalance.InitialThreatMaximum,
                Math.Max(profile.highestThreatAvailable, ThreatSystem.MaxAttempt(profile.highestThreat)));
            profile.threatBestScore = Math.Max(0, profile.threatBestScore);
            if (!IsFinite(profile.threatBestClearTime) || profile.threatBestClearTime < 0) profile.threatBestClearTime = -1;
            profile.rank = Math.Max(1, profile.rank);
            profile.rankXp = Math.Max(0, profile.rankXp);
            profile.totalRuns = Math.Max(0, profile.totalRuns);
            profile.successfulRuns = Mathf.Clamp(profile.successfulRuns, 0, profile.totalRuns);

            profile.stars = CleanIntEntries(profile.stars, true);
            profile.bestScores = CleanIntEntries(profile.bestScores, false);
            profile.primeBestTimes = CleanFloatEntries(profile.primeBestTimes);
            profile.unlockedPrimeIds = CleanPrimeIds(profile.unlockedPrimeIds);
            profile.unlockedPowerIds = CleanEnums(profile.unlockedPowerIds);
            profile.worldCoreUpgrades = CleanEnums(profile.worldCoreUpgrades);
            AchievementSystem.Ensure(profile);
            CleanAchievements(profile.achievements);
            SanitizeSettings(profile);

            profile.rank = Math.Max(profile.rank, ProgressionMath.CalculateRank(profile.TotalStars,
                profile.highestThreat, profile.PrimeClearCount, profile.rankXp));
            return profile;
        }

        private static void SanitizeSettings(PlayerProfile profile)
        {
            if (profile.settings == null) profile.settings = new GameSettingsData();
            if (!Enum.IsDefined(typeof(LanguageId), profile.settings.language)) profile.settings.language = LanguageId.English;
            profile.settings.musicVolume = Mathf.Clamp01(IsFinite(profile.settings.musicVolume) ? profile.settings.musicVolume : .58f);
            profile.settings.soundVolume = Mathf.Clamp01(IsFinite(profile.settings.soundVolume) ? profile.settings.soundVolume : .75f);
            if (profile.settings.bindings == null || profile.settings.bindings.Count == 0)
                profile.settings.bindings = GameSettingsData.DefaultBindings();
            else
            {
                HashSet<string> actions = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
                List<KeyBindingData> clean = new List<KeyBindingData>();
                for (int i = 0; i < profile.settings.bindings.Count; i++)
                {
                    KeyBindingData item = profile.settings.bindings[i];
                    if (item == null || string.IsNullOrWhiteSpace(item.action) || string.IsNullOrWhiteSpace(item.key) || !actions.Add(item.action)) continue;
                    clean.Add(item);
                }
                List<KeyBindingData> defaults = GameSettingsData.DefaultBindings();
                for (int i = 0; i < defaults.Count; i++) if (actions.Add(defaults[i].action)) clean.Add(defaults[i]);
                profile.settings.bindings = clean;
            }
        }

        private static List<StringIntEntry> CleanIntEntries(List<StringIntEntry> source, bool stars)
        {
            Dictionary<string, int> values = new Dictionary<string, int>();
            if (source != null)
                for (int i = 0; i < source.Count; i++)
                {
                    StringIntEntry item = source[i];
                    if (item == null || string.IsNullOrWhiteSpace(item.key)) continue;
                    int value = stars ? Mathf.Clamp(item.value, 0, 3) : Math.Max(0, item.value);
                    int old;
                    values.TryGetValue(item.key, out old);
                    values[item.key] = Math.Max(old, value);
                }
            List<StringIntEntry> result = new List<StringIntEntry>(values.Count);
            foreach (KeyValuePair<string, int> item in values) result.Add(new StringIntEntry(item.Key, item.Value));
            return result;
        }

        private static List<StringFloatEntry> CleanFloatEntries(List<StringFloatEntry> source)
        {
            Dictionary<string, float> values = new Dictionary<string, float>();
            if (source != null)
                for (int i = 0; i < source.Count; i++)
                {
                    StringFloatEntry item = source[i];
                    if (item == null || string.IsNullOrWhiteSpace(item.key) || !IsFinite(item.value) || item.value < 0) continue;
                    float old;
                    values.TryGetValue(item.key, out old);
                    values[item.key] = old <= 0 ? item.value : Mathf.Min(old, item.value);
                }
            List<StringFloatEntry> result = new List<StringFloatEntry>(values.Count);
            foreach (KeyValuePair<string, float> item in values) result.Add(new StringFloatEntry(item.Key, item.Value));
            return result;
        }

        private static List<string> CleanPrimeIds(List<string> source)
        {
            HashSet<string> seen = new HashSet<string>();
            List<string> result = new List<string>();
            if (source != null)
                for (int i = 0; i < source.Count; i++)
                    if (!string.IsNullOrWhiteSpace(source[i]) && PrimeMissionCatalog.GetById(source[i]) != null && seen.Add(source[i])) result.Add(source[i]);
            return result;
        }

        private static List<T> CleanEnums<T>(List<T> source) where T : struct
        {
            HashSet<T> seen = new HashSet<T>();
            List<T> result = new List<T>();
            if (source != null)
                for (int i = 0; i < source.Count; i++)
                    if (Enum.IsDefined(typeof(T), source[i]) && seen.Add(source[i])) result.Add(source[i]);
            return result;
        }

        private static void CleanAchievements(AchievementSaveData save)
        {
            save.version = 2;
            save.unlockedIds = UniqueStrings(save.unlockedIds, false);
            save.primeClears = UniqueStrings(save.primeClears, true);
            HashSet<int> campaign = new HashSet<int>();
            List<int> stages = new List<int>();
            for (int i = 0; i < save.campaignClears.Count; i++)
            {
                int id = save.campaignClears[i];
                if (id >= 0 && id <= 100 && campaign.Add(id)) stages.Add(id);
            }
            stages.Sort();
            save.campaignClears = stages;
            save.stats.kills = Math.Max(0, save.stats.kills);
            save.stats.elites = Math.Max(0, save.stats.elites);
            save.stats.absorbed = Math.Max(0, save.stats.absorbed);
            save.stats.perfect = Math.Max(0, save.stats.perfect);
            save.stats.refraction = Math.Max(0, save.stats.refraction);
            save.stats.combo = Mathf.Max(0, IsFinite(save.stats.combo) ? save.stats.combo : 0);
            save.stats.noHit = Math.Max(0, save.stats.noHit);
            save.stats.shards = Math.Max(save.stats.shards, 0);
            save.stats.threat = Math.Max(save.stats.threat, profileSafeThreat(save));
        }

        private static int profileSafeThreat(AchievementSaveData save) { return Math.Max(0, save.stats.threat); }

        private static List<string> UniqueStrings(List<string> source, bool primeOnly)
        {
            HashSet<string> seen = new HashSet<string>();
            List<string> result = new List<string>();
            if (source != null)
                for (int i = 0; i < source.Count; i++)
                {
                    string id = source[i];
                    if (string.IsNullOrWhiteSpace(id) || !seen.Add(id)) continue;
                    if (primeOnly && PrimeMissionCatalog.GetById(id) == null) continue;
                    if (!primeOnly && AchievementCatalog.Get(id) == null) continue;
                    result.Add(id);
                }
            return result;
        }

        private static bool IsFinite(float value) { return !float.IsNaN(value) && !float.IsInfinity(value); }
    }
}

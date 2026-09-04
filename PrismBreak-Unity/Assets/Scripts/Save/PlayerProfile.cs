using System;
using System.Collections.Generic;
using UnityEngine;

namespace PrismBreak
{
    [Serializable]
    public sealed class StringIntEntry
    {
        public string key = string.Empty;
        public int value;

        public StringIntEntry() { }
        public StringIntEntry(string key, int value) { this.key = key; this.value = value; }
    }

    [Serializable]
    public sealed class StringFloatEntry
    {
        public string key = string.Empty;
        public float value;

        public StringFloatEntry() { }
        public StringFloatEntry(string key, float value) { this.key = key; this.value = value; }
    }

    [Serializable]
    public sealed class KeyBindingData
    {
        public string action = string.Empty;
        public string key = string.Empty;

        public KeyBindingData() { }
        public KeyBindingData(string action, string key) { this.action = action; this.key = key; }
    }

    [Serializable]
    public sealed class GameSettingsData
    {
        public LanguageId language = LanguageId.English;
        public bool musicEnabled = true;
        public bool soundEnabled = true;
        public float musicVolume = .58f;
        public float soundVolume = .75f;
        public bool reducedMotion;
        public bool highContrast;
        public List<KeyBindingData> bindings = DefaultBindings();

        public string Binding(string action, string fallback)
        {
            if (bindings != null)
                for (int i = 0; i < bindings.Count; i++)
                    if (bindings[i] != null && string.Equals(bindings[i].action, action, StringComparison.OrdinalIgnoreCase))
                        return string.IsNullOrWhiteSpace(bindings[i].key) ? fallback : bindings[i].key;
            return fallback;
        }

        public void SetBinding(string action, string key)
        {
            if (string.IsNullOrWhiteSpace(action) || string.IsNullOrWhiteSpace(key)) return;
            if (bindings == null) bindings = new List<KeyBindingData>();
            for (int i = 0; i < bindings.Count; i++)
            {
                if (!string.Equals(bindings[i].action, action, StringComparison.OrdinalIgnoreCase)) continue;
                bindings[i].key = key;
                return;
            }
            bindings.Add(new KeyBindingData(action, key));
        }

        public static List<KeyBindingData> DefaultBindings()
        {
            return new List<KeyBindingData>
            {
                new KeyBindingData("up", "KeyW"), new KeyBindingData("down", "KeyS"),
                new KeyBindingData("left", "KeyA"), new KeyBindingData("right", "KeyD"),
                new KeyBindingData("dash", "Space"), new KeyBindingData("nova", "KeyE"),
                new KeyBindingData("smash", "KeyF"), new KeyBindingData("blast", "KeyQ"),
                new KeyBindingData("pause", "KeyP"), new KeyBindingData("hud", "KeyB"),
            };
        }
    }

    [Serializable]
    public sealed class AchievementStatsData
    {
        public int kills;
        public int elites;
        public int absorbed;
        public int perfect;
        public int refraction;
        public float combo;
        public int noHit;
        public int shards;
        public int threat;
    }

    [Serializable]
    public sealed class AchievementSaveData
    {
        public int version = 2;
        public List<string> unlockedIds = new List<string>();
        public List<int> campaignClears = new List<int>();
        public List<string> primeClears = new List<string>();
        public AchievementStatsData stats = new AchievementStatsData();
    }

    /// <summary>
    /// Version-four durable profile. Lists replace Dictionary fields because
    /// Unity JsonUtility supports them consistently on desktop and WebGL.
    /// </summary>
    [Serializable]
    public sealed class PlayerProfile
    {
        public int saveVersion = ProgressionBalance.SaveVersion;
        public int unlockedStage;
        public bool overdriveUnlocked;
        public List<StringIntEntry> stars = new List<StringIntEntry>();
        public List<StringIntEntry> bestScores = new List<StringIntEntry>();
        public int prismShards;
        public int healthBonus;
        public int selectedShip;
        public List<PersistentPowerId> unlockedPowerIds = new List<PersistentPowerId>();
        public List<string> unlockedPrimeIds = new List<string>();
        public List<StringFloatEntry> primeBestTimes = new List<StringFloatEntry>();
        public int highestThreat;
        public int highestThreatAvailable = ProgressionBalance.InitialThreatMaximum;
        public int threatBestScore;
        public float threatBestClearTime = -1f;
        public int rank = 1;
        public int rankXp;
        public int totalRuns;
        public int successfulRuns;
        public List<WorldUpgradeId> worldCoreUpgrades = new List<WorldUpgradeId>();
        public AchievementSaveData achievements = new AchievementSaveData();
        public GameSettingsData settings = new GameSettingsData();

        public static PlayerProfile CreateDefault() { return new PlayerProfile(); }

        public int GetStars(int stageId, Difficulty difficulty)
        {
            return GetInt(stars, StageKey(stageId, difficulty));
        }

        public void SetStars(int stageId, Difficulty difficulty, int value)
        {
            SetInt(stars, StageKey(stageId, difficulty), Mathf.Clamp(value, 0, 3), true);
        }

        public int GetBestScore(string recordKey) { return GetInt(bestScores, recordKey); }
        public void SetBestScore(string recordKey, int value) { SetInt(bestScores, recordKey, Math.Max(0, value), true); }

        public float GetPrimeBestTime(string id)
        {
            if (primeBestTimes != null)
                for (int i = 0; i < primeBestTimes.Count; i++)
                    if (primeBestTimes[i] != null && primeBestTimes[i].key == id) return primeBestTimes[i].value;
            return -1f;
        }

        public void SetPrimeBestTime(string id, float time)
        {
            if (string.IsNullOrEmpty(id) || time < 0) return;
            if (primeBestTimes == null) primeBestTimes = new List<StringFloatEntry>();
            for (int i = 0; i < primeBestTimes.Count; i++)
            {
                if (primeBestTimes[i] == null || primeBestTimes[i].key != id) continue;
                if (primeBestTimes[i].value <= 0 || time < primeBestTimes[i].value) primeBestTimes[i].value = time;
                return;
            }
            primeBestTimes.Add(new StringFloatEntry(id, time));
        }

        public bool HasPrime(string id) { return unlockedPrimeIds != null && unlockedPrimeIds.Contains(id); }
        public void AddPrime(string id)
        {
            if (string.IsNullOrEmpty(id)) return;
            if (unlockedPrimeIds == null) unlockedPrimeIds = new List<string>();
            if (!unlockedPrimeIds.Contains(id)) unlockedPrimeIds.Add(id);
        }

        public bool HasPower(PersistentPowerId id) { return unlockedPowerIds != null && unlockedPowerIds.Contains(id); }
        public bool HasWorldUpgrade(WorldUpgradeId id) { return worldCoreUpgrades != null && worldCoreUpgrades.Contains(id); }

        public bool TrySpendShards(int amount)
        {
            if (amount < 0 || prismShards < amount) return false;
            prismShards -= amount;
            return true;
        }

        public void AddShards(int amount)
        {
            if (amount <= 0) return;
            long total = (long)Math.Max(0, prismShards) + amount;
            prismShards = total >= int.MaxValue ? int.MaxValue : (int)total;
        }

        public int TotalStars
        {
            get
            {
                int total = 0;
                if (stars != null) for (int i = 0; i < stars.Count; i++) if (stars[i] != null) total += Mathf.Clamp(stars[i].value, 0, 3);
                return total;
            }
        }

        public int PrimeClearCount { get { return primeBestTimes == null ? 0 : primeBestTimes.Count; } }

        public static string StageKey(int stageId, Difficulty difficulty)
        {
            return stageId + ":" + difficulty.ToString().ToLowerInvariant();
        }

        private static int GetInt(List<StringIntEntry> entries, string key)
        {
            if (entries != null)
                for (int i = 0; i < entries.Count; i++)
                    if (entries[i] != null && entries[i].key == key) return entries[i].value;
            return 0;
        }

        private static void SetInt(List<StringIntEntry> entries, string key, int value, bool keepMaximum)
        {
            if (entries == null || string.IsNullOrEmpty(key)) return;
            for (int i = 0; i < entries.Count; i++)
            {
                if (entries[i] == null || entries[i].key != key) continue;
                entries[i].value = keepMaximum ? Math.Max(entries[i].value, value) : value;
                return;
            }
            entries.Add(new StringIntEntry(key, value));
        }
    }
}

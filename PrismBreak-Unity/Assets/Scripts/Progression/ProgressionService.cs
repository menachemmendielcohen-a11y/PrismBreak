using System;
using System.Collections.Generic;
using UnityEngine;

namespace PrismBreak
{
    public static class ProgressionMath
    {
        public static int CalculateRank(int totalStars, int highestThreat, int primeClears, int rankXp = 0)
        {
            long rank = 1L + Math.Max(0, totalStars) / 12
                + (long)Math.Floor(Math.Sqrt(Math.Max(0, highestThreat)) / 2)
                + Math.Max(0, primeClears) * 2L + Math.Max(0, rankXp) / 12;
            return rank >= int.MaxValue ? int.MaxValue : (int)rank;
        }

        public static int ScoreStars(int stageId, int score)
        {
            int[] targets = CampaignCatalog.GetStage(stageId).scoreTargets;
            if (score >= targets[2]) return 3;
            if (score >= targets[1]) return 2;
            return score >= targets[0] ? 1 : 0;
        }

        public static string RecordKey(RunConfig config)
        {
            if (config == null) return "unknown";
            return config.mode.ToString().ToLowerInvariant() + ":" + config.stageId + ":" + config.difficulty.ToString().ToLowerInvariant();
        }
    }

    public sealed class ProgressionUpdateResult
    {
        public int runReward;
        public int achievementReward;
        public int stars;
        public WorldUpgradeDefinition worldUpgrade;
        public readonly List<AchievementDefinition> achievements = new List<AchievementDefinition>();
    }

    public static class ProgressionService
    {
        public static ProgressionUpdateResult ApplyRun(PlayerProfile profile, RunConfig config, RunResult result, int bonusPickups = 0)
        {
            ProgressionUpdateResult update = new ProgressionUpdateResult();
            if (profile == null || config == null || result == null) return update;
            ProfileSanitizer.Sanitize(profile);

            int reward = result.shardsEarned > 0 ? result.shardsEarned : RewardCalculator.ForRun(config, result, bonusPickups);
            reward = Math.Max(0, reward);
            update.runReward = reward;
            profile.AddShards(reward);
            profile.totalRuns = SafeAdd(profile.totalRuns, 1);
            if (result.victory) profile.successfulRuns = SafeAdd(profile.successfulRuns, 1);
            profile.rankXp = SafeAdd(profile.rankXp, result.victory ? 2 : 1);
            profile.SetBestScore(ProgressionMath.RecordKey(config), result.score);

            if (result.victory && config.mode == RunMode.Campaign)
            {
                update.stars = Math.Max(1, ProgressionMath.ScoreStars(config.stageId, result.score));
                profile.SetStars(config.stageId, config.difficulty, update.stars);
                profile.unlockedStage = Math.Max(profile.unlockedStage, Math.Min(CampaignCatalog.Stages.Length - 1, config.stageId + 1));
                if (config.stageId >= 10) profile.overdriveUnlocked = true;
                CampaignWorldDefinition world = CampaignCatalog.WorldForStage(config.stageId);
                if (config.stageId == world.endStage)
                {
                    WorldUpgradeDefinition worldUpgrade = CampaignCatalog.GetWorldUpgrade(world.id);
                    if (!profile.HasWorldUpgrade(worldUpgrade.id))
                    {
                        profile.worldCoreUpgrades.Add(worldUpgrade.id);
                        update.worldUpgrade = worldUpgrade;
                    }
                }
            }

            if (result.victory && config.mode == RunMode.Prime && !string.IsNullOrEmpty(config.primeId))
                profile.SetPrimeBestTime(config.primeId, result.elapsed);

            if (config.mode == RunMode.Threat)
            {
                profile.threatBestScore = Math.Max(profile.threatBestScore, result.score);
                if (result.victory)
                {
                    profile.highestThreat = Math.Max(profile.highestThreat, config.threatLevel);
                    profile.highestThreatAvailable = Math.Max(profile.highestThreatAvailable, ThreatSystem.MaxAttempt(profile.highestThreat));
                    if (profile.threatBestClearTime < 0 || result.elapsed < profile.threatBestClearTime) profile.threatBestClearTime = result.elapsed;
                }
            }

            AchievementEvaluation achievements = AchievementSystem.RecordRun(profile, config, result, reward);
            update.achievementReward = achievements.reward;
            update.achievements.AddRange(achievements.newlyUnlocked);
            profile.AddShards(achievements.reward);
            result.shardsEarned = SafeAdd(reward, achievements.reward);
            result.stars = update.stars;
            string[] ids = new string[achievements.newlyUnlocked.Count];
            for (int i = 0; i < ids.Length; i++) ids[i] = achievements.newlyUnlocked[i].id;
            result.newAchievements = ids;

            profile.rank = Math.Max(profile.rank, ProgressionMath.CalculateRank(profile.TotalStars,
                profile.highestThreat, profile.PrimeClearCount, profile.rankXp));
            ProfileSanitizer.Sanitize(profile);
            return update;
        }

        public static bool PurchaseHealth(PlayerProfile profile)
        {
            if (profile == null) return false;
            ProfileSanitizer.Sanitize(profile);
            int cost = ProgressionBalance.HealthCost(profile.healthBonus);
            if (cost < 0 || !profile.TrySpendShards(cost)) return false;
            profile.healthBonus++;
            return true;
        }

        public static bool UnlockPower(PlayerProfile profile, PersistentPowerId id)
        {
            if (profile == null || !Enum.IsDefined(typeof(PersistentPowerId), id)) return false;
            if (profile.unlockedPowerIds == null) profile.unlockedPowerIds = new List<PersistentPowerId>();
            if (profile.unlockedPowerIds.Contains(id)) return false;
            profile.unlockedPowerIds.Add(id);
            return true;
        }

        public static bool CanEnterCampaign(PlayerProfile profile, int stageId)
        {
            return profile != null && stageId >= 0 && stageId < CampaignCatalog.Stages.Length && stageId <= profile.unlockedStage;
        }

        public static bool CanEnterPrime(PlayerProfile profile, string primeId)
        {
            return profile != null && PrimeMissionCatalog.GetById(primeId) != null && profile.HasPrime(primeId);
        }

        private static int SafeAdd(int value, int add)
        {
            long result = (long)Math.Max(0, value) + Math.Max(0, add);
            return result >= int.MaxValue ? int.MaxValue : (int)result;
        }
    }
}

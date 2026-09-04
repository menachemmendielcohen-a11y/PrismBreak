using System;
using UnityEngine;

namespace PrismBreak
{
    public static class RewardCalculator
    {
        public static int Calculate(RunMode mode, RewardMetrics metrics, PrimeMissionDefinition prime = null, int threatLevel = 1)
        {
            if (metrics == null) return 0;
            float scoreRatio = Mathf.Clamp01(metrics.score / Mathf.Max(1f, metrics.targetScore));
            float comboRatio = Mathf.Clamp01((metrics.bestCombo - 1f) / 7f);
            float speedRatio = Mathf.Clamp01((metrics.duration - metrics.elapsed) / Mathf.Max(1f, metrics.duration * .35f));
            float performance = Mathf.Clamp01(scoreRatio * .42f + comboRatio * .35f + speedRatio * .23f);
            int perfect = metrics.hitsTaken == 0 ? 1 : 0;

            if (!metrics.victory)
            {
                float effort = Mathf.Clamp01(metrics.elapsed / Mathf.Max(1f, metrics.duration));
                int basis = mode == RunMode.Threat ? ThreatSystem.RewardRange(threatLevel).minimum
                    : mode == RunMode.Prime && prime != null ? prime.minReward : 4;
                return Math.Max(1, Mathf.RoundToInt(basis * effort * .3f));
            }

            if (mode == RunMode.Campaign)
                return ProgressionBalance.CampaignCompletionReward
                    + Mathf.RoundToInt(performance * ProgressionBalance.CampaignPerformanceRewardMax)
                    + Mathf.RoundToInt(comboRatio * ProgressionBalance.CampaignComboRewardMax)
                    + perfect * ProgressionBalance.CampaignNoHitReward;

            if (mode == RunMode.Prime && prime != null)
                return Mathf.RoundToInt(prime.minReward + (prime.maxReward - prime.minReward) * performance + perfect * 2);

            if (mode == RunMode.Threat)
            {
                IntRange range = ThreatSystem.RewardRange(threatLevel);
                return Mathf.RoundToInt(range.minimum + (range.maximum - range.minimum) * performance
                    + perfect * Math.Max(1, Mathf.RoundToInt(threatLevel / 25f)));
            }
            return Math.Max(1, Mathf.RoundToInt(3 + performance * 5 + perfect * 2));
        }

        public static int ForRun(RunConfig config, RunResult result, int bonusPickups = 0)
        {
            if (config == null || result == null) return Math.Max(0, bonusPickups);
            int targetScore = config.mode == RunMode.Campaign
                ? CampaignCatalog.GetStage(config.stageId).scoreTargets[1]
                : Math.Max(30000, config.objectiveTarget * 700);
            RewardMetrics metrics = new RewardMetrics
            {
                victory = result.victory, score = result.score, targetScore = targetScore,
                bestCombo = result.bestCombo, hitsTaken = result.hitsTaken, elapsed = result.elapsed,
                duration = config.duration, absorbed = result.absorbed,
            };
            PrimeMissionDefinition prime = string.IsNullOrEmpty(config.primeId) ? null : PrimeMissionCatalog.GetById(config.primeId);
            return Math.Max(0, bonusPickups) + Calculate(config.mode, metrics, prime, config.threatLevel);
        }
    }
}

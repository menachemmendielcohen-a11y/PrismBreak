using System;

namespace PrismBreak
{
    /// <summary>
    /// Single source of truth for long-term progression and economy tuning.
    /// Keep presentation code free of balance constants so live tuning remains safe.
    /// </summary>
    public static class ProgressionBalance
    {
        public const int SaveVersion = 4;

        public const int CampaignCompletionReward = 5;
        public const int CampaignPerformanceRewardMax = 5;
        public const int CampaignComboRewardMax = 5;
        public const int CampaignNoHitReward = 3;

        public static readonly int[] HealthUpgradeCosts = { 30, 65, 110, 170, 245, 335 };

        public const int InitialThreatMaximum = 10;
        public const float ThreatDuration = 100f;
        public static readonly int[] ModifierMilestones = { 26, 51, 81, 121 };

        public const float ThreatHealthCap = 3.25f;
        public const float ThreatMovementCap = 1.55f;
        public const float ThreatProjectileCap = 1.9f;
        public const float ThreatSpawnCap = 2.2f;
        public const float ThreatAttackCap = 2.15f;
        public const int ThreatEnemyCap = 72;

        public static int HealthCost(int purchasedLevels)
        {
            return purchasedLevels >= 0 && purchasedLevels < HealthUpgradeCosts.Length
                ? HealthUpgradeCosts[purchasedLevels]
                : -1;
        }
    }

    [Serializable]
    public sealed class IntRange
    {
        public int minimum;
        public int maximum;

        public IntRange() { }
        public IntRange(int minimum, int maximum)
        {
            this.minimum = minimum;
            this.maximum = maximum;
        }
    }
}

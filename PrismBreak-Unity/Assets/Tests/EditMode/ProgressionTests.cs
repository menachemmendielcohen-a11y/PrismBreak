using System;
using NUnit.Framework;

namespace PrismBreak.Tests
{
    public sealed class ProgressionTests
    {
        [Test]
        public void NewPlayer_HasSafeVersionFourDefaults()
        {
            PlayerProfile profile = ProfileSanitizer.Sanitize(PlayerProfile.CreateDefault());
            Assert.That(profile.saveVersion, Is.EqualTo(4));
            Assert.That(profile.prismShards, Is.Zero);
            Assert.That(profile.rank, Is.EqualTo(1));
            Assert.That(profile.highestThreatAvailable, Is.EqualTo(10));
            Assert.That(profile.settings.language, Is.EqualTo(LanguageId.English));
            Assert.That(profile.settings.musicEnabled, Is.True);
            Assert.That(profile.selectedShip, Is.Zero);
        }

        [Test]
        public void CampaignCatalog_ContainsCalibrationAndOneHundredStagesAcrossFourWorlds()
        {
            Assert.That(CampaignCatalog.Stages.Length, Is.EqualTo(101));
            Assert.That(CampaignCatalog.GetStage(0).name, Is.EqualTo("CALIBRATION"));
            Assert.That(CampaignCatalog.GetStage(100).objective, Is.EqualTo(ObjectiveKind.Boss));
            Assert.That(CampaignCatalog.Worlds.Length, Is.EqualTo(4));
            Assert.That(CampaignCatalog.WorldForStage(10).id, Is.EqualTo(1));
            Assert.That(CampaignCatalog.WorldForStage(11).id, Is.EqualTo(2));
            Assert.That(CampaignCatalog.WorldForStage(26).id, Is.EqualTo(3));
            Assert.That(CampaignCatalog.WorldForStage(51).id, Is.EqualTo(4));
            for (int i = 0; i < CampaignCatalog.Stages.Length; i++)
            {
                Assert.That(CampaignCatalog.Stages[i].id, Is.EqualTo(i));
                Assert.That(CampaignCatalog.Stages[i].roster, Is.Not.Empty);
                Assert.That(CampaignCatalog.Stages[i].maxActiveElites, Is.LessThanOrEqualTo(2));
            }
        }

        [Test]
        public void ThreatScaling_IsSoftAtKeyMilestonesAndBoundedAtOneThousand()
        {
            int[] levels = { 1, 5, 10, 20, 40, 60, 100, 200, 500, 1000 };
            float previousHealth = 0;
            for (int i = 0; i < levels.Length; i++)
            {
                ThreatScaling scaling = ThreatSystem.Scaling(levels[i]);
                Assert.That(scaling.enemyHealth, Is.GreaterThanOrEqualTo(previousHealth));
                Assert.That(scaling.enemyHealth, Is.LessThanOrEqualTo(ProgressionBalance.ThreatHealthCap));
                Assert.That(scaling.enemySpeed, Is.LessThanOrEqualTo(ProgressionBalance.ThreatMovementCap));
                Assert.That(scaling.projectileSpeed, Is.LessThanOrEqualTo(ProgressionBalance.ThreatProjectileCap));
                Assert.That(scaling.spawnRate, Is.LessThanOrEqualTo(ProgressionBalance.ThreatSpawnCap));
                Assert.That(scaling.attackRate, Is.LessThanOrEqualTo(ProgressionBalance.ThreatAttackCap));
                Assert.That(scaling.maxEnemies, Is.LessThanOrEqualTo(ProgressionBalance.ThreatEnemyCap));
                previousHealth = scaling.enemyHealth;
            }
            Assert.That(ThreatSystem.Scaling(1).enemyHealth, Is.LessThan(1));
            Assert.That(ThreatSystem.Scaling(10).enemyHealth, Is.EqualTo(1).Within(.001));
            Assert.That(ThreatSystem.Scaling(1000).enemyHealth, Is.LessThan(2.7));
        }

        [Test]
        public void ThreatModifiers_NeverProduceIncompatiblePairs()
        {
            int[] levels = { 26, 51, 81, 121, 200, 500, 1000, 10000 };
            for (int l = 0; l < levels.Length; l++)
            {
                ThreatModifierId[] modifiers = ThreatSystem.SelectModifiers(levels[l]);
                Assert.That(modifiers.Length, Is.LessThanOrEqualTo(4));
                for (int i = 0; i < modifiers.Length; i++)
                    for (int j = i + 1; j < modifiers.Length; j++)
                        Assert.That(ThreatSystem.AreCompatible(modifiers[i], modifiers[j]), Is.True,
                            "Impossible pair at Threat " + levels[l]);
            }
        }

        [Test]
        public void ThreatUnlockRange_AllowsAReachableRiskJump()
        {
            Assert.That(ThreatSystem.MaxAttempt(0), Is.EqualTo(10));
            Assert.That(ThreatSystem.MaxAttempt(20), Is.EqualTo(30));
            PlayerProfile profile = PlayerProfile.CreateDefault();
            profile.highestThreat = 20;
            profile.highestThreatAvailable = 30;
            Assert.That(ThreatSystem.CanAttempt(profile, 30), Is.True);
            Assert.That(ThreatSystem.CanAttempt(profile, 31), Is.False);
        }

        [Test]
        public void ThreatRewards_GrowWithoutBreakingAtHighLevels()
        {
            IntRange low = ThreatSystem.RewardRange(10);
            IntRange medium = ThreatSystem.RewardRange(50);
            IntRange high = ThreatSystem.RewardRange(1000);
            Assert.That(low.minimum, Is.GreaterThanOrEqualTo(5));
            Assert.That(medium.minimum, Is.GreaterThan(low.minimum));
            Assert.That(high.minimum, Is.GreaterThan(medium.minimum));
            Assert.That(high.maximum, Is.GreaterThan(high.minimum));
        }

        [Test]
        public void PrimeMissions_ArePermanentAffordableBonusStages()
        {
            Assert.That(PrimeMissionCatalog.All.Length, Is.EqualTo(3));
            for (int i = 0; i < PrimeMissionCatalog.All.Length; i++)
            {
                PrimeMissionDefinition mission = PrimeMissionCatalog.All[i];
                Assert.That(mission.difficulty, Is.EqualTo(Difficulty.Cadet));
                Assert.That(mission.maxActiveElites, Is.LessThanOrEqualTo(1));
                Assert.That(mission.modifiers, Is.Empty);
                Assert.That(mission.bonuses.Length, Is.GreaterThanOrEqualTo(3));
                Assert.That(mission.scaling.integrityPenalty, Is.Zero);
                Assert.That(mission.scaling.novaDrain, Is.Zero);
            }

            PlayerProfile profile = PlayerProfile.CreateDefault();
            PrimeMissionDefinition first = PrimeMissionCatalog.All[0];
            profile.rank = first.requiredRank;
            profile.prismShards = first.unlockCost;
            Assert.That(PrimeMissionCatalog.Purchase(profile, first), Is.True);
            Assert.That(profile.prismShards, Is.Zero);
            Assert.That(profile.HasPrime(first.id), Is.True);
            Assert.That(PrimeMissionCatalog.Purchase(profile, first), Is.False);
            Assert.That(profile.prismShards, Is.Zero);
        }

        [Test]
        public void Currency_NeverGoesNegative()
        {
            PlayerProfile profile = PlayerProfile.CreateDefault();
            profile.prismShards = 3;
            Assert.That(profile.TrySpendShards(4), Is.False);
            Assert.That(profile.prismShards, Is.EqualTo(3));
            Assert.That(profile.TrySpendShards(-1), Is.False);
            Assert.That(profile.TrySpendShards(1), Is.True);
            Assert.That(profile.prismShards, Is.EqualTo(2));
        }

        [Test]
        public void VersionFourProfile_RoundTripsAllImportantProgression()
        {
            PlayerProfile source = PlayerProfile.CreateDefault();
            source.prismShards = 144;
            source.unlockedStage = 22;
            source.selectedShip = 17;
            source.highestThreat = 31;
            source.highestThreatAvailable = 47;
            source.rank = 8;
            source.settings.language = LanguageId.Hebrew;
            source.settings.musicEnabled = false;
            source.SetStars(7, Difficulty.Cadet, 3);
            source.SetBestScore("campaign:7:cadet", 45678);
            source.AddPrime("prime-1");
            source.SetPrimeBestTime("prime-1", 42.5f);
            source.unlockedPowerIds.Add(PersistentPowerId.Lance);
            source.worldCoreUpgrades.Add(WorldUpgradeId.OriginGuard);

            string json = SaveService.Serialize(source);
            PlayerProfile loaded = SaveService.Deserialize(json);
            Assert.That(loaded, Is.Not.Null);
            Assert.That(loaded.prismShards, Is.EqualTo(144));
            Assert.That(loaded.selectedShip, Is.EqualTo(17));
            Assert.That(loaded.GetStars(7, Difficulty.Cadet), Is.EqualTo(3));
            Assert.That(loaded.GetBestScore("campaign:7:cadet"), Is.EqualTo(45678));
            Assert.That(loaded.HasPrime("prime-1"), Is.True);
            Assert.That(loaded.GetPrimeBestTime("prime-1"), Is.EqualTo(42.5f).Within(.01));
            Assert.That(loaded.HasPower(PersistentPowerId.Lance), Is.True);
            Assert.That(loaded.settings.language, Is.EqualTo(LanguageId.Hebrew));
            Assert.That(loaded.settings.musicEnabled, Is.False);
        }

        [Test]
        public void BrowserProfile_MigratesObjectMapsAndLegacyCoins()
        {
            const string legacy = "{\"saveVersion\":2,\"coins\":88,\"unlockedStage\":9,\"selectedShip\":28,\"stars\":{\"4:cadet\":3},\"bestScores\":{\"campaign:4:cadet\":9001},\"unlockedPowers\":{\"lance\":true},\"unlockedPrimeIds\":[\"prime-1\"],\"highestThreat\":12}";
            PlayerProfile profile = SaveService.Deserialize(legacy);
            Assert.That(profile.prismShards, Is.EqualTo(88));
            Assert.That(profile.unlockedStage, Is.EqualTo(9));
            Assert.That(profile.selectedShip, Is.EqualTo(28));
            Assert.That(profile.GetStars(4, Difficulty.Cadet), Is.EqualTo(3));
            Assert.That(profile.GetBestScore("campaign:4:cadet"), Is.EqualTo(9001));
            Assert.That(profile.HasPower(PersistentPowerId.Lance), Is.True);
            Assert.That(profile.HasPrime("prime-1"), Is.True);
            Assert.That(profile.highestThreatAvailable, Is.GreaterThanOrEqualTo(18));
        }

        [Test]
        public void CampaignClear_AdvancesWithoutResettingExistingProgress()
        {
            PlayerProfile profile = PlayerProfile.CreateDefault();
            profile.prismShards = 20;
            RunConfig config = RunConfigFactory.Campaign(1, Difficulty.Cadet);
            RunResult result = new RunResult { victory = true, score = 25000, elapsed = 40, bestCombo = 4, hitsTaken = 1, kills = 20 };
            ProgressionUpdateResult update = ProgressionService.ApplyRun(profile, config, result);
            Assert.That(profile.unlockedStage, Is.EqualTo(2));
            Assert.That(profile.GetStars(1, Difficulty.Cadet), Is.GreaterThanOrEqualTo(1));
            Assert.That(profile.prismShards, Is.GreaterThan(20));
            Assert.That(update.runReward, Is.GreaterThan(0));
            Assert.That(profile.totalRuns, Is.EqualTo(1));
            Assert.That(profile.successfulRuns, Is.EqualTo(1));
        }

        [Test]
        public void FailedRun_StillPaysSmallEffortReward()
        {
            RunConfig config = RunConfigFactory.Threat(25);
            RunResult result = new RunResult { victory = false, elapsed = 50, score = 1000, bestCombo = 1 };
            int reward = RewardCalculator.ForRun(config, result);
            Assert.That(reward, Is.GreaterThanOrEqualTo(1));
            Assert.That(reward, Is.LessThan(ThreatSystem.RewardRange(25).minimum));
        }
    }
}

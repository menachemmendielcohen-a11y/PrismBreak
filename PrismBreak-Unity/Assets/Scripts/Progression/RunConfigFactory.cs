using System;
using UnityEngine;

namespace PrismBreak
{
    public static class RunConfigFactory
    {
        public static RunConfig Campaign(int stageId, Difficulty difficulty = Difficulty.Cadet, int seed = 0)
        {
            StageDefinition stage = CampaignCatalog.GetStage(stageId);
            return new RunConfig
            {
                mode = RunMode.Campaign, stageId = stage.id, difficulty = difficulty, duration = stage.duration,
                bossTime = stage.bossTime, roster = stage.roster, objective = stage.objective,
                objectiveTarget = stage.target, eliteChance = stage.eliteChance,
                label = "STAGE " + stage.code + " // " + stage.name, scaling = ThreatSystem.Scaling(Math.Max(1, stage.id), stage.modifiers),
                modifiers = stage.modifiers, maxHostiles = stage.maxHostiles, maxActiveElites = stage.maxActiveElites,
                eliteTierCap = stage.eliteTierCap, seed = ResolveSeed(seed, 0x1731 + stage.id),
            };
        }

        public static RunConfig Prime(int index, int seed = 0)
        {
            PrimeMissionDefinition mission = PrimeMissionCatalog.Get(index);
            return new RunConfig
            {
                mode = RunMode.Prime, stageId = index, difficulty = mission.difficulty, duration = mission.duration,
                roster = new[] { EnemyKind.Needle, EnemyKind.Halo, EnemyKind.Splitter, EnemyKind.Lancer, EnemyKind.Bulwark },
                objective = mission.objective, objectiveTarget = mission.target, eliteChance = mission.scaling.eliteChance,
                label = mission.code + " // " + mission.name, primeId = mission.id, primeBonuses = mission.bonuses,
                modifiers = mission.modifiers, scaling = mission.scaling.Clone(), maxHostiles = mission.maxHostiles,
                maxActiveElites = mission.maxActiveElites, eliteTierCap = EliteTier.Minor,
                seed = ResolveSeed(seed, 0x2911 + index),
            };
        }

        public static RunConfig Threat(int level, int seed = 0)
        {
            int safe = Math.Max(1, level);
            ThreatModifierId[] modifiers = ThreatSystem.SelectModifiers(safe);
            ThreatScaling scaling = ThreatSystem.Scaling(safe, modifiers);
            return new RunConfig
            {
                mode = RunMode.Threat, stageId = safe, threatLevel = safe, difficulty = Difficulty.Standard,
                duration = ProgressionBalance.ThreatDuration, roster = new[] { EnemyKind.Needle, EnemyKind.Halo, EnemyKind.Splitter, EnemyKind.Lancer, EnemyKind.Bulwark, EnemyKind.Skimmer, EnemyKind.Weaver, EnemyKind.Warden, EnemyKind.Siphon, EnemyKind.Phantom, EnemyKind.Oracle },
                objective = ObjectiveKind.Survive, objectiveTarget = (int)ProgressionBalance.ThreatDuration,
                eliteChance = scaling.eliteChance, label = "THREAT LEVEL " + safe, modifiers = modifiers,
                scaling = scaling, maxHostiles = scaling.maxEnemies, maxActiveElites = 2, eliteTierCap = EliteTier.Major,
                seed = ResolveSeed(seed, unchecked(0x510000 + safe * 7919)),
            };
        }

        public static RunConfig Daily(int daySeed, int seed = 0)
        {
            int level = 18 + Math.Abs(daySeed % 18);
            RunConfig config = Threat(level, ResolveSeed(seed, daySeed));
            config.mode = RunMode.Daily;
            config.stageId = -1;
            config.label = "DAILY RIFT";
            return config;
        }

        public static RunConfig Arcade(Difficulty difficulty = Difficulty.Standard, int seed = 0)
        {
            return new RunConfig
            {
                mode = RunMode.Arcade, stageId = -1, difficulty = difficulty, duration = 120,
                roster = new[] { EnemyKind.Needle, EnemyKind.Halo, EnemyKind.Splitter, EnemyKind.Lancer, EnemyKind.Bulwark },
                objective = ObjectiveKind.Survive, objectiveTarget = 120, label = "ARCADE RIFT",
                scaling = ThreatSystem.Scaling(12, Array.Empty<ThreatModifierId>()), maxHostiles = 30,
                maxActiveElites = 2, eliteTierCap = EliteTier.Major, seed = ResolveSeed(seed, 0x66151),
            };
        }

        private static int ResolveSeed(int requested, int fallback) { return requested == 0 ? fallback : requested; }
    }
}

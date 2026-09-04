using System;
using System.Collections.Generic;
using UnityEngine;

namespace PrismBreak
{
    [Serializable]
    public sealed class CampaignWorldDefinition
    {
        public int id;
        public int startStage;
        public int endStage;
        public string name = string.Empty;
        public string hebrewName = string.Empty;
        public string subtitle = string.Empty;
        public string hebrewSubtitle = string.Empty;
    }

    [Serializable]
    public sealed class WorldUpgradeDefinition
    {
        public WorldUpgradeId id;
        public int world;
        public string glyph = string.Empty;
        public string name = string.Empty;
        public string hebrewName = string.Empty;
        public string description = string.Empty;
        public string hebrewDescription = string.Empty;
    }

    /// <summary>
    /// Campaign stage 0 is the playable calibration; stages 1-100 form four worlds.
    /// Entries are generated once at startup, deterministically, rather than authored
    /// as hundreds of scene assets. This keeps the catalog compact and testable.
    /// </summary>
    public static class CampaignCatalog
    {
        public static readonly CampaignWorldDefinition[] Worlds =
        {
            World(1, 0, 10, "ORIGIN GRID", "רשת המקור", "VERY EASY // LEARN AND ADVANCE", "קל מאוד // למידה והתקדמות"),
            World(2, 11, 25, "CHROMA FRONTIER", "חזית הכרומה", "MEDIUM // ADAPT TO NEW SIGNALS", "בינוני // הסתגל לאותות חדשים"),
            World(3, 26, 50, "VOID ENGINE", "מנוע הריק", "HARDENING // BREAK THE FORMATIONS", "מתחיל להיות קשה // שבור את המבנים"),
            World(4, 51, 100, "ETERNAL APERTURE", "המפתח הנצחי", "HARD // MASTER THE PROTOCOL", "קשה // שלוט בפרוטוקול"),
        };

        public static readonly WorldUpgradeDefinition[] WorldUpgrades =
        {
            Upgrade(WorldUpgradeId.OriginGuard, 1, "◇", "ORIGIN GUARD", "מגן המקור", "Start every run with one Prism Shield charge.", "כל ריצה מתחילה עם טעינת מגן פריזמה אחת."),
            Upgrade(WorldUpgradeId.ChromaArray, 2, "✦", "CHROMA ARRAY", "מערך כרומה", "All normal ship fire deals 12% more damage.", "כל הירי הרגיל של החללית גורם 12% יותר נזק."),
            Upgrade(WorldUpgradeId.VoidDrive, 3, "»", "VOID DRIVE", "מנוע ריק", "Dash recharges 14% faster in every mode.", "הדאש נטען 14% מהר יותר בכל מצב."),
            Upgrade(WorldUpgradeId.EternalResonance, 4, "∞", "ETERNAL RESONANCE", "תהודה נצחית", "Absorbed fire grants 20% more Nova charge.", "ספיגת ירי מעניקה 20% יותר טעינת נובה."),
        };

        private static readonly string[] GeneratedNames =
        {
            "AFTERGLOW", "MIRRORLINE", "RESONANCE", "GATEKEEPER", "ORIGIN BREAKER",
            "RED VECTOR", "CHROMA WAKE", "TWIN HORIZON", "SIGNAL MAZE", "PRISM FORGE",
            "VOID CURRENT", "DARK REFRACTION", "GRAVITY KNOT", "SHATTERFIELD", "NIGHT ENGINE",
            "PHANTOM ARRAY", "CROWN OF STATIC", "NULL CASCADE", "LAST SPECTRUM", "ETERNAL BREAK",
        };

        public static readonly StageDefinition[] Stages = BuildStages();

        public static StageDefinition GetStage(int id)
        {
            return Stages[Mathf.Clamp(id, 0, Stages.Length - 1)];
        }

        public static CampaignWorldDefinition WorldForStage(int stageId)
        {
            int safe = Mathf.Clamp(stageId, 0, 100);
            for (int i = 0; i < Worlds.Length; i++)
            {
                if (safe >= Worlds[i].startStage && safe <= Worlds[i].endStage) return Worlds[i];
            }
            return Worlds[0];
        }

        public static WorldUpgradeDefinition GetWorldUpgrade(int worldId)
        {
            return WorldUpgrades[Mathf.Clamp(worldId, 1, 4) - 1];
        }

        private static StageDefinition[] BuildStages()
        {
            StageDefinition[] stages = new StageDefinition[101];
            stages[0] = Stage(0, "CALIBRATION", "Learn the light", "A protected chamber teaches movement, Perfect Absorb, spectrum storage, Refraction and Prism Break through play.", 60, -1, new[] { EnemyKind.Needle, EnemyKind.Halo, EnemyKind.Splitter, EnemyKind.Lancer }, ObjectiveKind.Survive, 60, 0f, 4200, 9000, 16000, 8, 2, EliteTier.Minor);
            stages[1] = Stage(1, "FIRST CONTACT", "Hold the perimeter", "Needles breach the arena while Halos establish a crossfire. Survive the first incursion.", 42, -1, new[] { EnemyKind.Needle, EnemyKind.Halo }, ObjectiveKind.Survive, 42, 0f, 5200, 11000, 20000, 12, 2, EliteTier.Minor);
            stages[2] = Stage(2, "CROSSFIRE", "Break the formation", "Splitters seed the arena with new threats. Destroy the formation before the timer collapses.", 68, -1, new[] { EnemyKind.Needle, EnemyKind.Halo, EnemyKind.Splitter }, ObjectiveKind.Kills, 32, .07f, 18000, 34000, 56000, 18, 2, EliteTier.Minor);
            stages[3] = Stage(3, "FRACTURE", "Feed on the storm", "Lancers weaponize the grid. Survive the storm; absorption is a powerful bonus, not a hard requirement.", 88, -1, new[] { EnemyKind.Needle, EnemyKind.Halo, EnemyKind.Splitter, EnemyKind.Lancer }, ObjectiveKind.Survive, 88, .05f, 19000, 36000, 61000, 18, 2, EliteTier.Minor);
            stages[4] = Stage(4, "SIEGE", "Hunt the elites", "Minor elite signatures breach in pairs. Eliminate six to collapse the siege lattice.", 88, -1, new[] { EnemyKind.Needle, EnemyKind.Halo, EnemyKind.Splitter, EnemyKind.Lancer, EnemyKind.Bulwark }, ObjectiveKind.Elites, 6, .16f, 45000, 78000, 118000, 14, 2, EliteTier.Minor);
            stages[5] = Stage(5, "THE APERTURE", "End the protocol", "The architect enters the arena. Survive its rings, reach the core and break the Aperture.", 120, 76, new[] { EnemyKind.Needle, EnemyKind.Halo, EnemyKind.Splitter, EnemyKind.Lancer, EnemyKind.Bulwark }, ObjectiveKind.Boss, 1, .16f, 72000, 125000, 190000, 18, 2, EliteTier.Minor);

            for (int id = 6; id <= 100; id++) stages[id] = GenerateStage(id);
            return stages;
        }

        private static StageDefinition GenerateStage(int id)
        {
            CampaignWorldDefinition world = WorldForStage(id);
            float worldProgress = (id - world.startStage) / Mathf.Max(1f, world.endStage - world.startStage);
            bool worldBoss = id == world.endStage;
            EnemyKind[] roster = RosterForWorld(world.id);
            ObjectiveKind objective = worldBoss
                ? ObjectiveKind.Boss
                : id <= 10
                    ? (id % 3 == 0 ? ObjectiveKind.Kills : ObjectiveKind.Survive)
                    : id % 5 == 0 ? ObjectiveKind.Elites : id % 4 == 0 ? ObjectiveKind.Absorb : id % 3 == 0 ? ObjectiveKind.Kills : ObjectiveKind.Survive;

            int duration = Mathf.RoundToInt(54 + world.id * 10 + worldProgress * 22);
            int target;
            switch (objective)
            {
                case ObjectiveKind.Boss: target = 1; break;
                case ObjectiveKind.Elites: target = Mathf.Min(10, 4 + world.id); break;
                case ObjectiveKind.Absorb: target = 16 + world.id * 7 + Mathf.FloorToInt(worldProgress * 12); break;
                case ObjectiveKind.Kills: target = id <= 10 ? 20 + id * 2 : 28 + world.id * 9 + Mathf.FloorToInt(worldProgress * 15); break;
                default: target = duration; break;
            }

            int mastery = Mathf.RoundToInt(8500 + id * 2400 + Mathf.Pow(id, 1.18f) * 380);
            string name = worldBoss ? world.name + " CORE" : GeneratedNames[(id * 7 + world.id * 3) % GeneratedNames.Length];
            StageDefinition result = Stage(id, name,
                worldBoss ? "Break World " + world.id : world.name + " // Sector " + (id - world.startStage + 1).ToString("00"),
                worldBoss ? "The world core is exposed. Survive its final pattern and break its signal." : "Read the new formations and complete the marked objective.",
                duration, worldBoss ? Mathf.RoundToInt(duration * .62f) : -1f, roster, objective, target,
                id <= 10 ? .06f : id <= 25 ? .09f : id <= 50 ? .12f : .15f,
                Mathf.RoundToInt(mastery * .62f), mastery, Mathf.RoundToInt(mastery * 1.5f),
                id <= 10 ? 18 : id <= 25 ? 24 : id <= 50 ? 30 : 36,
                2, id <= 10 ? EliteTier.Minor : EliteTier.Major);
            result.modifiers = id >= 26 ? ThreatSystem.SelectModifiers(id) : Array.Empty<ThreatModifierId>();
            return result;
        }

        private static StageDefinition Stage(int id, string name, string subtitle, string briefing, float duration,
            float bossTime, EnemyKind[] roster, ObjectiveKind objective, int target, float eliteChance,
            int bronze, int silver, int gold, int maxHostiles, int maxElites, EliteTier eliteTierCap)
        {
            return new StageDefinition
            {
                id = id,
                code = id.ToString("00"),
                name = name,
                hebrewName = id == 0 ? "כיול" : "שלב " + id.ToString("00"),
                subtitle = subtitle,
                hebrewSubtitle = WorldForStage(id).hebrewName,
                briefing = briefing,
                hebrewBriefing = "השלם את המטרה, השתמש בספיגה ובשבירה והתקדם אל ליבת העולם.",
                world = WorldForStage(id).id,
                duration = duration,
                bossTime = bossTime,
                roster = roster,
                objective = objective,
                target = target,
                eliteChance = eliteChance,
                scoreTargets = new[] { bronze, silver, gold },
                modifiers = Array.Empty<ThreatModifierId>(),
                maxHostiles = maxHostiles,
                maxActiveElites = maxElites,
                eliteTierCap = eliteTierCap,
            };
        }

        private static EnemyKind[] RosterForWorld(int world)
        {
            switch (world)
            {
                case 2: return new[] { EnemyKind.Skimmer, EnemyKind.Weaver, EnemyKind.Needle, EnemyKind.Halo };
                case 3: return new[] { EnemyKind.Warden, EnemyKind.Siphon, EnemyKind.Splitter, EnemyKind.Bulwark };
                case 4: return new[] { EnemyKind.Phantom, EnemyKind.Oracle, EnemyKind.Lancer, EnemyKind.Weaver };
                default: return new[] { EnemyKind.Needle, EnemyKind.Halo, EnemyKind.Splitter, EnemyKind.Lancer, EnemyKind.Bulwark };
            }
        }

        private static CampaignWorldDefinition World(int id, int start, int end, string name, string he, string subtitle, string heSubtitle)
        {
            return new CampaignWorldDefinition { id = id, startStage = start, endStage = end, name = name, hebrewName = he, subtitle = subtitle, hebrewSubtitle = heSubtitle };
        }

        private static WorldUpgradeDefinition Upgrade(WorldUpgradeId id, int world, string glyph, string name, string heName, string description, string heDescription)
        {
            return new WorldUpgradeDefinition { id = id, world = world, glyph = glyph, name = name, hebrewName = heName, description = description, hebrewDescription = heDescription };
        }
    }
}

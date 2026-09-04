using System;
using System.Collections.Generic;
using UnityEngine;

namespace PrismBreak
{
    /// <summary>Paid once, permanently unlocked, deliberately fun power-bonus missions.</summary>
    public static class PrimeMissionCatalog
    {
        public static readonly PrimeMissionDefinition[] All =
        {
            new PrimeMissionDefinition
            {
                id = "prime-1", code = "PRIME // I", name = "PRISM PARADE", hebrewName = "מצעד הפריזמה",
                description = "A short survival celebration with Twin Beam, a double shield and frequent power drops.",
                hebrewDescription = "חגיגת הישרדות קצרה עם ירי כפול, מגן כפול ודרופים תכופים.",
                requiredRank = 4, unlockCost = 60, duration = 55, objective = ObjectiveKind.Survive, target = 55,
                minReward = 14, maxReward = 24, difficulty = Difficulty.Cadet, maxHostiles = 16, maxActiveElites = 1,
                bonuses = new[] { PrimeBonusId.TwinArray, PrimeBonusId.AegisStart, PrimeBonusId.DropSurge },
                modifiers = Array.Empty<ThreatModifierId>(),
                scaling = Scale(.82f, .9f, .9f, .92f, 16, .015f, .88f, .82f),
            },
            new PrimeMissionDefinition
            {
                id = "prime-2", code = "PRIME // II", name = "CASCADE RANGE", hebrewName = "מטווח המפל",
                description = "A fast power fantasy: fragile targets pour in while Twin Beam and Rapid Fire stay online.",
                hebrewDescription = "שלב עוצמה מהיר: מטרות חלשות נכנסות לזירה בזמן שירי כפול ומהיר נשארים פעילים.",
                requiredRank = 8, unlockCost = 120, duration = 65, objective = ObjectiveKind.Kills, target = 40,
                minReward = 22, maxReward = 36, difficulty = Difficulty.Cadet, maxHostiles = 22, maxActiveElites = 1,
                bonuses = new[] { PrimeBonusId.TwinArray, PrimeBonusId.RapidArray, PrimeBonusId.DropSurge },
                modifiers = Array.Empty<ThreatModifierId>(),
                scaling = Scale(.72f, .9f, .84f, 1.25f, 22, .025f, .92f, .82f),
            },
            new PrimeMissionDefinition
            {
                id = "prime-3", code = "PRIME // III", name = "CHROMA HARVEST", hebrewName = "קציר כרומה",
                description = "A generous absorption playground with slow spectrum fire, boosted resonance and a double shield.",
                hebrewDescription = "מגרש ספיגה נדיב עם ירי ספקטרום איטי, תהודה מוגברת ומגן כפול.",
                requiredRank = 15, unlockCost = 220, duration = 70, objective = ObjectiveKind.Absorb, target = 24,
                minReward = 32, maxReward = 50, difficulty = Difficulty.Cadet, maxHostiles = 18, maxActiveElites = 1,
                bonuses = new[] { PrimeBonusId.ResonanceField, PrimeBonusId.AegisStart, PrimeBonusId.DropSurge },
                modifiers = Array.Empty<ThreatModifierId>(),
                scaling = Scale(.88f, .82f, .72f, .98f, 18, .015f, 1.05f, .8f),
            },
        };

        public static PrimeMissionDefinition Get(int index) { return All[Mathf.Clamp(index, 0, All.Length - 1)]; }

        public static PrimeMissionDefinition GetById(string id)
        {
            for (int i = 0; i < All.Length; i++) if (All[i].id == id) return All[i];
            return null;
        }

        public static bool CanUnlock(PlayerProfile profile, PrimeMissionDefinition mission)
        {
            return profile != null && mission != null && !profile.HasPrime(mission.id)
                && profile.rank >= mission.requiredRank && profile.prismShards >= mission.unlockCost;
        }

        public static bool Purchase(PlayerProfile profile, PrimeMissionDefinition mission)
        {
            if (!CanUnlock(profile, mission)) return false;
            if (!profile.TrySpendShards(mission.unlockCost)) return false;
            profile.AddPrime(mission.id);
            return true;
        }

        private static ThreatScaling Scale(float hp, float movement, float projectile, float spawn, int enemies,
            float elites, float attack, float dash)
        {
            return new ThreatScaling
            {
                enemyHealth = hp, enemySpeed = movement, projectileSpeed = projectile, spawnRate = spawn,
                maxEnemies = enemies, eliteChance = elites, attackRate = attack, dashCooldown = dash,
                integrityPenalty = 0, novaDrain = 0,
            };
        }
    }
}

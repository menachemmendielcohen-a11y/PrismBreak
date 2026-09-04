using System;
using System.Collections.Generic;
using UnityEngine;

namespace PrismBreak
{
    /// <summary>
    /// Endless, soft-capped Threat scaling. Stats grow in gentle milestone bands;
    /// beyond level 100 logarithmic growth and compatible modifiers add pressure.
    /// </summary>
    public static class ThreatSystem
    {
        private static readonly Dictionary<ThreatModifierId, int> MinimumLevel =
            new Dictionary<ThreatModifierId, int>
            {
                { ThreatModifierId.DoubleFire, 81 },
                { ThreatModifierId.EliteSwarm, 26 },
                { ThreatModifierId.FastProjectiles, 26 },
                { ThreatModifierId.NovaDrain, 81 },
                { ThreatModifierId.DashCooldown, 51 },
                { ThreatModifierId.HighDensity, 51 },
                { ThreatModifierId.AggressiveEnemies, 26 },
                { ThreatModifierId.LowIntegrity, 121 },
                { ThreatModifierId.RapidSpawn, 26 },
            };

        private static readonly ThreatModifierId[] ModifierOrder =
        {
            ThreatModifierId.EliteSwarm,
            ThreatModifierId.FastProjectiles,
            ThreatModifierId.AggressiveEnemies,
            ThreatModifierId.RapidSpawn,
            ThreatModifierId.DashCooldown,
            ThreatModifierId.HighDensity,
            ThreatModifierId.DoubleFire,
            ThreatModifierId.NovaDrain,
            ThreatModifierId.LowIntegrity,
        };

        private static readonly HashSet<string> Incompatible = new HashSet<string>
        {
            PairKey(ThreatModifierId.HighDensity, ThreatModifierId.RapidSpawn),
            PairKey(ThreatModifierId.HighDensity, ThreatModifierId.LowIntegrity),
            PairKey(ThreatModifierId.DoubleFire, ThreatModifierId.HighDensity),
            PairKey(ThreatModifierId.DoubleFire, ThreatModifierId.LowIntegrity),
            PairKey(ThreatModifierId.DoubleFire, ThreatModifierId.FastProjectiles),
            PairKey(ThreatModifierId.FastProjectiles, ThreatModifierId.LowIntegrity),
            PairKey(ThreatModifierId.DashCooldown, ThreatModifierId.FastProjectiles),
            PairKey(ThreatModifierId.LowIntegrity, ThreatModifierId.NovaDrain),
            PairKey(ThreatModifierId.LowIntegrity, ThreatModifierId.RapidSpawn),
            PairKey(ThreatModifierId.AggressiveEnemies, ThreatModifierId.LowIntegrity),
            PairKey(ThreatModifierId.DashCooldown, ThreatModifierId.NovaDrain),
            PairKey(ThreatModifierId.EliteSwarm, ThreatModifierId.RapidSpawn),
            PairKey(ThreatModifierId.DashCooldown, ThreatModifierId.LowIntegrity),
        };

        public static int MaxAttempt(int highestCompleted)
        {
            int highest = Math.Max(0, highestCompleted);
            if (highest == 0) return ProgressionBalance.InitialThreatMaximum;
            return Math.Max(10, highest + Math.Max(5, (int)Math.Ceiling(highest * .5)));
        }

        public static bool CanAttempt(PlayerProfile profile, int level)
        {
            if (profile == null || level < 1) return false;
            return level <= Math.Max(profile.highestThreatAvailable, MaxAttempt(profile.highestThreat));
        }

        public static IntRange RewardRange(int level)
        {
            int safe = Math.Max(1, level);
            int expected = (int)Math.Round(4 + safe * .78 + Math.Pow(safe, 1.12) * .02,
                MidpointRounding.AwayFromZero);
            return new IntRange(Math.Max(5, Round(expected * .78)), Math.Max(6, Round(expected * 1.22)));
        }

        public static string DangerLabel(int level)
        {
            int safe = Math.Max(1, level);
            if (safe <= 10) return "VERY LOW";
            if (safe <= 25) return "MODERATE";
            if (safe <= 50) return "RISING";
            if (safe <= 100) return "HIGH";
            if (safe <= 250) return "EXTREME";
            return "UNBOUNDED";
        }

        public static ThreatModifierId[] SelectModifiers(int level)
        {
            int safe = Math.Max(1, level);
            int desired = 0;
            for (int i = 0; i < ProgressionBalance.ModifierMilestones.Length; i++)
            {
                if (safe >= ProgressionBalance.ModifierMilestones[i]) desired++;
            }
            if (desired == 0) return Array.Empty<ThreatModifierId>();

            List<ThreatModifierId> pool = new List<ThreatModifierId>();
            for (int i = 0; i < ModifierOrder.Length; i++)
            {
                if (safe >= MinimumLevel[ModifierOrder[i]]) pool.Add(ModifierOrder[i]);
            }

            // Rotate by ten-level sectors: predictable for a selected level but not
            // permanently stuck on one modifier set in an endless run.
            int cursor = ((safe / 10) * 7 + safe) % Math.Max(1, pool.Count);
            List<ThreatModifierId> selected = new List<ThreatModifierId>(desired);
            for (int pass = 0; pass < pool.Count * 2 && selected.Count < desired; pass++)
            {
                ThreatModifierId candidate = pool[(cursor + pass) % pool.Count];
                if (selected.Contains(candidate)) continue;
                bool compatible = true;
                for (int i = 0; i < selected.Count; i++)
                {
                    if (!AreCompatible(selected[i], candidate)) { compatible = false; break; }
                }
                if (compatible && Pressure(candidate) + TotalPressure(selected) <= 7) selected.Add(candidate);
            }
            return selected.ToArray();
        }

        public static bool AreCompatible(ThreatModifierId first, ThreatModifierId second)
        {
            return first == second || !Incompatible.Contains(PairKey(first, second));
        }

        public static ThreatScaling Scaling(int level)
        {
            return Scaling(level, SelectModifiers(level));
        }

        public static ThreatScaling Scaling(int level, ThreatModifierId[] modifiers)
        {
            int safe = Math.Max(1, level);
            ThreatScaling scaling;
            if (safe <= 10)
                scaling = InterpolateBand(safe, 1, 10, .78f, 1f, .82f, 1f, .8f, 1f, .78f, 1f, 18, 26, 0f, .03f, .82f, 1f);
            else if (safe <= 25)
                scaling = InterpolateBand(safe, 10, 25, 1f, 1.25f, 1f, 1.1f, 1f, 1.1f, 1f, 1.15f, 26, 33, .03f, .08f, 1f, 1.12f);
            else if (safe <= 50)
                scaling = InterpolateBand(safe, 25, 50, 1.25f, 1.55f, 1.1f, 1.22f, 1.1f, 1.27f, 1.15f, 1.34f, 33, 40, .08f, .15f, 1.12f, 1.3f);
            else if (safe <= 100)
                scaling = InterpolateBand(safe, 50, 100, 1.55f, 1.95f, 1.22f, 1.36f, 1.27f, 1.46f, 1.34f, 1.58f, 40, 49, .15f, .23f, 1.3f, 1.52f);
            else
            {
                float endless = Mathf.Log(1f + Math.Max(0, safe - 100) / 100f);
                scaling = new ThreatScaling
                {
                    enemyHealth = Mathf.Min(ProgressionBalance.ThreatHealthCap, 1.95f + endless * .24f),
                    enemySpeed = Mathf.Min(ProgressionBalance.ThreatMovementCap, 1.36f + endless * .045f),
                    projectileSpeed = Mathf.Min(1.7f, 1.46f + endless * .06f),
                    spawnRate = Mathf.Min(1.9f, 1.58f + endless * .075f),
                    maxEnemies = Math.Min(64, Mathf.RoundToInt(49 + endless * 3.5f)),
                    eliteChance = Mathf.Min(.4f, .23f + endless * .035f),
                    attackRate = Mathf.Min(1.9f, 1.52f + endless * .075f),
                    dashCooldown = 1f,
                };
            }

            ThreatModifierId[] safeModifiers = modifiers ?? Array.Empty<ThreatModifierId>();
            float fast = Strength(ThreatModifierId.FastProjectiles, safe, safeModifiers);
            float spawn = Strength(ThreatModifierId.RapidSpawn, safe, safeModifiers);
            float density = Strength(ThreatModifierId.HighDensity, safe, safeModifiers);
            float elite = Strength(ThreatModifierId.EliteSwarm, safe, safeModifiers);
            float aggressive = Strength(ThreatModifierId.AggressiveEnemies, safe, safeModifiers);
            float doubleFire = Strength(ThreatModifierId.DoubleFire, safe, safeModifiers);
            float dash = Strength(ThreatModifierId.DashCooldown, safe, safeModifiers);
            float integrity = Strength(ThreatModifierId.LowIntegrity, safe, safeModifiers);
            float nova = Strength(ThreatModifierId.NovaDrain, safe, safeModifiers);

            if (fast > 0) scaling.projectileSpeed = Mathf.Min(ProgressionBalance.ThreatProjectileCap, scaling.projectileSpeed * (1 + .18f * fast));
            if (spawn > 0) scaling.spawnRate = Mathf.Min(ProgressionBalance.ThreatSpawnCap, scaling.spawnRate * (1 + .2f * spawn));
            if (density > 0) scaling.maxEnemies = Math.Min(ProgressionBalance.ThreatEnemyCap, scaling.maxEnemies + Mathf.RoundToInt(12 * density));
            if (elite > 0) scaling.eliteChance = Mathf.Min(.58f, scaling.eliteChance + .16f * elite);
            if (aggressive > 0) scaling.attackRate = Mathf.Min(ProgressionBalance.ThreatAttackCap, scaling.attackRate * (1 + .2f * aggressive));
            if (doubleFire > 0) scaling.attackRate = Mathf.Min(ProgressionBalance.ThreatAttackCap, scaling.attackRate * (1 + .28f * doubleFire));
            if (dash > 0) scaling.dashCooldown = 1 + .45f * dash;
            if (integrity >= .7f) scaling.integrityPenalty = 1;
            if (nova > 0) scaling.novaDrain = 2.4f * nova;
            return scaling;
        }

        private static ThreatScaling InterpolateBand(int level, int from, int to,
            float hp0, float hp1, float speed0, float speed1, float projectile0, float projectile1,
            float spawn0, float spawn1, int enemies0, int enemies1, float elite0, float elite1, float attack0, float attack1)
        {
            float t = Mathf.Clamp01((level - from) / Mathf.Max(1f, to - from));
            return new ThreatScaling
            {
                enemyHealth = Mathf.Lerp(hp0, hp1, t),
                enemySpeed = Mathf.Lerp(speed0, speed1, t),
                projectileSpeed = Mathf.Lerp(projectile0, projectile1, t),
                spawnRate = Mathf.Lerp(spawn0, spawn1, t),
                maxEnemies = Mathf.RoundToInt(Mathf.Lerp(enemies0, enemies1, t)),
                eliteChance = Mathf.Lerp(elite0, elite1, t),
                attackRate = Mathf.Lerp(attack0, attack1, t),
                dashCooldown = 1f,
            };
        }

        private static float Strength(ThreatModifierId id, int level, ThreatModifierId[] modifiers)
        {
            int index = Array.IndexOf(modifiers, id);
            if (index < 0) return 0;
            int start = ProgressionBalance.ModifierMilestones[Math.Min(index, ProgressionBalance.ModifierMilestones.Length - 1)];
            int[] fullAt = { 50, 80, 120, 180 };
            int full = fullAt[Math.Min(index, fullAt.Length - 1)];
            float t = Mathf.Clamp01((level - start) / Mathf.Max(1f, full - start));
            float smooth = t * t * (3 - 2 * t);
            return .15f + .85f * smooth;
        }

        private static int Pressure(ThreatModifierId id)
        {
            switch (id)
            {
                case ThreatModifierId.LowIntegrity:
                case ThreatModifierId.DoubleFire: return 3;
                case ThreatModifierId.FastProjectiles:
                case ThreatModifierId.HighDensity:
                case ThreatModifierId.RapidSpawn: return 2;
                default: return 1;
            }
        }

        private static int TotalPressure(List<ThreatModifierId> list)
        {
            int total = 0;
            for (int i = 0; i < list.Count; i++) total += Pressure(list[i]);
            return total;
        }

        private static string PairKey(ThreatModifierId first, ThreatModifierId second)
        {
            int a = (int)first;
            int b = (int)second;
            return a < b ? a + ":" + b : b + ":" + a;
        }

        private static int Round(double value)
        {
            return (int)Math.Round(value, MidpointRounding.AwayFromZero);
        }
    }
}

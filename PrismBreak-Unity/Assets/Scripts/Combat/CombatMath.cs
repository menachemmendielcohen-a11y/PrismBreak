using UnityEngine;

namespace PrismBreak
{
    public struct EnemySpec
    {
        public float Radius;
        public float Health;
        public float FireDelay;
        public float MoveForce;

        public EnemySpec(float radius, float health, float fireDelay, float moveForce)
        {
            Radius = radius;
            Health = health;
            FireDelay = fireDelay;
            MoveForce = moveForce;
        }
    }

    public struct CombatDifficultyProfile
    {
        public int Health;
        public float EnemySpeed;
        public float ProjectileSpeed;
        public float SpawnRate;
        public float EnemyHealth;
        public float ScoreMultiplier;
        public float DashCooldown;
        public float DashDuration;
        public float AbsorbCharge;

        public CombatDifficultyProfile(int health, float enemySpeed, float projectileSpeed, float spawnRate,
            float enemyHealth, float scoreMultiplier, float dashCooldown, float dashDuration, float absorbCharge)
        {
            Health = health;
            EnemySpeed = enemySpeed;
            ProjectileSpeed = projectileSpeed;
            SpawnRate = spawnRate;
            EnemyHealth = enemyHealth;
            ScoreMultiplier = scoreMultiplier;
            DashCooldown = dashCooldown;
            DashDuration = dashDuration;
            AbsorbCharge = absorbCharge;
        }
    }

    public static class CombatMath
    {
        public static CombatDifficultyProfile DifficultyProfile(Difficulty difficulty)
        {
            switch (difficulty)
            {
                case Difficulty.Cadet:
                    return new CombatDifficultyProfile(5, .84f, .76f, .76f, .86f, .78f, .9f, .29f, 6f);
                case Difficulty.Overdrive:
                    return new CombatDifficultyProfile(2, 1.14f, 1.16f, 1.28f, 1.16f, 1.45f, 1.38f, .2f, 3.5f);
                default:
                    return new CombatDifficultyProfile(3, 1f, 1f, 1f, 1f, 1f, 1.18f, .23f, 4.2f);
            }
        }

        public static EnemySpec Enemy(EnemyKind kind)
        {
            switch (kind)
            {
                case EnemyKind.Needle: return new EnemySpec(13f, 3.1f, 2.5f, 162f);
                case EnemyKind.Halo: return new EnemySpec(21f, 8.5f, 1.55f, 128f);
                case EnemyKind.Splitter: return new EnemySpec(24f, 13f, 2.15f, 105f);
                case EnemyKind.Lancer: return new EnemySpec(19f, 11f, 2.35f, 90f);
                case EnemyKind.Bulwark: return new EnemySpec(31f, 27f, 2.05f, 58f);
                case EnemyKind.Skimmer: return new EnemySpec(16f, 7.5f, 1.9f, 165f);
                case EnemyKind.Weaver: return new EnemySpec(23f, 15f, 2.45f, 82f);
                case EnemyKind.Warden: return new EnemySpec(27f, 21f, 2.55f, 52f);
                case EnemyKind.Siphon: return new EnemySpec(22f, 18f, 2.75f, 92f);
                case EnemyKind.Phantom: return new EnemySpec(18f, 13f, 2.8f, 105f);
                case EnemyKind.Oracle: return new EnemySpec(30f, 25f, 3.05f, 72f);
                default: return new EnemySpec(74f, 520f, 1.28f, 56f);
            }
        }

        public static float BaseScore(EnemyKind kind)
        {
            switch (kind)
            {
                case EnemyKind.Needle: return 100f;
                case EnemyKind.Halo: return 240f;
                case EnemyKind.Splitter: return 360f;
                case EnemyKind.Lancer: return 420f;
                case EnemyKind.Bulwark: return 650f;
                case EnemyKind.Skimmer: return 310f;
                case EnemyKind.Weaver: return 520f;
                case EnemyKind.Warden: return 780f;
                case EnemyKind.Siphon: return 720f;
                case EnemyKind.Phantom: return 690f;
                case EnemyKind.Oracle: return 920f;
                default: return 12000f;
            }
        }

        public static SpectrumId EnemySpectrum(EnemyKind kind, int selector)
        {
            SpectrumId[] spectra;
            switch (kind)
            {
                case EnemyKind.Needle: spectra = new[] { SpectrumId.Crimson }; break;
                case EnemyKind.Halo: spectra = new[] { SpectrumId.Cyan }; break;
                case EnemyKind.Splitter: spectra = new[] { SpectrumId.Violet }; break;
                case EnemyKind.Lancer: spectra = new[] { SpectrumId.Gold }; break;
                case EnemyKind.Bulwark: spectra = new[] { SpectrumId.Crimson, SpectrumId.Gold }; break;
                case EnemyKind.Skimmer: spectra = new[] { SpectrumId.Cyan, SpectrumId.Crimson }; break;
                case EnemyKind.Weaver: spectra = new[] { SpectrumId.Gold, SpectrumId.Violet }; break;
                case EnemyKind.Warden: spectra = new[] { SpectrumId.Violet }; break;
                case EnemyKind.Siphon: spectra = new[] { SpectrumId.Cyan, SpectrumId.Gold }; break;
                case EnemyKind.Phantom: spectra = new[] { SpectrumId.Violet, SpectrumId.Crimson }; break;
                case EnemyKind.Oracle: spectra = new[] { SpectrumId.Gold, SpectrumId.Cyan, SpectrumId.Violet }; break;
                default: spectra = new[] { SpectrumId.Cyan, SpectrumId.Violet, SpectrumId.Gold, SpectrumId.Crimson }; break;
            }
            int index = Mathf.Abs(selector) % spectra.Length;
            return spectra[index];
        }

        public static Color EnemyColor(EnemyKind kind)
        {
            switch (kind)
            {
                case EnemyKind.Needle: return new Color32(255, 79, 123, 255);
                case EnemyKind.Halo: return new Color32(70, 230, 255, 255);
                case EnemyKind.Splitter: return new Color32(229, 107, 255, 255);
                case EnemyKind.Lancer: return new Color32(255, 216, 90, 255);
                case EnemyKind.Bulwark: return new Color32(255, 143, 82, 255);
                case EnemyKind.Skimmer: return new Color32(255, 119, 107, 255);
                case EnemyKind.Weaver: return new Color32(125, 255, 159, 255);
                case EnemyKind.Warden: return new Color32(200, 155, 255, 255);
                case EnemyKind.Siphon: return new Color32(110, 241, 210, 255);
                case EnemyKind.Phantom: return new Color32(255, 111, 216, 255);
                case EnemyKind.Oracle: return new Color32(255, 207, 112, 255);
                default: return new Color32(173, 123, 255, 255);
            }
        }

        public static bool SegmentHitsCircle(ProjectileState projectile, Vector2 center, float radius)
        {
            float combined = radius + projectile.radius;
            return PrismMath.DistanceToSegmentSquared(center, projectile.previousPosition, projectile.position) <= combined * combined;
        }

        public static float WrappedAngleDelta(float from, float to)
        {
            return Mathf.DeltaAngle(from * Mathf.Rad2Deg, to * Mathf.Rad2Deg) * Mathf.Deg2Rad;
        }
    }
}

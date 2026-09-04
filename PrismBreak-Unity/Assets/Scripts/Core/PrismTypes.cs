using System;
using System.Collections.Generic;
using UnityEngine;

namespace PrismBreak
{
    public static class ArenaConstants
    {
        public const float Width = 1280f;
        public const float Height = 720f;
        public const float FixedStep = 1f / 60f;
        public const int MaxStepsPerFrame = 5;
        public const int MaxEnemyProjectiles = 720;
        public const int MaxProjectiles = 1080;
        public const int MaxParticles = 900;
        public const float PlayerRadius = 14f;
    }

    public enum AppScreen { Home, Campaign, Prime, Threat, Daily, Arcade, Guide, Shop, Achievements, Settings, Playing, Paused, Upgrade, NovaConfirm, Result }
    public enum RunMode { Campaign, Prime, Threat, Daily, Arcade }
    public enum Difficulty { Cadet, Standard, Overdrive }
    public enum LanguageId { English, Hebrew }
    public enum ObjectiveKind { Survive, Kills, Absorb, Elites, Boss }
    public enum EnemyKind { Needle, Halo, Splitter, Lancer, Bulwark, Skimmer, Weaver, Warden, Siphon, Phantom, Oracle, Boss }
    public enum EliteTier { None, Minor, Major }
    public enum SpectrumId { Cyan, Violet, Gold, Crimson }
    public enum PrismStability { Stable, Charged, Unstable, BreakReady }
    public enum DamageSource { Normal, Refraction, Nova, Smash, Dash, Ally }
    public enum DropKind { Repair, Overcharge, Rapid, SmashCell, Double, Alliance, PowerCore, Cooldown, Aegis, Pierce, Stasis, Resonance }
    public enum PersistentPowerId { Focus, Overclock, Lance }
    public enum WorldUpgradeId { OriginGuard, ChromaArray, VoidDrive, EternalResonance }
    public enum UpgradeRarity { Common, Rare, Prismatic, Anomalous }
    public enum UpgradeId
    {
        Split, Rapid, Heavy, Chain, Magnet, Wake, Phase, Guard, Glass, Second,
        Focus, Overclock, Lance, Echo, SpectrumLock, Horizon, Shatterpoint
    }

    public enum ThreatModifierId
    {
        DoubleFire, EliteSwarm, FastProjectiles, NovaDrain, DashCooldown,
        HighDensity, AggressiveEnemies, LowIntegrity, RapidSpawn
    }

    public enum PrimeBonusId { TwinArray, RapidArray, DropSurge, ResonanceField, AegisStart }

    [Serializable]
    public sealed class ThreatScaling
    {
        public float enemyHealth = 1f;
        public float enemySpeed = 1f;
        public float projectileSpeed = 1f;
        public float spawnRate = 1f;
        public int maxEnemies = 28;
        public float eliteChance;
        public float attackRate = 1f;
        public float dashCooldown = 1f;
        public int integrityPenalty;
        public float novaDrain;

        public ThreatScaling Clone()
        {
            return (ThreatScaling)MemberwiseClone();
        }
    }

    [Serializable]
    public sealed class RunConfig
    {
        public RunMode mode;
        public int stageId;
        public Difficulty difficulty;
        public float duration;
        public float bossTime = -1f;
        public EnemyKind[] roster = Array.Empty<EnemyKind>();
        public ObjectiveKind objective;
        public int objectiveTarget;
        public float eliteChance;
        public string label = string.Empty;
        public string primeId = string.Empty;
        public int threatLevel;
        public ThreatModifierId[] modifiers = Array.Empty<ThreatModifierId>();
        public PrimeBonusId[] primeBonuses = Array.Empty<PrimeBonusId>();
        public ThreatScaling scaling = new ThreatScaling();
        public int maxHostiles;
        public int maxActiveElites = 2;
        public EliteTier eliteTierCap = EliteTier.Minor;
        public int seed;
    }

    [Serializable]
    public sealed class StageDefinition
    {
        public int id;
        public string code = string.Empty;
        public string name = string.Empty;
        public string hebrewName = string.Empty;
        public string subtitle = string.Empty;
        public string hebrewSubtitle = string.Empty;
        public string briefing = string.Empty;
        public string hebrewBriefing = string.Empty;
        public int world;
        public float duration;
        public float bossTime = -1f;
        public EnemyKind[] roster = Array.Empty<EnemyKind>();
        public ObjectiveKind objective;
        public int target;
        public float eliteChance;
        public int[] scoreTargets = new int[3];
        public ThreatModifierId[] modifiers = Array.Empty<ThreatModifierId>();
        public int maxHostiles;
        public int maxActiveElites = 2;
        public EliteTier eliteTierCap = EliteTier.Minor;
    }

    [Serializable]
    public sealed class PrimeMissionDefinition
    {
        public string id = string.Empty;
        public string code = string.Empty;
        public string name = string.Empty;
        public string hebrewName = string.Empty;
        public string description = string.Empty;
        public string hebrewDescription = string.Empty;
        public int requiredRank;
        public int unlockCost;
        public float duration;
        public ObjectiveKind objective;
        public int target;
        public int minReward;
        public int maxReward;
        public Difficulty difficulty = Difficulty.Cadet;
        public int maxHostiles;
        public int maxActiveElites = 1;
        public PrimeBonusId[] bonuses = Array.Empty<PrimeBonusId>();
        public ThreatModifierId[] modifiers = Array.Empty<ThreatModifierId>();
        public ThreatScaling scaling = new ThreatScaling();
    }

    [Serializable]
    public sealed class AchievementDefinition
    {
        public string id = string.Empty;
        public string title = string.Empty;
        public string hebrewTitle = string.Empty;
        public string description = string.Empty;
        public string hebrewDescription = string.Empty;
        public string metric = string.Empty;
        public int goal;
        public int shardReward;
        public UpgradeRarity tier;
        public string glyph = string.Empty;
    }

    [Serializable]
    public sealed class UpgradeDefinition
    {
        public UpgradeId id;
        public string name = string.Empty;
        public string hebrewName = string.Empty;
        public string tag = string.Empty;
        public string hebrewTag = string.Empty;
        public string description = string.Empty;
        public string hebrewDescription = string.Empty;
        public string glyph = string.Empty;
        public int maxRank;
        public UpgradeRarity rarity;
    }

    [Serializable]
    public sealed class RewardMetrics
    {
        public bool victory;
        public int score;
        public int targetScore;
        public float bestCombo;
        public int hitsTaken;
        public float elapsed;
        public float duration;
        public int absorbed;
    }

    [Serializable]
    public sealed class PlayerState
    {
        public Vector2 position = new Vector2(ArenaConstants.Width * .5f, ArenaConstants.Height * .56f);
        public Vector2 velocity;
        public float radius = ArenaConstants.PlayerRadius;
        public int health = 6;
        public int maxHealth = 6;
        public float invulnerability;
        public float dashTime;
        public float dashCooldown;
        public float fireCooldown;
        public float aim;
        public float wakeClock;
        public float shield;
        public bool secondUsed;
    }

    [Serializable]
    public sealed class EnemyState
    {
        public int id;
        public EnemyKind kind;
        public Vector2 position;
        public Vector2 velocity;
        public float radius;
        public float health;
        public float maxHealth;
        public float fireTimer;
        public float phase;
        public float contactCooldown;
        public bool dead;
        public bool ally;
        public EliteTier eliteTier;
        public SpectrumId spectrum;
        public float behaviorClock;
        public int visualIndex;
    }

    [Serializable]
    public sealed class ProjectileState
    {
        public int id;
        public Vector2 position;
        public Vector2 previousPosition;
        public Vector2 velocity;
        public float radius;
        public float damage;
        public float life;
        public bool hostile;
        public bool dead;
        public bool refracted;
        public int pierce;
        public SpectrumId spectrum;
        public Color color = Color.white;
    }

    [Serializable]
    public sealed class PickupState
    {
        public Vector2 position;
        public Vector2 velocity;
        public float life;
        public int value;
        public bool prismShard;
        public bool dead;
    }

    [Serializable]
    public sealed class PowerDropState
    {
        public Vector2 position;
        public Vector2 velocity;
        public float life;
        public DropKind kind;
        public SpectrumId spectrum;
        public EnemyKind allyKind;
        public bool hasAllyKind;
        public bool dead;
    }

    [Serializable]
    public sealed class ParticleState
    {
        public Vector2 position;
        public Vector2 velocity;
        public float life;
        public float maxLife;
        public float size;
        public Color color = Color.white;
        public float drag;
        public bool ring;
    }

    [Serializable]
    public sealed class FloatTextState
    {
        public Vector2 position;
        public string text = string.Empty;
        public Color color = Color.white;
        public float life;
    }

    [Serializable]
    public sealed class GameEvent
    {
        public string id = string.Empty;
        public float value;
        public Vector2 position;
    }

    [Serializable]
    public sealed class RunResult
    {
        public bool victory;
        public string reason = string.Empty;
        public int score;
        public int kills;
        public int eliteKills;
        public int absorbed;
        public int perfectAbsorbs;
        public int refractionKills;
        public int hitsTaken;
        public float bestCombo;
        public float elapsed;
        public int shardsEarned;
        public int stars;
        public string[] newAchievements = Array.Empty<string>();
    }
}

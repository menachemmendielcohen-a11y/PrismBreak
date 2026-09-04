using System;
using System.Collections.Generic;
using UnityEngine;

namespace PrismBreak
{
    /// <summary>
    /// Scene-independent, deterministic PRISM BREAK simulation. Presentation code feeds
    /// arena-space input and renders the public state; this class owns no GameObjects,
    /// coroutines, PlayerPrefs or SDK calls, which keeps WebGL runs predictable and makes
    /// the combat loop testable in edit mode.
    /// </summary>
    public sealed class GameSession
    {
        private sealed class ProjectileMeta
        {
            public DamageSource Source;
            public int Chain;
            public float BurstRadius;
            public bool DetonatesBullets;
            public float ScoreMultiplier = 1f;
        }

        private sealed class DelayedVolley
        {
            public float Delay;
            public Vector2 Position;
            public float Aim;
            public RefractionRecipe Recipe;
            public float Power;
            public SpectrumId Spectrum;
        }

        private readonly RunConfig config;
        private readonly SessionLoadout loadout;
        private readonly CombatDifficultyProfile difficulty;
        private readonly DeterministicRng rng;
        private readonly List<EnemyState> enemies = new List<EnemyState>(64);
        private readonly List<ProjectileState> projectiles = new List<ProjectileState>(384);
        private readonly List<PickupState> pickups = new List<PickupState>(48);
        private readonly List<PowerDropState> powerDrops = new List<PowerDropState>(24);
        private readonly List<ParticleState> particles = new List<ParticleState>(256);
        private readonly List<FloatTextState> floatTexts = new List<FloatTextState>(32);
        private readonly List<GameEvent> events = new List<GameEvent>(32);
        private readonly List<DelayedVolley> delayedVolleys = new List<DelayedVolley>(8);
        private readonly Dictionary<int, ProjectileMeta> projectileMeta = new Dictionary<int, ProjectileMeta>();
        private readonly Dictionary<UpgradeId, int> upgradeRanks = new Dictionary<UpgradeId, int>();
        private readonly HashSet<PersistentPowerId> unlockedPowers = new HashSet<PersistentPowerId>();
        private readonly HashSet<WorldUpgradeId> worldUpgrades = new HashSet<WorldUpgradeId>();
        private readonly Dictionary<string, float> activeBuffs = new Dictionary<string, float>(StringComparer.Ordinal);
        private readonly Dictionary<SpectrumId, int> absorbStreak = new Dictionary<SpectrumId, int>();

        private InputFrame pendingInput;
        private float accumulator;
        private float spawnTimer;
        private float comboDecay;
        private float overloadClock;
        private float overloadDamageClock;
        private float rapidTime;
        private float doubleTime;
        private float overchargeTime;
        private float cooldownTime;
        private float pierceTime;
        private float stasisTime;
        private float resonanceTime;
        private float dropSurgeTime;
        private float lanceCooldown;
        private float smashCooldown;
        private float prismBreakTime;
        private float experience;
        private int level = 1;
        private int nextEnemyId = 1;
        private int nextProjectileId = 1;
        private int hostileProjectileCount;
        private int objectiveProgress;
        private bool bossSpawned;
        private bool bossDefeated;
        private bool firstCoinSpawned;
        private UpgradeId[] upgradeChoices = Array.Empty<UpgradeId>();
        private RunResult result;

        public GameSession(RunConfig runConfig, SessionLoadout sessionLoadout)
        {
            config = runConfig ?? throw new ArgumentNullException(nameof(runConfig));
            loadout = sessionLoadout ?? new SessionLoadout();
            difficulty = CombatMath.DifficultyProfile(config.difficulty);
            int seed = config.seed != 0 ? config.seed : unchecked(7919 + config.stageId * 104729 + config.threatLevel * 313);
            rng = new DeterministicRng(seed);

            AddRange(unlockedPowers, loadout.UnlockedPowers);
            AddRange(worldUpgrades, loadout.WorldUpgrades);
            Spectrum = new SpectrumStore();
            Player = new PlayerState();
            int difficultyPenalty = config.difficulty == Difficulty.Overdrive ? 2 : config.difficulty == Difficulty.Standard ? 1 : 0;
            int worldHealth = worldUpgrades.Contains(WorldUpgradeId.OriginGuard) ? 1 : 0;
            Player.maxHealth = Mathf.Max(1, 6 + loadout.StartingHealthBonus + worldHealth - difficultyPenalty - SafeScaling.integrityPenalty);
            Player.health = Player.maxHealth;
            Player.shield = worldUpgrades.Contains(WorldUpgradeId.OriginGuard) ? 1f : 0f;

            if (worldUpgrades.Contains(WorldUpgradeId.ChromaArray))
            {
                Spectrum.Set(SpectrumId.Cyan, 1);
                Spectrum.Set(SpectrumId.Violet, 1);
            }

            ApplyPrimeBonuses();
            if (loadout.StartingUpgrades != null)
            {
                for (int i = 0; i < loadout.StartingUpgrades.Length; i++) ApplyUpgradeInternal(loadout.StartingUpgrades[i]);
            }

            spawnTimer = .45f;
            Phase = SessionPhase.Running;
            Emit("run-start", 0f, Player.position);
        }

        public SessionPhase Phase { get; private set; }
        public PlayerState Player { get; private set; }
        public SpectrumStore Spectrum { get; private set; }
        public IReadOnlyList<EnemyState> Enemies { get { return enemies; } }
        public IReadOnlyList<ProjectileState> Projectiles { get { return projectiles; } }
        public IReadOnlyList<PickupState> Pickups { get { return pickups; } }
        public IReadOnlyList<PowerDropState> PowerDrops { get { return powerDrops; } }
        public IReadOnlyList<ParticleState> Particles { get { return particles; } }
        public IReadOnlyList<FloatTextState> FloatTexts { get { return floatTexts; } }
        public IReadOnlyList<GameEvent> Events { get { return events; } }
        public IReadOnlyDictionary<UpgradeId, int> UpgradeRanks { get { return upgradeRanks; } }
        public IReadOnlyDictionary<string, float> ActiveBuffs { get { return activeBuffs; } }
        public UpgradeId[] UpgradeChoices { get { return (UpgradeId[])upgradeChoices.Clone(); } }
        public RunResult Result { get { return result; } }
        public RunConfig Config { get { return config; } }

        public float Elapsed { get; private set; }
        public float Duration { get { return Mathf.Max(1f, config.duration); } }
        public float TimeRemaining { get { return Mathf.Max(0f, Duration - Elapsed); } }
        public int Score { get; private set; }
        public int Kills { get; private set; }
        public int EliteKills { get; private set; }
        public int Absorbed { get; private set; }
        public int PerfectAbsorbs { get; private set; }
        public int RefractionKills { get; private set; }
        public int HitsTaken { get; private set; }
        public int CoinsCollected { get; private set; }
        public int ShardsCollected { get; private set; }
        public float Combo { get; private set; }
        public float BestCombo { get; private set; }
        public float Multiplier { get { return Mathf.Min(8f, 1f + Combo * .075f) * (prismBreakTime > 0f ? 1.55f : 1f); } }
        public float Intensity
        {
            get
            {
                float enemyPressure = CountHostiles() / (float)Mathf.Max(1, EffectiveMaxHostiles);
                float bulletPressure = hostileProjectileCount / (float)ArenaConstants.MaxEnemyProjectiles;
                float bossPressure = bossSpawned && !bossDefeated ? .22f : 0f;
                return Mathf.Clamp01(enemyPressure * .55f + bulletPressure * .58f + bossPressure);
            }
        }
        public float NovaCharge { get; private set; }
        public float SmashCooldown { get { return smashCooldown; } }
        public float LanceCooldown { get { return lanceCooldown; } }
        public bool SmashReady { get { return smashCooldown <= 0f; } }
        public bool LanceReady { get { return lanceCooldown <= 0f && HasLance; } }
        public bool CanAffordNova { get { return CoinsCollected >= 1; } }
        public float PrismBreakTime { get { return prismBreakTime; } }
        public bool PrismBreakActive { get { return prismBreakTime > 0f; } }
        public bool PrismOverloaded { get { return Spectrum.Total >= SpectrumCapacity && prismBreakTime <= 0f; } }
        public PrismStability PrismStability { get { return SpectrumEngine.Stability(Spectrum, SpectrumCapacity); } }
        public int SpectrumCapacity { get { return SpectrumEngine.Capacity + (worldUpgrades.Contains(WorldUpgradeId.EternalResonance) ? 4 : 0); } }
        public int Level { get { return level; } }
        public float Experience { get { return experience; } }
        public float ExperienceToNext { get { return ExperienceRequirement(level); } }
        public int CurrentObjectiveProgress
        {
            get
            {
                switch (config.objective)
                {
                    case ObjectiveKind.Survive: return Mathf.Min(ObjectiveTarget, Mathf.FloorToInt(Elapsed));
                    case ObjectiveKind.Kills: return Kills;
                    case ObjectiveKind.Absorb: return Absorbed;
                    case ObjectiveKind.Elites: return EliteKills;
                    case ObjectiveKind.Boss: return bossDefeated ? 1 : 0;
                    default: return objectiveProgress;
                }
            }
        }
        public int ObjectiveTarget
        {
            get
            {
                if (config.objective == ObjectiveKind.Survive) return config.objectiveTarget > 0 ? config.objectiveTarget : Mathf.CeilToInt(Duration);
                if (config.objective == ObjectiveKind.Boss) return 1;
                return Mathf.Max(1, config.objectiveTarget);
            }
        }

        private ThreatScaling SafeScaling { get { return config.scaling ?? new ThreatScaling(); } }
        private bool HasLance { get { return unlockedPowers.Contains(PersistentPowerId.Lance) || Rank(UpgradeId.Lance) > 0; } }

        /// <summary>Advances by real delta time while simulating in stable 60 Hz steps.</summary>
        public void Advance(float deltaTime, InputFrame input)
        {
            events.Clear();
            pendingInput.MergeButtons(input);

            if (pendingInput.PausePressed)
            {
                pendingInput.PausePressed = false;
                if (Phase == SessionPhase.Running) Phase = SessionPhase.Paused;
                else if (Phase == SessionPhase.Paused) Phase = SessionPhase.Running;
                Emit(Phase == SessionPhase.Paused ? "pause" : "resume", 0f, Player.position);
            }

            if (Phase != SessionPhase.Running) return;
            accumulator = Mathf.Min(.25f, accumulator + Mathf.Max(0f, deltaTime));
            int steps = 0;
            while (accumulator >= ArenaConstants.FixedStep && steps < ArenaConstants.MaxStepsPerFrame && Phase == SessionPhase.Running)
            {
                InputFrame stepInput = pendingInput;
                SimulateStep(ArenaConstants.FixedStep, stepInput);
                pendingInput.ConsumeButtons();
                accumulator -= ArenaConstants.FixedStep;
                steps++;
            }

            if (steps == ArenaConstants.MaxStepsPerFrame && accumulator >= ArenaConstants.FixedStep)
                accumulator = 0f;
        }

        public void SetPaused(bool paused)
        {
            if (Phase == SessionPhase.Running && paused) Phase = SessionPhase.Paused;
            else if (Phase == SessionPhase.Paused && !paused) Phase = SessionPhase.Running;
        }

        public void TogglePause()
        {
            SetPaused(Phase != SessionPhase.Paused);
        }

        public bool ApplyUpgrade(UpgradeId id)
        {
            if (Phase != SessionPhase.UpgradeChoice || Array.IndexOf(upgradeChoices, id) < 0) return false;
            if (!ApplyUpgradeInternal(id)) return false;
            upgradeChoices = Array.Empty<UpgradeId>();
            Phase = SessionPhase.Running;
            Emit("upgrade", (float)id, Player.position);
            return true;
        }

        public bool ConfirmNova(bool accepted)
        {
            if (Phase != SessionPhase.NovaConfirm) return false;
            if (!accepted)
            {
                Phase = SessionPhase.Running;
                Emit("nova-cancel", 0f, Player.position);
                return false;
            }

            if (CoinsCollected < 1)
            {
                // Keep the confirmation open so the UI can clearly explain the missing
                // current-run coin; only an explicit No/cancel returns to play.
                Emit("nova-denied", 0f, Player.position);
                AddFloatText(Player.position + Vector2.up * 38f, "NEED 1 COIN", new Color32(255, 116, 146, 255));
                return false;
            }

            CoinsCollected--;
            NovaCharge = 0f;
            ExecuteNova();
            Phase = SessionPhase.Running;
            return true;
        }

        public GameEvent[] ConsumeEvents()
        {
            GameEvent[] copy = events.ToArray();
            events.Clear();
            return copy;
        }

        private void SimulateStep(float dt, InputFrame input)
        {
            Elapsed += dt;
            TickTimers(dt);
            UpdatePlayer(dt, input);

            if (input.NovaPressed)
            {
                Phase = SessionPhase.NovaConfirm;
                Emit("nova-request", CanAffordNova ? 1f : 0f, Player.position);
                return;
            }
            if (input.SmashPressed) TrySmash();
            if (input.LancePressed) TryLance();
            if (input.RefractPressed) TryRefract();

            UpdateSpawning(dt);
            UpdateEnemies(dt);
            UpdateDelayedVolleys(dt);
            UpdateProjectiles(dt);
            ResolveCollisions();
            UpdatePickups(dt);
            UpdatePowerDrops(dt);
            UpdateParticles(dt);
            UpdateFloatTexts(dt);
            UpdateCombo(dt);
            UpdateOverload(dt);
            RebuildBuffView();
            CheckObjective();
        }

        private void TickTimers(float dt)
        {
            Player.invulnerability = Mathf.Max(0f, Player.invulnerability - dt);
            Player.dashTime = Mathf.Max(0f, Player.dashTime - dt);
            Player.dashCooldown = Mathf.Max(0f, Player.dashCooldown - dt);
            Player.fireCooldown = Mathf.Max(0f, Player.fireCooldown - dt);
            Player.shield = Mathf.Max(0f, Player.shield - dt * .012f);
            rapidTime = Mathf.Max(0f, rapidTime - dt);
            doubleTime = Mathf.Max(0f, doubleTime - dt);
            overchargeTime = Mathf.Max(0f, overchargeTime - dt);
            cooldownTime = Mathf.Max(0f, cooldownTime - dt);
            pierceTime = Mathf.Max(0f, pierceTime - dt);
            stasisTime = Mathf.Max(0f, stasisTime - dt);
            resonanceTime = Mathf.Max(0f, resonanceTime - dt);
            dropSurgeTime = Mathf.Max(0f, dropSurgeTime - dt);
            prismBreakTime = Mathf.Max(0f, prismBreakTime - dt);
            float cooldownSpeed = cooldownTime > 0f ? 2.25f : 1f;
            smashCooldown = Mathf.Max(0f, smashCooldown - dt * cooldownSpeed);
            lanceCooldown = Mathf.Max(0f, lanceCooldown - dt * cooldownSpeed);
        }

        private void UpdatePlayer(float dt, InputFrame input)
        {
            Vector2 previous = Player.position;
            if (input.HasPointer)
            {
                Player.position = ClampToArena(input.PointerWorld, 20f);
                Player.velocity = (Player.position - previous) / Mathf.Max(.0001f, dt);
            }
            else
            {
                Vector2 move = input.Move.sqrMagnitude > 1f ? input.Move.normalized : input.Move;
                Player.velocity = Vector2.Lerp(Player.velocity, move * 430f, 1f - Mathf.Exp(-18f * dt));
                Player.position = ClampToArena(Player.position + Player.velocity * dt, 20f);
            }

            EnemyState target = FindNearestHostile(Player.position, null);
            if (target != null) Player.aim = PrismMath.Angle(target.position - Player.position);
            else if (Player.velocity.sqrMagnitude > 25f) Player.aim = PrismMath.Angle(Player.velocity);

            if (input.DashPressed && Player.dashCooldown <= 0f)
            {
                Player.dashTime = difficulty.DashDuration;
                Player.invulnerability = Mathf.Max(Player.invulnerability, difficulty.DashDuration + .08f);
                float worldScale = worldUpgrades.Contains(WorldUpgradeId.VoidDrive) ? .84f : 1f;
                Player.dashCooldown = difficulty.DashCooldown * Mathf.Max(.35f, SafeScaling.dashCooldown) * worldScale * Mathf.Pow(.82f, Rank(UpgradeId.Phase));
                if (!input.HasPointer)
                {
                    Vector2 direction = input.Move.sqrMagnitude > .1f ? input.Move.normalized : PrismMath.FromAngle(Player.aim);
                    Player.position = ClampToArena(Player.position + direction * 118f, 20f);
                }
                Emit("dash", 0f, Player.position);
                BurstParticles(Player.position, new Color32(92, 247, 255, 255), 18, 190f);
            }

            if (Player.fireCooldown <= 0f && target != null)
            {
                FirePlayerShot(target);
            }
        }

        private void FirePlayerShot(EnemyState target)
        {
            Vector2 direction = (target.position - Player.position).normalized;
            if (direction.sqrMagnitude < .5f) direction = PrismMath.FromAngle(Player.aim);
            Player.aim = PrismMath.Angle(direction);
            float fireRate = .19f;
            fireRate /= 1f + Rank(UpgradeId.Rapid) * .18f + Rank(UpgradeId.Overclock) * .12f;
            if (rapidTime > 0f) fireRate *= .54f;
            if (prismBreakTime > 0f) fireRate *= .7f;
            Player.fireCooldown = Mathf.Max(.055f, fireRate);

            int count = doubleTime > 0f ? 2 : 1;
            for (int i = 0; i < count; i++)
            {
                float angle = Player.aim + (count == 2 ? (i == 0 ? -.055f : .055f) : 0f);
                float damage = PlayerShotDamage();
                ProjectileState shot = SpawnProjectile(Player.position + PrismMath.FromAngle(angle) * 21f,
                    PrismMath.FromAngle(angle) * 780f, 4.2f, damage, 1.8f, false, SpectrumId.Cyan,
                    new Color32(235, 255, 250, 255), DamageSource.Normal);
                if (shot != null) shot.pierce = pierceTime > 0f ? 2 : 0;
            }
            Emit("shoot", 0f, Player.position);
        }

        private float PlayerShotDamage()
        {
            float value = 1.25f;
            value *= 1f + Rank(UpgradeId.Heavy) * .28f + Rank(UpgradeId.Focus) * .14f;
            if (Rank(UpgradeId.Glass) > 0) value *= 1.55f;
            if (overchargeTime > 0f) value *= 1.4f;
            if (prismBreakTime > 0f) value *= 1.45f;
            return value;
        }

        private void UpdateSpawning(float dt)
        {
            if (!bossSpawned && ShouldSpawnBoss())
            {
                bossSpawned = true;
                SpawnEnemy(EnemyKind.Boss, RandomEdgePosition(100f), EliteTier.None, false);
                Emit("boss-enter", 0f, new Vector2(ArenaConstants.Width * .5f, 100f));
            }

            spawnTimer -= dt;
            int hostiles = CountHostiles();
            int max = EffectiveMaxHostiles;
            if (spawnTimer > 0f || hostiles >= max) return;

            EnemyKind kind = ChooseRosterEnemy();
            EliteTier elite = ChooseEliteTier();
            SpawnEnemy(kind, RandomEdgePosition(54f), elite, false);

            float pressure = Mathf.Clamp01(Elapsed / Mathf.Max(20f, Duration));
            float interval = Mathf.Lerp(1.25f, .68f, pressure);
            interval /= Mathf.Max(.25f, difficulty.SpawnRate * SafeScaling.spawnRate);
            if (HasModifier(ThreatModifierId.RapidSpawn)) interval *= .76f;
            if (HasModifier(ThreatModifierId.HighDensity)) interval *= .83f;
            spawnTimer = Mathf.Max(.19f, interval * rng.Range(.82f, 1.18f));
        }

        private bool ShouldSpawnBoss()
        {
            if (bossSpawned) return false;
            bool needsBoss = config.objective == ObjectiveKind.Boss || config.bossTime >= 0f;
            if (!needsBoss) return false;
            float time = config.bossTime >= 0f ? config.bossTime : Duration * .52f;
            return Elapsed >= time;
        }

        private EnemyKind ChooseRosterEnemy()
        {
            EnemyKind[] roster = config.roster;
            if (roster == null || roster.Length == 0)
                roster = new[] { EnemyKind.Needle, EnemyKind.Halo, EnemyKind.Splitter };
            return roster[rng.Range(0, roster.Length)];
        }

        private EliteTier ChooseEliteTier()
        {
            if (CountActiveElites() >= Mathf.Max(0, config.maxActiveElites)) return EliteTier.None;
            float chance = Mathf.Max(config.eliteChance, SafeScaling.eliteChance);
            if (HasModifier(ThreatModifierId.EliteSwarm)) chance += .08f;
            if (!rng.Chance(chance)) return EliteTier.None;
            if (config.eliteTierCap == EliteTier.Major && config.stageId >= 35 && rng.Chance(.14f)) return EliteTier.Major;
            return EliteTier.Minor;
        }

        private EnemyState SpawnEnemy(EnemyKind kind, Vector2 position, EliteTier elite, bool ally)
        {
            if (!ally && kind != EnemyKind.Boss && CountHostiles() >= EffectiveMaxHostiles) return null;
            EnemySpec spec = CombatMath.Enemy(kind);
            float eliteHealth = elite == EliteTier.Major ? 2.15f : elite == EliteTier.Minor ? 1.32f : 1f;
            float hp = spec.Health * difficulty.EnemyHealth * SafeScaling.enemyHealth * eliteHealth;
            EnemyState enemy = new EnemyState
            {
                id = nextEnemyId++,
                kind = kind,
                position = ClampToArena(position, spec.Radius + 4f),
                velocity = Vector2.zero,
                radius = spec.Radius * (elite == EliteTier.Major ? 1.28f : elite == EliteTier.Minor ? 1.08f : 1f),
                health = hp,
                maxHealth = hp,
                fireTimer = spec.FireDelay * rng.Range(.45f, .95f),
                phase = rng.Range(0f, Mathf.PI * 2f),
                ally = ally,
                eliteTier = elite,
                spectrum = CombatMath.EnemySpectrum(kind, nextEnemyId),
                visualIndex = Mathf.Max(0, ((int)kind * 2 + config.stageId) % 30),
            };
            enemies.Add(enemy);
            Emit(ally ? "ally-spawn" : "enemy-spawn", (float)kind, enemy.position);
            return enemy;
        }

        private void UpdateEnemies(float dt)
        {
            float slow = stasisTime > 0f ? .48f : 1f;
            for (int i = 0; i < enemies.Count; i++)
            {
                EnemyState enemy = enemies[i];
                if (enemy.dead) continue;
                enemy.behaviorClock += dt;
                enemy.contactCooldown = Mathf.Max(0f, enemy.contactCooldown - dt);

                if (enemy.ally)
                {
                    UpdateAlly(enemy, dt);
                    continue;
                }

                EnemySpec spec = CombatMath.Enemy(enemy.kind);
                Vector2 desired = EnemyDesiredVelocity(enemy, spec);
                float eliteSpeed = enemy.eliteTier == EliteTier.Major ? 1.16f : enemy.eliteTier == EliteTier.Minor ? 1.07f : 1f;
                float aggression = HasModifier(ThreatModifierId.AggressiveEnemies) ? 1.16f : 1f;
                desired *= difficulty.EnemySpeed * SafeScaling.enemySpeed * eliteSpeed * aggression * slow;
                enemy.velocity = Vector2.Lerp(enemy.velocity, desired, 1f - Mathf.Exp(-3.8f * dt));
                enemy.position = ClampToArena(enemy.position + enemy.velocity * dt, enemy.radius + 2f);

                enemy.fireTimer -= dt * (stasisTime > 0f ? .64f : 1f);
                if (enemy.fireTimer <= 0f)
                {
                    FireEnemyPattern(enemy);
                    float eliteFire = enemy.eliteTier == EliteTier.Major ? .68f : enemy.eliteTier == EliteTier.Minor ? .82f : 1f;
                    float rate = difficulty.SpawnRate * SafeScaling.attackRate;
                    if (HasModifier(ThreatModifierId.AggressiveEnemies)) rate *= 1.18f;
                    enemy.fireTimer = spec.FireDelay * eliteFire / Mathf.Max(.35f, rate) * rng.Range(.82f, 1.16f);
                }

                if (enemy.kind == EnemyKind.Siphon && Vector2.Distance(enemy.position, Player.position) < 155f)
                    NovaCharge = Mathf.Max(0f, NovaCharge - dt * 3.5f);
            }
        }

        private Vector2 EnemyDesiredVelocity(EnemyState enemy, EnemySpec spec)
        {
            Vector2 toPlayer = Player.position - enemy.position;
            float distance = Mathf.Max(1f, toPlayer.magnitude);
            Vector2 toward = toPlayer / distance;
            Vector2 tangent = new Vector2(-toward.y, toward.x);
            float wave = Mathf.Sin(enemy.behaviorClock * 2.1f + enemy.phase);
            switch (enemy.kind)
            {
                case EnemyKind.Needle: return toward * spec.MoveForce;
                case EnemyKind.Halo: return toward * Mathf.Sign(distance - 245f) * spec.MoveForce + tangent * wave * 82f;
                case EnemyKind.Splitter: return toward * spec.MoveForce + tangent * wave * 55f;
                case EnemyKind.Lancer: return toward * Mathf.Sign(distance - 380f) * spec.MoveForce + tangent * 46f;
                case EnemyKind.Bulwark: return toward * spec.MoveForce;
                case EnemyKind.Skimmer: return toward * 42f + tangent * (spec.MoveForce + wave * 38f);
                case EnemyKind.Weaver: return toward * Mathf.Sign(distance - 285f) * 60f + tangent * wave * spec.MoveForce;
                case EnemyKind.Warden: return toward * Mathf.Sign(distance - 330f) * spec.MoveForce;
                case EnemyKind.Siphon: return toward * spec.MoveForce + tangent * wave * 34f;
                case EnemyKind.Phantom: return toward * 58f + tangent * wave * spec.MoveForce;
                case EnemyKind.Oracle: return toward * Mathf.Sign(distance - 315f) * 54f + tangent * spec.MoveForce;
                case EnemyKind.Boss:
                    Vector2 center = new Vector2(ArenaConstants.Width * .5f, ArenaConstants.Height * .35f);
                    return (center - enemy.position).normalized * spec.MoveForce + tangent * 26f;
                default: return toward * spec.MoveForce;
            }
        }

        private void UpdateAlly(EnemyState ally, float dt)
        {
            EnemyState target = FindNearestHostile(ally.position, ally);
            if (target == null)
            {
                Vector2 desired = Player.position + PrismMath.FromAngle(ally.phase) * 88f;
                ally.velocity = Vector2.Lerp(ally.velocity, (desired - ally.position) * 3f, 1f - Mathf.Exp(-5f * dt));
            }
            else
            {
                Vector2 delta = target.position - ally.position;
                Vector2 tangent = delta.sqrMagnitude > .01f ? new Vector2(-delta.y, delta.x).normalized : Vector2.right;
                ally.velocity = Vector2.Lerp(ally.velocity, delta.normalized * 80f + tangent * 55f, 1f - Mathf.Exp(-4f * dt));
                ally.fireTimer -= dt;
                if (ally.fireTimer <= 0f)
                {
                    float aim = PrismMath.Angle(delta);
                    SpawnProjectile(ally.position, PrismMath.FromAngle(aim) * 610f, 4.5f, 2.3f, 2.1f, false,
                        ally.spectrum, new Color32(130, 255, 179, 255), DamageSource.Ally);
                    ally.fireTimer = .72f;
                }
            }
            ally.position = ClampToArena(ally.position + ally.velocity * dt, ally.radius + 2f);
        }

        private void FireEnemyPattern(EnemyState enemy)
        {
            Vector2 delta = Player.position - enemy.position;
            float aim = PrismMath.Angle(delta.sqrMagnitude > .01f ? delta : Vector2.down);
            float speedBase = 255f * difficulty.ProjectileSpeed * SafeScaling.projectileSpeed;
            if (HasModifier(ThreatModifierId.FastProjectiles)) speedBase *= 1.22f;
            SpectrumId spectrum = CombatMath.EnemySpectrum(enemy.kind, Mathf.FloorToInt(enemy.behaviorClock * 2f) + enemy.id);
            enemy.spectrum = spectrum;
            int repeats = HasModifier(ThreatModifierId.DoubleFire) ? 2 : 1;
            for (int repeat = 0; repeat < repeats; repeat++)
            {
                float offset = repeat == 0 ? 0f : .1f;
                switch (enemy.kind)
                {
                    case EnemyKind.Needle:
                        EnemyBullet(enemy, aim + offset, speedBase * 1.22f, 5f, spectrum); break;
                    case EnemyKind.Halo:
                        RadialEnemyBurst(enemy, 6, speedBase * .82f, spectrum, enemy.phase + enemy.behaviorClock * .24f); break;
                    case EnemyKind.Splitter:
                        AimedEnemySpread(enemy, aim, 3, .19f, speedBase * .9f, spectrum, 6f); break;
                    case EnemyKind.Lancer:
                        EnemyBullet(enemy, aim, speedBase * 1.7f, 6.5f, spectrum); break;
                    case EnemyKind.Bulwark:
                        AimedEnemySpread(enemy, aim, 5, .15f, speedBase * .74f, spectrum, 8f); break;
                    case EnemyKind.Skimmer:
                        AimedEnemySpread(enemy, aim, 2, .11f, speedBase * 1.28f, spectrum, 4.5f); break;
                    case EnemyKind.Weaver:
                        AimedEnemySpread(enemy, aim + Mathf.Sin(enemy.behaviorClock) * .22f, 4, .18f, speedBase, spectrum, 5.5f); break;
                    case EnemyKind.Warden:
                        RadialEnemyBurst(enemy, 8, speedBase * .72f, spectrum, enemy.behaviorClock * .38f); break;
                    case EnemyKind.Siphon:
                        EnemyBullet(enemy, aim, speedBase * .62f, 11f, spectrum); break;
                    case EnemyKind.Phantom:
                        AimedEnemySpread(enemy, aim, 3, .08f, speedBase * 1.45f, spectrum, 4.2f); break;
                    case EnemyKind.Oracle:
                        if (((int)(enemy.behaviorClock / 3f) & 1) == 0) RadialEnemyBurst(enemy, 10, speedBase * .78f, spectrum, enemy.phase);
                        else AimedEnemySpread(enemy, aim, 5, .14f, speedBase, spectrum, 5.5f);
                        break;
                    case EnemyKind.Boss:
                        FireBossPattern(enemy, aim, speedBase, spectrum); break;
                }
            }
            Emit("enemy-fire", (float)enemy.kind, enemy.position);
        }

        private void FireBossPattern(EnemyState enemy, float aim, float speed, SpectrumId spectrum)
        {
            int phase = Mathf.FloorToInt(enemy.behaviorClock / 7f) % 3;
            if (phase == 0)
                RadialEnemyBurst(enemy, 14, speed * .76f, spectrum, enemy.behaviorClock * .36f);
            else if (phase == 1)
                AimedEnemySpread(enemy, aim, 7, .115f, speed * 1.1f, spectrum, 8f);
            else
            {
                for (int i = 0; i < 6; i++)
                {
                    float spiral = enemy.behaviorClock * .82f + i * Mathf.PI * 2f / 6f;
                    EnemyBullet(enemy, spiral, speed * .9f, 6.5f, (SpectrumId)((i + Mathf.FloorToInt(enemy.behaviorClock)) % 4));
                }
            }
        }

        private void AimedEnemySpread(EnemyState enemy, float aim, int count, float spread, float speed, SpectrumId spectrum, float radius)
        {
            float center = (count - 1) * .5f;
            for (int i = 0; i < count; i++) EnemyBullet(enemy, aim + (i - center) * spread, speed, radius, spectrum);
        }

        private void RadialEnemyBurst(EnemyState enemy, int count, float speed, SpectrumId spectrum, float offset)
        {
            for (int i = 0; i < count; i++)
                EnemyBullet(enemy, offset + i * Mathf.PI * 2f / count, speed, 5.5f, (SpectrumId)(((int)spectrum + i / 4) % 4));
        }

        private void EnemyBullet(EnemyState enemy, float angle, float speed, float radius, SpectrumId spectrum)
        {
            if (hostileProjectileCount >= ArenaConstants.MaxEnemyProjectiles) return;
            float damage = enemy.eliteTier == EliteTier.Major ? 2f : 1f;
            SpawnProjectile(enemy.position + PrismMath.FromAngle(angle) * (enemy.radius + radius), PrismMath.FromAngle(angle) * speed,
                radius, damage, 6f, true, spectrum, HostileSpectrumColor(spectrum), DamageSource.Normal);
        }

        private void UpdateProjectiles(float dt)
        {
            float hostileSlow = stasisTime > 0f ? .55f : 1f;
            for (int i = projectiles.Count - 1; i >= 0; i--)
            {
                ProjectileState projectile = projectiles[i];
                if (projectile.dead)
                {
                    RemoveProjectileAt(i);
                    continue;
                }
                projectile.previousPosition = projectile.position;
                projectile.position += projectile.velocity * dt * (projectile.hostile ? hostileSlow : 1f);
                projectile.life -= dt;
                if (projectile.life <= 0f || projectile.position.x < -90f || projectile.position.y < -90f ||
                    projectile.position.x > ArenaConstants.Width + 90f || projectile.position.y > ArenaConstants.Height + 90f)
                {
                    RemoveProjectileAt(i);
                }
            }
        }

        private void ResolveCollisions()
        {
            if (Player.dashTime > 0f) AbsorbNearbyProjectiles();

            for (int p = projectiles.Count - 1; p >= 0; p--)
            {
                ProjectileState projectile = projectiles[p];
                if (projectile.dead) continue;
                if (projectile.hostile)
                {
                    if (Player.invulnerability <= 0f && CombatMath.SegmentHitsCircle(projectile, Player.position, Player.radius))
                    {
                        projectile.dead = true;
                        DamagePlayer(Mathf.Max(1, Mathf.RoundToInt(projectile.damage)), projectile.position);
                    }
                    continue;
                }

                ProjectileMeta meta;
                projectileMeta.TryGetValue(projectile.id, out meta);
                if (meta != null && meta.DetonatesBullets) DetonateHostileBullets(projectile.position, projectile.radius + 16f);
                for (int e = enemies.Count - 1; e >= 0 && !projectile.dead; e--)
                {
                    EnemyState enemy = enemies[e];
                    if (enemy.dead || enemy.ally) continue;
                    if (!CombatMath.SegmentHitsCircle(projectile, enemy.position, enemy.radius)) continue;
                    DamageSource source = meta != null ? meta.Source : (projectile.refracted ? DamageSource.Refraction : DamageSource.Normal);
                    float damage = projectile.damage;
                    if (enemy.kind == EnemyKind.Warden && source == DamageSource.Normal) damage *= .38f;
                    if (enemy.kind == EnemyKind.Phantom && source == DamageSource.Normal) damage *= .62f;
                    DamageEnemy(enemy, damage, source, projectile.position, meta);
                    if (projectile.pierce > 0) projectile.pierce--;
                    else projectile.dead = true;
                }
            }

            for (int i = enemies.Count - 1; i >= 0; i--)
            {
                EnemyState enemy = enemies[i];
                if (enemy.dead)
                {
                    enemies.RemoveAt(i);
                    continue;
                }
                if (enemy.ally || enemy.contactCooldown > 0f) continue;
                float radius = enemy.radius + Player.radius;
                if ((enemy.position - Player.position).sqrMagnitude > radius * radius) continue;
                enemy.contactCooldown = .25f;
                if (Player.dashTime > 0f)
                    DamageEnemy(enemy, 4.4f + Rank(UpgradeId.Wake) * 2.1f, DamageSource.Dash, enemy.position, null);
                else if (Player.invulnerability <= 0f)
                    DamagePlayer(enemy.eliteTier == EliteTier.Major ? 2 : 1, enemy.position);
            }
        }

        private void AbsorbNearbyProjectiles()
        {
            float radius = 94f + (Rank(UpgradeId.Horizon) > 0 ? 22f : 0f);
            int horizonExtra = 0;
            for (int i = projectiles.Count - 1; i >= 0; i--)
            {
                ProjectileState projectile = projectiles[i];
                if (!projectile.hostile || projectile.dead) continue;
                float distance = Vector2.Distance(projectile.position, Player.position);
                if (distance > radius + projectile.radius) continue;
                bool perfect = IsPerfectAbsorb(projectile, distance);
                AbsorbProjectile(projectile, perfect);
                if (perfect && Rank(UpgradeId.Horizon) > 0) horizonExtra = 2;
            }

            if (horizonExtra <= 0) return;
            for (int i = 0; i < projectiles.Count && horizonExtra > 0; i++)
            {
                ProjectileState projectile = projectiles[i];
                if (!projectile.hostile || projectile.dead || Vector2.Distance(projectile.position, Player.position) > 146f) continue;
                AbsorbProjectile(projectile, false);
                horizonExtra--;
            }
        }

        private bool IsPerfectAbsorb(ProjectileState projectile, float distance)
        {
            Vector2 toward = Player.position - projectile.position;
            float closingSpeed = Vector2.Dot(projectile.velocity, toward.normalized);
            if (closingSpeed <= 1f) return distance <= Player.radius + projectile.radius + 12f;
            float timeToImpact = (distance - Player.radius - projectile.radius) / closingSpeed;
            float loadRatio = Spectrum.Total / Mathf.Max(1f, SpectrumCapacity);
            float window = SpectrumEngine.PerfectWindow(config.difficulty, loadRatio);
            if (Rank(UpgradeId.Glass) > 0) window *= .78f;
            return timeToImpact >= -.025f && timeToImpact <= window;
        }

        private void AbsorbProjectile(ProjectileState projectile, bool perfect)
        {
            projectile.dead = true;
            int overflow;
            int amount = perfect ? 2 : 1;
            int added = SpectrumEngine.Add(Spectrum, projectile.spectrum, amount, SpectrumCapacity, out overflow);
            Absorbed++;
            Combo += perfect ? 2f : .7f;
            comboDecay = 2.5f;
            float charge = difficulty.AbsorbCharge * (perfect ? 2.15f : 1f);
            if (resonanceTime > 0f) charge *= 1.45f;
            NovaCharge = Mathf.Min(100f, NovaCharge + charge);
            AddExperience(perfect ? 10f : 4f);

            int streak;
            absorbStreak.TryGetValue(projectile.spectrum, out streak);
            streak++;
            absorbStreak[projectile.spectrum] = streak;
            if (Rank(UpgradeId.SpectrumLock) > 0 && streak % 3 == 0)
                SpectrumEngine.Add(Spectrum, projectile.spectrum, 1, SpectrumCapacity, out overflow);

            if (perfect)
            {
                PerfectAbsorbs++;
                Score += Mathf.RoundToInt(180f * Multiplier);
                Emit("perfect", (float)projectile.spectrum, projectile.position);
                AddFloatText(projectile.position, "PERFECT ABSORB", SpectrumEngine.ColorFor(projectile.spectrum));
                BurstParticles(projectile.position, SpectrumEngine.ColorFor(projectile.spectrum), 18, 150f);
            }
            else
            {
                Score += Mathf.RoundToInt(55f * Multiplier);
                Emit("absorb", (float)projectile.spectrum, projectile.position);
                BurstParticles(projectile.position, SpectrumEngine.ColorFor(projectile.spectrum), 7, 90f);
            }

            if (overflow > 0 || (added == 0 && Spectrum.Total >= SpectrumCapacity)) EnterPrismBreak();
        }

        private void TryRefract()
        {
            RefractionRecipe recipe = SpectrumEngine.Resolve(Spectrum);
            if (recipe == null || !SpectrumEngine.Consume(Spectrum, recipe))
            {
                Emit("refract-empty", 0f, Player.position);
                return;
            }
            FireRefractionVolley(Player.position, Player.aim, recipe, 1f);
            Score += Mathf.RoundToInt(110f * recipe.ScoreMultiplier * Multiplier);
            Combo += recipe.Spectra.Length * 1.25f;
            comboDecay = 2.7f;
            Emit("refract", recipe.ScoreMultiplier, Player.position);
            AddFloatText(Player.position + Vector2.up * 42f, recipe.Name, SpectrumEngine.ColorFor(recipe.Spectra[0]));
            if (recipe.Id == "full-spectrum")
            {
                Emit("full-spectrum", recipe.ScoreMultiplier, Player.position);
                EnterPrismBreak();
            }
            if (Rank(UpgradeId.Echo) > 0)
            {
                delayedVolleys.Add(new DelayedVolley
                {
                    Delay = .34f,
                    Position = Player.position,
                    Aim = Player.aim,
                    Recipe = recipe,
                    Power = .58f,
                    Spectrum = recipe.Spectra[0],
                });
            }
        }

        private void FireRefractionVolley(Vector2 position, float aim, RefractionRecipe recipe, float power)
        {
            int count = Mathf.Max(1, recipe.Projectiles + Rank(UpgradeId.Split) * 2);
            float center = (count - 1) * .5f;
            SpectrumId spectrum = recipe.Spectra.Length > 0 ? recipe.Spectra[0] : SpectrumId.Cyan;
            for (int i = 0; i < count; i++)
            {
                float angle = aim + (i - center) * recipe.Spread;
                ProjectileState shot = SpawnProjectile(position + PrismMath.FromAngle(angle) * 24f,
                    PrismMath.FromAngle(angle) * 650f, 7f, recipe.Damage * power * (prismBreakTime > 0f ? 1.4f : 1f),
                    2.4f, false, spectrum, SpectrumEngine.ColorFor(spectrum), DamageSource.Refraction);
                if (shot == null) continue;
                shot.refracted = true;
                shot.pierce = recipe.Pierce + (pierceTime > 0f ? 2 : 0);
                ProjectileMeta meta = projectileMeta[shot.id];
                meta.Chain = recipe.Chain;
                meta.BurstRadius = recipe.BurstRadius;
                meta.DetonatesBullets = recipe.DetonatesBullets;
                meta.ScoreMultiplier = recipe.ScoreMultiplier;
            }
            BurstParticles(position, SpectrumEngine.ColorFor(spectrum), 22, 230f);
        }

        private void UpdateDelayedVolleys(float dt)
        {
            for (int i = delayedVolleys.Count - 1; i >= 0; i--)
            {
                DelayedVolley volley = delayedVolleys[i];
                volley.Delay -= dt;
                if (volley.Delay > 0f) continue;
                FireRefractionVolley(Player.position, Player.aim, volley.Recipe, volley.Power);
                Emit("echo", 0f, Player.position);
                delayedVolleys.RemoveAt(i);
            }
        }

        private void EnterPrismBreak()
        {
            prismBreakTime = Mathf.Max(prismBreakTime, SpectrumEngine.PrismBreakDuration);
            overloadClock = 0f;
            Emit("prism-break", prismBreakTime, Player.position);
            AddFloatText(Player.position + Vector2.up * 60f, "PRISM BREAK", new Color32(255, 240, 151, 255));
            BurstParticles(Player.position, Color.white, 38, 310f);
        }

        private void TrySmash()
        {
            if (smashCooldown > 0f)
            {
                Emit("cooldown", smashCooldown, Player.position);
                return;
            }
            smashCooldown = cooldownTime > 0f ? 6.5f : 18f;
            float radius = 215f;
            int hit = 0;
            for (int i = 0; i < enemies.Count; i++)
            {
                EnemyState enemy = enemies[i];
                if (enemy.dead || enemy.ally || Vector2.Distance(enemy.position, Player.position) > radius + enemy.radius) continue;
                DamageEnemy(enemy, 12f + Rank(UpgradeId.Shatterpoint) * 4f, DamageSource.Smash, enemy.position, null);
                hit++;
            }
            DetonateHostileBullets(Player.position, radius);
            Player.invulnerability = Mathf.Max(Player.invulnerability, .32f);
            Emit("smash", hit, Player.position);
            BurstParticles(Player.position, new Color32(201, 120, 255, 255), 45, 350f);
        }

        private void TryLance()
        {
            if (!HasLance)
            {
                Emit("power-locked", (float)PersistentPowerId.Lance, Player.position);
                return;
            }
            if (lanceCooldown > 0f)
            {
                Emit("cooldown", lanceCooldown, Player.position);
                return;
            }
            lanceCooldown = cooldownTime > 0f ? 2.2f : 5f;
            Vector2 direction = PrismMath.FromAngle(Player.aim);
            ProjectileState shot = SpawnProjectile(Player.position + direction * 28f, direction * 1080f, 10f,
                20f * (overchargeTime > 0f ? 1.35f : 1f), 1.25f, false, SpectrumId.Gold,
                new Color32(255, 242, 164, 255), DamageSource.Normal);
            if (shot != null)
            {
                shot.pierce = 12;
                ProjectileMeta meta = projectileMeta[shot.id];
                meta.DetonatesBullets = true;
                meta.BurstRadius = 38f;
            }
            Emit("lance", 0f, Player.position);
            BurstParticles(Player.position, new Color32(255, 228, 100, 255), 18, 280f);
        }

        private void ExecuteNova()
        {
            int hits = 0;
            for (int i = 0; i < enemies.Count; i++)
            {
                EnemyState enemy = enemies[i];
                if (enemy.dead || enemy.ally) continue;
                DamageEnemy(enemy, enemy.kind == EnemyKind.Boss ? 68f : 45f, DamageSource.Nova, enemy.position, null);
                hits++;
            }
            for (int i = 0; i < projectiles.Count; i++) if (projectiles[i].hostile) projectiles[i].dead = true;
            if (Rank(UpgradeId.Guard) > 0) Player.shield = Mathf.Max(Player.shield, 1f + Rank(UpgradeId.Guard));
            Player.invulnerability = Mathf.Max(Player.invulnerability, .85f);
            Emit("nova", hits, Player.position);
            AddFloatText(Player.position + Vector2.up * 54f, "PRISM NOVA", new Color32(126, 253, 255, 255));
            BurstParticles(Player.position, Color.white, 64, 480f);
        }

        private void DamageEnemy(EnemyState enemy, float amount, DamageSource source, Vector2 point, ProjectileMeta meta)
        {
            if (enemy == null || enemy.dead || amount <= 0f) return;
            enemy.health -= amount;
            Emit("hit", amount, point);
            AddParticle(point, rng.Range(0f, Mathf.PI * 2f), 75f, 4f, CombatMath.EnemyColor(enemy.kind), .22f);
            if (enemy.health > 0f) return;

            enemy.dead = true;
            KillEnemy(enemy, source, meta);
        }

        private void KillEnemy(EnemyState enemy, DamageSource source, ProjectileMeta meta)
        {
            Kills++;
            if (enemy.eliteTier != EliteTier.None) EliteKills++;
            if (source == DamageSource.Refraction) RefractionKills++;
            float scoreMultiplier = meta != null ? meta.ScoreMultiplier : 1f;
            int points = Mathf.RoundToInt(CombatMath.BaseScore(enemy.kind) * difficulty.ScoreMultiplier * Multiplier * scoreMultiplier);
            Score += points;
            Combo += enemy.kind == EnemyKind.Boss ? 12f : enemy.eliteTier != EliteTier.None ? 3f : 1f;
            BestCombo = Mathf.Max(BestCombo, Multiplier);
            comboDecay = 2.9f;
            AddExperience(Mathf.Max(8f, CombatMath.BaseScore(enemy.kind) * .045f));
            NovaCharge = Mathf.Min(100f, NovaCharge + (enemy.eliteTier != EliteTier.None ? 6f : 1.8f));
            Emit(enemy.kind == EnemyKind.Boss ? "boss-kill" : "kill", points, enemy.position);
            BurstParticles(enemy.position, CombatMath.EnemyColor(enemy.kind), enemy.kind == EnemyKind.Boss ? 70 : 18, enemy.kind == EnemyKind.Boss ? 420f : 190f);

            if (meta != null && meta.BurstRadius > 0f) BurstDamage(enemy.position, meta.BurstRadius, enemy, source, meta);
            if (meta != null && meta.Chain > 0) ChainDamage(enemy.position, enemy, meta.Chain, source, meta);
            if (Rank(UpgradeId.Chain) > 0) ChainDamage(enemy.position, enemy, Rank(UpgradeId.Chain), source, null);
            if (prismBreakTime > 0f && Rank(UpgradeId.Shatterpoint) > 0) SpawnShatterFragments(enemy.position);

            if (enemy.kind == EnemyKind.Splitter && CountHostiles() + 2 < EffectiveMaxHostiles)
            {
                SpawnEnemy(EnemyKind.Needle, enemy.position + new Vector2(-22f, 0f), EliteTier.None, false);
                SpawnEnemy(EnemyKind.Needle, enemy.position + new Vector2(22f, 0f), EliteTier.None, false);
            }

            SpawnRewards(enemy);
            if (enemy.kind == EnemyKind.Boss)
            {
                bossDefeated = true;
                objectiveProgress = 1;
            }
        }

        private void BurstDamage(Vector2 center, float radius, EnemyState excluded, DamageSource source, ProjectileMeta originalMeta)
        {
            for (int i = 0; i < enemies.Count; i++)
            {
                EnemyState target = enemies[i];
                if (target == excluded || target.dead || target.ally || Vector2.Distance(center, target.position) > radius + target.radius) continue;
                DamageEnemy(target, Mathf.Max(2f, originalMeta == null ? 2f : radius * .035f), source, target.position, null);
            }
            DetonateHostileBullets(center, radius);
        }

        private void ChainDamage(Vector2 start, EnemyState excluded, int chains, DamageSource source, ProjectileMeta originalMeta)
        {
            EnemyState previous = excluded;
            Vector2 origin = start;
            for (int c = 0; c < chains; c++)
            {
                EnemyState target = FindNearestHostile(origin, previous, 235f);
                if (target == null) break;
                Emit("chain", c + 1, target.position);
                DamageEnemy(target, originalMeta != null ? 3.25f : 1.8f, source, target.position, null);
                origin = target.position;
                previous = target;
            }
        }

        private void SpawnShatterFragments(Vector2 position)
        {
            for (int i = 0; i < 4; i++)
            {
                float angle = i * Mathf.PI * .5f;
                ProjectileState fragment = SpawnProjectile(position, PrismMath.FromAngle(angle) * 420f, 5f, 2.8f,
                    1.1f, false, (SpectrumId)i, SpectrumEngine.ColorFor((SpectrumId)i), DamageSource.Refraction);
                if (fragment != null) fragment.pierce = 1;
            }
        }

        private void DamagePlayer(int amount, Vector2 point)
        {
            if (Player.invulnerability > 0f || Phase != SessionPhase.Running) return;
            int remaining = Mathf.Max(1, amount);
            if (Player.shield > 0f)
            {
                float absorbedByShield = Mathf.Min(Player.shield, remaining);
                Player.shield -= absorbedByShield;
                remaining -= Mathf.FloorToInt(absorbedByShield);
            }
            if (remaining <= 0)
            {
                Emit("shield-hit", amount, point);
                return;
            }

            if (Rank(UpgradeId.Second) > 0 && !Player.secondUsed && Player.health - remaining <= 0)
            {
                Player.secondUsed = true;
                Player.health = 1;
                Player.invulnerability = 1.25f;
                Emit("second-light", 0f, Player.position);
                return;
            }

            Player.health -= remaining;
            HitsTaken++;
            Combo *= .45f;
            comboDecay = .8f;
            Player.invulnerability = config.difficulty == Difficulty.Cadet ? 1.2f : .85f;
            Emit("hurt", remaining, point);
            BurstParticles(Player.position, new Color32(255, 81, 123, 255), 20, 230f);
            if (Player.health <= 0) Finish(false, "PRISM FALLEN");
        }

        private void SpawnRewards(EnemyState enemy)
        {
            bool elite = enemy.eliteTier != EliteTier.None;
            if (!firstCoinSpawned || rng.Chance(elite ? .52f : .13f))
            {
                firstCoinSpawned = true;
                pickups.Add(new PickupState
                {
                    position = enemy.position,
                    velocity = RandomDirection() * 48f,
                    life = 14f,
                    value = 1,
                    prismShard = false,
                });
            }
            if (rng.Chance(elite ? .72f : .26f))
            {
                pickups.Add(new PickupState
                {
                    position = enemy.position + RandomDirection() * 14f,
                    velocity = RandomDirection() * 62f,
                    life = 14f,
                    value = elite ? 2 : 1,
                    prismShard = true,
                });
            }

            float dropChance = elite ? .44f : .085f;
            if (dropSurgeTime > 0f || HasPrimeBonus(PrimeBonusId.DropSurge)) dropChance = elite ? .78f : .32f;
            if (!rng.Chance(dropChance)) return;
            DropKind kind = (DropKind)rng.Range(0, 12);
            powerDrops.Add(new PowerDropState
            {
                position = enemy.position + RandomDirection() * 20f,
                velocity = RandomDirection() * 35f,
                life = 15f,
                kind = kind,
                spectrum = enemy.spectrum,
                allyKind = enemy.kind,
                hasAllyKind = kind == DropKind.Alliance,
            });
            Emit("drop", (float)kind, enemy.position);
        }

        private void UpdatePickups(float dt)
        {
            float magnetRadius = 75f + Rank(UpgradeId.Magnet) * 85f;
            for (int i = pickups.Count - 1; i >= 0; i--)
            {
                PickupState pickup = pickups[i];
                pickup.life -= dt;
                pickup.velocity *= Mathf.Exp(-2.2f * dt);
                Vector2 delta = Player.position - pickup.position;
                float distance = delta.magnitude;
                if (distance < magnetRadius && distance > .1f) pickup.velocity += delta / distance * (480f + Rank(UpgradeId.Magnet) * 180f) * dt;
                pickup.position += pickup.velocity * dt;
                if (distance < Player.radius + 15f)
                {
                    if (pickup.prismShard) ShardsCollected += pickup.value;
                    else CoinsCollected += pickup.value;
                    pickup.dead = true;
                    Emit("pickup", pickup.prismShard ? pickup.value : -pickup.value, pickup.position);
                    AddFloatText(pickup.position, pickup.prismShard ? "+SHARD" : "+COIN", pickup.prismShard ? new Color32(105, 255, 205, 255) : new Color32(255, 222, 104, 255));
                }
                if (pickup.dead || pickup.life <= 0f) pickups.RemoveAt(i);
            }
        }

        private void UpdatePowerDrops(float dt)
        {
            for (int i = powerDrops.Count - 1; i >= 0; i--)
            {
                PowerDropState drop = powerDrops[i];
                drop.life -= dt;
                drop.velocity *= Mathf.Exp(-2f * dt);
                Vector2 delta = Player.position - drop.position;
                float distance = delta.magnitude;
                if (distance < 150f && distance > .1f) drop.velocity += delta / distance * 330f * dt;
                drop.position += drop.velocity * dt;
                if (distance < Player.radius + 22f)
                {
                    ApplyDrop(drop);
                    drop.dead = true;
                }
                if (drop.dead || drop.life <= 0f) powerDrops.RemoveAt(i);
            }
        }

        private void ApplyDrop(PowerDropState drop)
        {
            switch (drop.kind)
            {
                case DropKind.Repair:
                    Player.health = Mathf.Min(Player.maxHealth, Player.health + 1); break;
                case DropKind.Overcharge:
                    overchargeTime = Mathf.Max(overchargeTime, 12f); NovaCharge = Mathf.Min(100f, NovaCharge + 28f); break;
                case DropKind.Rapid:
                    rapidTime = Mathf.Max(rapidTime, 13f); break;
                case DropKind.SmashCell:
                    smashCooldown = 0f; break;
                case DropKind.Double:
                    doubleTime = Mathf.Max(doubleTime, 15f); break;
                case DropKind.Alliance:
                    ConvertEnemyToAlly(drop); break;
                case DropKind.PowerCore:
                    GrantTemporaryPower(); break;
                case DropKind.Cooldown:
                    cooldownTime = Mathf.Max(cooldownTime, 10f); smashCooldown *= .35f; lanceCooldown *= .35f; Player.dashCooldown *= .35f; break;
                case DropKind.Aegis:
                    Player.shield = Mathf.Max(Player.shield, 2f); break;
                case DropKind.Pierce:
                    pierceTime = Mathf.Max(pierceTime, 14f); break;
                case DropKind.Stasis:
                    stasisTime = Mathf.Max(stasisTime, 9f); break;
                case DropKind.Resonance:
                    resonanceTime = Mathf.Max(resonanceTime, 16f); AddOneOfEachSpectrum(); break;
            }
            Emit("power-pickup", (float)drop.kind, drop.position);
            AddFloatText(drop.position, drop.kind.ToString().ToUpperInvariant(), DropColor(drop.kind));
            BurstParticles(drop.position, DropColor(drop.kind), 20, 190f);
        }

        private void ConvertEnemyToAlly(PowerDropState drop)
        {
            EnemyState best = null;
            float bestDistance = float.MaxValue;
            for (int i = 0; i < enemies.Count; i++)
            {
                EnemyState candidate = enemies[i];
                if (candidate.dead || candidate.ally || candidate.kind == EnemyKind.Boss) continue;
                if (drop.hasAllyKind && candidate.kind != drop.allyKind) continue;
                float distance = (candidate.position - Player.position).sqrMagnitude;
                if (distance < bestDistance) { bestDistance = distance; best = candidate; }
            }
            if (best == null)
            {
                EnemyKind kind = drop.hasAllyKind && drop.allyKind != EnemyKind.Boss ? drop.allyKind : EnemyKind.Needle;
                best = SpawnEnemy(kind, Player.position + RandomDirection() * 90f, EliteTier.None, true);
            }
            if (best != null)
            {
                best.ally = true;
                best.eliteTier = EliteTier.None;
                best.health = Mathf.Max(best.health, best.maxHealth * .75f);
                best.fireTimer = .25f;
                Emit("ally-convert", (float)best.kind, best.position);
            }
        }

        private void GrantTemporaryPower()
        {
            PersistentPowerId[] powers = { PersistentPowerId.Focus, PersistentPowerId.Overclock, PersistentPowerId.Lance };
            PersistentPowerId power = powers[rng.Range(0, powers.Length)];
            unlockedPowers.Add(power);
            if (power == PersistentPowerId.Focus) ApplyUpgradeInternal(UpgradeId.Focus);
            else if (power == PersistentPowerId.Overclock) ApplyUpgradeInternal(UpgradeId.Overclock);
            else ApplyUpgradeInternal(UpgradeId.Lance);
        }

        private void UpdateParticles(float dt)
        {
            for (int i = particles.Count - 1; i >= 0; i--)
            {
                ParticleState particle = particles[i];
                particle.life -= dt;
                particle.velocity *= Mathf.Exp(-particle.drag * dt);
                particle.position += particle.velocity * dt;
                particle.size *= Mathf.Exp(-.55f * dt);
                if (particle.life <= 0f) particles.RemoveAt(i);
            }
        }

        private void UpdateFloatTexts(float dt)
        {
            for (int i = floatTexts.Count - 1; i >= 0; i--)
            {
                FloatTextState text = floatTexts[i];
                text.life -= dt;
                text.position += Vector2.up * 27f * dt;
                if (text.life <= 0f) floatTexts.RemoveAt(i);
            }
        }

        private void UpdateCombo(float dt)
        {
            if (comboDecay > 0f) comboDecay -= dt;
            else Combo = Mathf.Max(0f, Combo - dt * (1.4f + Combo * .065f));
            BestCombo = Mathf.Max(BestCombo, Multiplier);
        }

        private void UpdateOverload(float dt)
        {
            if (!PrismOverloaded)
            {
                overloadClock = 0f;
                overloadDamageClock = 0f;
                return;
            }
            overloadClock += dt;
            overloadDamageClock += dt;
            if (overloadClock > 3.2f && overloadClock - dt <= 3.2f)
            {
                Emit("overload-warning", 0f, Player.position);
                AddFloatText(Player.position + Vector2.up * 52f, "PRISM UNSTABLE", new Color32(255, 94, 143, 255));
            }
            if (config.difficulty == Difficulty.Cadet || overloadClock < 6f || overloadDamageClock < 2f) return;
            overloadDamageClock = 0f;
            DamagePlayer(1, Player.position);
        }

        private void CheckObjective()
        {
            if (Phase != SessionPhase.Running) return;
            bool met = CurrentObjectiveProgress >= ObjectiveTarget;
            if (met)
            {
                Finish(true, "OBJECTIVE COMPLETE");
                return;
            }

            if (Elapsed < Duration) return;
            if (config.objective == ObjectiveKind.Survive) Finish(true, "RIFT STABILIZED");
            else Finish(false, "OBJECTIVE INCOMPLETE");
        }

        private void Finish(bool victory, string reason)
        {
            if (Phase == SessionPhase.Victory || Phase == SessionPhase.Defeat) return;
            Phase = victory ? SessionPhase.Victory : SessionPhase.Defeat;
            int stars = 0;
            if (victory)
            {
                stars = 1;
                if (HitsTaken <= Mathf.Max(1, Player.maxHealth / 2)) stars++;
                if (HitsTaken == 0 || Multiplier >= 3f) stars++;
            }
            result = new RunResult
            {
                victory = victory,
                reason = reason,
                score = Score,
                kills = Kills,
                eliteKills = EliteKills,
                absorbed = Absorbed,
                perfectAbsorbs = PerfectAbsorbs,
                refractionKills = RefractionKills,
                hitsTaken = HitsTaken,
                bestCombo = BestCombo,
                elapsed = Elapsed,
                shardsEarned = 0,
                stars = stars,
            };
            // The progression module owns the economy formula. Unspent run coins are
            // included as bonus pickups; a Nova coin has already been removed and can
            // therefore never be banked or charged twice.
            result.shardsEarned = RewardCalculator.ForRun(config, result, ShardsCollected + CoinsCollected);
            Emit(victory ? "victory" : "defeat", Score, Player.position);
        }

        private void AddExperience(float amount)
        {
            experience += Mathf.Max(0f, amount);
            float requirement = ExperienceRequirement(level);
            if (experience < requirement || Phase != SessionPhase.Running) return;
            experience -= requirement;
            level++;
            upgradeChoices = UpgradeCatalog.ChooseThree(rng, upgradeRanks, unlockedPowers, config.stageId);
            if (upgradeChoices.Length > 0)
            {
                Phase = SessionPhase.UpgradeChoice;
                Emit("level", level, Player.position);
            }
        }

        private static float ExperienceRequirement(int currentLevel)
        {
            return 72f + currentLevel * 38f + Mathf.Pow(currentLevel, 1.35f) * 8f;
        }

        private bool ApplyUpgradeInternal(UpgradeId id)
        {
            UpgradeDefinition definition;
            try { definition = UpgradeCatalog.Get(id); }
            catch (KeyNotFoundException) { return false; }
            int rank = Rank(id);
            if (rank >= definition.maxRank) return false;
            upgradeRanks[id] = rank + 1;
            if (id == UpgradeId.Glass)
            {
                Player.maxHealth = Mathf.Max(1, Player.maxHealth - 1);
                Player.health = Mathf.Min(Player.health, Player.maxHealth);
            }
            if (id == UpgradeId.Second) Player.secondUsed = false;
            if (id == UpgradeId.Lance) unlockedPowers.Add(PersistentPowerId.Lance);
            return true;
        }

        private int Rank(UpgradeId id)
        {
            int value;
            return upgradeRanks.TryGetValue(id, out value) ? value : 0;
        }

        private void ApplyPrimeBonuses()
        {
            float fullRun = Duration + 5f;
            if (HasPrimeBonus(PrimeBonusId.TwinArray)) doubleTime = fullRun;
            if (HasPrimeBonus(PrimeBonusId.RapidArray)) rapidTime = fullRun;
            if (HasPrimeBonus(PrimeBonusId.DropSurge)) dropSurgeTime = fullRun;
            if (HasPrimeBonus(PrimeBonusId.ResonanceField)) resonanceTime = fullRun;
            if (HasPrimeBonus(PrimeBonusId.AegisStart)) Player.shield = Mathf.Max(Player.shield, 2f);
        }

        private void AddOneOfEachSpectrum()
        {
            for (int i = 0; i < 4; i++)
            {
                int overflow;
                SpectrumEngine.Add(Spectrum, (SpectrumId)i, 1, SpectrumCapacity, out overflow);
            }
        }

        private bool HasPrimeBonus(PrimeBonusId id)
        {
            PrimeBonusId[] bonuses = config.primeBonuses;
            return bonuses != null && Array.IndexOf(bonuses, id) >= 0;
        }

        private bool HasModifier(ThreatModifierId id)
        {
            ThreatModifierId[] modifiers = config.modifiers;
            return modifiers != null && Array.IndexOf(modifiers, id) >= 0;
        }

        private int EffectiveMaxHostiles
        {
            get
            {
                int configured = config.maxHostiles > 0 ? config.maxHostiles : SafeScaling.maxEnemies;
                if (configured <= 0) configured = 28;
                if (HasModifier(ThreatModifierId.HighDensity)) configured += Mathf.Min(8, configured / 4);
                return Mathf.Clamp(configured, 4, 72);
            }
        }

        private int CountHostiles()
        {
            int count = 0;
            for (int i = 0; i < enemies.Count; i++) if (!enemies[i].dead && !enemies[i].ally) count++;
            return count;
        }

        private int CountActiveElites()
        {
            int count = 0;
            for (int i = 0; i < enemies.Count; i++)
                if (!enemies[i].dead && !enemies[i].ally && enemies[i].eliteTier != EliteTier.None) count++;
            return count;
        }

        private EnemyState FindNearestHostile(Vector2 origin, EnemyState excluded, float maxDistance = float.MaxValue)
        {
            EnemyState best = null;
            float bestSquared = maxDistance == float.MaxValue ? float.MaxValue : maxDistance * maxDistance;
            for (int i = 0; i < enemies.Count; i++)
            {
                EnemyState candidate = enemies[i];
                if (candidate == excluded || candidate.dead || candidate.ally) continue;
                float distance = (candidate.position - origin).sqrMagnitude;
                if (distance >= bestSquared) continue;
                bestSquared = distance;
                best = candidate;
            }
            return best;
        }

        private ProjectileState SpawnProjectile(Vector2 position, Vector2 velocity, float radius, float damage,
            float life, bool hostile, SpectrumId spectrum, Color color, DamageSource source)
        {
            if (projectiles.Count >= ArenaConstants.MaxProjectiles) return null;
            if (hostile && hostileProjectileCount >= ArenaConstants.MaxEnemyProjectiles) return null;
            ProjectileState projectile = new ProjectileState
            {
                id = nextProjectileId++,
                position = position,
                previousPosition = position,
                velocity = velocity,
                radius = radius,
                damage = damage,
                life = life,
                hostile = hostile,
                spectrum = spectrum,
                color = color,
            };
            projectiles.Add(projectile);
            projectileMeta[projectile.id] = new ProjectileMeta { Source = source };
            if (hostile) hostileProjectileCount++;
            return projectile;
        }

        private void RemoveProjectileAt(int index)
        {
            ProjectileState projectile = projectiles[index];
            if (projectile.hostile) hostileProjectileCount = Mathf.Max(0, hostileProjectileCount - 1);
            projectileMeta.Remove(projectile.id);
            projectiles.RemoveAt(index);
        }

        private void DetonateHostileBullets(Vector2 center, float radius)
        {
            float squared = radius * radius;
            for (int i = 0; i < projectiles.Count; i++)
            {
                ProjectileState projectile = projectiles[i];
                if (projectile.hostile && !projectile.dead && (projectile.position - center).sqrMagnitude <= squared)
                {
                    projectile.dead = true;
                    Score += Mathf.RoundToInt(12f * Multiplier);
                }
            }
        }

        private void RebuildBuffView()
        {
            activeBuffs.Clear();
            PutBuff("RAPID ARRAY", rapidTime);
            PutBuff("TWIN BEAM", doubleTime);
            PutBuff("OVERCHARGE", overchargeTime);
            PutBuff("COOLDOWN FLUX", cooldownTime);
            PutBuff("PHASE PIERCE", pierceTime);
            PutBuff("STASIS BLOOM", stasisTime);
            PutBuff("RESONANCE", resonanceTime);
            PutBuff("DROP SURGE", dropSurgeTime);
            PutBuff("PRISM BREAK", prismBreakTime);
            if (Player.shield > 0f) activeBuffs["AEGIS"] = Player.shield;
        }

        private void PutBuff(string name, float time)
        {
            if (time > .01f) activeBuffs[name] = time;
        }

        private void AddFloatText(Vector2 position, string text, Color color)
        {
            if (floatTexts.Count >= 32) floatTexts.RemoveAt(0);
            floatTexts.Add(new FloatTextState { position = position, text = text, color = color, life = 1.05f });
        }

        private void BurstParticles(Vector2 position, Color color, int count, float speed)
        {
            if (loadout.ReducedMotion) count = Mathf.Max(3, count / 3);
            for (int i = 0; i < count; i++)
                AddParticle(position, rng.Range(0f, Mathf.PI * 2f), rng.Range(speed * .25f, speed), rng.Range(2f, 7f), color, rng.Range(.24f, .75f));
        }

        private void AddParticle(Vector2 position, float angle, float speed, float size, Color color, float life)
        {
            if (particles.Count >= ArenaConstants.MaxParticles) return;
            particles.Add(new ParticleState
            {
                position = position,
                velocity = PrismMath.FromAngle(angle) * speed,
                life = life,
                maxLife = life,
                size = size,
                color = color,
                drag = 3.2f,
            });
        }

        private void Emit(string id, float value, Vector2 position)
        {
            if (events.Count >= 64) return;
            events.Add(new GameEvent { id = id, value = value, position = position });
        }

        private Vector2 RandomEdgePosition(float padding)
        {
            int side = rng.Range(0, 4);
            if (side == 0) return new Vector2(rng.Range(padding, ArenaConstants.Width - padding), padding);
            if (side == 1) return new Vector2(ArenaConstants.Width - padding, rng.Range(padding, ArenaConstants.Height - padding));
            if (side == 2) return new Vector2(rng.Range(padding, ArenaConstants.Width - padding), ArenaConstants.Height - padding);
            return new Vector2(padding, rng.Range(padding, ArenaConstants.Height - padding));
        }

        private Vector2 RandomDirection()
        {
            return PrismMath.FromAngle(rng.Range(0f, Mathf.PI * 2f));
        }

        private static Vector2 ClampToArena(Vector2 value, float margin)
        {
            value.x = Mathf.Clamp(value.x, margin, ArenaConstants.Width - margin);
            value.y = Mathf.Clamp(value.y, margin, ArenaConstants.Height - margin);
            return value;
        }

        private static Color HostileSpectrumColor(SpectrumId spectrum)
        {
            // Hostile cyan is intentionally mint-green rather than particle cyan so the
            // Halo/Oracle shots remain readable against the cyan arena background.
            switch (spectrum)
            {
                case SpectrumId.Cyan: return new Color32(116, 255, 177, 255);
                case SpectrumId.Violet: return new Color32(236, 117, 255, 255);
                case SpectrumId.Gold: return new Color32(255, 224, 96, 255);
                default: return new Color32(255, 76, 129, 255);
            }
        }

        private static Color DropColor(DropKind kind)
        {
            switch (kind)
            {
                case DropKind.Repair: return new Color32(105, 255, 143, 255);
                case DropKind.Overcharge: return new Color32(255, 219, 84, 255);
                case DropKind.Rapid: return new Color32(96, 211, 255, 255);
                case DropKind.SmashCell: return new Color32(199, 114, 255, 255);
                case DropKind.Alliance: return new Color32(117, 255, 151, 255);
                case DropKind.Cooldown: return new Color32(110, 241, 255, 255);
                case DropKind.Aegis: return new Color32(127, 177, 255, 255);
                case DropKind.Stasis: return new Color32(116, 181, 255, 255);
                case DropKind.Resonance: return new Color32(231, 136, 255, 255);
                default: return new Color32(255, 132, 153, 255);
            }
        }

        private static void AddRange<T>(HashSet<T> target, T[] values)
        {
            if (values == null) return;
            for (int i = 0; i < values.Length; i++) target.Add(values[i]);
        }
    }
}

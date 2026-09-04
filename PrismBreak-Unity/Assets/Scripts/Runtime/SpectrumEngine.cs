using System;
using System.Collections.Generic;
using UnityEngine;

namespace PrismBreak
{
    [Serializable]
    public sealed class SpectrumStore
    {
        public int Cyan;
        public int Violet;
        public int Gold;
        public int Crimson;

        public int Total { get { return Cyan + Violet + Gold + Crimson; } }

        public int Get(SpectrumId id)
        {
            switch (id)
            {
                case SpectrumId.Cyan: return Cyan;
                case SpectrumId.Violet: return Violet;
                case SpectrumId.Gold: return Gold;
                default: return Crimson;
            }
        }

        public void Set(SpectrumId id, int value)
        {
            value = Mathf.Max(0, value);
            switch (id)
            {
                case SpectrumId.Cyan: Cyan = value; break;
                case SpectrumId.Violet: Violet = value; break;
                case SpectrumId.Gold: Gold = value; break;
                default: Crimson = value; break;
            }
        }

        public void Clear()
        {
            Cyan = Violet = Gold = Crimson = 0;
        }
    }

    [Serializable]
    public sealed class RefractionRecipe
    {
        public string Id = string.Empty;
        public string Name = string.Empty;
        public SpectrumId[] Spectra = Array.Empty<SpectrumId>();
        public float Damage;
        public int Projectiles;
        public float Spread;
        public int Pierce;
        public int Chain;
        public float BurstRadius;
        public bool DetonatesBullets;
        public float ScoreMultiplier;
    }

    /// <summary>
    /// The signature ABSORB / REFRACT rules. This has no scene dependencies and
    /// can therefore be unit tested and used by preview/editor tools.
    /// </summary>
    public static class SpectrumEngine
    {
        public const int Capacity = 12;
        public const float PrismBreakDuration = 7f;

        private static readonly SpectrumId[] SpectrumOrder =
        {
            SpectrumId.Cyan, SpectrumId.Violet, SpectrumId.Gold, SpectrumId.Crimson
        };

        private static readonly Dictionary<SpectrumId, RefractionRecipe> Singles =
            new Dictionary<SpectrumId, RefractionRecipe>
            {
                { SpectrumId.Cyan, Recipe("cyan-pierce", "CYAN PIERCE", new[] { SpectrumId.Cyan }, 5.2f, 1, 0f, 4, 0, 0f, true, 1.25f) },
                { SpectrumId.Violet, Recipe("violet-split", "VIOLET SPLIT", new[] { SpectrumId.Violet }, 3.5f, 3, .17f, 0, 0, 0f, false, 1.25f) },
                { SpectrumId.Gold, Recipe("gold-chain", "GOLD CHAIN", new[] { SpectrumId.Gold }, 4.2f, 1, 0f, 0, 3, 0f, false, 1.35f) },
                { SpectrumId.Crimson, Recipe("crimson-burst", "CRIMSON BURST", new[] { SpectrumId.Crimson }, 5.7f, 1, 0f, 0, 0, 92f, false, 1.35f) },
            };

        private static readonly RefractionRecipe[] Combos =
        {
            Recipe("full-spectrum", "FULL SPECTRUM", SpectrumOrder, 10.5f, 7, .105f, 6, 5, 155f, true, 3.2f),
            Recipe("tri-cvg", "TRI-SPECTRAL BREAK", new[] { SpectrumId.Cyan, SpectrumId.Violet, SpectrumId.Gold }, 8.1f, 5, .12f, 4, 3, 74f, true, 2.4f),
            Recipe("tri-cvc", "TRI-SPECTRAL BREAK", new[] { SpectrumId.Cyan, SpectrumId.Violet, SpectrumId.Crimson }, 8.1f, 5, .12f, 4, 0, 112f, true, 2.4f),
            Recipe("tri-cgc", "TRI-SPECTRAL BREAK", new[] { SpectrumId.Cyan, SpectrumId.Gold, SpectrumId.Crimson }, 8.1f, 3, .13f, 4, 4, 112f, true, 2.4f),
            Recipe("tri-vgc", "TRI-SPECTRAL BREAK", new[] { SpectrumId.Violet, SpectrumId.Gold, SpectrumId.Crimson }, 8.1f, 6, .13f, 1, 4, 112f, true, 2.4f),
            Recipe("prism-lance", "PRISM LANCE", new[] { SpectrumId.Cyan, SpectrumId.Violet }, 7.6f, 3, .08f, 6, 0, 0f, true, 1.85f),
            Recipe("solar-cascade", "SOLAR CASCADE", new[] { SpectrumId.Gold, SpectrumId.Crimson }, 7.1f, 1, 0f, 0, 5, 128f, true, 2f),
            Recipe("arc-beam", "ARC BEAM", new[] { SpectrumId.Cyan, SpectrumId.Gold }, 6.8f, 1, 0f, 5, 4, 0f, true, 1.9f),
            Recipe("void-bloom", "VOID BLOOM", new[] { SpectrumId.Violet, SpectrumId.Crimson }, 6.2f, 5, .16f, 0, 0, 108f, false, 1.9f),
            Recipe("phase-flare", "PHASE FLARE", new[] { SpectrumId.Cyan, SpectrumId.Crimson }, 7f, 1, 0f, 4, 0, 118f, true, 1.8f),
            Recipe("resonant-swarm", "RESONANT SWARM", new[] { SpectrumId.Violet, SpectrumId.Gold }, 5.5f, 5, .15f, 0, 3, 0f, false, 1.8f),
        };

        public static int Add(SpectrumStore store, SpectrumId spectrum, int amount, int capacity, out int overflow)
        {
            int safeAmount = Mathf.Max(0, amount);
            int added = Mathf.Min(Mathf.Max(0, capacity - store.Total), safeAmount);
            store.Set(spectrum, store.Get(spectrum) + added);
            overflow = safeAmount - added;
            return added;
        }

        public static PrismStability Stability(SpectrumStore store, int capacity)
        {
            float ratio = store.Total / Mathf.Max(1f, capacity);
            if (ratio >= 1f) return PrismStability.BreakReady;
            if (ratio >= .76f) return PrismStability.Unstable;
            if (ratio >= .5f) return PrismStability.Charged;
            return PrismStability.Stable;
        }

        public static float PerfectWindow(Difficulty difficulty, float loadRatio)
        {
            float window = difficulty == Difficulty.Cadet ? .22f : difficulty == Difficulty.Overdrive ? .11f : .16f;
            return window * (loadRatio >= .76f ? .82f : 1f);
        }

        public static RefractionRecipe Resolve(SpectrumStore store)
        {
            for (int i = 0; i < Combos.Length; i++)
            {
                if (CanPay(store, Combos[i])) return Combos[i];
            }

            SpectrumId dominant = SpectrumId.Cyan;
            int largest = 0;
            for (int i = 0; i < SpectrumOrder.Length; i++)
            {
                int count = store.Get(SpectrumOrder[i]);
                if (count > largest)
                {
                    largest = count;
                    dominant = SpectrumOrder[i];
                }
            }
            return largest == 0 ? null : Singles[dominant];
        }

        public static bool Consume(SpectrumStore store, RefractionRecipe recipe)
        {
            if (recipe == null || !CanPay(store, recipe)) return false;
            for (int i = 0; i < recipe.Spectra.Length; i++)
            {
                SpectrumId id = recipe.Spectra[i];
                store.Set(id, store.Get(id) - 1);
            }
            return true;
        }

        public static Color ColorFor(SpectrumId id)
        {
            switch (id)
            {
                case SpectrumId.Cyan: return new Color32(95, 246, 255, 255);
                case SpectrumId.Violet: return new Color32(191, 120, 255, 255);
                case SpectrumId.Gold: return new Color32(255, 216, 94, 255);
                default: return new Color32(255, 84, 125, 255);
            }
        }

        private static bool CanPay(SpectrumStore store, RefractionRecipe recipe)
        {
            for (int i = 0; i < recipe.Spectra.Length; i++)
            {
                if (store.Get(recipe.Spectra[i]) <= 0) return false;
            }
            return true;
        }

        private static RefractionRecipe Recipe(string id, string name, SpectrumId[] spectra, float damage,
            int projectiles, float spread, int pierce, int chain, float burstRadius, bool detonates, float score)
        {
            return new RefractionRecipe
            {
                Id = id,
                Name = name,
                Spectra = spectra,
                Damage = damage,
                Projectiles = projectiles,
                Spread = spread,
                Pierce = pierce,
                Chain = chain,
                BurstRadius = burstRadius,
                DetonatesBullets = detonates,
                ScoreMultiplier = score,
            };
        }
    }
}

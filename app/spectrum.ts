export const SPECTRUM_IDS = ["cyan", "violet", "gold", "crimson"] as const;

export type SpectrumId = (typeof SPECTRUM_IDS)[number];
export type SpectrumStore = Record<SpectrumId, number>;
export type PrismStability = "stable" | "charged" | "unstable" | "break-ready";
export type DifficultyId = "cadet" | "standard" | "overdrive";

export interface SpectrumInfo {
  name: string;
  color: string;
  glyph: string;
  behavior: string;
}

export interface RefractionRecipe {
  id: string;
  name: string;
  spectra: SpectrumId[];
  damage: number;
  projectiles: number;
  spread: number;
  pierce: number;
  chain: number;
  burstRadius: number;
  detonatesBullets: boolean;
  scoreMultiplier: number;
}

export const PRISM_ENGINE = {
  capacity: 12,
  chargedRatio: 0.5,
  unstableRatio: 0.76,
  prismBreakDuration: 7,
  perfectWindow: {
    cadet: 0.22,
    standard: 0.16,
    overdrive: 0.11,
  } satisfies Record<DifficultyId, number>,
  normalAbsorbEnergy: 1,
  perfectAbsorbEnergy: 2,
} as const;

export const SPECTRUM_INFO: Record<SpectrumId, SpectrumInfo> = {
  cyan: { name: "CYAN // PIERCE", color: "#5ff6ff", glyph: "\u27e1", behavior: "Cuts through targets and hostile formations." },
  violet: { name: "VIOLET // SPLIT", color: "#bf78ff", glyph: "\u22c7", behavior: "Divides into a wide refracted fan." },
  gold: { name: "GOLD // CHAIN", color: "#ffd85e", glyph: "\u27f2", behavior: "Jumps between nearby targets." },
  crimson: { name: "CRIMSON // BURST", color: "#ff547d", glyph: "\u25c8", behavior: "Detonates in a high-impact blast." },
};

const SINGLE_RECIPES: Record<SpectrumId, RefractionRecipe> = {
  cyan: recipe("cyan-pierce", "CYAN PIERCE", ["cyan"], 5.2, 1, 0, 4, 0, 0, true, 1.25),
  violet: recipe("violet-split", "VIOLET SPLIT", ["violet"], 3.5, 3, 0.17, 0, 0, 0, false, 1.25),
  gold: recipe("gold-chain", "GOLD CHAIN", ["gold"], 4.2, 1, 0, 0, 3, 0, false, 1.35),
  crimson: recipe("crimson-burst", "CRIMSON BURST", ["crimson"], 5.7, 1, 0, 0, 0, 92, false, 1.35),
};

const COMBO_RECIPES: RefractionRecipe[] = [
  recipe("full-spectrum", "FULL SPECTRUM", ["cyan", "violet", "gold", "crimson"], 10.5, 7, 0.105, 6, 5, 155, true, 3.2),
  recipe("tri-spectral", "TRI-SPECTRAL BREAK", ["cyan", "violet", "gold"], 8.1, 5, 0.12, 4, 3, 74, true, 2.4),
  recipe("tri-spectral", "TRI-SPECTRAL BREAK", ["cyan", "violet", "crimson"], 8.1, 5, 0.12, 4, 0, 112, true, 2.4),
  recipe("tri-spectral", "TRI-SPECTRAL BREAK", ["cyan", "gold", "crimson"], 8.1, 3, 0.13, 4, 4, 112, true, 2.4),
  recipe("tri-spectral", "TRI-SPECTRAL BREAK", ["violet", "gold", "crimson"], 8.1, 6, 0.13, 1, 4, 112, true, 2.4),
  recipe("prism-lance", "PRISM LANCE", ["cyan", "violet"], 7.6, 3, 0.08, 6, 0, 0, true, 1.85),
  recipe("solar-cascade", "SOLAR CASCADE", ["gold", "crimson"], 7.1, 1, 0, 0, 5, 128, true, 2),
  recipe("arc-beam", "ARC BEAM", ["cyan", "gold"], 6.8, 1, 0, 5, 4, 0, true, 1.9),
  recipe("void-bloom", "VOID BLOOM", ["violet", "crimson"], 6.2, 5, 0.16, 0, 0, 108, false, 1.9),
  recipe("phase-flare", "PHASE FLARE", ["cyan", "crimson"], 7, 1, 0, 4, 0, 118, true, 1.8),
  recipe("resonant-swarm", "RESONANT SWARM", ["violet", "gold"], 5.5, 5, 0.15, 0, 3, 0, false, 1.8),
];

function recipe(
  id: string,
  name: string,
  spectra: SpectrumId[],
  damage: number,
  projectiles: number,
  spread: number,
  pierce: number,
  chain: number,
  burstRadius: number,
  detonatesBullets: boolean,
  scoreMultiplier: number,
): RefractionRecipe {
  return { id, name, spectra, damage, projectiles, spread, pierce, chain, burstRadius, detonatesBullets, scoreMultiplier };
}

export function emptySpectrumStore(): SpectrumStore {
  return { cyan: 0, violet: 0, gold: 0, crimson: 0 };
}

export function spectrumTotal(store: SpectrumStore): number {
  return SPECTRUM_IDS.reduce((total, id) => total + Math.max(0, store[id] || 0), 0);
}

export function addSpectrum(
  store: SpectrumStore,
  spectrum: SpectrumId,
  amount: number,
  capacity: number = PRISM_ENGINE.capacity,
): { store: SpectrumStore; added: number; overflow: number } {
  const safeAmount = Math.max(0, Number.isFinite(amount) ? amount : 0);
  const room = Math.max(0, capacity - spectrumTotal(store));
  const added = Math.min(room, safeAmount);
  return {
    store: { ...store, [spectrum]: Math.max(0, store[spectrum] || 0) + added },
    added,
    overflow: Math.max(0, safeAmount - added),
  };
}

export function prismStability(store: SpectrumStore, capacity: number = PRISM_ENGINE.capacity): PrismStability {
  const ratio = spectrumTotal(store) / Math.max(1, capacity);
  if (ratio >= 1) return "break-ready";
  if (ratio >= PRISM_ENGINE.unstableRatio) return "unstable";
  if (ratio >= PRISM_ENGINE.chargedRatio) return "charged";
  return "stable";
}

export function perfectAbsorbWindow(difficulty: DifficultyId, loadRatio = 0): number {
  const instability = loadRatio >= PRISM_ENGINE.unstableRatio ? 0.82 : 1;
  return PRISM_ENGINE.perfectWindow[difficulty] * instability;
}

export function resolveRefraction(store: SpectrumStore): RefractionRecipe | null {
  const available = SPECTRUM_IDS.filter((id) => store[id] > 0);
  if (available.length === 0) return null;
  for (const combo of COMBO_RECIPES) {
    if (combo.spectra.every((id) => store[id] > 0)) return combo;
  }
  const dominant = [...available].sort((a, b) => store[b] - store[a] || SPECTRUM_IDS.indexOf(a) - SPECTRUM_IDS.indexOf(b))[0];
  return SINGLE_RECIPES[dominant];
}

export function consumeRefraction(store: SpectrumStore, refraction: RefractionRecipe): SpectrumStore {
  const next = { ...store };
  for (const spectrum of refraction.spectra) next[spectrum] = Math.max(0, next[spectrum] - 1);
  return next;
}

export function spectrumMatches(recipe: RefractionRecipe, spectrum: SpectrumId | null): boolean {
  return spectrum !== null && recipe.spectra.includes(spectrum);
}

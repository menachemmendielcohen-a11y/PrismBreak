import assert from "node:assert/strict";
import test from "node:test";
import {
  PRISM_ENGINE,
  addSpectrum,
  consumeRefraction,
  emptySpectrumStore,
  perfectAbsorbWindow,
  prismStability,
  resolveRefraction,
  spectrumTotal,
} from "../app/spectrum.ts";

test("spectrum storage is capped and never becomes negative", () => {
  let store = emptySpectrumStore();
  for (let index = 0; index < 20; index += 1) store = addSpectrum(store, "cyan", 1).store;
  assert.equal(spectrumTotal(store), PRISM_ENGINE.capacity);
  assert.equal(prismStability(store), "break-ready");
  const fired = resolveRefraction(store);
  assert.ok(fired);
  store = consumeRefraction(store, fired);
  assert.ok(Object.values(store).every((value) => value >= 0));
});

test("all four spectra resolve to FULL SPECTRUM", () => {
  const store = { cyan: 1, violet: 1, gold: 1, crimson: 1 };
  assert.equal(resolveRefraction(store)?.id, "full-spectrum");
});

test("pair recipes are deterministic and mechanically distinct", () => {
  assert.equal(resolveRefraction({ cyan: 1, violet: 1, gold: 0, crimson: 0 })?.id, "prism-lance");
  assert.equal(resolveRefraction({ cyan: 0, violet: 0, gold: 1, crimson: 1 })?.id, "solar-cascade");
  assert.equal(resolveRefraction({ cyan: 0, violet: 1, gold: 0, crimson: 1 })?.id, "void-bloom");
});

test("perfect timing is generous on Cadet and tighter while unstable", () => {
  assert.ok(perfectAbsorbWindow("cadet") > perfectAbsorbWindow("standard"));
  assert.ok(perfectAbsorbWindow("standard", 0.9) < perfectAbsorbWindow("standard", 0.2));
});

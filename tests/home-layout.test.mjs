import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

test("home menu uses bounded desktop grid instead of overflowing eight-track layout", () => {
  assert.match(css, /\.menu-screen\s*\{[\s\S]*overflow:\s*hidden;/);
  assert.match(css, /\.home-content\s+\.mode-card-grid\s*\{[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
  assert.doesNotMatch(css, /\.home-content\s*\.mode-card-grid\s*\{[\s\S]*grid-template-columns:\s*repeat\(8,\s*minmax\(0,\s*1fr\)\)/);
});

test("hebrew home menu keeps RTL text without flipping the grid engine off-screen", () => {
  assert.match(css, /\.prism-game\.is-hebrew\s+\.menu-screen\s*\{[\s\S]*direction:\s*ltr;/);
  assert.match(css, /\.prism-game\.is-hebrew\s+\.home-content\s+\.mode-card-grid\s*\{[\s\S]*direction:\s*ltr;/);
  assert.match(css, /\.prism-game\.is-hebrew\s+\.home-content\s+\.mode-card-grid\s*>\s*button\s*\{[\s\S]*direction:\s*rtl;/);
});

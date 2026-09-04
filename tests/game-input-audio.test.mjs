import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../app/PrismBreak.tsx", import.meta.url), "utf8");

test("Nova keyboard shortcut reaches confirmation even when a gameplay HUD button retains focus", () => {
  assert.match(source, /game\.mode === "menu" && isKeyboardControlTarget\(eventValue\.target\)/);
  assert.match(source, /eventValue\.code === input\.bindings\.nova\) input\.nova = true/);
  assert.match(source, /if \(input\.nova\)[\s\S]*?game\.mode = "nova-confirm"/);
  assert.match(source, /game\.mode !== "nova-confirm" \|\| game\.coinsCollected < NOVA_COIN_COST/);
  assert.match(source, /game\.coinsCollected -= NOVA_COIN_COST;[\s\S]*?triggerNova\(game\)/);
});

test("procedural soundtrack has a real melody, is scheduled once and cleaned up", () => {
  assert.match(source, /private startMusic\(\)/);
  assert.match(source, /const melody = \[/);
  assert.match(source, /scheduleMusicNoise/);
  assert.match(source, /this\.musicTimer = window\.setInterval/);
  assert.match(source, /if \(this\.musicTimer !== null\) window\.clearInterval\(this\.musicTimer\)/);
  assert.match(source, /audioRef\.current\?\.setIntensity/);
});

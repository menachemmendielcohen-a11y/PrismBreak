import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const game = readFileSync(new URL("../app/PrismBreak.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

test("world 2 campaign stages ease in instead of jumping to hard absorb goals", () => {
  assert.match(game, /function campaignScalingLevel\(stageId: number\)/);
  assert.match(game, /const stageScaling = threatScaling\(campaignScalingLevel\(stage\.id\), stage\.modifiers \?\? \[\]\)/);
  assert.match(game, /world\.id === 2 && stageInWorld <= 5\s*\?\s*stageInWorld === 3 \? "kills" : "survive"/);
  assert.match(game, /stageInWorld <= 5 \? 17 : stageInWorld <= 10 \? 20 : 22/);
  assert.doesNotMatch(game, /id % 4 === 0 \? "absorb"/);
  assert.match(game, /id: 4,[\s\S]*objective: "kills", target: 42/);
});

test("non-survival missions do not fail just because the old duration expires", () => {
  assert.match(game, /function hasFailureTimer\(config: RunConfig\)/);
  assert.match(game, /return config\.objective === "survive" \|\| config\.runMode === "daily" \|\| config\.runMode === "arcade";/);
  assert.match(game, /if \(hasFailureTimer\(game\.config\) && game\.elapsed >= game\.config\.duration && !game\.bossDefeated\)/);
  assert.match(game, /timeLeft: hasFailureTimer\(game\.config\) \? Math\.max\(0, game\.config\.duration - game\.elapsed\) : game\.elapsed/);
  assert.match(game, /ui\.timeLimited \? formatTime\(ui\.timeLeft\) : "∞"/);
});

test("campaign menu keeps the mission launch button inside the visible console", () => {
  assert.match(css, /Final campaign-menu guard/);
  assert.match(css, /\.mission-layout\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+minmax\(280px,\s*0\.36fr\)/);
  assert.match(css, /\.mission-brief\s*\{[\s\S]*display:\s*flex;[\s\S]*flex-direction:\s*column;/);
  assert.match(css, /\.mission-launch\s*\{[\s\S]*width:\s*min\(460px,\s*100%\);[\s\S]*margin-top:\s*16px;/);
});

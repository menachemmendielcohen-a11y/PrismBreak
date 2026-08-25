import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the PRISM BREAK campaign shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>PRISM BREAK — Absorb the Storm<\/title>/i);
  assert.match(html, /aria-label="PRISM BREAK game arena"/i);
  assert.match(html, /ENTER CAMPAIGN/);
  assert.match(html, /DAILY RIFT/);
  assert.match(html, /ARCADE RIFT/);
  assert.match(html, /GLOBAL COMPETITION/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape/i);
});

test("keeps progression and the D1 leaderboard wired into the production app", async () => {
  const [game, hosting, schema, scoresRoute, migration] = await Promise.all([
    readFile(new URL("../app/PrismBreak.tsx", import.meta.url), "utf8"),
    readFile(new URL("../.openai/hosting.json", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/scores/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../drizzle/0000_sour_blindfold.sql", import.meta.url), "utf8"),
  ]);

  assert.equal((game.match(/id:\s*[0-5],\s*code:/g) ?? []).length, 6);
  assert.match(game, /type RunMode = "campaign" \| "daily" \| "arcade"/);
  assert.match(game, /type Difficulty = "cadet" \| "standard" \| "overdrive"/);
  assert.match(game, /prism-break-profile-v2/);
  assert.match(game, /type DropKind = "repair" \| "overcharge" \| "rapid" \| "smashcell"/);
  assert.match(game, /const DEFAULT_BINDINGS/);
  assert.match(game, /function triggerSmash/);
  assert.match(game, /prism-break-bindings-v1/);
  assert.match(game, /fetch\("\/api\/scores"/);

  assert.equal(JSON.parse(hosting).d1, "DB");
  assert.match(schema, /sqliteTable\(\s*"scores"/);
  assert.match(schema, /scores_leaderboard_idx/);
  assert.match(scoresRoute, /\.prepare\(/);
  assert.match(scoresRoute, /PILOT-/);
  assert.match(migration, /CREATE TABLE `scores`/);
  assert.match(migration, /PRAGMA optimize;/);
});

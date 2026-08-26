import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const distPath = fileURLToPath(new URL("../firebase-dist/", import.meta.url));

async function listFiles(directory, prefix = "") {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const relativePath = path.posix.join(prefix, entry.name);
    if (entry.isDirectory()) files.push(...await listFiles(path.join(directory, entry.name), relativePath));
    else files.push(relativePath);
  }
  return files;
}

test("Firebase output is a self-contained static site", async () => {
  const indexPath = path.join(distPath, "index.html");
  assert.equal((await stat(indexPath)).isFile(), true);

  const index = await readFile(indexPath, "utf8");
  const assetReferences = [...index.matchAll(/(?:src|href)="\.\/([^"?#]+)"/g)].map((match) => match[1]);
  assert.ok(assetReferences.some((reference) => reference.endsWith(".js")));
  assert.ok(assetReferences.some((reference) => reference.endsWith(".css")));

  for (const reference of assetReferences) {
    assert.match(reference, /^assets\//);
    assert.equal((await stat(path.join(distPath, ...reference.split("/")))).isFile(), true);
  }

  const files = await listFiles(distPath);
  assert.deepEqual(files.filter((file) => file !== "index.html" && !file.startsWith("assets/")), []);
  assert.equal(files.some((file) => /(?:^|\/)(?:server|functions?)(?:\/|$)/i.test(file)), false);

  const builtText = (await Promise.all(files.map((file) => readFile(path.join(distPath, ...file.split("/")), "utf8")))).join("\n");
  assert.doesNotMatch(builtText, /Available only on CrazyGames|isCrazyGamesLaunchAllowed|document\.referrer/);
  assert.match(builtText, /ENTER CAMPAIGN/);
});

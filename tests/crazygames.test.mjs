import assert from "node:assert/strict";
import test from "node:test";
import {
  isCrazyGames,
  isCrazyGamesLaunchAllowed,
} from "../crazygames/src/sitelock.js";

function withHostname(hostname, callback) {
  const previousWindow = globalThis.window;
  globalThis.window = { location: { hostname } };
  try {
    return callback();
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
}

test("recognizes CrazyGames production and QA hostnames", () => {
  for (const hostname of [
    "www.crazygames.com",
    "prism-break.game-files.crazygames.com",
    "preview.game-files.crazygames.com",
    "www.crazygames.co.id",
  ]) {
    withHostname(hostname, () => assert.equal(isCrazyGames(), true, hostname));
  }

  for (const hostname of [
    "example.com",
    "crazygames.example.co.uk",
    "evil-crazygames.com",
  ]) {
    withHostname(hostname, () => assert.equal(isCrazyGames(), false, hostname));
  }
});

test("allows local development hosts in a production build", () => {
  withHostname("localhost", () => assert.equal(isCrazyGamesLaunchAllowed(), true));
  withHostname("127.0.0.1", () => assert.equal(isCrazyGamesLaunchAllowed(), true));
});

test("blocks unauthorized production hosts", () => {
  withHostname("example.com", () => assert.equal(isCrazyGamesLaunchAllowed(), false));
});

import assert from "node:assert/strict";
import test from "node:test";
import {
  isCrazyGamesHostname,
  isCrazyGamesLaunchAllowed,
} from "../crazygames/src/sitelock.js";

test("recognizes CrazyGames production and QA hostnames", () => {
  for (const hostname of [
    "www.crazygames.com",
    "prism-break.game-files.crazygames.com",
    "preview.game-files.crazygames.com",
    "www.crazygames.co.id",
    "WWW.CRAZYGAMES.COM.",
  ]) {
    assert.equal(isCrazyGamesHostname(hostname), true, hostname);
  }

  for (const hostname of [
    "example.com",
    "crazygames.example.co.uk",
    "evil-crazygames.com",
  ]) {
    assert.equal(isCrazyGamesHostname(hostname), false, hostname);
  }
});

test("allows local development hosts in a production build", () => {
  assert.equal(isCrazyGamesLaunchAllowed("localhost", true), true);
  assert.equal(isCrazyGamesLaunchAllowed("127.0.0.1", true), true);
  assert.equal(isCrazyGamesLaunchAllowed("[::1]", true), true);
});

test("blocks unauthorized production hosts without blocking dev builds", () => {
  assert.equal(isCrazyGamesLaunchAllowed("example.com", true), false);
  assert.equal(isCrazyGamesLaunchAllowed("example.com", false), true);
});

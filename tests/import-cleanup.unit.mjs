import { test } from "node:test";
import assert from "node:assert/strict";
import { importExclusion, normalizedTitle } from "../src/lib/import-cleanup.ts";

test("flags imported playtests and test servers without hiding their base games", () => {
  assert.equal(importExclusion("THE FINALS PLAYTEST"), "Playtest or demo");
  assert.equal(
    importExclusion("Tom Clancy’s Rainbow Six Siege - Test Server"),
    "Playtest or demo",
  );
  assert.equal(
    importExclusion("Battlefield™ 6 Open Beta"),
    "Playtest or demo",
  );
  assert.equal(importExclusion("THE FINALS"), null);
  assert.equal(importExclusion("Alpha Protocol"), null);
});
test("recognises known utilities without broad partial-title matches", () => {
  assert.equal(importExclusion("3DMark"), "Utility");
  assert.equal(importExclusion("Wallpaper Engine"), "Utility");
  assert.equal(importExclusion("Wallpaper Engine Adventure"), null);
});
test("same-title suggestions tolerate punctuation and trademarks but preserve editions", () => {
  assert.equal(
    normalizedTitle("Ghost of Yōtei™"),
    normalizedTitle("Ghost of Yotei"),
  );
  assert.equal(normalizedTitle("THE FINALS®"), normalizedTitle("The Finals"));
  assert.notEqual(normalizedTitle("Hades"), normalizedTitle("Hades II"));
  assert.notEqual(
    normalizedTitle("Skyrim"),
    normalizedTitle("Skyrim Special Edition"),
  );
});

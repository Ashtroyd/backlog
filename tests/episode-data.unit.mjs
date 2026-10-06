import assert from "node:assert/strict";
import { test } from "node:test";
import ts from "typescript";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/lib/episode-data.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { countAiredEpisodes } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);

test("counts dated releases, not future or unknown episodes", () => {
  const result = countAiredEpisodes([
    { airedAt: "2026-10-01T12:00:00Z" }, { airedAt: null }, { airedAt: "invalid" },
    { airedAt: "2026-10-10T12:00:00Z" }, { airedAt: "2026-10-03T12:00:00Z" },
  ], Date.parse("2026-10-06T12:00:00Z"));
  assert.deepEqual(result, { aired: 2, latestAirAt: "2026-10-03T12:00:00Z", nextAirAt: "2026-10-10T12:00:00Z" });
});
test("empty episode lists have no availability dates", () => {
  assert.deepEqual(countAiredEpisodes([]), { aired: 0, latestAirAt: null, nextAirAt: null });
});

import assert from "node:assert/strict";
import { test } from "node:test";
import ts from "typescript";
import { readFile } from "node:fs/promises";

async function compiled(path, replacements = []) {
  const source = await readFile(new URL(path, import.meta.url), "utf8");
  let code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  for (const [from, to] of replacements) code = code.replaceAll(from, to);
  return `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`;
}
const dates = await compiled("../src/lib/episode-data.ts");
const sources = await compiled("../src/lib/server/episode-sources.ts", [["../episode-data", dates]]);
const { fetchEpisodeAvailability } = await import(sources);
const route = await compiled("../src/app/api/episodes/route.ts", [["@/lib/server/episode-sources", sources]]);
const { GET } = await import(route);
const mapping = { data: [{ attributes: { externalSite: "myanimelist/anime", externalId: "52991" }, relationships: { item: { data: { type: "anime", id: "46474" } } } }] };
const episode = (number, airdate = "2020-01-01") => ({ id: String(number), attributes: { number, airdate } });
const response = (data, status = 200) => Response.json(data, { status });

test("a healthy primary source is used without calling Kitsu", async () => {
  const result = await fetchEpisodeAvailability("anime", "52991", async (url) => {
    assert.match(url, /api\.jikan\.moe/);
    return response({ data: [{ aired: "2020-01-01T12:00:00Z" }], pagination: { has_next_page: false } });
  });
  assert.equal(result.source, "jikan"); assert.equal(result.availability.aired, 1);
});

test("primary outage falls back to exact mapping and all paginated dated episodes", async () => {
  const offsets = [];
  const result = await fetchEpisodeAvailability("anime", "52991", async (url, options) => {
    assert.ok(options.signal instanceof AbortSignal);
    const parsed = new URL(url);
    if (parsed.hostname === "api.jikan.moe") throw new DOMException("timeout", "TimeoutError");
    if (parsed.pathname.endsWith("/mappings")) {
      assert.equal(parsed.searchParams.get("include"), "item");
      assert.equal(parsed.searchParams.get("filter[externalId]"), "52991"); return response(mapping);
    }
    assert.equal(parsed.pathname, "/api/edge/anime/46474/episodes");
    const offset = Number(parsed.searchParams.get("page[offset]")); offsets.push(offset);
    return response(offset === 0
      ? { data: Array.from({ length: 20 }, (_, i) => episode(i + 1)), meta: { count: 21 }, links: { next: "https://untrusted.invalid/not-followed" } }
      : { data: [episode(21, "2099-01-01")], meta: { count: 21 }, links: {} });
  });
  assert.deepEqual(offsets, [0, 20]); assert.equal(result.source, "kitsu");
  assert.equal(result.availability.aired, 20); assert.equal(result.availability.nextAirAt, "2099-01-01T23:59:59.999Z");
});

test("Kitsu-only titles bypass both Jikan and mapping lookup", async () => {
  const result = await fetchEpisodeAvailability("anime", "kitsu:46474", async (url) => {
    assert.match(url, /^https:\/\/kitsu\.io\/api\/edge\/anime\/46474\/episodes\?/);
    return response({ data: [episode(1)], meta: { count: 1 } });
  });
  assert.equal(result.availability.aired, 1); assert.equal(result.source, "kitsu");
});

for (const [name, rows, count] of [
  ["missing dates", [episode(1, null)], 1],
  ["invalid dates", [episode(1, "not-a-date")], 1],
  ["impossible calendar dates", [episode(1, "2020-02-31")], 1],
  ["episode gaps", [episode(1), episode(3)], 2],
  ["duplicate episode numbers", [episode(1), episode(1)], 2],
  ["incomplete pagination", [episode(1)], 2],
  ["empty data", [], 0],
]) {
  test(`fallback doesn't invent availability for ${name}`, async () => {
    const result = await fetchEpisodeAvailability("anime", "kitsu:46474", async () => response({ data: rows, meta: { count } }));
    assert.equal(result.availability, null);
  });
}

test("an ambiguous or absent mapping cannot match another anime", async () => {
  for (const data of [[], [...mapping.data, { ...mapping.data[0], relationships: { item: { data: { type: "anime", id: "123" } } } }]]) {
    const result = await fetchEpisodeAvailability("anime", "52991", async (url) => {
      if (url.includes("jikan")) return response({}, 503);
      assert.match(url, /\/mappings\?/); return response({ data });
    });
    assert.equal(result.availability, null);
  }
});

test("missing catalog size cannot establish a complete episode count", async () => {
  const result = await fetchEpisodeAvailability("anime", "kitsu:46474", async () => response({ data: [episode(1)] }));
  assert.equal(result.availability, null);
});

test("missing primary dates also trigger fallback", async () => {
  const result = await fetchEpisodeAvailability("anime", "52991", async (url) => {
    if (url.includes("jikan")) return response({ data: [{ aired: null }], pagination: { has_next_page: false } });
    if (url.includes("/mappings?")) return response(mapping);
    return response({ data: [episode(1)], meta: { count: 1 } });
  });
  assert.equal(result.source, "kitsu"); assert.equal(result.availability.aired, 1);
});

test("both providers failing remains an error, not zero aired episodes", async () => {
  await assert.rejects(fetchEpisodeAvailability("anime", "52991", async () => response({}, 429)));
});

test("TV availability still uses TVMaze", async () => {
  const result = await fetchEpisodeAvailability("series", "1", async (url) => {
    assert.equal(url, "https://api.tvmaze.com/shows/1/episodes");
    return response([{ airstamp: "2020-01-01T12:00:00Z" }]);
  });
  assert.equal(result.source, "tvmaze"); assert.equal(result.availability.aired, 1);
});

test("route rejects invalid IDs and Kitsu IDs for TV", async () => {
  for (const query of ["type=anime&id=kitsu:../../x", "type=series&id=kitsu:1", "type=anime&id=1/2", "type=movie&id=1"]) {
    assert.equal((await GET(new Request(`https://example.test/api/episodes?${query}`))).status, 400);
  }
});

test("route accepts Kitsu IDs and returns non-cacheable failures", async (t) => {
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; });
  globalThis.fetch = async () => response({ data: [episode(1)], meta: { count: 1 } });
  const success = await GET(new Request("https://example.test/api/episodes?type=anime&id=kitsu:46474"));
  assert.equal(success.status, 200); assert.equal((await success.json()).availability.aired, 1);
  globalThis.fetch = async () => response({}, 503);
  const failure = await GET(new Request("https://example.test/api/episodes?type=anime&id=52991"));
  assert.equal(failure.status, 502); assert.equal(failure.headers.get("cache-control"), "no-store");
});

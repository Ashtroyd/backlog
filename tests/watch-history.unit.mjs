import assert from 'node:assert/strict';
import { test } from 'node:test';
import ts from 'typescript';
import { readFile } from 'node:fs/promises';
async function load(path) {
  const source = await readFile(new URL(path, import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
}
const { nextWatchEpisodes, episodeLabel } = await load('../src/lib/watch-history.ts');
const { fetchEpisodeCatalogue } = await load('../src/lib/server/episode-catalogue.ts');
const catalogue = [
  { ordinal: 1, season: 1, number: 1, title: 'Pilot' },
  { ordinal: 2, season: 1, number: 2, title: 'Finale' },
  { ordinal: 3, season: 2, number: 1, title: 'Return' },
];
test('a batch crosses seasons without resetting absolute progress', () => {
  assert.deepEqual(nextWatchEpisodes(1, 2, catalogue, 3), catalogue.slice(1));
  assert.equal(episodeLabel(catalogue[2]), 'S2 E1');
});
test('missing metadata preserves anime/legacy numbering without inventing seasons', () => {
  assert.deepEqual(nextWatchEpisodes(500, 2, null, null), [
    { ordinal: 501, season: null, number: 501, title: null },
    { ordinal: 502, season: null, number: 502, title: null },
  ]);
});
test('rejects invalid counts and going past the known total', () => {
  for (const count of [0, -1, 1.5, NaN, Infinity, 101]) assert.throws(() => nextWatchEpisodes(1, count, null, null));
  assert.throws(() => nextWatchEpisodes(2, 2, catalogue, 3));
  assert.throws(() => nextWatchEpisodes(-1, 1, null, null));
});
test('catalogue sorts numbered episodes and excludes specials', async () => {
  const episodes = await fetchEpisodeCatalogue('1', async () => Response.json([
    { season: 2, number: 1, name: 'Return' }, { season: 1, number: null, name: 'Special' },
    { season: 1, number: 2, name: 'Finale' }, { season: 1, number: 1, name: 'Pilot' },
  ]));
  assert.deepEqual(episodes, catalogue);
});
test('provider errors and ambiguous episode lists remain failures, not empty success', async () => {
  await assert.rejects(() => fetchEpisodeCatalogue('1', async () => new Response('', { status: 503 })));
  await assert.rejects(() => fetchEpisodeCatalogue('1', async () => Response.json([
    { season: 1, number: 1 }, { season: 1, number: 1 },
  ])));
});

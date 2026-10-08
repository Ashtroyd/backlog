import test from 'node:test';
import assert from 'node:assert/strict';
import { findStarterPicks, rotateStarterPicks } from '../src/lib/start-picker.ts';
const preferences = { media: 'any', minutes: null, mood: 'any', includePaused: false };
const item = (id, patch = {}) => ({ id, title: id, media_type: 'game', status: 'backlog', genres: [], release_year: 2025, meta: {}, pinned_at: null, rating: null, is_favorite: false, ...patch });

test('only waiting released-year titles are eligible, with opt-in paused titles', () => {
  const rows = [item('new'), item('paused', {status:'on_hold'}), item('done',{status:'completed'}), item('playing',{status:'in_progress'}), item('dropped',{status:'dropped'}), item('future',{release_year:2028})];
  assert.deepEqual(findStarterPicks(rows,preferences,2026).map(p=>p.item.id),['new']);
  assert.deepEqual(findStarterPicks(rows,{...preferences,includePaused:true},2026).map(p=>p.item.id),['new','paused']);
});
test('short sessions leave out films and do not claim verified game playtime', () => {
  const rows = [item('film',{media_type:'movie'}),item('game')];
  const picks = findStarterPicks(rows,{...preferences,minutes:30});
  assert.equal(picks.length,1); assert.match(picks[0].timeNote,/session; total playtime varies/);
  assert.equal(findStarterPicks(rows,{...preferences,minutes:120}).length,2);
});
test('media and genre-based moods are respected without silently relaxing filters', () => {
  const rows=[item('puzzle',{genres:['Puzzle']}),item('thriller',{media_type:'series',genres:['Thriller']}),item('unknown')];
  assert.deepEqual(findStarterPicks(rows,{...preferences,mood:'easygoing'}).map(p=>p.item.id),['puzzle']);
  assert.equal(findStarterPicks(rows,{...preferences,mood:'mystery',media:'game'}).length,0);
});
test('pins and actual liked genres rank first with evidence-based reasons', () => {
  const rows=[item('neutral'),item('liked',{status:'completed',rating:4.5,genres:['Role-Playing']}),item('familiar',{genres:['Role Playing']}),item('pinned',{pinned_at:'2026-01-01'})];
  const picks=findStarterPicks(rows,preferences);
  assert.deepEqual(picks.map(p=>p.item.id),['pinned','familiar','neutral']);
  assert.match(picks[1].reasons.join(' '),/enjoyed other Role Playing/);
});
test('rotation offers unique alternatives, handles empty libraries and does not mutate input', () => {
  const rows=[item('a'),item('b'),item('c'),item('d')];
  const picks=findStarterPicks(rows,preferences);
  assert.deepEqual(rotateStarterPicks(picks,3).map(p=>p.item.id),['d','a','b']);
  assert.deepEqual(rows.map(p=>p.id),['a','b','c','d']);
  assert.deepEqual(rotateStarterPicks([],3),[]);
  assert.equal(findStarterPicks([item('a'),item('a')],preferences).length,1);
});

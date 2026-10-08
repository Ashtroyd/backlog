import test from 'node:test';
import assert from 'node:assert/strict';
import {buildMonthlyRecap} from '../src/lib/monthly-recap.ts';
import {validRecapMonth,recapBounds,recapLabel} from '../src/lib/recap-month.ts';
const item=(id,patch={})=>({id,title:id,media_type:'movie',cover_url:null,status:'completed',completed_at:'2026-09-15T00:00:00Z',rating:4,is_private:false,is_favorite:false,...patch});
test('completion timestamps use inclusive start and exclusive end in UTC',()=>{
 const result=buildMonthlyRecap([item('start',{completed_at:'2026-09-01T00:00:00Z'}),item('end',{completed_at:'2026-10-01T00:00:00Z'}),item('before',{completed_at:'2026-08-31T23:59:59Z'}),item('offset',{completed_at:'2026-09-01T00:30:00+01:00'}),item('last',{completed_at:'2026-09-30T23:59:59Z'})],'2026-09');
 assert.deepEqual(result.completed.map(i=>i.id),['last','start']);
});
test('unknown dates, unfinished titles and duplicates never inflate the recap',()=>{
 const rows=[item('valid'),item('valid'),item('missing',{completed_at:null}),item('invalid',{completed_at:'not a date'}),item('playing',{status:'in_progress'})];
 assert.equal(buildMonthlyRecap(rows,'2026-09').completed.length,1);
 assert.equal(rows.length,5);
});
test('downloadable totals, averages and highlights exclude private titles',()=>{
 const rows=[item('public',{rating:0}),item('secret',{is_private:true,is_favorite:true,rating:5})];
 const page=buildMonthlyRecap(rows,'2026-09'),card=buildMonthlyRecap(rows,'2026-09',true);
 assert.equal(page.completed.length,2);assert.equal(card.completed.length,1);assert.equal(card.average,0);
 assert.deepEqual(card.highlights.map(i=>i.id),['public']);
});
test('empty months have no pretend average or highlights',()=>{
 const result=buildMonthlyRecap([],'2026-09');assert.equal(result.average,null);assert.deepEqual(result.highlights,[]);
});
test('month input rejects invalid and future months and handles leap/year boundaries',()=>{
 const now=new Date('2026-10-08T00:00:00Z');
 for(const value of ['2026-13','2026-00','2026-11','junk','0000-01'])assert.equal(validRecapMonth(value,now),'2026-10');
 assert.deepEqual(recapBounds('2024-02'),{start:'2024-02-01T00:00:00.000Z',end:'2024-03-01T00:00:00.000Z'});
 assert.equal(recapBounds('2026-12').end,'2027-01-01T00:00:00.000Z');assert.equal(recapLabel('2026-09'),'September 2026');
});

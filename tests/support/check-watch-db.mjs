// Install @electric-sql/pglite in a temporary directory, then point
// PGLITE_TEST_MODULE to its dist/index.js to run without a live database.
import { readFile } from 'node:fs/promises';
const { PGlite } = await import(process.env.PGLITE_TEST_MODULE ?? '@electric-sql/pglite');
const db = new PGlite();
try {
  await db.exec(`
    create role authenticated; create role anon;
    create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to authenticated, anon;
    grant execute on function auth.uid() to authenticated, anon;
  `);
  for (const name of ['0001_items.sql', '0003_started_at.sql']) {
    await db.exec(await readFile(new URL(`../../supabase/migrations/${name}`, import.meta.url), 'utf8'));
  }
  await db.exec(`alter type public.item_status add value 'on_hold';
    alter table public.items add column progress integer check(progress >= 0);
    grant select,insert,update,delete on public.items to authenticated;`);
  await db.exec(await readFile(new URL('../../supabase/migrations/20261021090539_episode_watches.sql', import.meta.url), 'utf8'));
  await db.exec(await readFile(new URL('../episode-watches.sql', import.meta.url), 'utf8'));
  console.log('Watch-history SQL integration checks passed (logging, retry, stale writes, undo, RLS).');
} finally { await db.close(); }

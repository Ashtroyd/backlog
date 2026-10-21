# Backlog

**Live at [backlog-liart.vercel.app](https://backlog-liart.vercel.app)** —
pushes to `main` deploy automatically.

A clean, Claude-styled tracker for everything you want to play and watch —
**Games, Movies, Series and Anime**, each with its own section. Search a title
and it lands in your backlog with cover art, year, genres and details filled in
automatically. Move it through *Backlog → Playing/Watching → On hold / Completed* (or
*Dropped*), and once it's done, rate it out of five stars and write a review.

Built with **Next.js 16, Tailwind CSS 4, Motion**, and **Supabase** (Postgres,
Auth) for cross-device sync. Deploys to Vercel.

## Features

- **Four sections** — Games, Movies, Series, Anime — each with its own
  library, search, and status pipeline (Backlog → Playing/Watching →
  On hold/Completed/Dropped).
- **Search & autofill** — free, keyless sources (below) fill in cover art,
  year, genre, platform, and score automatically.
- **Reviews** — a five-star rating plus a written review once something's
  Completed, shareable as a card.
- **Friends** — add friends and see what they're playing/watching/completed.
- **Shared Backlog** — a jointly-tracked list for titles you and a friend are
  working through together.
- **Messages** — direct messages between friends.
- **Notifications** — a bell for friend requests and shared-backlog activity.
- **Top Picks** — a monthly, manually-curated highlight reel per section.
- **Monthly recap** — recorded completions, current favourites and scores,
  with a downloadable PNG card that excludes private titles and notes.
  Find it on Up Next or in Account. Months use UTC completion dates, not
  inferred playtime; editing the library may change a recap.
- **Trending** — what's currently popular per section, from the same free
  sources used for search.
- **Command palette** — `Cmd`/`Ctrl`+`K` to jump anywhere or add a title fast.
- **Import/export** — back up your whole library to JSON, or restore one.
- **Help me choose** — get explained picks from your own backlog on Up Next, filtered by media type, mood and session length. Pinned titles and genres you have enjoyed come first; paused titles are optional. Time guidance is not a verified runtime.
- **Installable PWA** — add it to your home screen on desktop or mobile.

## Setup

```bash
npm install
npm run dev
```

Your library lives in Supabase (email/password account) and syncs across
devices. `.env.local` needs the project's URL and anon key:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ…
```

On a fresh Supabase project, run
[`supabase/migrations/0001_items.sql`](supabase/migrations/0001_items.sql) once
in the SQL Editor to create the table.

Search needs no keys at all — it's powered by free, keyless sources, proxied
through the app's own `/api/search`:

- **Games** — Steam store search combined with IMDb's video-game catalogue, so
  PC indies *and* console exclusives (Ghost of Yōtei, Zelda) both turn up.
  Titles sold on Steam keep their Steam appid and gain genres, platforms and a
  Metacritic score when added.
- **Movies** — IMDb's search suggestions (posters, year, top cast)
- **Series** — [TVMaze](https://www.tvmaze.com)
- **Anime** — MyAnimeList via [Jikan](https://jikan.moe)

The archive menu in the top-right can still **export a JSON backup** of your
library or **import** one. Anything saved during the app's earlier
localStorage era is uploaded to your account automatically on first login.

## Deploying to Vercel

Push the repo to GitHub and import it in Vercel, setting
`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` as environment
variables. Log in on any device and your library is there.

## Scripts

```bash
npm run dev     # dev server on :3000
npm run build   # production build
npm run lint    # eslint
```

## Library improvements

- **On hold** pauses a game or show without clearing progress; paused titles leave Continue. MyAnimeList imports preserve this status.
- **Continue** shows episodes or hours played, with a quick +1 episode button. The editor also accepts typed episode counts.
- **Library organisation** includes grid/list views, bulk status changes, live-service and cleanup filters. Search, filters, sort and view are stored in the URL.
- **Import preview** can skip playtests, known utilities and possible same-title duplicates. Steam imports default to Backlog and preserve playtime; choose Playing explicitly when appropriate.
- **Editing** preserves drafts after failed saves, warns before discarding changes, and groups secondary actions under More actions. Recent reviews have room for an excerpt.

Before deploying these changes, apply `supabase/migrations/20260910084835_add_on_hold_status.sql` to the target database. It only adds the new enum value and does not modify existing library entries.

### Isolated verification

`node --experimental-strip-types --test tests/import-cleanup.unit.mjs` checks import classification and duplicate title matching (Node 22+).

For browser checks without touching live accounts, follow the commands in `tests/support/review-server.mjs`. The fixture backend supports a one-shot simulated save failure at `POST /__review/fail-next` and recorded writes at `GET /__review/state` on port 3101. This is a local test server, not an alternative production backend.

### Episode tracking and Watched tonight

Up Next now has **Watched tonight**: choose a series or anime, enter how many
new episodes you watched, and choose the watch date. Series show TVMaze season
and episode numbers (regular episodes, excluding specials). Anime and titles
without season metadata keep their overall episode numbering. Batches can cross
season boundaries. Rewatches get their own dated logs without advancing your
place, and Undo removes the most recent log while restoring its previous count.

The title editor includes the same logger and a private watch history. Existing
progress remains undated; editing **Total watched** corrects your place without
inventing or deleting watch dates. Continue's **+1** also records a dated watch.
Logging new episodes starts or resumes watching without automatically marking
an ongoing show completed. History remains private even for a shared title.
Library JSON backups currently cover library items, **not dated watch logs**;
replacing the library from a backup also removes its associated watch logs.

Before deploying, apply
`supabase/migrations/20261021090539_episode_watches.sql`. It adds an owner-only
history table and two invoker functions for atomic logging and undo; it does not
rewrite existing progress. No additional API keys are needed.

Verification:

```bash
node --test tests/watch-history.unit.mjs tests/episode-data.unit.mjs tests/episode-sources.unit.mjs
npx playwright test -c tests/support/watch-history.config.ts
```

The dedicated browser configuration starts isolated fixture servers with synthetic
accounts; it does not connect to live accounts. The SQL checks in
`tests/episode-watches.sql` verify atomic writes, retry handling, stale progress,
rewatches, undo, and owner isolation. To run them without a live database, install
`@electric-sql/pglite` in a temporary directory, set `PGLITE_TEST_MODULE` to its
`dist/index.js`, and run `node tests/support/check-watch-db.mjs`.

# Backlog

**Live at [backlog-liart.vercel.app](https://backlog-liart.vercel.app)** —
pushes to `main` deploy automatically.

A clean, Claude-styled tracker for everything you want to play and watch —
**Games, Movies, Series and Anime**, each with its own section. Search a title
and it lands in your backlog with cover art, year, genres and details filled in
automatically. Move it through *Backlog → Playing/Watching → Completed* (or
*Dropped*), and once it's done, rate it out of five stars and write a review.

Built with **Next.js 16, Tailwind CSS 4, Motion**, and **Supabase** (Postgres,
Auth) for cross-device sync. Deploys to Vercel.

## Features

- **Four sections** — Games, Movies, Series, Anime — each with its own
  library, search, and status pipeline (Backlog → Playing/Watching →
  Completed/Dropped).
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
- **Trending** — what's currently popular per section, from the same free
  sources used for search.
- **Command palette** — `Cmd`/`Ctrl`+`K` to jump anywhere or add a title fast.
- **Import/export** — back up your whole library to JSON, or restore one.
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

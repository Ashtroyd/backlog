# Backlog

A clean, Claude-styled tracker for everything you want to play and watch —
**Games, Movies, Series and Anime**, each with its own section. Search a title
and it lands in your backlog with cover art, year, genres and details filled in
automatically. Move it through *Backlog → Playing/Watching → Completed* (or
*Dropped*), and once it's done, rate it out of five stars and write a review.

Built with Next.js 16, Tailwind CSS 4 and Motion.

## Zero setup

```bash
npm install
npm run dev
```

That's the whole setup — no accounts, no API keys. Search is powered by free,
keyless sources, proxied through the app's own `/api/search`:

- **Games** — Steam store search (covers, genres, release year, Metacritic).
  Steam catalogue only, so console exclusives won't appear.
- **Movies** — IMDb's search suggestions (posters, year, top cast)
- **Series** — [TVMaze](https://www.tvmaze.com)
- **Anime** — MyAnimeList via [Jikan](https://jikan.moe)

Your library is stored in your browser (localStorage) — works offline once
loaded. Use the archive menu in the top-right to **export a JSON backup** or
**import** one on another machine.

## Deploying to Vercel

Push the repo to GitHub and import it in Vercel — no environment variables
needed. Your library lives in each browser's localStorage, so the deployed site
starts empty on every new device; use export/import to carry your data over.

## Scripts

```bash
npm run dev     # dev server on :3000
npm run build   # production build
npm run lint    # eslint
```

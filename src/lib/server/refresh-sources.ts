import type { SearchResult } from "@/lib/types";

/**
 * Server-side detail lookups against the keyless sources, used to enrich a
 * game on add and to refresh any stored item's details later.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Steam appdetails: genres, platforms, Metacritic, portrait cover, year. */
export async function fetchSteamDetail(id: string): Promise<SearchResult | null> {
  const res = await fetch(
    `https://store.steampowered.com/api/appdetails?appids=${id}&cc=GB&l=english`,
    { cache: "no-store" },
  );
  if (!res.ok) return null;
  const payload = await res.json();
  const app = payload?.[id];
  if (!app?.success || !app.data) return null;
  const d = app.data;

  // Prefer the portrait library cover; fall back to the landscape header.
  const portrait = `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${id}/library_600x900.jpg`;
  let coverUrl: string | null = d.header_image ?? null;
  try {
    const head = await fetch(portrait, { method: "HEAD", cache: "no-store" });
    if (head.ok) coverUrl = portrait;
  } catch {
    // keep header image
  }

  const releaseDate: string = d.release_date?.date ?? "";
  const yearMatch = releaseDate.match(/\b(19|20)\d{2}\b/);
  const platforms: string[] = [];
  if (d.platforms?.windows) platforms.push("Windows");
  if (d.platforms?.mac) platforms.push("Mac");
  if (d.platforms?.linux) platforms.push("Linux");

  return {
    externalId: id,
    title: d.name,
    coverUrl,
    year: yearMatch ? Number(yearMatch[0]) : null,
    genres: (d.genres ?? []).slice(0, 3).map((g: any) => g.description),
    meta: { platforms, metacritic: d.metacritic?.score ?? null },
  };
}

/** IMDb suggestion lookup by title, matched back to a known tt id. */
export async function fetchImdbDetail(
  ttId: string,
  title: string,
  kind: "movie" | "game",
): Promise<SearchResult | null> {
  const lowered = title.toLowerCase();
  if (!lowered) return null;
  const res = await fetch(
    `https://v3.sg.media-imdb.com/suggestion/${encodeURIComponent(lowered[0])}/${encodeURIComponent(lowered)}.json`,
    { cache: "no-store" },
  );
  if (!res.ok) return null;
  const data = await res.json();
  const m = (data.d ?? []).find((r: any) => r.id === ttId);
  if (!m) return null;

  const s: string = m.s ?? "";
  return {
    externalId: m.id,
    title: m.l,
    coverUrl: m.i?.imageUrl
      ? m.i.imageUrl.replace("._V1_.jpg", "._V1_UX400_.jpg")
      : null,
    year: m.y ?? null,
    // For video games IMDb's `s` field is genres; for films it's the cast.
    genres:
      kind === "game" && s
        ? s.split(",").map((g) => g.trim()).filter(Boolean).slice(0, 3)
        : [],
    meta: kind === "movie" ? { stars: s || null } : {},
  };
}

/** TVMaze direct show lookup. */
export async function fetchTvmazeDetail(id: string): Promise<SearchResult | null> {
  const res = await fetch(`https://api.tvmaze.com/shows/${id}`, {
    cache: "no-store",
  });
  if (!res.ok) return null;
  const show = await res.json();
  return {
    externalId: String(show.id),
    title: show.name,
    coverUrl: show.image?.original ?? show.image?.medium ?? null,
    year: show.premiered ? Number(show.premiered.slice(0, 4)) : null,
    genres: (show.genres ?? []).slice(0, 3),
    meta: {
      tvmazeRating: show.rating?.average ?? null,
      network: show.network?.name ?? show.webChannel?.name ?? null,
    },
  };
}

/** Jikan (MyAnimeList) direct anime lookup. */
export async function fetchJikanDetail(id: string): Promise<SearchResult | null> {
  const res = await fetch(`https://api.jikan.moe/v4/anime/${id}`, {
    cache: "no-store",
  });
  if (!res.ok) return null;
  const { data: a } = await res.json();
  if (!a) return null;
  return {
    externalId: String(a.mal_id),
    title: a.title_english || a.title,
    coverUrl: a.images?.jpg?.large_image_url ?? a.images?.jpg?.image_url ?? null,
    year: a.year ?? (a.aired?.from ? Number(a.aired.from.slice(0, 4)) : null),
    genres: (a.genres ?? []).slice(0, 3).map((g: any) => g.name),
    meta: {
      episodes: a.episodes ?? null,
      malScore: a.score ?? null,
      studios: (a.studios ?? []).map((s: any) => s.name),
    },
  };
}

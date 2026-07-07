import { NextResponse, type NextRequest } from "next/server";
import type { SearchResult } from "@/lib/types";

/**
 * GET /api/search?type=game|movie|series|anime&q=…
 *
 * Server-side proxy over free, keyless sources:
 *   games  → Steam store search (year/genres enriched on add via /api/detail)
 *   movies → IMDb suggestion API (the endpoint behind imdb.com's search box)
 *   series → TVMaze
 *   anime  → Jikan (MyAnimeList)
 */

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  const type = request.nextUrl.searchParams.get("type") ?? "";
  if (!q) return NextResponse.json({ results: [] });

  try {
    let results: SearchResult[];
    switch (type) {
      case "game":
        results = await searchGames(q);
        break;
      case "movie":
        results = await searchMovies(q);
        break;
      case "series":
        results = await searchSeries(q);
        break;
      case "anime":
        results = await searchAnime(q);
        break;
      default:
        return NextResponse.json({ error: "bad_type" }, { status: 400 });
    }
    return NextResponse.json({ results: dedupe(results) });
  } catch (err) {
    console.error("search failed", err);
    return NextResponse.json(
      { error: "search_failed", message: "Search failed — try again." },
      { status: 502 },
    );
  }
}

/** Some sources (notably Jikan) can return the same title twice. */
function dedupe(results: SearchResult[]): SearchResult[] {
  const seen = new Set<string>();
  return results.filter((r) =>
    seen.has(r.externalId) ? false : (seen.add(r.externalId), true),
  );
}

/* eslint-disable @typescript-eslint/no-explicit-any */

async function searchGames(q: string): Promise<SearchResult[]> {
  const url = `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(q)}&l=english&cc=GB`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Steam ${res.status}`);
  const data = await res.json();

  return (data.items ?? [])
    .filter((g: any) => g.type === "app")
    .slice(0, 10)
    .map((g: any): SearchResult => ({
      externalId: String(g.id),
      // Search only returns the tiny landscape capsule; /api/detail swaps in
      // the portrait cover, year and genres when the game is added.
      title: g.name,
      coverUrl: g.tiny_image ?? null,
      year: null,
      genres: [],
      meta: {
        metacritic: g.metascore ? Number(g.metascore) : null,
      },
    }));
}

async function searchMovies(q: string): Promise<SearchResult[]> {
  const lowered = q.toLowerCase();
  const url = `https://v3.sg.media-imdb.com/suggestion/${encodeURIComponent(lowered[0])}/${encodeURIComponent(lowered)}.json`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`IMDb ${res.status}`);
  const data = await res.json();

  return (data.d ?? [])
    .filter(
      (m: any) =>
        typeof m.id === "string" &&
        m.id.startsWith("tt") &&
        (m.q === "feature" || m.q === "TV movie"),
    )
    .slice(0, 10)
    .map((m: any): SearchResult => ({
      externalId: m.id,
      title: m.l,
      // Ask Amazon's CDN for a 400px-wide poster instead of the original.
      coverUrl: m.i?.imageUrl
        ? m.i.imageUrl.replace("._V1_.jpg", "._V1_UX400_.jpg")
        : null,
      year: m.y ?? null,
      genres: [],
      meta: {
        stars: m.s ?? null,
      },
    }));
}

async function searchSeries(q: string): Promise<SearchResult[]> {
  const url = `https://api.tvmaze.com/search/shows?q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`TVMaze ${res.status}`);
  const data = await res.json();

  return (data ?? []).slice(0, 10).map(({ show }: any): SearchResult => ({
    externalId: String(show.id),
    title: show.name,
    coverUrl: show.image?.original ?? show.image?.medium ?? null,
    year: show.premiered ? Number(show.premiered.slice(0, 4)) : null,
    genres: (show.genres ?? []).slice(0, 3),
    meta: {
      tvmazeRating: show.rating?.average ?? null,
      network: show.network?.name ?? show.webChannel?.name ?? null,
    },
  }));
}

async function searchAnime(q: string): Promise<SearchResult[]> {
  const url = `https://api.jikan.moe/v4/anime?q=${encodeURIComponent(q)}&limit=10&sfw=true`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Jikan ${res.status}`);
  const data = await res.json();

  return (data.data ?? []).map((a: any): SearchResult => ({
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
  }));
}

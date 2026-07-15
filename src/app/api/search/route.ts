import { NextResponse, type NextRequest } from "next/server";
import type { SearchResult } from "@/lib/types";

/**
 * GET /api/search?type=game|movie|series|anime&q=…
 *
 * Server-side proxy over free, keyless sources:
 *   games  → Steam store search ∪ IMDb video games (Steam data enriched on add
 *            via /api/detail); covers PC indies and console exclusives alike
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

/* ---------- games: Steam ∪ IMDb ----------
 * Steam is exhaustive for PC but has no console exclusives; IMDb covers every
 * platform but misses some tiny indies. We search both and merge on title.
 * A game that exists on Steam keeps its Steam appid as the external id (so
 * previously-added entries still match); console-only titles use the IMDb id.
 */

const EDITION_SUFFIX =
  /\s+(directors? cut|definitive|remastered|remaster|goty|game of the year|complete|deluxe|enhanced|ultimate|anniversary)( edition)?$/;

const STEAM_NOISE = /(soundtrack|original score|artbook|art book|\bdlc\b|\bost\b|demo|season pass)/i;

/** Lowercase, strip accents and punctuation, collapse spaces. */
function normTitle(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip accents (Yotei)
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Same, with a trailing edition suffix removed, for cross-source matching. */
function baseTitle(s: string): string {
  return normTitle(s).replace(EDITION_SUFFIX, "").trim();
}

const steamPortrait = (appid: string | number) =>
  `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${appid}/library_600x900.jpg`;

async function steamGames(q: string) {
  try {
    const res = await fetch(
      `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(q)}&l=english&cc=GB`,
      { cache: "no-store" },
    );
    if (!res.ok) return [];
    const data = await res.json();
    return ((data.items ?? []) as any[]).filter(
      (g) => g.type === "app" && !STEAM_NOISE.test(g.name ?? ""),
    );
  } catch {
    return [];
  }
}

async function imdbGames(q: string) {
  try {
    const lowered = q.toLowerCase();
    const res = await fetch(
      `https://v3.sg.media-imdb.com/suggestion/${encodeURIComponent(lowered[0])}/${encodeURIComponent(lowered)}.json`,
      { cache: "no-store" },
    );
    if (!res.ok) return [];
    const data = await res.json();
    return ((data.d ?? []) as any[]).filter(
      (m) => typeof m.id === "string" && m.id.startsWith("tt") && m.q === "video game",
    );
  } catch {
    return [];
  }
}

async function searchGames(q: string): Promise<SearchResult[]> {
  const [steam, imdb] = await Promise.all([steamGames(q), imdbGames(q)]);

  // Index Steam by base title so IMDb entries can claim their Steam twin.
  const steamByTitle = new Map<string, any>();
  for (const g of steam) {
    const key = baseTitle(g.name);
    if (!steamByTitle.has(key)) steamByTitle.set(key, g);
  }

  const results: SearchResult[] = [];
  const claimed = new Set<any>();

  for (const m of imdb) {
    const twin = steamByTitle.get(baseTitle(m.l));
    if (twin) claimed.add(twin);
    // For video games IMDb's `s` field carries genres (for films it's the cast).
    const genres: string[] = m.s
      ? String(m.s)
          .split(",")
          .map((g: string) => g.trim())
          .filter(Boolean)
          .slice(0, 3)
      : [];
    results.push({
      // Steam id wins when the game is on Steam, so ids stay stable.
      externalId: twin ? String(twin.id) : m.id,
      title: m.l,
      coverUrl: twin
        ? steamPortrait(twin.id)
        : m.i?.imageUrl
          ? m.i.imageUrl.replace("._V1_.jpg", "._V1_UX400_.jpg")
          : null,
      year: m.y ?? null,
      genres,
      meta: {
        metacritic: twin?.metascore ? Number(twin.metascore) : null,
      },
    });
  }

  // Steam-only titles (indies IMDb doesn't list).
  for (const g of steam) {
    if (claimed.has(g)) continue;
    results.push({
      externalId: String(g.id),
      title: g.name,
      coverUrl: steamPortrait(g.id),
      year: null,
      genres: [],
      meta: { metacritic: g.metascore ? Number(g.metascore) : null },
    });
  }

  // Rank by how closely the title matches what was typed.
  const nq = normTitle(q);
  const score = (t: string) => {
    const n = normTitle(t);
    if (n === nq) return 0;
    if (n.startsWith(nq)) return 1;
    if (n.includes(nq)) return 2;
    return 3;
  };
  return results
    .map((r, i) => ({ r, i, s: score(r.title) }))
    .sort((a, b) => a.s - b.s || a.i - b.i)
    .slice(0, 12)
    .map((x) => x.r);
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

/**
 * Jikan proxies MyAnimeList and goes down whenever MAL blocks it, so anime
 * search falls back to Kitsu. Kitsu's `mappings` include carries MAL ids, so
 * items keep the same external id from either source (friend matching stays
 * intact); the rare title without a MAL mapping gets a `kitsu:` id instead.
 */
async function searchAnime(q: string): Promise<SearchResult[]> {
  try {
    const jikan = await searchAnimeJikan(q);
    if (jikan.length > 0) return jikan;
  } catch {
    // fall through to Kitsu
  }
  return searchAnimeKitsu(q);
}

async function searchAnimeKitsu(q: string): Promise<SearchResult[]> {
  const url = `https://kitsu.io/api/edge/anime?filter%5Btext%5D=${encodeURIComponent(q)}&page%5Blimit%5D=10&include=mappings`;
  const res = await fetch(url, {
    cache: "no-store",
    headers: { Accept: "application/vnd.api+json" },
  });
  if (!res.ok) throw new Error(`Kitsu ${res.status}`);
  const data = await res.json();

  // mapping id -> MAL id, for stitching Kitsu results onto MAL identities.
  const malByMapping = new Map<string, string>();
  for (const inc of data.included ?? []) {
    if (
      inc.type === "mappings" &&
      inc.attributes?.externalSite === "myanimelist/anime"
    ) {
      malByMapping.set(String(inc.id), String(inc.attributes.externalId));
    }
  }

  return ((data.data ?? []) as any[]).map((a): SearchResult => {
    const at = a.attributes ?? {};
    const mappingRefs: { id: string }[] = a.relationships?.mappings?.data ?? [];
    const malId = mappingRefs
      .map((r) => malByMapping.get(String(r.id)))
      .find(Boolean);
    return {
      externalId: malId ?? `kitsu:${a.id}`,
      title: at.titles?.en || at.canonicalTitle || "Untitled",
      coverUrl:
        at.posterImage?.large ??
        at.posterImage?.medium ??
        at.posterImage?.original ??
        null,
      year: at.startDate ? Number(at.startDate.slice(0, 4)) : null,
      genres: [],
      meta: { episodes: at.episodeCount ?? null },
    };
  });
}

async function searchAnimeJikan(q: string): Promise<SearchResult[]> {
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

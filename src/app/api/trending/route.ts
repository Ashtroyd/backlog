import { NextResponse, type NextRequest } from "next/server";
import type { SearchResult } from "@/lib/types";

/**
 * GET /api/trending?type=game|movie|series|anime
 *
 * "What's popular right now", one feed per media type:
 *   games  → Steam's public top-sellers chart (keyless)
 *   anime  → Jikan's currently-airing season (keyless)
 *   movies/series → TMDB's daily trending chart, used only to pick titles —
 *     each is then resolved back to an IMDb/TVMaze id via the same lookups
 *     `/api/search` uses, so a trending add can't create a second, differently
 *     -id'd entry for a title the user already owns. Needs a free TMDB_API_KEY.
 */

const REVALIDATE = 1800; // 30 min — trending charts don't move fast enough to justify more

export async function GET(request: NextRequest) {
  const type = request.nextUrl.searchParams.get("type") ?? "";
  try {
    switch (type) {
      case "game":
        return NextResponse.json({ results: await trendingGames() });
      case "anime":
        return NextResponse.json({ results: await trendingAnime() });
      case "movie":
        return trendingTmdb("movie");
      case "series":
        return trendingTmdb("tv");
      default:
        return NextResponse.json({ error: "bad_type" }, { status: 400 });
    }
  } catch (err) {
    console.error("trending failed", err);
    return NextResponse.json(
      { error: "trending_failed", message: "Couldn't load trending titles — try again." },
      { status: 502 },
    );
  }
}

/* ---------- games: Steam top sellers ---------- */

interface SteamFeaturedItem {
  id: number;
  name: string;
}

const steamPortrait = (appid: string) =>
  `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${appid}/library_600x900.jpg`;

// Valve's own hardware rides in the same top-sellers/specials feed as actual
// games, with no field to tell them apart — the storefront just has a
// handful of these, so a name denylist is the pragmatic fix.
const STEAM_HARDWARE = new Set(["Steam Machine", "Steam Controller", "Steam Deck", "Steam Link"]);

async function trendingGames(): Promise<SearchResult[]> {
  const res = await fetch("https://store.steampowered.com/api/featuredcategories?cc=us&l=en", {
    next: { revalidate: REVALIDATE },
  });
  if (!res.ok) throw new Error(`Steam ${res.status}`);
  const data = (await res.json()) as {
    top_sellers?: { items?: SteamFeaturedItem[] };
    specials?: { items?: SteamFeaturedItem[] };
  };

  const merged = [...(data.top_sellers?.items ?? []), ...(data.specials?.items ?? [])];
  const seen = new Set<number>();
  const results: SearchResult[] = [];
  for (const g of merged) {
    if (seen.has(g.id) || STEAM_HARDWARE.has(g.name)) continue;
    seen.add(g.id);
    results.push({
      externalId: String(g.id),
      title: g.name,
      coverUrl: steamPortrait(String(g.id)),
      year: null,
      genres: [],
      meta: {},
    });
  }
  return results.slice(0, 15);
}

/* ---------- anime: Kitsu's trending chart, falling back to Jikan's airing season ---------- */

interface KitsuAnime {
  id: string;
  attributes?: {
    titles?: { en?: string };
    canonicalTitle?: string;
    posterImage?: { large?: string; medium?: string; original?: string };
    startDate?: string;
    episodeCount?: number | null;
  };
}

async function trendingAnime(): Promise<SearchResult[]> {
  try {
    const kitsu = await trendingAnimeKitsu();
    if (kitsu.length > 0) return kitsu;
  } catch {
    // fall through to Jikan
  }
  return trendingAnimeJikan();
}

async function trendingAnimeKitsu(): Promise<SearchResult[]> {
  const res = await fetch("https://kitsu.io/api/edge/trending/anime", {
    next: { revalidate: REVALIDATE },
    headers: { Accept: "application/vnd.api+json" },
  });
  if (!res.ok) throw new Error(`Kitsu ${res.status}`);
  const data = (await res.json()) as { data?: KitsuAnime[] };

  return (data.data ?? []).map((a): SearchResult => {
    const at = a.attributes ?? {};
    return {
      // No MAL mapping on this endpoint, unlike search's Kitsu fallback — same
      // `kitsu:` id space /api/refresh already resolves via fetchKitsuDetail.
      externalId: `kitsu:${a.id}`,
      title: at.titles?.en || at.canonicalTitle || "Untitled",
      coverUrl: at.posterImage?.large ?? at.posterImage?.medium ?? at.posterImage?.original ?? null,
      year: at.startDate ? Number(at.startDate.slice(0, 4)) : null,
      genres: [],
      meta: { episodes: at.episodeCount ?? null },
    };
  });
}

interface JikanAnime {
  mal_id: number;
  title: string;
  title_english?: string | null;
  images?: { jpg?: { image_url?: string; large_image_url?: string } };
  year?: number | null;
  genres?: { name: string }[];
  score?: number | null;
}

async function trendingAnimeJikan(): Promise<SearchResult[]> {
  const res = await fetch("https://api.jikan.moe/v4/seasons/now?filter=tv&limit=15", {
    next: { revalidate: REVALIDATE },
  });
  if (!res.ok) throw new Error(`Jikan ${res.status}`);
  const data = (await res.json()) as { data?: JikanAnime[] };

  return (data.data ?? []).map((a): SearchResult => ({
    externalId: String(a.mal_id),
    title: a.title_english || a.title,
    coverUrl: a.images?.jpg?.large_image_url ?? a.images?.jpg?.image_url ?? null,
    year: a.year ?? null,
    genres: (a.genres ?? []).slice(0, 3).map((g) => g.name),
    meta: { malScore: a.score ?? null },
  }));
}

/* ---------- movies & series: TMDB daily trending, resolved to our ids ---------- */

interface TmdbTrendingItem {
  title?: string;
  name?: string;
}

interface ImdbSuggestionItem {
  id: string;
  l: string;
  q?: string;
  y?: number | null;
  i?: { imageUrl?: string };
}

interface TvMazeShow {
  id: number;
  name: string;
  image?: { original?: string; medium?: string } | null;
  premiered?: string | null;
  genres?: string[];
}

async function trendingTmdb(kind: "movie" | "tv") {
  const key = process.env.TMDB_API_KEY;
  if (!key) {
    return NextResponse.json(
      {
        error: "not_configured",
        message:
          "Trending needs a free TMDB API key — add TMDB_API_KEY (from themoviedb.org/settings/api) to enable this.",
      },
      { status: 501 },
    );
  }

  const res = await fetch(
    `https://api.themoviedb.org/3/trending/${kind}/day?api_key=${key}`,
    { next: { revalidate: REVALIDATE } },
  );
  if (!res.ok) return NextResponse.json({ error: "fetch_failed" }, { status: 502 });
  const data = (await res.json()) as { results?: TmdbTrendingItem[] };
  const titles = (data.results ?? []).map((t) => t.title ?? t.name ?? "").filter(Boolean).slice(0, 12);

  const resolved = await Promise.all(
    titles.map((title) => (kind === "movie" ? resolveImdbMovie(title) : resolveTvmazeShow(title))),
  );
  const results = resolved.filter((r): r is SearchResult => r !== null).slice(0, 10);
  return NextResponse.json({ results });
}

/** Matches a trending title back to its IMDb id, the same id space `/api/search` uses for movies. */
async function resolveImdbMovie(title: string): Promise<SearchResult | null> {
  const lowered = title.toLowerCase();
  const url = `https://v3.sg.media-imdb.com/suggestion/${encodeURIComponent(lowered[0])}/${encodeURIComponent(lowered)}.json`;
  const res = await fetch(url, { next: { revalidate: REVALIDATE } });
  if (!res.ok) return null;
  const data = (await res.json()) as { d?: ImdbSuggestionItem[] };
  const candidates = (data.d ?? []).filter(
    (m) => typeof m.id === "string" && m.id.startsWith("tt") && (m.q === "feature" || m.q === "TV movie"),
  );
  const match = candidates.find((m) => m.l.toLowerCase() === lowered) ?? candidates[0];
  if (!match) return null;

  return {
    externalId: match.id,
    title: match.l,
    coverUrl: match.i?.imageUrl ? match.i.imageUrl.replace("._V1_.jpg", "._V1_UX400_.jpg") : null,
    year: match.y ?? null,
    genres: [],
    meta: {},
  };
}

/** Matches a trending title back to its TVMaze id, the same id space `/api/search` uses for series. */
async function resolveTvmazeShow(title: string): Promise<SearchResult | null> {
  const url = `https://api.tvmaze.com/search/shows?q=${encodeURIComponent(title)}`;
  const res = await fetch(url, { next: { revalidate: REVALIDATE } });
  if (!res.ok) return null;
  const data = (await res.json()) as { show: TvMazeShow }[];
  const lowered = title.toLowerCase();
  const match = data.find((r) => r.show.name.toLowerCase() === lowered) ?? data[0];
  if (!match) return null;
  const { show } = match;

  return {
    externalId: String(show.id),
    title: show.name,
    coverUrl: show.image?.original ?? show.image?.medium ?? null,
    year: show.premiered ? Number(show.premiered.slice(0, 4)) : null,
    genres: (show.genres ?? []).slice(0, 3),
    meta: {},
  };
}

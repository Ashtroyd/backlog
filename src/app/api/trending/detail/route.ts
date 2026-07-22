import { NextResponse, type NextRequest } from "next/server";

/**
 * GET /api/trending/detail?type=game|movie|series|anime&id=<external id>
 *
 * The trending list itself stays lean (title/cover/year only), so a card's
 * synopsis and length/runtime are fetched on demand when its detail modal
 * opens, straight from each source's own detail endpoint.
 */

const REVALIDATE = 1800;

type TrendingDetail = { description: string | null; facts: string[] };

export async function GET(request: NextRequest) {
  const type = request.nextUrl.searchParams.get("type") ?? "";
  const id = request.nextUrl.searchParams.get("id") ?? "";
  if (!id) return NextResponse.json({ error: "missing_id" }, { status: 400 });

  try {
    switch (type) {
      case "game":
        return NextResponse.json({ detail: await gameDetail(id) });
      case "movie":
        return NextResponse.json({ detail: await movieDetail(id) });
      case "series":
        return NextResponse.json({ detail: await seriesDetail(id) });
      case "anime":
        return NextResponse.json({ detail: await animeDetail(id) });
      default:
        return NextResponse.json({ error: "bad_type" }, { status: 400 });
    }
  } catch (err) {
    console.error("trending detail failed", err);
    return NextResponse.json({ error: "detail_failed" }, { status: 502 });
  }
}

/** Strips markup and the handful of HTML entities these sources use in plain-text fields. */
function cleanText(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const cleaned = raw
    .replace(/<[^>]+>/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || null;
}

/* ---------- games: Steam appdetails ---------- */

async function gameDetail(appid: string): Promise<TrendingDetail> {
  const res = await fetch(`https://store.steampowered.com/api/appdetails?appids=${appid}&cc=GB&l=english`, {
    next: { revalidate: REVALIDATE },
  });
  if (!res.ok) throw new Error(`Steam ${res.status}`);
  const payload = (await res.json()) as Record<string, { success: boolean; data?: Record<string, unknown> }>;
  const d = payload[appid]?.data;
  if (!d) return { description: null, facts: [] };

  const facts: string[] = [];
  const genres = d.genres as { description: string }[] | undefined;
  if (genres?.length) facts.push(genres.slice(0, 3).map((g) => g.description).join(", "));
  const metacritic = d.metacritic as { score?: number } | undefined;
  if (metacritic?.score) facts.push(`Metacritic ${metacritic.score}`);
  const platforms = d.platforms as { windows?: boolean; mac?: boolean; linux?: boolean } | undefined;
  const platformNames = [
    platforms?.windows && "Windows",
    platforms?.mac && "Mac",
    platforms?.linux && "Linux",
  ].filter((p): p is string => Boolean(p));
  if (platformNames.length) facts.push(platformNames.join(" · "));
  const releaseDate = d.release_date as { date?: string } | undefined;
  if (releaseDate?.date) facts.push(releaseDate.date);

  return { description: cleanText(d.short_description as string), facts };
}

/* ---------- series: TVMaze show detail ---------- */

async function seriesDetail(id: string): Promise<TrendingDetail> {
  const res = await fetch(`https://api.tvmaze.com/shows/${id}`, { next: { revalidate: REVALIDATE } });
  if (!res.ok) throw new Error(`TVMaze ${res.status}`);
  const show = (await res.json()) as {
    summary?: string;
    runtime?: number | null;
    averageRuntime?: number | null;
    rating?: { average?: number | null };
    network?: { name?: string } | null;
    webChannel?: { name?: string } | null;
    status?: string;
  };

  const facts: string[] = [];
  const runtime = show.averageRuntime ?? show.runtime;
  if (runtime) facts.push(`${runtime} min/ep`);
  if (show.rating?.average) facts.push(`TVMaze ${show.rating.average}`);
  const network = show.network?.name ?? show.webChannel?.name;
  if (network) facts.push(network);
  if (show.status) facts.push(show.status);

  return { description: cleanText(show.summary), facts };
}

/* ---------- movies: TMDB, resolved from our IMDb id ---------- */

async function movieDetail(imdbId: string): Promise<TrendingDetail> {
  const key = process.env.TMDB_API_KEY;
  if (!key) return { description: null, facts: [] };

  const findRes = await fetch(
    `https://api.themoviedb.org/3/find/${imdbId}?api_key=${key}&external_source=imdb_id`,
    { next: { revalidate: REVALIDATE } },
  );
  if (!findRes.ok) throw new Error(`TMDB ${findRes.status}`);
  const found = (await findRes.json()) as { movie_results?: { id: number; overview?: string; vote_average?: number }[] };
  const movie = found.movie_results?.[0];
  if (!movie) return { description: null, facts: [] };

  const facts: string[] = [];
  let description = movie.overview || null;

  const detailRes = await fetch(`https://api.themoviedb.org/3/movie/${movie.id}?api_key=${key}`, {
    next: { revalidate: REVALIDATE },
  });
  if (detailRes.ok) {
    const d = (await detailRes.json()) as { overview?: string; runtime?: number; genres?: { name: string }[] };
    if (d.overview) description = d.overview;
    if (d.runtime) facts.push(`${d.runtime} min`);
    if (d.genres?.length) facts.push(d.genres.slice(0, 3).map((g) => g.name).join(", "));
  }
  if (movie.vote_average) facts.push(`TMDB ${movie.vote_average.toFixed(1)}`);

  return { description, facts };
}

/* ---------- anime: Kitsu (kitsu: ids) or Jikan (mal ids) ---------- */

async function animeDetail(id: string): Promise<TrendingDetail> {
  if (id.startsWith("kitsu:")) return kitsuAnimeDetail(id.slice("kitsu:".length));
  return jikanAnimeDetail(id);
}

async function kitsuAnimeDetail(kitsuId: string): Promise<TrendingDetail> {
  const res = await fetch(`https://kitsu.io/api/edge/anime/${kitsuId}`, {
    next: { revalidate: REVALIDATE },
    headers: { Accept: "application/vnd.api+json" },
  });
  if (!res.ok) throw new Error(`Kitsu ${res.status}`);
  const { data } = (await res.json()) as {
    data?: {
      attributes?: {
        synopsis?: string;
        episodeLength?: number | null;
        episodeCount?: number | null;
        averageRating?: string | null;
      };
    };
  };
  const at = data?.attributes ?? {};

  const facts: string[] = [];
  if (at.episodeLength) facts.push(`${at.episodeLength} min/ep`);
  if (at.episodeCount) facts.push(`${at.episodeCount} episodes`);
  if (at.averageRating) facts.push(`Kitsu ${(Number(at.averageRating) / 10).toFixed(1)}`);

  return { description: cleanText(at.synopsis), facts };
}

async function jikanAnimeDetail(malId: string): Promise<TrendingDetail> {
  const res = await fetch(`https://api.jikan.moe/v4/anime/${malId}`, { next: { revalidate: REVALIDATE } });
  if (!res.ok) throw new Error(`Jikan ${res.status}`);
  const { data: a } = (await res.json()) as {
    data?: { synopsis?: string; duration?: string; episodes?: number | null; score?: number | null };
  };

  const facts: string[] = [];
  if (a?.duration) facts.push(a.duration);
  if (a?.episodes) facts.push(`${a.episodes} episodes`);
  if (a?.score) facts.push(`MAL ${a.score}`);

  return { description: cleanText(a?.synopsis), facts };
}

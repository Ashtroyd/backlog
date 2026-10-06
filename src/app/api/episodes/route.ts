import { countAiredEpisodes } from "@/lib/episode-data";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const type = params.get("type"), id = params.get("id");
  if (!id || !/^\d{1,9}$/.test(id) || !["series", "anime"].includes(type ?? "")) {
    return Response.json({ error: "unsupported_title" }, { status: 400 });
  }
  try {
    const signal = AbortSignal.timeout(25_000);
    const episodes: { airedAt: string | null }[] = [];
    if (type === "series") {
      const response = await fetch(`https://api.tvmaze.com/shows/${id}/episodes`, {
        next: { revalidate: 3600 }, signal,
      });
      if (!response.ok) throw new Error("source unavailable");
      const rows: { airstamp?: string | null }[] = await response.json();
      episodes.push(...rows.map((row) => ({ airedAt: row.airstamp ?? null })));
    } else {
      // Never count announced episode totals as released episodes. Read every
      // page, bounded to avoid a long-running request for huge franchises.
      for (let page = 1; page <= 10; page++) {
        signal.throwIfAborted();
        const response = await fetch(`https://api.jikan.moe/v4/anime/${id}/episodes?page=${page}`, {
          next: { revalidate: 3600 }, signal,
        });
        if (!response.ok) throw new Error("source unavailable");
        const payload: { data: { aired: string | null }[]; pagination: { has_next_page: boolean } } = await response.json();
        episodes.push(...payload.data.map((row) => ({ airedAt: row.aired })));
        if (!payload.pagination.has_next_page) break;
        if (page === 10) return Response.json({ availability: null });
        await new Promise((resolve) => setTimeout(resolve, 1100));
      }
    }
    // Missing air dates make an exact released count unknowable.
    const availability = episodes.length && episodes.every((episode) => episode.airedAt && Number.isFinite(Date.parse(episode.airedAt)))
      ? countAiredEpisodes(episodes) : null;
    return Response.json({ availability }, { headers: { "Cache-Control": "public, s-maxage=300" } });
  } catch {
    console.warn(JSON.stringify({ event: "episode_source_unavailable", source: type === "series" ? "tvmaze" : "jikan" }));
    return Response.json({ error: "episode_source_unavailable" }, { status: 502 });
  }
}

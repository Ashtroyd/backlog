import { NextResponse, type NextRequest } from "next/server";
import type { ItemStatus } from "@/lib/types";

/**
 * GET /api/import/mal?username=<MyAnimeList username>
 *
 * MAL's own list page renders from a keyless JSON endpoint
 * (`/animelist/{user}/load.json`) — no API key needed, as long as the list
 * is public. Paginated 300 rows at a time.
 */

export type MalImportAnime = {
  malId: string;
  title: string;
  coverUrl: string | null;
  episodes: number | null;
  watchedEpisodes: number;
  status: ItemStatus;
  /** Raw MAL score, 0–10 (0 means unscored). */
  score: number | null;
};

const STATUS_MAP: Record<number, ItemStatus> = {
  1: "in_progress", // currently watching
  2: "completed",
  3: "in_progress", // on hold — still nominally in progress, just paused
  4: "dropped",
  6: "backlog", // plan to watch
};

const PAGE_SIZE = 300;
const MAX_ENTRIES = 3000;

interface MalListEntry {
  anime_id: number;
  anime_title?: string;
  anime_title_eng?: string | null;
  anime_image_path?: string;
  anime_num_episodes?: number;
  num_watched_episodes?: number;
  status: number;
  score?: number;
}

export async function GET(request: NextRequest) {
  const username = request.nextUrl.searchParams.get("username")?.trim() ?? "";
  if (!username) return NextResponse.json({ error: "missing_username" }, { status: 400 });

  const notFound = () =>
    NextResponse.json(
      {
        error: "not_found",
        message: "Couldn't find that MyAnimeList user, or their list isn't public.",
      },
      { status: 404 },
    );

  try {
    const entries: MalListEntry[] = [];
    for (let offset = 0; offset < MAX_ENTRIES; offset += PAGE_SIZE) {
      const url = `https://myanimelist.net/animelist/${encodeURIComponent(username)}/load.json?status=7&offset=${offset}`;
      const res = await fetch(url, {
        cache: "no-store",
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; BacklogApp/1.0; +https://backlog-liart.vercel.app)",
          Accept: "application/json",
        },
      });
      if (!res.ok) {
        if (offset === 0) return notFound();
        break;
      }
      let page: unknown;
      try {
        page = await res.json();
      } catch {
        if (offset === 0) return notFound();
        break;
      }
      if (!Array.isArray(page) || page.length === 0) break;
      entries.push(...page);
      if (page.length < PAGE_SIZE) break;
    }

    const results: MalImportAnime[] = entries
      .filter((e) => e && e.anime_id != null)
      .map((e): MalImportAnime => ({
        malId: String(e.anime_id),
        title: e.anime_title_eng?.trim() || e.anime_title || "Untitled",
        coverUrl: e.anime_image_path
          ? String(e.anime_image_path).replace(/\/r\/\d+x\d+\//, "/")
          : null,
        episodes:
          typeof e.anime_num_episodes === "number" && e.anime_num_episodes > 0
            ? e.anime_num_episodes
            : null,
        watchedEpisodes: typeof e.num_watched_episodes === "number" ? e.num_watched_episodes : 0,
        status: STATUS_MAP[e.status] ?? "backlog",
        score: typeof e.score === "number" && e.score > 0 ? e.score : null,
      }));

    return NextResponse.json({ results });
  } catch (err) {
    console.error("mal import failed", err);
    return NextResponse.json({ error: "import_failed" }, { status: 502 });
  }
}

import { NextResponse, type NextRequest } from "next/server";
import {
  fetchImdbDetail,
  fetchJikanDetail,
  fetchKitsuDetail,
  fetchSteamDetail,
  fetchTvmazeDetail,
} from "@/lib/server/refresh-sources";
import type { MediaType, SearchResult } from "@/lib/types";

/**
 * GET /api/refresh?type=…&id=…&title=…
 *
 * Re-fetches a stored item's details from its original source, so covers,
 * release years and scores don't stay frozen at add-time (especially for
 * titles added before release).
 */
export async function GET(request: NextRequest) {
  const type = request.nextUrl.searchParams.get("type") as MediaType | null;
  const id = request.nextUrl.searchParams.get("id") ?? "";
  const title = request.nextUrl.searchParams.get("title") ?? "";
  if (!type || !id) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  try {
    let result: SearchResult | null = null;
    if (type === "game") {
      result = /^\d+$/.test(id)
        ? await fetchSteamDetail(id)
        : await fetchImdbDetail(id, title, "game");
    } else if (type === "movie") {
      result = await fetchImdbDetail(id, title, "movie");
    } else if (type === "series") {
      result = await fetchTvmazeDetail(id);
    } else if (type === "anime") {
      result = id.startsWith("kitsu:")
        ? await fetchKitsuDetail(id.slice(6))
        : await fetchJikanDetail(id);
    }
    if (!result) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    return NextResponse.json({ result });
  } catch (err) {
    console.error("refresh failed", err);
    return NextResponse.json({ error: "refresh_failed" }, { status: 502 });
  }
}

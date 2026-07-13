import { NextResponse, type NextRequest } from "next/server";
import { fetchSteamDetail } from "@/lib/server/refresh-sources";

/**
 * GET /api/detail?type=game&id=…
 *
 * Steam's search endpoint doesn't include year, genres or a portrait cover,
 * so the add flow enriches a game with one appdetails call before saving.
 */
export async function GET(request: NextRequest) {
  const type = request.nextUrl.searchParams.get("type") ?? "";
  const id = request.nextUrl.searchParams.get("id") ?? "";
  if (type !== "game" || !/^\d+$/.test(id)) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  try {
    const result = await fetchSteamDetail(id);
    if (!result) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    return NextResponse.json({ result });
  } catch (err) {
    console.error("detail failed", err);
    return NextResponse.json({ error: "detail_failed" }, { status: 502 });
  }
}

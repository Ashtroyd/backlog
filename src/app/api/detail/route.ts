import { NextResponse, type NextRequest } from "next/server";
import type { SearchResult } from "@/lib/types";

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
    const res = await fetch(
      `https://store.steampowered.com/api/appdetails?appids=${id}&cc=GB&l=english`,
      { cache: "no-store" },
    );
    if (!res.ok) throw new Error(`Steam ${res.status}`);
    const payload = await res.json();
    const app = payload?.[id];
    if (!app?.success || !app.data) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    const d = app.data;

    // Prefer the portrait library cover (fits the 2:3 cards); not every app
    // has one, so fall back to the landscape header image.
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

    const result: SearchResult = {
      externalId: id,
      title: d.name,
      coverUrl,
      year: yearMatch ? Number(yearMatch[0]) : null,
      genres: (d.genres ?? [])
        .slice(0, 3)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((g: any) => g.description),
      meta: {
        platforms,
        metacritic: d.metacritic?.score ?? null,
      },
    };
    return NextResponse.json({ result });
  } catch (err) {
    console.error("detail failed", err);
    return NextResponse.json({ error: "detail_failed" }, { status: 502 });
  }
}

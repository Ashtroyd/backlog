import { NextResponse, type NextRequest } from "next/server";

/**
 * GET /api/import/steam?id=<vanity name, SteamID64, or profile URL>
 *
 * Steam Community's old keyless XML games list now redirects to a login
 * wall even for public profiles, so this goes through Valve's official Web
 * API instead. Needs one app-level STEAM_API_KEY (free, from
 * steamcommunity.com/dev/apikey) — end users still just paste their own
 * Steam ID, no key of their own required.
 */

export type SteamImportGame = {
  appid: string;
  name: string;
  coverUrl: string;
  hoursPlayed: number | null;
};

/* eslint-disable @typescript-eslint/no-explicit-any */

const steamPortrait = (appid: string) =>
  `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${appid}/library_600x900.jpg`;

export async function GET(request: NextRequest) {
  const key = process.env.STEAM_API_KEY;
  if (!key) {
    return NextResponse.json(
      {
        error: "not_configured",
        message: "Steam import isn't set up on this server yet (missing STEAM_API_KEY).",
      },
      { status: 501 },
    );
  }

  const raw = request.nextUrl.searchParams.get("id")?.trim() ?? "";
  if (!raw) return NextResponse.json({ error: "missing_id" }, { status: 400 });

  try {
    const steamId64 = await resolveSteamId(raw, key);
    if (!steamId64) {
      return NextResponse.json(
        { error: "not_found", message: "Couldn't find that Steam profile." },
        { status: 404 },
      );
    }

    const url = `https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/?key=${key}&steamid=${steamId64}&format=json&include_appinfo=1&include_played_free_games=1`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return NextResponse.json({ error: "fetch_failed" }, { status: 502 });
    const data = await res.json();
    const games = data?.response?.games as any[] | undefined;

    if (!games) {
      return NextResponse.json(
        {
          error: "private",
          message:
            "That Steam profile's game details are private. Set \"Game details\" to public in Steam privacy settings and try again.",
        },
        { status: 403 },
      );
    }

    const results: SteamImportGame[] = games
      .filter((g) => g && g.appid != null && g.name)
      .map((g): SteamImportGame => ({
        appid: String(g.appid),
        name: g.name,
        coverUrl: steamPortrait(String(g.appid)),
        hoursPlayed:
          typeof g.playtime_forever === "number"
            ? Math.round((g.playtime_forever / 60) * 10) / 10
            : null,
      }));

    return NextResponse.json({ results });
  } catch (err) {
    console.error("steam import failed", err);
    return NextResponse.json({ error: "import_failed" }, { status: 502 });
  }
}

/** Accepts a vanity name, a SteamID64, or a full profile URL; resolves to a SteamID64. */
async function resolveSteamId(input: string, key: string): Promise<string | null> {
  const cleaned = input
    .replace(/^https?:\/\/(www\.)?steamcommunity\.com\//i, "")
    .replace(/\/+$/, "")
    .trim();

  const profileMatch = cleaned.match(/^profiles\/(\d+)/i);
  if (profileMatch) return profileMatch[1];
  if (/^\d{15,20}$/.test(cleaned)) return cleaned;

  const idMatch = cleaned.match(/^id\/([^/]+)/i);
  const vanity = idMatch ? idMatch[1] : cleaned;

  const res = await fetch(
    `https://api.steampowered.com/ISteamUser/ResolveVanityURL/v0001/?key=${key}&vanityurl=${encodeURIComponent(vanity)}`,
    { cache: "no-store" },
  );
  if (!res.ok) return null;
  const data = await res.json();
  if (data?.response?.success === 1) return String(data.response.steamid);
  return null;
}

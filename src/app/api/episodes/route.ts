import { fetchEpisodeAvailability } from "@/lib/server/episode-sources";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const type = params.get("type"), id = params.get("id") ?? "";
  const validId = type === "anime" ? /^(?:kitsu:)?\d{1,9}$/.test(id) : /^\d{1,9}$/.test(id);
  if ((type !== "series" && type !== "anime") || !validId) {
    return Response.json({ error: "unsupported_title" }, { status: 400 });
  }
  try {
    const result = await fetchEpisodeAvailability(type, id);
    return Response.json(result, { headers: { "Cache-Control": result.availability ? "public, s-maxage=300" : "no-store" } });
  } catch {
    return Response.json({ error: "episode_source_unavailable" }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}

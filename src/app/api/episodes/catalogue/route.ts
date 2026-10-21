import { fetchEpisodeCatalogue } from "@/lib/server/episode-catalogue";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const id = params.get("id") ?? "";
  if (params.get("type") !== "series" || !/^\d{1,9}$/.test(id))
    return Response.json({ error: "unsupported_title" }, { status: 400 });
  try {
    return Response.json({ episodes: await fetchEpisodeCatalogue(id) }, { headers: { "Cache-Control": "public, s-maxage=3600" } });
  } catch {
    return Response.json({ error: "episode_source_unavailable" }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}

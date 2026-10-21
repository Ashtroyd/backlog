import type { WatchEpisode } from "../watch-history";

/** TVMaze's regular episodes are ordered by season and number; specials are excluded. */
export async function fetchEpisodeCatalogue(id: string, fetcher: typeof fetch = fetch): Promise<WatchEpisode[]> {
  const response = await fetcher(`https://api.tvmaze.com/shows/${id}/episodes`, {
    headers: { Accept: "application/json" }, next: { revalidate: 3600 }, signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error("Episode list unavailable");
  const data: unknown = await response.json();
  if (!Array.isArray(data)) throw new Error("Invalid episode list");
  const rows = data.filter((row) => row && Number.isSafeInteger(row.season) && row.season > 0 && Number.isSafeInteger(row.number) && row.number > 0)
    .sort((a, b) => a.season - b.season || a.number - b.number);
  const keys = new Set<string>();
  return rows.map((row, index) => {
    const key = `${row.season}:${row.number}`;
    if (keys.has(key)) throw new Error("Ambiguous episode list");
    keys.add(key);
    return { ordinal: index + 1, season: row.season, number: row.number, title: typeof row.name === "string" ? row.name.slice(0, 250) : null };
  });
}

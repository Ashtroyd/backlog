import { countAiredEpisodes, type EpisodeAvailability } from "../episode-data";

type Fetcher = typeof fetch;
type SourceResult = { availability: EpisodeAvailability | null; source: "jikan" | "kitsu" | "tvmaze" };

class EpisodeSourceError extends Error {
  constructor(public reason: string, public status?: number) { super(reason); }
}

function logFailure(source: string, error: unknown) {
  const cause = error instanceof Error ? error.cause : null;
  const code = typeof cause === "object" && cause !== null && "code" in cause ? cause.code : null;
  const connectionReason = ["UND_ERR_CONNECT_TIMEOUT", "ETIMEDOUT"].includes(String(code)) ? "timeout"
    : code === "ENOTFOUND" ? "dns_error"
    : ["ECONNREFUSED", "ECONNRESET"].includes(String(code)) ? "connection_failed" : "request_failed";
  // No user data, URLs, response bodies or raw exception messages in logs.
  console.warn(JSON.stringify({ event: "episode_source_unavailable", source,
    reason: error instanceof EpisodeSourceError ? error.reason : error instanceof Error && ["TimeoutError", "AbortError"].includes(error.name) ? "timeout" : connectionReason,
    status: error instanceof EpisodeSourceError ? error.status : undefined }));
}

async function json<T>(url: string, signal: AbortSignal, fetcher: Fetcher): Promise<T> {
  signal.throwIfAborted();
  const response = await fetcher(url, {
    headers: { Accept: "application/json, application/vnd.api+json" },
    next: { revalidate: 3600 },
    signal: AbortSignal.any([signal, AbortSignal.timeout(4000)]),
  });
  if (!response.ok) throw new EpisodeSourceError("http_error", response.status);
  return response.json() as Promise<T>;
}

function datedAvailability(episodes: { airedAt: string | null }[]): EpisodeAvailability | null {
  return episodes.length && episodes.every((episode) => episode.airedAt && Number.isFinite(Date.parse(episode.airedAt)))
    ? countAiredEpisodes(episodes) : null;
}

async function jikanEpisodes(id: string, fetcher: Fetcher): Promise<EpisodeAvailability | null> {
  const signal = AbortSignal.timeout(12_000);
  const episodes: { airedAt: string | null }[] = [];
  for (let page = 1; page <= 10; page++) {
    const payload = await json<{ data: { aired: string | null }[]; pagination: { has_next_page: boolean } }>(
      `https://api.jikan.moe/v4/anime/${id}/episodes?page=${page}`, signal, fetcher);
    if (!Array.isArray(payload.data) || typeof payload.pagination?.has_next_page !== "boolean") throw new EpisodeSourceError("invalid_payload");
    episodes.push(...payload.data.map((row) => ({ airedAt: row.aired })));
    if (!payload.pagination.has_next_page) return datedAvailability(episodes);
    if (page < 10) await new Promise((resolve) => setTimeout(resolve, 1100));
  }
  return null;
}

type Mapping = { attributes?: { externalSite?: string; externalId?: string }; relationships?: { item?: { data?: { type: string; id: string } } } };
type KitsuEpisode = { id: string; attributes?: { number?: number; airdate?: string | null } };

async function kitsuEpisodes(id: string, fetcher: Fetcher): Promise<EpisodeAvailability | null> {
  const signal = AbortSignal.timeout(15_000);
  let kitsuId = id.startsWith("kitsu:") ? id.slice(6) : null;
  if (!kitsuId) {
    const params = new URLSearchParams({ "filter[externalSite]": "myanimelist/anime", "filter[externalId]": id, "include": "item", "fields[anime]": "slug" });
    const payload = await json<{ data: Mapping[] }>(`https://kitsu.io/api/edge/mappings?${params}`, signal, fetcher);
    if (!Array.isArray(payload.data)) throw new EpisodeSourceError("invalid_payload");
    const matches = new Set(payload.data.filter((row) => row.attributes?.externalSite === "myanimelist/anime" && row.attributes.externalId === id && row.relationships?.item?.data?.type === "anime")
      .map((row) => row.relationships!.item!.data!.id));
    if (matches.size !== 1) return null;
    kitsuId = [...matches][0];
  }
  if (!/^\d{1,9}$/.test(kitsuId)) throw new EpisodeSourceError("invalid_mapping");
  const episodes = new Map<number, { airedAt: string | null }>();
  let expected: number | null = null;
  for (let page = 0; page < 100; page++) {
    const params = new URLSearchParams({ "page[limit]": "20", "page[offset]": String(page * 20), "sort": "number", "fields[episodes]": "number,airdate" });
    const payload = await json<{ data: KitsuEpisode[]; meta?: { count?: number }; links?: { next?: string | null } }>(
      `https://kitsu.io/api/edge/anime/${kitsuId}/episodes?${params}`, signal, fetcher);
    if (!Array.isArray(payload.data)) throw new EpisodeSourceError("invalid_payload");
    if (page === 0) {
      if (!Number.isSafeInteger(payload.meta?.count) || payload.meta!.count! < 0) return null;
      expected = payload.meta!.count!;
      if (expected > 2000) return null;
    }
    for (const row of payload.data) {
      const number = row.attributes?.number;
      if (!Number.isSafeInteger(number) || number! < 1 || episodes.has(number!)) return null;
      // Date-only records become available after that UTC day has ended.
      const date = row.attributes?.airdate;
      const stamp = typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date) ? `${date}T23:59:59.999Z` : null;
      const airedAt = stamp && Number.isFinite(Date.parse(stamp)) && new Date(stamp).toISOString().slice(0, 10) === date ? stamp : null;
      episodes.set(number!, { airedAt });
    }
    if (!payload.links?.next) {
      if (expected !== null && episodes.size !== expected) return null;
      if ([...episodes.keys()].some((number) => number > episodes.size)) return null;
      return datedAvailability([...episodes.values()]);
    }
    if (!payload.data.length) return null;
    // Never follow provider-supplied URLs; all requests remain allowlisted.
  }
  return null;
}

export async function fetchEpisodeAvailability(type: "anime" | "series", id: string, fetcher: Fetcher = fetch): Promise<SourceResult> {
  if (type === "series") {
    try {
      const rows = await json<{ airstamp?: string | null }[]>(`https://api.tvmaze.com/shows/${id}/episodes`, AbortSignal.timeout(8000), fetcher);
      if (!Array.isArray(rows)) throw new EpisodeSourceError("invalid_payload");
      return { availability: datedAvailability(rows.map((row) => ({ airedAt: row.airstamp ?? null }))), source: "tvmaze" };
    } catch (error) { logFailure("tvmaze", error); throw error; }
  }
  let primaryFailed = false;
  if (!id.startsWith("kitsu:")) {
    try {
      const availability = await jikanEpisodes(id, fetcher);
      if (availability) return { availability, source: "jikan" };
    } catch (error) { primaryFailed = true; logFailure("jikan", error); }
  }
  try {
    return { availability: await kitsuEpisodes(id, fetcher), source: "kitsu" };
  } catch (error) {
    logFailure("kitsu", error);
    if (primaryFailed || id.startsWith("kitsu:")) throw error;
    return { availability: null, source: "jikan" };
  }
}

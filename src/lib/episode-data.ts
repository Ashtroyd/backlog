export type EpisodeAvailability = { aired: number; latestAirAt: string | null; nextAirAt: string | null };

export function countAiredEpisodes(episodes: { airedAt: string | null }[], now = Date.now()): EpisodeAvailability {
  const dated = episodes.map((episode) => episode.airedAt).filter((date): date is string => !!date && Number.isFinite(Date.parse(date)));
  const past = dated.filter((date) => Date.parse(date) <= now).sort((a, b) => Date.parse(a) - Date.parse(b));
  const future = dated.filter((date) => Date.parse(date) > now).sort((a, b) => Date.parse(a) - Date.parse(b));
  return { aired: past.length, latestAirAt: past.at(-1) ?? null, nextAirAt: future[0] ?? null };
}

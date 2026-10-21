/** Ordinal excludes specials; season/number are the provider's display numbering. */
export type WatchEpisode = { ordinal: number; season: number | null; number: number; title: string | null };
export type WatchInput = { requestId: string; watchedOn: string; episodes: WatchEpisode[]; rewatch: boolean };
export type WatchSession = {
  id: string; item_id: string; watched_on: string; episodes: WatchEpisode[];
  is_rewatch: boolean; progress_before: number; progress_after: number; created_at: string;
};

export function episodeLabel(episode: WatchEpisode): string {
  return episode.season == null ? `Episode ${episode.number}` : `S${episode.season} E${episode.number}`;
}

export function nextWatchEpisodes(progress: number, count: number, catalogue: WatchEpisode[] | null, total: number | null): WatchEpisode[] {
  if (!Number.isSafeInteger(progress) || progress < 0 || !Number.isSafeInteger(count) || count < 1 || count > 100)
    throw new Error("Choose between 1 and 100 episodes.");
  if (total != null && progress + count > total) throw new Error("That goes past the last episode. Reduce the count or log a rewatch.");
  return Array.from({ length: count }, (_, i) => {
    const ordinal = progress + i + 1;
    return catalogue?.find((episode) => episode.ordinal === ordinal) ?? { ordinal, season: null, number: ordinal, title: null };
  });
}

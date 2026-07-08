import type { BacklogItem } from "./types";

/** Human-readable metadata chips (platforms, scores, episodes…) for an item. */
export function itemChips(item: BacklogItem | null): string[] {
  if (!item) return [];
  const m = item.meta ?? {};
  const chips: string[] = [];
  if (m.platforms?.length) chips.push(m.platforms.join(" · "));
  if (m.metacritic) chips.push(`Metacritic ${m.metacritic}`);
  if (m.stars) chips.push(m.stars);
  if (m.tvmazeRating) chips.push(`TVMaze ${m.tvmazeRating}`);
  if (m.network) chips.push(m.network);
  if (m.episodes) chips.push(`${m.episodes} episodes`);
  if (m.malScore) chips.push(`MAL ${m.malScore}`);
  if (m.studios?.length) chips.push(m.studios.join(", "));
  return chips;
}

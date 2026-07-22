import type { BacklogItem, ItemMeta } from "./types";

/** Human-readable metadata chips (platforms, scores, episodes…) from raw item meta. */
export function metaChips(meta: ItemMeta): string[] {
  const chips: string[] = [];
  if (meta.platforms?.length) chips.push(meta.platforms.join(" · "));
  if (meta.metacritic) chips.push(`Metacritic ${meta.metacritic}`);
  if (meta.stars) chips.push(meta.stars);
  if (meta.tvmazeRating) chips.push(`TVMaze ${meta.tvmazeRating}`);
  if (meta.network) chips.push(meta.network);
  if (meta.episodes) chips.push(`${meta.episodes} episodes`);
  if (meta.malScore) chips.push(`MAL ${meta.malScore}`);
  if (meta.studios?.length) chips.push(meta.studios.join(", "));
  return chips;
}

/** Human-readable metadata chips (platforms, scores, episodes…) for an item. */
export function itemChips(item: BacklogItem | null): string[] {
  if (!item) return [];
  return metaChips(item.meta ?? {});
}

/**
 * Whether an item has a shareable "take" worth showing to friends and
 * opening a comment thread under — a finished review, or (for a game still
 * in progress) current thoughts, since live-service titles never complete.
 */
export function hasShareableTake(item: Pick<BacklogItem, "status" | "media_type" | "current_thoughts"> | null): boolean {
  if (!item) return false;
  if (item.status === "completed") return true;
  return (
    item.media_type === "game" &&
    item.status === "in_progress" &&
    Boolean(item.current_thoughts?.trim())
  );
}

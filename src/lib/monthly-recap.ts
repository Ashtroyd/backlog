import type { BacklogItem, MediaType } from "./types";

export type RecapItem = Pick<BacklogItem, "id" | "title" | "cover_url" | "media_type" | "status" | "completed_at" | "rating" | "is_favorite" | "is_private">;

export function buildMonthlyRecap(items: RecapItem[], month: string, shareSafe = false) {
  const [year, m] = month.split("-").map(Number);
  const start = Date.UTC(year, m - 1, 1), end = Date.UTC(year, m, 1);
  const seen = new Set<string>();
  const completed = items.filter((item) => {
    const at = item.completed_at ? Date.parse(item.completed_at) : NaN;
    if (seen.has(item.id) || item.status !== "completed" || at < start || at >= end || !Number.isFinite(at) || (shareSafe && item.is_private)) return false;
    seen.add(item.id); return true;
  }).sort((a,b) => Date.parse(b.completed_at!) - Date.parse(a.completed_at!) || a.title.localeCompare(b.title));
  const byType: Record<MediaType, number> = {game:0,movie:0,series:0,anime:0};
  completed.forEach((item) => byType[item.media_type]++);
  const rated = completed.filter((item) => item.rating != null && Number.isFinite(item.rating) && item.rating >= 0 && item.rating <= 5);
  const average = rated.length ? rated.reduce((sum,item) => sum + item.rating!,0)/rated.length : null;
  const highlights = [...completed].sort((a,b) => Number(b.is_favorite)-Number(a.is_favorite) || (b.rating ?? -1)-(a.rating ?? -1) || a.title.localeCompare(b.title)).slice(0,3);
  return { completed, byType, average, highlights };
}

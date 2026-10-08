import type { BacklogItem, MediaType } from "./types";

export type StarterMood = "any" | "easygoing" | "action" | "story" | "mystery";
export type StarterPreferences = { media: MediaType | "any"; minutes: 30 | 60 | 120 | null; mood: StarterMood; includePaused: boolean };
export type StarterPick = { item: BacklogItem; reasons: string[]; timeNote: string };
export const STARTER_MOODS: { value: StarterMood; label: string; genres: string[] }[] = [
  { value: "any", label: "Anything", genres: [] },
  { value: "easygoing", label: "Easygoing", genres: ["comedy", "slice of life", "casual", "puzzle", "family", "cozy"] },
  { value: "action", label: "Some action", genres: ["action", "adventure", "shooter", "fighting"] },
  { value: "story", label: "A good story", genres: ["drama", "rpg", "role playing", "visual novel", "story rich"] },
  { value: "mystery", label: "A mystery", genres: ["mystery", "thriller", "detective", "crime"] },
];
const normalize = (genre: string) => genre.toLowerCase().replace(/[-_]/g, " ").trim();

/** Explainable suggestions from the owner's saved library; never infer a real runtime. */
export function findStarterPicks(items: BacklogItem[], preferences: StarterPreferences, year = new Date().getFullYear()): StarterPick[] {
  const likedGenres = new Set(items.filter((item) => item.status === "completed" && ((item.rating ?? 0) >= 4 || item.is_favorite)).flatMap((item) => item.genres.map(normalize)));
  const mood = STARTER_MOODS.find((entry) => entry.value === preferences.mood)!;
  const seen = new Set<string>();
  const picks: { pick: StarterPick; score: number }[] = [];
  for (const item of items) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    if (item.status !== "backlog" && !(preferences.includePaused && item.status === "on_hold")) continue;
    if (item.release_year != null && item.release_year > year) continue;
    if (preferences.media !== "any" && item.media_type !== preferences.media) continue;
    // With no stored runtimes, a film isn't a useful suggestion for a short session.
    if (item.media_type === "movie" && preferences.minutes != null && preferences.minutes < 120) continue;
    const genres = item.genres.map(normalize);
    const moodGenre = item.genres.find((_, index) => mood.genres.some((target) => genres[index].includes(target)));
    if (preferences.mood !== "any" && !moodGenre) continue;
    let score = 0;
    const reasons: string[] = [];
    if (item.pinned_at) { score += 5; reasons.push("You pinned this to Up Next."); }
    if (moodGenre) { score += 3; reasons.push(`Tagged ${moodGenre} in your library.`); }
    const familiar = item.genres.find((_, index) => likedGenres.has(genres[index]));
    if (familiar) { score += 2; reasons.push(`You’ve enjoyed other ${familiar} titles.`); }
    if (item.status === "on_hold") reasons.push("A paused title you could return to.");
    if (!reasons.length) reasons.push("Still waiting in your backlog.");
    const timeNote = item.media_type === "game" ? (preferences.minutes ? `Try a ${preferences.minutes}-minute session; total playtime varies.` : "Choose your own session length.")
      : item.media_type === "anime" ? "Try one episode. Often around 25 minutes; actual length varies."
      : item.media_type === "series" ? "Try one episode. Episode length isn’t saved; check before starting."
      : "Film runtime isn’t saved; check it before starting.";
    picks.push({ pick: { item, reasons: reasons.slice(0, 2), timeNote }, score });
  }
  return picks.sort((a, b) => b.score - a.score || a.pick.item.title.localeCompare(b.pick.item.title)).map(({ pick }) => pick);
}

export function rotateStarterPicks(picks: StarterPick[], offset: number): StarterPick[] {
  if (!picks.length) return [];
  const start = ((offset % picks.length) + picks.length) % picks.length;
  return [...picks.slice(start), ...picks.slice(0, start)].slice(0, 3);
}

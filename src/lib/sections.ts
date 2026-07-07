import type { ItemStatus, MediaType } from "./types";

export type SectionSlug = "games" | "movies" | "series" | "anime";

export type Section = {
  slug: SectionSlug;
  label: string;
  singular: string;
  mediaType: MediaType;
  /** Label for the in_progress status — "Playing" for games, "Watching" otherwise. */
  inProgressLabel: string;
  searchPlaceholder: string;
  /** Where search results come from, shown in the add dialog. */
  source: string;
  emptyTitle: string;
  emptyBody: string;
};

export const SECTIONS: Record<SectionSlug, Section> = {
  games: {
    slug: "games",
    label: "Games",
    singular: "game",
    mediaType: "game",
    inProgressLabel: "Playing",
    searchPlaceholder: "Search for a game…",
    source: "Steam",
    emptyTitle: "No games yet",
    emptyBody: "Search for a game and it lands in your backlog with cover art and details filled in.",
  },
  movies: {
    slug: "movies",
    label: "Movies",
    singular: "movie",
    mediaType: "movie",
    inProgressLabel: "Watching",
    searchPlaceholder: "Search for a movie…",
    source: "IMDb",
    emptyTitle: "No movies yet",
    emptyBody: "Search for a movie and it lands in your watchlist with its poster and details filled in.",
  },
  series: {
    slug: "series",
    label: "Series",
    singular: "series",
    mediaType: "series",
    inProgressLabel: "Watching",
    searchPlaceholder: "Search for a series…",
    source: "TVMaze",
    emptyTitle: "No series yet",
    emptyBody: "Search for a series and it lands in your watchlist with its poster and details filled in.",
  },
  anime: {
    slug: "anime",
    label: "Anime",
    singular: "anime",
    mediaType: "anime",
    inProgressLabel: "Watching",
    searchPlaceholder: "Search for an anime…",
    source: "MyAnimeList",
    emptyTitle: "No anime yet",
    emptyBody: "Search for an anime and it lands in your watchlist with cover art, episodes and studio details.",
  },
};

export const SECTION_SLUGS = Object.keys(SECTIONS) as SectionSlug[];

export const STATUS_ORDER: ItemStatus[] = ["backlog", "in_progress", "completed", "dropped"];

export function statusLabel(status: ItemStatus, section: Section): string {
  switch (status) {
    case "backlog":
      return "Backlog";
    case "in_progress":
      return section.inProgressLabel;
    case "completed":
      return "Completed";
    case "dropped":
      return "Dropped";
  }
}

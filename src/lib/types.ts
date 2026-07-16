export type MediaType = "game" | "movie" | "series" | "anime";

export type ItemStatus = "backlog" | "in_progress" | "completed" | "dropped";

/** Extra details captured at add-time, varies by media type. */
export type ItemMeta = {
  platforms?: string[];
  metacritic?: number | null;
  stars?: string | null;
  tvmazeRating?: number | null;
  network?: string | null;
  episodes?: number | null;
  malScore?: number | null;
  studios?: string[];
  /** When details were last re-fetched from the source (ISO timestamp). */
  _refreshedAt?: string;
  /** Set when a refresh discovers a previously-upcoming title has released. */
  _outNow?: boolean;
};

/** A row in the library. */
export type BacklogItem = {
  id: string;
  media_type: MediaType;
  external_id: string;
  title: string;
  cover_url: string | null;
  release_year: number | null;
  genres: string[];
  meta: ItemMeta;
  status: ItemStatus;
  rating: number | null;
  review: string | null;
  is_private: boolean;
  is_favorite: boolean;
  started_at: string | null;
  /** Episodes watched (series/anime). */
  progress: number | null;
  /** Hours played (games). */
  hours_played: number | null;
  /** Owner-only free-text notes, editable at any status. */
  notes: string | null;
  /** Set when pinned to the "Up next" row. */
  pinned_at: string | null;
  /** Games only: an ongoing live-service/multiplayer title with no real "completed" state. */
  live_service: boolean;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
};

/** A user's public identity, used across the friend features. */
export type Profile = {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  banner_url: string | null;
  bio: string | null;
};

/** A result returned by /api/search, ready to become a BacklogItem. */
export type SearchResult = {
  externalId: string;
  title: string;
  coverUrl: string | null;
  year: number | null;
  genres: string[];
  meta: ItemMeta;
};

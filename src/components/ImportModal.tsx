"use client";

import { useEffect, useRef, useState } from "react";
import type { Section } from "@/lib/sections";
import type { ImportInput } from "@/lib/backlog-store";
import type { SearchResult } from "@/lib/types";
import type { SteamImportGame } from "@/app/api/import/steam/route";
import type { MalImportAnime } from "@/app/api/import/mal/route";
import { toast } from "@/lib/toast-bus";
import { supabase } from "@/lib/supabase";
import { Modal } from "./Modal";
import { CoverImage } from "./CoverImage";
import { CheckIcon, SpinnerIcon, UploadIcon, XIcon } from "./icons";

type PreviewRow = {
  key: string;
  title: string;
  year: number | null;
  coverUrl: string | null;
  subtitle: string;
  input: ImportInput | null;
  alreadyInLibrary: boolean;
  matched: boolean;
};

const STATUS_LABEL: Record<string, string> = {
  backlog: "Plan to watch",
  in_progress: "Watching",
  completed: "Completed",
  dropped: "Dropped",
};

export function ImportModal({
  open,
  onClose,
  section,
  existingIds,
  bulkAdd,
}: {
  open: boolean;
  onClose: () => void;
  section: Section;
  existingIds: Set<string>;
  bulkAdd: (
    inputs: ImportInput[],
  ) => Promise<{ added: number; skipped: number; error: string | null }>;
}) {
  const [steamId, setSteamId] = useState("");
  const [malUsername, setMalUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [rows, setRows] = useState<PreviewRow[] | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function reset() {
    setSteamId("");
    setMalUsername("");
    setLoading(false);
    setProgress(null);
    setNotice(null);
    setRows(null);
    setChecked(new Set());
    setImporting(false);
  }

  useEffect(() => {
    if (open) reset();
  }, [open]);

  function finishFetch(built: PreviewRow[], emptyMessage: string) {
    setLoading(false);
    setProgress(null);
    const seen = new Set<string>();
    const deduped = built.filter((r) => {
      if (seen.has(r.key)) return false;
      seen.add(r.key);
      return true;
    });
    if (deduped.length === 0) {
      setNotice(emptyMessage);
      return;
    }
    setRows(deduped);
    setChecked(
      new Set(deduped.filter((r) => r.matched && !r.alreadyInLibrary).map((r) => r.key)),
    );
  }

  async function fetchSteam() {
    const id = steamId.trim();
    if (!id) return;
    setLoading(true);
    setNotice(null);
    try {
      const res = await fetch(`/api/import/steam?id=${encodeURIComponent(id)}`);
      const data = await res.json();
      if (!res.ok) {
        setNotice(data.message ?? "Couldn't fetch that Steam library — try again.");
        setLoading(false);
        return;
      }
      const games: SteamImportGame[] = data.results;
      const built: PreviewRow[] = games.map((g) => {
        const hours = g.hoursPlayed;
        const input: ImportInput = {
          mediaType: "game",
          externalId: g.appid,
          title: g.name,
          coverUrl: g.coverUrl,
          releaseYear: null,
          genres: [],
          meta: {},
          status: hours && hours > 0 ? "in_progress" : "backlog",
          hoursPlayed: hours,
        };
        return {
          key: g.appid,
          title: g.name,
          year: null,
          coverUrl: g.coverUrl,
          subtitle: hours ? `${hours} hr${hours === 1 ? "" : "s"} played` : "Not played yet",
          input,
          alreadyInLibrary: existingIds.has(g.appid),
          matched: true,
        };
      });
      finishFetch(built, "No games found on that profile.");
    } catch {
      setNotice("Couldn't fetch that Steam library — try again.");
      setLoading(false);
    }
  }

  async function fetchMal() {
    const username = malUsername.trim();
    if (!username) return;
    setLoading(true);
    setNotice(null);
    try {
      const res = await fetch(`/api/import/mal?username=${encodeURIComponent(username)}`);
      const data = await res.json();
      if (!res.ok) {
        setNotice(data.message ?? "Couldn't fetch that MyAnimeList — try again.");
        setLoading(false);
        return;
      }
      const list: MalImportAnime[] = data.results;
      const built: PreviewRow[] = list.map((a) => {
        const input: ImportInput = {
          mediaType: "anime",
          externalId: a.malId,
          title: a.title,
          coverUrl: a.coverUrl,
          releaseYear: null,
          genres: [],
          meta: { episodes: a.episodes },
          status: a.status,
          progress: a.watchedEpisodes,
          rating: a.score != null ? a.score / 2 : null,
        };
        return {
          key: a.malId,
          title: a.title,
          year: null,
          coverUrl: a.coverUrl,
          subtitle: `${STATUS_LABEL[a.status]} · ${a.watchedEpisodes}${a.episodes ? `/${a.episodes}` : ""} episodes`,
          input,
          alreadyInLibrary: existingIds.has(a.malId),
          matched: true,
        };
      });
      finishFetch(built, "No anime found for that username — make sure the list is public.");
    } catch {
      setNotice("Couldn't fetch that MyAnimeList — try again.");
      setLoading(false);
    }
  }

  async function handleLetterboxdFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const text = await file.text();
    const parsed = parseLetterboxdCsv(text);
    if (parsed.length === 0) {
      setNotice(
        "Couldn't find any films in that file — make sure it's a Letterboxd watched.csv or diary.csv export.",
      );
      return;
    }
    setLoading(true);
    setNotice(null);
    setProgress({ done: 0, total: parsed.length });

    // existingIds (from props) only covers this section's own media type
    // (movies) — a Letterboxd row that turns out to be a series needs its
    // own duplicate check against the Series library instead.
    let existingSeriesIds = new Set<string>();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase
        .from("items")
        .select("external_id")
        .eq("user_id", user.id)
        .eq("media_type", "series");
      existingSeriesIds = new Set((data ?? []).map((r) => r.external_id as string));
    }

    const results: PreviewRow[] = [];
    let idx = 0;
    const CONCURRENCY = 5;
    async function worker() {
      while (idx < parsed.length) {
        const i = idx++;
        const row = parsed[i];
        const match = await matchLetterboxdRow(row.title, row.year);
        if (match) {
          const { result, mediaType } = match;
          const input: ImportInput = {
            mediaType,
            externalId: result.externalId,
            title: result.title,
            coverUrl: result.coverUrl,
            releaseYear: result.year,
            genres: result.genres,
            meta: result.meta,
            status: "completed",
            startedAt: row.watchedDate,
            completedAt: row.watchedDate,
            rating: row.rating,
          };
          const alreadyInLibrary =
            mediaType === "series"
              ? existingSeriesIds.has(result.externalId)
              : existingIds.has(result.externalId);
          results.push({
            key: `${mediaType}:${result.externalId}`,
            title: result.title,
            year: result.year,
            coverUrl: result.coverUrl,
            subtitle:
              (mediaType === "series" ? "Series · " : "") +
              (row.watchedDate ? `Watched ${row.watchedDate}` : "Watched"),
            input,
            alreadyInLibrary,
            matched: true,
          });
        } else {
          results.push({
            key: `unmatched:${i}:${row.title}`,
            title: row.title,
            year: row.year,
            coverUrl: null,
            subtitle: "No match found",
            input: null,
            alreadyInLibrary: false,
            matched: false,
          });
        }
        setProgress({ done: i + 1, total: parsed.length });
      }
    }
    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, parsed.length) }, worker),
    );
    finishFetch(results, "No films found in that file.");
  }

  function toggle(key: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const selectableRows = rows?.filter((r) => r.matched && !r.alreadyInLibrary) ?? [];
  const allSelected = selectableRows.length > 0 && selectableRows.every((r) => checked.has(r.key));

  function toggleAll() {
    setChecked(allSelected ? new Set() : new Set(selectableRows.map((r) => r.key)));
  }

  async function handleImport() {
    if (!rows) return;
    const inputs = rows
      .filter((r) => checked.has(r.key) && r.input)
      .map((r) => r.input as ImportInput);
    if (inputs.length === 0) return;
    setImporting(true);
    const result = await bulkAdd(inputs);
    setImporting(false);
    if (result.error) {
      toast("error", result.error);
      return;
    }
    toast("success", `Imported ${result.added} title${result.added === 1 ? "" : "s"}.`);
    onClose();
  }

  const sourceLabel =
    section.mediaType === "game"
      ? "Steam"
      : section.mediaType === "anime"
        ? "MyAnimeList"
        : "Letterboxd";

  return (
    <Modal open={open} onClose={onClose} wide>
      <div className="p-6 sm:p-7">
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-serif text-xl font-semibold text-ink">
            Import from {sourceLabel}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="-m-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-ivory hover:text-ink"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>

        {!rows && (
          <div className="mt-4">
            {section.mediaType === "game" && (
              <div className="flex gap-2">
                <input
                  autoFocus
                  value={steamId}
                  onChange={(e) => setSteamId(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && fetchSteam()}
                  placeholder="Steam ID, vanity name, or profile URL"
                  className="w-full rounded-xl border border-line bg-paper px-3.5 py-2.5 text-[15px] text-ink placeholder:text-muted/70 transition-colors focus:border-line-strong"
                />
                <button
                  type="button"
                  onClick={fetchSteam}
                  disabled={loading || !steamId.trim()}
                  className="shrink-0 rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
                >
                  {loading ? <SpinnerIcon className="h-4 w-4 animate-spin" /> : "Fetch"}
                </button>
              </div>
            )}

            {section.mediaType === "anime" && (
              <div className="flex gap-2">
                <input
                  autoFocus
                  value={malUsername}
                  onChange={(e) => setMalUsername(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && fetchMal()}
                  placeholder="MyAnimeList username"
                  className="w-full rounded-xl border border-line bg-paper px-3.5 py-2.5 text-[15px] text-ink placeholder:text-muted/70 transition-colors focus:border-line-strong"
                />
                <button
                  type="button"
                  onClick={fetchMal}
                  disabled={loading || !malUsername.trim()}
                  className="shrink-0 rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
                >
                  {loading ? <SpinnerIcon className="h-4 w-4 animate-spin" /> : "Fetch"}
                </button>
              </div>
            )}

            {section.mediaType === "movie" && (
              <div>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={loading}
                  className="flex items-center gap-1.5 rounded-xl border border-line px-4 py-2.5 text-sm font-medium text-ink transition-colors hover:border-line-strong hover:bg-ivory disabled:opacity-50"
                >
                  {loading ? (
                    <SpinnerIcon className="h-4 w-4 animate-spin" />
                  ) : (
                    <UploadIcon className="h-4 w-4" />
                  )}
                  Choose Letterboxd export…
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={handleLetterboxdFile}
                />
                <p className="mt-2.5 text-xs leading-relaxed text-muted">
                  Export your data from Letterboxd (Settings → Import & Export) and upload{" "}
                  <code>watched.csv</code> or <code>diary.csv</code>.
                </p>
              </div>
            )}

            {loading && progress && (
              <p className="mt-3 text-sm text-muted">
                Matching {progress.done} of {progress.total}…
              </p>
            )}
            {notice && (
              <div className="mt-3 rounded-xl bg-accent-soft px-4 py-3 text-sm leading-relaxed text-accent-hover">
                {notice}
              </div>
            )}
          </div>
        )}

        {rows && (
          <>
            <div className="mt-4 flex items-center justify-between">
              <button
                type="button"
                onClick={toggleAll}
                className="text-sm font-medium text-accent transition-colors hover:text-accent-hover"
              >
                {allSelected ? "Deselect all" : "Select all"}
              </button>
              <p className="text-xs text-muted">{checked.size} selected</p>
            </div>

            <ul className="mt-2 max-h-[50vh] divide-y divide-line/70 overflow-y-auto">
              {rows.map((r) => {
                const disabled = !r.matched || r.alreadyInLibrary;
                const isChecked = checked.has(r.key);
                return (
                  <li key={r.key} className="flex items-center gap-3 px-1 py-2.5">
                    <button
                      type="button"
                      onClick={() => toggle(r.key)}
                      disabled={disabled}
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors ${
                        isChecked ? "border-accent bg-accent text-white" : "border-line"
                      } ${disabled ? "opacity-40" : ""}`}
                    >
                      {isChecked && <CheckIcon className="h-3 w-3" />}
                    </button>
                    <div className="relative h-14 w-10 shrink-0 overflow-hidden rounded-md bg-ivory">
                      <CoverImage src={r.coverUrl} title={r.title} sizes="40px" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-medium text-ink">
                        {r.title}
                        {r.year ? ` (${r.year})` : ""}
                      </p>
                      <p className="truncate text-xs text-muted">
                        {r.alreadyInLibrary
                          ? "Already in your library"
                          : !r.matched
                            ? "No match found — add it manually instead"
                            : r.subtitle}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>

            <div className="mt-5 flex items-center justify-between gap-3 border-t border-line pt-4">
              <button
                type="button"
                onClick={reset}
                className="text-sm font-medium text-muted transition-colors hover:text-ink"
              >
                Start over
              </button>
              <button
                type="button"
                onClick={handleImport}
                disabled={importing || checked.size === 0}
                className="rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
              >
                {importing ? "Importing…" : `Import ${checked.size}`}
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

/* ---------- Letterboxd CSV parsing + matching ---------- */

type LetterboxdRow = {
  title: string;
  year: number | null;
  watchedDate: string | null;
  rating: number | null;
};

/** Minimal RFC4180-ish CSV parser: handles quoted fields with embedded commas. */
function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (c === "\r") {
      // no-op — \n handles the row break
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

/** Reads either Letterboxd's watched.csv or diary.csv (Rating is optional). */
function parseLetterboxdCsv(text: string): LetterboxdRow[] {
  const rows = parseCsvRows(text);
  if (rows.length < 2) return [];
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const nameIdx = header.indexOf("name");
  const yearIdx = header.indexOf("year");
  const ratingIdx = header.indexOf("rating");
  // diary.csv has both "Date" (log date) and "Watched Date" (backdated entries) —
  // prefer the more precise one when both are present.
  const dateIdx = header.indexOf("watched date") !== -1
    ? header.indexOf("watched date")
    : header.indexOf("date");
  if (nameIdx === -1) return [];

  return rows
    .slice(1)
    .map((cols): LetterboxdRow | null => {
      const title = cols[nameIdx]?.trim();
      if (!title) return null;
      const year = yearIdx !== -1 ? Number(cols[yearIdx]) || null : null;
      const rating = ratingIdx !== -1 && cols[ratingIdx] ? Number(cols[ratingIdx]) || null : null;
      const watchedDate = dateIdx !== -1 ? cols[dateIdx]?.trim() || null : null;
      return { title, year, watchedDate, rating };
    })
    .filter((r): r is LetterboxdRow => r !== null);
}

function normTitle(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Only returns a confident match — an ambiguous title is left unmatched rather than guessed. */
async function searchAndMatch(
  type: "movie" | "series",
  title: string,
  year: number | null,
): Promise<SearchResult | null> {
  try {
    const res = await fetch(`/api/search?type=${type}&q=${encodeURIComponent(title)}`);
    if (!res.ok) return null;
    const data = await res.json();
    const results: SearchResult[] = data.results ?? [];
    if (results.length === 0) return null;
    const nt = normTitle(title);
    const exactYear = results.find(
      (r) => normTitle(r.title) === nt && (year == null || r.year === year),
    );
    if (exactYear) return exactYear;
    const exact = results.find((r) => normTitle(r.title) === nt);
    if (exact) return exact;
    if (year != null) {
      const yearMatch = results.find((r) => r.year === year);
      if (yearMatch) return yearMatch;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Letterboxd diaries aren't only films — Kdrama and other TV entries show up
 * there too. Try a film match first (the common case), and only fall back to
 * series search when nothing confident turns up.
 */
async function matchLetterboxdRow(
  title: string,
  year: number | null,
): Promise<{ result: SearchResult; mediaType: "movie" | "series" } | null> {
  const movie = await searchAndMatch("movie", title, year);
  if (movie) return { result: movie, mediaType: "movie" };
  const series = await searchAndMatch("series", title, year);
  if (series) return { result: series, mediaType: "series" };
  return null;
}

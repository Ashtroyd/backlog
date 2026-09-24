"use client";

import type { TasteMatch } from "@/lib/social";

export function TasteMatchCard({
  match,
  friendName,
}: {
  match: TasteMatch;
  friendName: string;
}) {
  if (match.sharedCount === 0) {
    return (
      <div className="rounded-2xl border border-line bg-surface p-5 text-sm text-muted">
        Nothing in common with {friendName} yet — once you both have some of the
        same titles, your taste match shows up here.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <div className="flex items-center gap-5">
        <div className="flex flex-col items-center">
          <span className="font-display text-4xl font-bold text-accent">
            {match.score != null ? `${match.score}%` : "—"}
          </span>
          <span className="text-xs text-muted">taste match</span>
        </div>
        <div className="text-sm leading-relaxed text-body">
          <p>
            <span className="font-medium text-ink">{match.sharedCount}</span>{" "}
            {match.sharedCount === 1 ? "title" : "titles"} in common
            {match.coRated > 0 && (
              <>
                , <span className="font-medium text-ink">{match.coRated}</span>{" "}
                rated by you both
              </>
            )}
            .
          </p>
          {match.score == null && (
            <p className="mt-1 text-muted">
              Rate some shared titles to see how aligned your taste is.
            </p>
          )}
        </div>
      </div>

      {(match.agreements.length > 0 || match.clashes.length > 0) && (
        <div className="mt-4 grid gap-4 border-t border-line pt-4 sm:grid-cols-2">
          {match.agreements.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-sage">
                You agree on
              </p>
              <ul className="space-y-1">
                {match.agreements.slice(0, 4).map((a) => (
                  <li key={a.title} className="truncate text-sm text-body">
                    {a.title}{" "}
                    <span className="text-muted">
                      · {a.mine}★ / {a.theirs}★
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {match.clashes.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-accent">
                You clash on
              </p>
              <ul className="space-y-1">
                {match.clashes.slice(0, 4).map((c) => (
                  <li key={c.title} className="truncate text-sm text-body">
                    {c.title}{" "}
                    <span className="text-muted">
                      · you {c.mine}★, {friendName.split(" ")[0]} {c.theirs}★
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

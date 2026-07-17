"use client";

import { useEffect } from "react";
import Link from "next/link";

/** Catches rendering errors anywhere under the authenticated app (sections,
 * friends, messages, profile) instead of taking down the whole page. */
export default function AppError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center py-24 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-ivory font-serif text-2xl text-accent">
        !
      </div>
      <h2 className="mt-5 font-serif text-xl font-semibold text-ink">
        Something went wrong
      </h2>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted">
        This page hit a snag. Try again, or head back to your games.
      </p>
      <div className="mt-6 flex items-center gap-3">
        <button
          type="button"
          onClick={() => unstable_retry()}
          className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
        >
          Try again
        </button>
        <Link
          href="/games"
          className="rounded-full border border-line px-4 py-2 text-sm font-medium text-ink transition-colors hover:border-line-strong hover:bg-ivory"
        >
          Go to Games
        </Link>
      </div>
    </div>
  );
}

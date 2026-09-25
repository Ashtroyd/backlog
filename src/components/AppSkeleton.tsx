import { OfflineBanner } from "./OfflineBanner";

/**
 * Placeholder app chrome for a cold start: sidebar or top bar, a large
 * title and a couple of shelves of grey cards. Server-rendered, so it shows
 * before any JavaScript runs; deliberately generic, as it doesn't yet know
 * which page it's standing in for.
 */
export function AppSkeleton() {
  return (
    <div aria-hidden>
      <div className="fixed inset-y-0 left-0 hidden w-60 border-r border-line bg-ivory/50 lg:block">
        <p className="px-5 pt-5 font-brand text-xl font-semibold tracking-tight text-ink">
          Backlog<span className="text-accent">.</span>
        </p>
        <div className="mt-6 animate-pulse space-y-2.5 px-5">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-4 rounded bg-ivory" style={{ width: `${60 + ((i * 17) % 30)}%` }} />
          ))}
        </div>
      </div>
      <div className="lg:pl-60">
        <div className="border-b border-line/70 pt-[env(safe-area-inset-top)] lg:hidden">
          <div className="mx-auto flex h-14 max-w-6xl items-center px-4 sm:h-16 sm:px-6">
            <p className="font-brand text-xl font-semibold tracking-tight text-ink">
              Backlog<span className="text-accent">.</span>
            </p>
            <div className="ml-auto h-8 w-8 animate-pulse rounded-full bg-ivory" />
          </div>
        </div>
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-10">
          <OfflineBanner />
          <div className="animate-pulse pt-10 sm:pt-12">
            <div className="h-3 w-32 rounded bg-ivory" />
            <div className="mt-2.5 h-9 w-48 rounded-lg bg-ivory" />
          </div>
          <SkeletonShelves />
        </div>
      </div>
      <div className="fixed inset-x-4 bottom-[calc(1.25rem+env(safe-area-inset-bottom))] mx-auto flex max-w-sm gap-2.5 sm:hidden">
        <div className="h-[3.75rem] flex-1 rounded-full border border-line/70 bg-surface/75 shadow-[0_16px_40px_rgba(0,0,0,0.18)]" />
        <div className="h-[3.75rem] w-[3.75rem] rounded-full border border-line/70 bg-surface/75 shadow-[0_16px_40px_rgba(0,0,0,0.18)]" />
      </div>
    </div>
  );
}

/** Two shelves of grey cards — also Up Next's first-visit placeholder. */
export function SkeletonShelves() {
  return (
    <div aria-hidden className="animate-pulse">
      {[0, 1].map((row) => (
        <div key={row} className="mt-10">
          <div className="h-5 w-28 rounded bg-ivory" />
          <div className="mt-4 flex gap-4 overflow-hidden">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="w-28 shrink-0 sm:w-32">
                <div className="aspect-[2/3] rounded-xl bg-ivory" />
                <div className="mt-2.5 h-3.5 w-4/5 rounded bg-ivory" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

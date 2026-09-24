"use client";

import { Source_Serif_4 } from "next/font/google";
import { themeScript } from "@/lib/theme-script";
import "./globals.css";

const serif = Source_Serif_4({
  variable: "--font-source-serif",
  subsets: ["latin"],
  weight: ["600"],
  display: "swap",
});


/**
 * Last-resort boundary for errors the (app) segment's own error.tsx can't
 * reach — e.g. AppShell itself throwing during auth/session setup, since
 * error.js never wraps the layout.js of its own segment. Replaces the root
 * layout entirely when active, so it needs its own html/body/fonts.
 */
export default function GlobalError({
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <html
      lang="en"
      data-theme="light"
      suppressHydrationWarning
      className={`${serif.variable} h-full`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full">
        <div className="flex min-h-full flex-col items-center justify-center px-4 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-ivory font-display text-2xl text-accent">
            !
          </div>
          <h1 className="mt-5 font-display text-2xl font-semibold text-ink">
            Something went wrong
          </h1>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted">
            Backlog hit a snag loading. Reloading usually fixes it.
          </p>
          <button
            type="button"
            onClick={() => unstable_retry()}
            className="mt-6 rounded-full bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}

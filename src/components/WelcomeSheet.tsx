"use client";

import { useEffect, useState } from "react";
import { onWelcomeOpen } from "@/lib/welcome-bus";
import { Modal } from "./Modal";
import { ChatIcon, LibraryIcon, SearchIcon, UpNextIcon } from "./icons";

const FEATURES = [
  {
    Icon: SearchIcon,
    title: "Add anything",
    body: "Search games, movies, series and anime. Covers and details fill themselves in — or import from Steam, Letterboxd or MyAnimeList.",
  },
  {
    Icon: LibraryIcon,
    title: "Track it at a glance",
    body: "Progress and status show right on the cover. Touch and hold (or right-click) a title for quick actions.",
  },
  {
    Icon: UpNextIcon,
    title: "Pick up where you left off",
    body: "Up Next keeps what you're in the middle of front and centre, with +1 episode a tap away.",
  },
  {
    Icon: ChatIcon,
    title: "Share it with friends",
    body: "Browse friends' shelves, compare ratings, and send recommendations they can add in one tap.",
  },
];

/**
 * A "What's New"-style welcome, in place of a spotlight tour: one sheet,
 * a few feature rows, one Continue button. Opened on first visit by
 * AppShell and any time from the account sheet.
 */
export function WelcomeSheet() {
  const [open, setOpen] = useState(false);
  useEffect(() => onWelcomeOpen(() => setOpen(true)), []);
  const close = () => setOpen(false);

  return (
    <Modal open={open} onClose={close} sheet>
      <div className="flex min-h-full flex-col px-7 pb-6 pt-12 sm:px-10 sm:pt-10">
        <h2 className="text-center font-display text-3xl font-bold leading-tight tracking-tight text-ink text-balance">
          Welcome to <span className="font-brand">Backlog<span className="text-accent">.</span></span>
        </h2>
        <ul className="mx-auto mt-10 max-w-sm space-y-7">
          {FEATURES.map(({ Icon, title, body }) => (
            <li key={title} className="flex gap-4">
              <Icon className="mt-0.5 h-8 w-8 shrink-0 text-accent" />
              <div>
                <p className="text-subhead font-semibold text-ink">{title}</p>
                <p className="mt-0.5 text-subhead leading-snug text-muted">{body}</p>
              </div>
            </li>
          ))}
        </ul>
        {/* Pinned to the bottom, as in Apple's welcome screens, so it's
            always in reach however tall the list runs. */}
        <div className="sticky bottom-0 -mx-7 mt-auto bg-gradient-to-t from-surface via-surface to-surface/0 px-7 pb-2 pt-8 sm:-mx-10 sm:px-10">
          <button
            type="button"
            onClick={close}
            className="mx-auto flex min-h-[3.25rem] w-full max-w-sm items-center justify-center rounded-2xl bg-accent text-base font-semibold text-white transition-colors hover:bg-accent-hover"
          >
            Continue
          </button>
        </div>
      </div>
    </Modal>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { useAuth } from "@/lib/backlog-store";
import { openCommandPalette } from "@/lib/command-palette-bus";
import { activeTab, useLibraryHref, type TabKey } from "@/lib/last-section";
import { useOpenAccount, useUnread } from "@/lib/nav-context";
import { NotificationCenter } from "./NotificationCenter";
import { Avatar } from "./Avatar";
import { SearchIcon } from "./icons";

/**
 * Top bar for phones and tablets (the sidebar takes over at lg). Phones get
 * just the wordmark, notifications and your avatar — the floating tab bar
 * handles navigation. Tablets also show the three tabs and search inline,
 * the way iPadOS moves the tab bar to the top.
 */
export default function Nav() {
  const pathname = usePathname();
  const { profile } = useAuth();
  const unread = useUnread();
  const openAccount = useOpenAccount();
  const libraryHref = useLibraryHref();
  const current = activeTab(pathname);

  const tabs: { key: TabKey; href: string; label: string; badge?: number }[] = [
    { key: "upnext", href: "/", label: "Up Next" },
    { key: "library", href: libraryHref, label: "Library" },
    { key: "friends", href: "/friends", label: "Friends", badge: unread },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-paper/80 pt-[env(safe-area-inset-top)] backdrop-blur-xl backdrop-saturate-150 lg:hidden">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-3 px-4 sm:h-16 sm:px-6">
        <Link
          href="/"
          className="shrink-0 font-brand text-xl font-semibold tracking-tight text-ink"
        >
          Backlog<span className="text-accent">.</span>
        </Link>

        <nav
          aria-label="Main"
          className="hidden flex-1 items-center justify-center sm:flex"
        >
          <div className="flex rounded-full bg-ivory p-1">
            {tabs.map((t) => {
              const active = current === t.key;
              return (
                <Link
                  key={t.key}
                  href={t.href}
                  aria-current={active ? "page" : undefined}
                  className={`relative flex min-h-9 items-center gap-1.5 rounded-full px-4 text-sm font-medium transition-colors ${
                    active ? "text-ink" : "text-muted hover:text-ink"
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="top-tab-thumb"
                      className="absolute inset-0 rounded-full bg-surface shadow-[0_1px_3px_rgba(0,0,0,0.12)]"
                      transition={{ type: "spring", duration: 0.45, bounce: 0.15 }}
                    />
                  )}
                  <span className="relative">{t.label}</span>
                  {!!t.badge && (
                    <span className="relative h-2 w-2 rounded-full bg-accent" />
                  )}
                </Link>
              );
            })}
          </div>
        </nav>

        <div className="ml-auto flex items-center gap-1 sm:ml-0">
          <button
            type="button"
            title="Search (⌘K)"
            aria-label="Search"
            onClick={() => openCommandPalette()}
            className="hidden h-11 w-11 items-center justify-center rounded-full text-muted transition-colors hover:bg-ivory hover:text-ink sm:flex"
          >
            <SearchIcon className="h-[18px] w-[18px]" />
          </button>
          <NotificationCenter />
          {profile && (
            <button
              type="button"
              onClick={openAccount}
              title="Account"
              aria-label="Account"
              className={`flex h-11 w-11 items-center justify-center rounded-full transition-opacity hover:opacity-80`}
            >
              <span
                className={`rounded-full ${
                  pathname === "/profile"
                    ? "ring-2 ring-accent ring-offset-2 ring-offset-paper"
                    : ""
                }`}
              >
                <Avatar profile={profile} size={32} />
              </span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

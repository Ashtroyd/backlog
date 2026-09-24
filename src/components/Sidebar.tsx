"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/backlog-store";
import { openCommandPalette } from "@/lib/command-palette-bus";
import { SECTION_SLUGS, SECTIONS } from "@/lib/sections";
import { useOpenAccount, useUnread } from "@/lib/nav-context";
import { Avatar } from "./Avatar";
import { NotificationCenter } from "./NotificationCenter";
import {
  ChatIcon,
  FilmIcon,
  GamepadIcon,
  SearchIcon,
  SharedIcon,
  SparklesIcon,
  TvIcon,
  UpNextIcon,
  UsersIcon,
} from "./icons";

const SECTION_ICONS = {
  games: GamepadIcon,
  movies: FilmIcon,
  series: TvIcon,
  anime: SparklesIcon,
} as const;

function Item({
  href,
  label,
  Icon,
  active,
  badge,
}: {
  href: string;
  label: string;
  Icon: typeof UsersIcon;
  active: boolean;
  badge?: number;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`flex min-h-9 items-center gap-2.5 rounded-lg px-2.5 text-sm transition-colors ${
        active
          ? "bg-accent font-medium text-white"
          : "text-ink hover:bg-line/60"
      }`}
    >
      <Icon className={`h-[18px] w-[18px] ${active ? "" : "text-accent"}`} />
      <span className="flex-1">{label}</span>
      {!!badge && (
        <span
          className={`text-footnote font-semibold tabular-nums ${
            active ? "text-white/85" : "text-accent"
          }`}
        >
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </Link>
  );
}

function Heading({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-1 mt-5 px-2.5 text-caption2 font-semibold text-muted">
      {children}
    </p>
  );
}

/**
 * Desktop navigation (lg and up), in the shape of the Music and TV sidebars
 * on the Mac: search, Up Next, the Library grouped by type, Friends grouped
 * by People / Messages / Shared, and your account pinned to the bottom.
 */
export function Sidebar() {
  const pathname = usePathname();
  const { profile } = useAuth();
  const unread = useUnread();
  const openAccount = useOpenAccount();
  const on = (href: string) =>
    href === "/"
      ? pathname === "/"
      : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-line bg-ivory/50 backdrop-blur-xl lg:flex">
      <div className="flex h-16 shrink-0 items-center justify-between pl-5 pr-2">
        <Link
          href="/"
          className="font-brand text-xl font-semibold tracking-tight text-ink"
        >
          Backlog<span className="text-accent">.</span>
        </Link>
        <NotificationCenter align="left" />
      </div>

      <div className="px-3">
        <button
          type="button"
          onClick={() => openCommandPalette()}
          className="flex min-h-9 w-full items-center gap-2 rounded-lg bg-line/60 px-2.5 text-sm text-muted transition-colors hover:bg-line"
        >
          <SearchIcon className="h-4 w-4" />
          <span className="flex-1 text-left">Search</span>
          <kbd className="font-sans text-footnote">⌘K</kbd>
        </button>
      </div>

      <nav aria-label="Main" className="flex-1 overflow-y-auto px-3 pb-4 pt-3">
        <Item href="/" label="Up Next" Icon={UpNextIcon} active={on("/")} />

        <Heading>Library</Heading>
        <div className="space-y-0.5">
          {SECTION_SLUGS.map((slug) => (
            <Item
              key={slug}
              href={`/${slug}`}
              label={SECTIONS[slug].label}
              Icon={SECTION_ICONS[slug]}
              active={on(`/${slug}`)}
            />
          ))}
        </div>

        <Heading>Friends</Heading>
        <div className="space-y-0.5">
          <Item href="/friends" label="People" Icon={UsersIcon} active={on("/friends")} />
          <Item
            href="/messages"
            label="Messages"
            Icon={ChatIcon}
            active={on("/messages")}
            badge={unread}
          />
          <Item href="/shared" label="Shared" Icon={SharedIcon} active={on("/shared")} />
        </div>
      </nav>

      {profile && (
        <div className="shrink-0 border-t border-line p-3">
          <button
            type="button"
            onClick={openAccount}
            className="flex min-h-11 w-full items-center gap-2.5 rounded-lg px-2 text-left transition-colors hover:bg-line/60"
          >
            <Avatar profile={profile} size={28} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-ink">
                {profile.display_name}
              </span>
              <span className="block truncate text-caption2 text-muted">
                Account & Settings
              </span>
            </span>
          </button>
        </div>
      )}
    </aside>
  );
}

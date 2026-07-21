"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SECTION_SLUGS, SECTIONS } from "@/lib/sections";
import { HomeIcon, GamepadIcon, FilmIcon, TvIcon, SparklesIcon } from "./icons";

const SECTION_ICONS = {
  games: GamepadIcon,
  movies: FilmIcon,
  series: TvIcon,
  anime: SparklesIcon,
} as const;

const ITEMS = [
  { href: "/", label: "Home", Icon: HomeIcon },
  ...SECTION_SLUGS.map((slug) => ({
    href: `/${slug}`,
    label: SECTIONS[slug].label,
    Icon: SECTION_ICONS[slug],
  })),
];

/** Mobile-only floating glass capsule tab bar. */
export function BottomNav() {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <nav
      className="fixed inset-x-4 z-30 sm:hidden"
      style={{ bottom: "calc(1.25rem + env(safe-area-inset-bottom))" }}
    >
      <div className="mx-auto flex max-w-sm items-stretch justify-around rounded-full border border-line/70 bg-surface/75 px-1.5 py-1.5 shadow-[0_16px_40px_rgba(0,0,0,0.28)] backdrop-blur-xl backdrop-saturate-150">
        {ITEMS.map(({ href, label, Icon }) => (
          <Link
            key={href}
            href={href}
            aria-label={label}
            className={`relative flex flex-1 flex-col items-center justify-center gap-0.5 rounded-full py-2 text-[10px] font-medium transition-colors active:bg-ivory/70 ${
              isActive(href) ? "text-accent" : "text-muted"
            }`}
          >
            <Icon className="h-[22px] w-[22px]" />
            {label}
          </Link>
        ))}
      </div>
    </nav>
  );
}

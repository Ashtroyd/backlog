"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { THEME_KEY } from "@/lib/theme-script";
import { useIsClient } from "@/lib/use-is-client";
import { AutoThemeIcon, MoonIcon, SunIcon } from "./icons";

type Appearance = "system" | "light" | "dark";

const OPTIONS: { value: Appearance; label: string }[] = [
  { value: "system", label: "Automatic" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

const ICONS = { system: AutoThemeIcon, light: SunIcon, dark: MoonIcon };

function readAppearance(): Appearance {
  try {
    const t = localStorage.getItem(THEME_KEY);
    return t === "light" || t === "dark" ? t : "system";
  } catch {
    return "system";
  }
}

function applyAppearance(next: Appearance) {
  try {
    if (next === "system") localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, next);
  } catch {
    // ignore — storage may be unavailable
  }
  // The pre-paint script in the root layout exposes its resolver, which also
  // handles "system" by reading the OS preference.
  const w = window as unknown as { __applyTheme?: () => void };
  if (w.__applyTheme) w.__applyTheme();
  else
    document.documentElement.setAttribute(
      "data-theme",
      next === "system"
        ? window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light"
        : next,
    );
}

/**
 * Appearance control: Automatic (follows the OS), Light or Dark — the same
 * three choices as iOS/macOS. "icon" cycles through them from the nav bar;
 * "row" shows a labelled segmented control inside a menu.
 */
export function ThemeToggle({
  variant = "icon",
  onToggled,
}: {
  variant?: "icon" | "row";
  onToggled?: () => void;
} = {}) {
  // "system" matches the SSR render; the stored choice takes over once
  // hydrated, and a pick made here wins after that.
  const isClient = useIsClient();
  const [picked, setAppearance] = useState<Appearance | null>(null);
  const appearance = picked ?? (isClient ? readAppearance() : "system");

  function choose(next: Appearance) {
    setAppearance(next);
    applyAppearance(next);
    onToggled?.();
  }

  const label = OPTIONS.find((o) => o.value === appearance)!.label;

  if (variant === "row") {
    return (
      <div className="px-3 py-2">
        <p className="mb-1.5 text-footnote text-muted">Appearance</p>
        <div
          role="radiogroup"
          aria-label="Appearance"
          className="flex rounded-lg bg-ivory p-0.5"
        >
          {OPTIONS.map((o) => {
            const active = appearance === o.value;
            return (
              <button
                key={o.value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => choose(o.value)}
                className={`min-h-9 flex-1 rounded-md text-footnote font-medium transition-colors ${
                  active
                    ? "bg-surface text-ink shadow-[0_1px_3px_rgba(0,0,0,0.12)]"
                    : "text-muted hover:text-ink"
                }`}
              >
                {o.label}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  const next =
    OPTIONS[(OPTIONS.findIndex((o) => o.value === appearance) + 1) % 3];
  const Icon = ICONS[appearance];

  return (
    <button
      type="button"
      onClick={() => choose(next.value)}
      title={`Appearance: ${label} — switch to ${next.label}`}
      aria-label={`Appearance: ${label}. Switch to ${next.label}`}
      className="relative flex h-11 w-11 items-center justify-center rounded-full text-muted transition-colors hover:bg-ivory hover:text-ink"
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={appearance}
          initial={{ opacity: 0, rotate: -90, scale: 0.5 }}
          animate={{ opacity: 1, rotate: 0, scale: 1 }}
          exit={{ opacity: 0, rotate: 90, scale: 0.5 }}
          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="absolute flex items-center justify-center"
        >
          <Icon className="h-[18px] w-[18px]" />
        </motion.span>
      </AnimatePresence>
    </button>
  );
}

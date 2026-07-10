"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { MoonIcon, SunIcon } from "./icons";

const THEME_KEY = "backlog:theme";
type Theme = "light" | "dark";

/**
 * Dark-mode toggle. The pre-paint script in the root layout sets
 * `data-theme` before React runs; here we read it back on mount, then flip
 * both the attribute and the persisted preference on click.
 */
export function ThemeToggle({
  variant = "icon",
  onToggled,
}: {
  /** "icon" for the nav bar, "row" for a labelled item inside a menu. */
  variant?: "icon" | "row";
  onToggled?: () => void;
} = {}) {
  // Default "light" matches the SSR/first-client render, so no hydration
  // mismatch; the real value is read from the DOM once mounted.
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const current = document.documentElement.getAttribute("data-theme");
    if (current === "dark" || current === "light") setTheme(current);
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      // ignore — storage may be unavailable
    }
    onToggled?.();
  }

  const isDark = theme === "dark";

  if (variant === "row") {
    return (
      <button
        type="button"
        onClick={toggle}
        className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-body transition-colors hover:bg-ivory hover:text-ink"
      >
        {isDark ? (
          <SunIcon className="h-4 w-4 text-muted" />
        ) : (
          <MoonIcon className="h-4 w-4 text-muted" />
        )}
        {isDark ? "Light mode" : "Dark mode"}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      aria-label="Toggle dark mode"
      className="relative flex h-9 w-9 items-center justify-center rounded-full text-muted transition-colors hover:bg-ivory hover:text-ink"
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={theme}
          initial={{ opacity: 0, rotate: -90, scale: 0.5 }}
          animate={{ opacity: 1, rotate: 0, scale: 1 }}
          exit={{ opacity: 0, rotate: 90, scale: 0.5 }}
          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="absolute flex items-center justify-center"
        >
          {isDark ? (
            <MoonIcon className="h-[18px] w-[18px]" />
          ) : (
            <SunIcon className="h-[18px] w-[18px]" />
          )}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}

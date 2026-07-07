"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { SECTIONS, SECTION_SLUGS } from "@/lib/sections";
import { exportBacklog, importBacklog } from "@/lib/backlog-store";
import { ArchiveIcon, DownloadIcon, UploadIcon } from "./icons";

export default function Nav() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (!confirm("Importing replaces your current library. Continue?")) return;
      const result = importBacklog(String(reader.result));
      if ("error" in result) {
        alert(result.error);
      } else {
        window.location.reload();
      }
    };
    reader.readAsText(file);
    setMenuOpen(false);
  }

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-4 px-6 sm:gap-6">
        <Link
          href="/games"
          className="font-serif text-xl font-semibold tracking-tight text-ink"
        >
          Backlog<span className="text-accent">.</span>
        </Link>

        <nav className="flex flex-1 items-center gap-1 overflow-x-auto">
          {SECTION_SLUGS.map((slug) => {
            const active =
              pathname === `/${slug}` || pathname.startsWith(`/${slug}/`);
            return (
              <Link
                key={slug}
                href={`/${slug}`}
                className={`relative shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                  active ? "text-ink" : "text-muted hover:text-ink"
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="nav-pill"
                    className="absolute inset-0 rounded-full bg-ivory"
                    transition={{ type: "spring", duration: 0.5, bounce: 0.2 }}
                  />
                )}
                <span className="relative">{SECTIONS[slug].label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="relative">
          <button
            type="button"
            title="Backup"
            onClick={() => setMenuOpen((v) => !v)}
            className={`flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-ivory hover:text-ink ${
              menuOpen ? "bg-ivory text-ink" : "text-muted"
            }`}
          >
            <ArchiveIcon className="h-[18px] w-[18px]" />
          </button>

          <AnimatePresence>
            {menuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setMenuOpen(false)}
                />
                <motion.div
                  initial={{ opacity: 0, y: -6, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.97 }}
                  transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }}
                  className="absolute right-0 top-11 z-50 w-52 rounded-xl border border-line bg-surface p-1.5 shadow-[0_12px_32px_rgba(38,37,33,0.14)]"
                >
                  <button
                    type="button"
                    onClick={() => {
                      exportBacklog();
                      setMenuOpen(false);
                    }}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-body transition-colors hover:bg-ivory hover:text-ink"
                  >
                    <DownloadIcon className="h-4 w-4 text-muted" />
                    Export backup
                  </button>
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-body transition-colors hover:bg-ivory hover:text-ink"
                  >
                    <UploadIcon className="h-4 w-4 text-muted" />
                    Import backup
                  </button>
                </motion.div>
              </>
            )}
          </AnimatePresence>

          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={handleImportFile}
          />
        </div>
      </div>
    </header>
  );
}

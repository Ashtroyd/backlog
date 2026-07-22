"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { SECTIONS, SECTION_SLUGS } from "@/lib/sections";
import { exportBacklog, importBacklog, useAuth } from "@/lib/backlog-store";
import { fetchUnreadMessageCount } from "@/lib/messages";
import { supabase } from "@/lib/supabase";
import { startTour } from "@/lib/tour-bus";
import { useDismissableMenu } from "@/lib/use-dismissable-menu";
import { ThemeToggle } from "./ThemeToggle";
import { NotificationCenter } from "./NotificationCenter";
import { Avatar } from "./Avatar";
import { useConfirm } from "./ConfirmDialog";
import { toast } from "@/lib/toast-bus";
import {
  ArchiveIcon,
  ChatIcon,
  CompassIcon,
  DownloadIcon,
  LogoutIcon,
  MenuIcon,
  SharedIcon,
  UploadIcon,
  UsersIcon,
} from "./icons";

const iconButton =
  "flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-ivory hover:text-ink";

function Badge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold text-white">
      {count > 9 ? "9+" : count}
    </span>
  );
}

export default function Nav() {
  const pathname = usePathname();
  const { session, profile } = useAuth();
  const myId = session?.user?.id ?? null;

  const friendsActive = pathname === "/friends" || pathname.startsWith("/friends/");
  const messagesActive =
    pathname === "/messages" || pathname.startsWith("/messages/");
  const sharedActive = pathname === "/shared" || pathname.startsWith("/shared/");

  const [unreadMsgs, setUnreadMsgs] = useState(0);
  const [backupOpen, setBackupOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const confirm = useConfirm();

  useDismissableMenu(backupOpen, () => setBackupOpen(false));
  useDismissableMenu(mobileOpen, () => setMobileOpen(false));

  // Unread badge: realtime when the messages table is in the publication
  // (migration 0007), with a slow poll as fallback either way.
  useEffect(() => {
    if (!myId) return;
    let alive = true;
    const tick = () =>
      fetchUnreadMessageCount(myId)
        .then((n) => alive && setUnreadMsgs(n))
        .catch(() => {});
    tick();
    const t = setInterval(tick, 60000);
    const channel = supabase
      .channel(`msg-badge-${myId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
          filter: `recipient_id=eq.${myId}`,
        },
        tick,
      )
      .subscribe();
    return () => {
      alive = false;
      clearInterval(t);
      supabase.removeChannel(channel);
    };
  }, [myId]);

  // Refresh the badge on navigation too (e.g. after reading a thread).
  useEffect(() => {
    if (!myId) return;
    fetchUnreadMessageCount(myId).then(setUnreadMsgs).catch(() => {});
  }, [pathname, myId]);

  // Close the sheet whenever we navigate.
  useEffect(() => {
    setMobileOpen(false);
    setBackupOpen(false);
  }, [pathname]);

  function handleTakeTour() {
    setBackupOpen(false);
    setMobileOpen(false);
    // The tour spotlights elements on the current page — give the menu's
    // close animation a moment to clear before measuring positions.
    setTimeout(() => startTour(), 200);
  }

  async function handleExport() {
    setBackupOpen(false);
    setMobileOpen(false);
    try {
      await exportBacklog();
      toast("success", "Backup downloaded.");
    } catch {
      toast("error", "Export failed — check your connection.");
    }
  }

  function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !session) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const ok = await confirm({
        title: "Import backup?",
        message:
          "This replaces your entire library with the file's contents. Your current items will be gone.",
        confirmLabel: "Import",
        danger: true,
      });
      if (!ok) return;
      const result = await importBacklog(String(reader.result), session.user.id);
      if ("error" in result) toast("error", result.error);
      else window.location.reload();
    };
    reader.readAsText(file);
    setBackupOpen(false);
    setMobileOpen(false);
  }

  const menuItem =
    "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-body transition-colors hover:bg-ivory hover:text-ink";

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper/85 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-2.5 sm:h-16 sm:flex-nowrap sm:gap-x-4 sm:gap-y-0 sm:px-6 sm:py-0">
        <Link
          href="/"
          className="order-1 shrink-0 font-serif text-xl font-semibold tracking-tight text-ink"
        >
          Backlog<span className="text-accent">.</span>
        </Link>

        {/* Controls: full icon row on desktop, bell + hamburger on mobile. */}
        <div className="order-2 ml-auto flex items-center gap-1 sm:order-3 sm:ml-0">
          <Link
            href="/friends"
            title="Friends"
            aria-label="Friends"
            className={`hidden sm:flex ${iconButton} ${
              friendsActive ? "bg-ivory text-ink" : "text-muted"
            }`}
          >
            <UsersIcon className="h-[18px] w-[18px]" />
          </Link>

          <Link
            href="/messages"
            title="Messages"
            aria-label="Messages"
            className={`relative hidden sm:flex ${iconButton} ${
              messagesActive ? "bg-ivory text-ink" : "text-muted"
            }`}
          >
            <ChatIcon className="h-[18px] w-[18px]" />
            <Badge count={unreadMsgs} />
          </Link>

          <Link
            href="/shared"
            title="Shared backlog"
            aria-label="Shared backlog"
            className={`hidden sm:flex ${iconButton} ${
              sharedActive ? "bg-ivory text-ink" : "text-muted"
            }`}
          >
            <SharedIcon className="h-[18px] w-[18px]" />
          </Link>

          <NotificationCenter />

          <span className="hidden sm:block">
            <ThemeToggle />
          </span>

          <div className="relative hidden sm:block">
            <button
              type="button"
              title="Backup"
              aria-label="Backup"
              onClick={() => setBackupOpen((v) => !v)}
              className={`${iconButton} ${backupOpen ? "bg-ivory text-ink" : "text-muted"}`}
            >
              <ArchiveIcon className="h-[18px] w-[18px]" />
            </button>

            {/* The backdrop sits outside AnimatePresence: a Fragment child
                can't be tracked for exit, which strands it (and its
                pointer-events) over the page after a route change. */}
            {backupOpen && (
              <div
                className="fixed inset-0 z-40"
                onClick={() => setBackupOpen(false)}
              />
            )}
            <AnimatePresence>
              {backupOpen && (
                <motion.div
                  key="backup-menu"
                  initial={{ opacity: 0, y: -6, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.97 }}
                  transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }}
                  className="absolute right-0 top-11 z-50 w-52 rounded-xl border border-line bg-surface p-1.5 shadow-[0_12px_32px_rgba(38,37,33,0.14)]"
                >
                  <button type="button" onClick={handleTakeTour} className={menuItem}>
                    <CompassIcon className="h-4 w-4 text-muted" />
                    Take a tour
                  </button>
                  <div className="my-1 h-px bg-line" />
                  <button type="button" onClick={handleExport} className={menuItem}>
                    <DownloadIcon className="h-4 w-4 text-muted" />
                    Export backup
                  </button>
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className={menuItem}
                  >
                    <UploadIcon className="h-4 w-4 text-muted" />
                    Import backup
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {profile && (
            <Link
              href="/profile"
              title="Your profile"
              className={`hidden shrink-0 rounded-full transition-opacity hover:opacity-80 sm:block ${
                pathname === "/profile"
                  ? "ring-2 ring-accent ring-offset-2 ring-offset-paper"
                  : ""
              }`}
            >
              <Avatar profile={profile} size={30} />
            </Link>
          )}

          <button
            type="button"
            title={`Sign out${session ? ` (${session.user.email})` : ""}`}
            aria-label="Sign out"
            onClick={() => supabase.auth.signOut()}
            className={`hidden sm:flex ${iconButton} text-muted`}
          >
            <LogoutIcon className="h-[18px] w-[18px]" />
          </button>

          {/* Everything above, folded into one menu on small screens. */}
          <div className="relative sm:hidden">
            <button
              type="button"
              aria-label="Menu"
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen((v) => !v)}
              className={`relative ${iconButton} ${
                mobileOpen ? "bg-ivory text-ink" : "text-muted"
              }`}
            >
              <MenuIcon className="h-5 w-5" />
              {!mobileOpen && unreadMsgs > 0 && (
                <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-accent" />
              )}
            </button>

            {mobileOpen && (
              <div
                className="fixed inset-0 z-40"
                onClick={() => setMobileOpen(false)}
              />
            )}
            <AnimatePresence>
              {mobileOpen && (
                  <motion.div
                    key="mobile-menu"
                    initial={{ opacity: 0, y: -6, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.97 }}
                    transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }}
                    className="absolute right-0 top-11 z-50 w-60 rounded-xl border border-line bg-surface p-1.5 shadow-[0_12px_32px_rgba(38,37,33,0.16)]"
                  >
                    {profile && (
                      <>
                        <Link href="/profile" className={`${menuItem} py-2.5`}>
                          <Avatar profile={profile} size={32} />
                          <span className="min-w-0">
                            <span className="block truncate font-medium text-ink">
                              {profile.display_name}
                            </span>
                            <span className="block truncate text-xs text-muted">
                              @{profile.username}
                            </span>
                          </span>
                        </Link>
                        <div className="my-1 h-px bg-line" />
                      </>
                    )}

                    <Link href="/friends" className={menuItem}>
                      <UsersIcon className="h-4 w-4 text-muted" />
                      Friends
                    </Link>
                    <Link href="/messages" className={menuItem}>
                      <ChatIcon className="h-4 w-4 text-muted" />
                      Messages
                      {unreadMsgs > 0 && (
                        <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-[11px] font-semibold text-white">
                          {unreadMsgs > 9 ? "9+" : unreadMsgs}
                        </span>
                      )}
                    </Link>

                    <div className="my-1 h-px bg-line" />

                    <ThemeToggle variant="row" onToggled={() => setMobileOpen(false)} />
                    <button type="button" onClick={handleTakeTour} className={menuItem}>
                      <CompassIcon className="h-4 w-4 text-muted" />
                      Take a tour
                    </button>
                    <button type="button" onClick={handleExport} className={menuItem}>
                      <DownloadIcon className="h-4 w-4 text-muted" />
                      Export backup
                    </button>
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      className={menuItem}
                    >
                      <UploadIcon className="h-4 w-4 text-muted" />
                      Import backup
                    </button>

                    <div className="my-1 h-px bg-line" />

                    <button
                      type="button"
                      onClick={() => supabase.auth.signOut()}
                      className={menuItem}
                    >
                      <LogoutIcon className="h-4 w-4 text-muted" />
                      Sign out
                    </button>
                  </motion.div>
              )}
            </AnimatePresence>
          </div>

          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={handleImportFile}
          />
        </div>

        {/* Section tabs: own row on mobile, inline on desktop. */}
        <nav className="order-3 hidden w-full items-center justify-between sm:order-2 sm:flex sm:w-auto sm:flex-1 sm:justify-start sm:gap-1">
          {SECTION_SLUGS.map((slug) => {
            const active =
              pathname === `/${slug}` || pathname.startsWith(`/${slug}/`);
            return (
              <Link
                key={slug}
                href={`/${slug}`}
                className={`relative shrink-0 rounded-full px-3 py-1.5 text-sm font-medium transition-colors sm:px-3.5 ${
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
      </div>
    </header>
  );
}

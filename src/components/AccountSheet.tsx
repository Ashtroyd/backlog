"use client";

import Link from "next/link";
import { useRef } from "react";
import { exportBacklog, importBacklog, useAuth } from "@/lib/backlog-store";
import { supabase } from "@/lib/supabase";
import { openWelcome } from "@/lib/welcome-bus";
import { toast } from "@/lib/toast-bus";
import { Avatar } from "./Avatar";
import { useConfirm } from "./ConfirmDialog";
import { Modal } from "./Modal";
import { ThemeToggle } from "./ThemeToggle";
import {
  ChevronRightIcon,
  CompassIcon,
  DownloadIcon,
  UploadIcon,
  XIcon,
} from "./icons";

const row =
  "flex min-h-11 w-full items-center gap-3 px-4 text-left text-subhead text-ink transition-colors hover:bg-ivory";

/**
 * Everything account-level in one place, like the account sheet behind the
 * avatar in the App Store and Music: profile, appearance, backups, help, and
 * Sign Out at the bottom — confirmed, never one stray click away.
 */
export function AccountSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { session, profile } = useAuth();
  const confirm = useConfirm();
  const fileRef = useRef<HTMLInputElement>(null);

  function handleWelcome() {
    onClose();
    // Let this sheet slide away before the welcome sheet rises.
    setTimeout(() => openWelcome(), 300);
  }

  async function handleExport() {
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
  }

  async function handleSignOut() {
    const ok = await confirm({
      title: "Sign out?",
      message: "Your library stays saved to your account.",
      confirmLabel: "Sign Out",
      danger: true,
    });
    if (ok) await supabase.auth.signOut();
  }

  return (
    <Modal open={open} onClose={onClose} sheet>
      <div className="p-5 sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl font-bold tracking-tight text-ink">
            Account
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Done"
            className="-m-2.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-ivory hover:text-ink"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>

        <div className="overflow-hidden rounded-xl bg-ivory/60">
          {profile && (
            <Link
              href="/profile"
              onClick={onClose}
              className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-ivory"
            >
              <Avatar profile={profile} size={48} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-base font-semibold text-ink">
                  {profile.display_name}
                </span>
                <span className="block truncate text-footnote text-muted">
                  @{profile.username}
                  {session?.user.email ? ` · ${session.user.email}` : ""}
                </span>
              </span>
              <ChevronRightIcon className="h-4 w-4 shrink-0 text-muted" />
            </Link>
          )}
        </div>

        <div className="mt-4 overflow-hidden rounded-xl bg-ivory/60 py-1">
          <ThemeToggle variant="row" />
        </div>

        <div className="mt-4 divide-y divide-line overflow-hidden rounded-xl bg-ivory/60">
          <button type="button" onClick={handleExport} className={row}>
            <DownloadIcon className="h-[18px] w-[18px] text-accent" />
            Export Backup
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className={row}
          >
            <UploadIcon className="h-[18px] w-[18px] text-accent" />
            Import Backup
          </button>
          <button type="button" onClick={handleWelcome} className={row}>
            <CompassIcon className="h-[18px] w-[18px] text-accent" />
            What&apos;s in Backlog
          </button>
        </div>

        <div className="mt-4 overflow-hidden rounded-xl bg-ivory/60">
          <button
            type="button"
            onClick={handleSignOut}
            className="flex min-h-11 w-full items-center justify-center px-4 text-subhead font-medium text-danger transition-colors hover:bg-ivory"
          >
            Sign Out
          </button>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={handleImportFile}
        />
      </div>
    </Modal>
  );
}

"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { createProfile, normalizeUsername } from "@/lib/social";
import type { Profile } from "@/lib/types";
import { supabase } from "@/lib/supabase";
import { ThemeToggle } from "./ThemeToggle";
import { Avatar } from "./Avatar";
import { SpinnerIcon } from "./icons";

/** Shown once, right after signup: claim a handle + display name. */
export function Onboarding({
  userId,
  onDone,
}: {
  userId: string;
  onDone: (p: Profile) => void;
}) {
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const handle = normalizeUsername(username);
  const preview = {
    username: handle || "you",
    display_name: displayName.trim() || handle || "you",
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const { error: err, profile } = await createProfile(
      userId,
      username,
      displayName,
    );
    setPending(false);
    if (err) setError(err);
    else if (profile) onDone(profile);
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-16">
      <div className="fixed right-4 top-4">
        <ThemeToggle />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-sm rounded-2xl border border-line bg-surface p-8 shadow-[0_2px_12px_rgba(38,37,33,0.05)]"
      >
        <div className="flex items-center gap-3">
          <Avatar profile={preview} size={48} />
          <div className="min-w-0">
            <p className="truncate font-display text-lg font-semibold text-ink">
              {preview.display_name}
            </p>
            <p className="truncate text-sm text-muted">@{preview.username}</p>
          </div>
        </div>

        <h1 className="mt-6 font-display text-2xl font-semibold tracking-tight text-ink">
          Set up your profile
        </h1>
        <p className="mt-1.5 text-sm text-muted">
          This is how friends find and recognise you.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="displayName" className="mb-1.5 block text-sm font-medium text-ink">
              Display name
            </label>
            <input
              id="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={40}
              required
              className="w-full rounded-xl border border-line bg-paper px-3.5 py-2.5 text-subhead text-ink placeholder:text-muted/70 transition-colors focus:border-line-strong"
              placeholder="Your name"
            />
          </div>
          <div>
            <label htmlFor="username" className="mb-1.5 block text-sm font-medium text-ink">
              Handle
            </label>
            <div className="flex items-center rounded-xl border border-line bg-paper pl-3.5 transition-colors focus-within:border-line-strong">
              <span className="text-subhead text-muted">@</span>
              <input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoCapitalize="none"
                autoCorrect="off"
                className="w-full bg-transparent px-1 py-2.5 text-subhead text-ink placeholder:text-muted/70 focus:outline-none"
                placeholder="handle"
              />
            </div>
            <p className="mt-1.5 text-xs text-muted">
              3–20 characters: lowercase letters, numbers or underscores.
            </p>
          </div>

          {error && (
            <p className="rounded-xl bg-accent-soft px-3.5 py-2.5 text-sm text-accent-hover">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-subhead font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-60"
          >
            {pending && <SpinnerIcon className="h-4 w-4 animate-spin" />}
            Continue
          </button>
        </form>

        <button
          type="button"
          onClick={() => supabase.auth.signOut()}
          className="mt-4 w-full text-center text-sm text-muted transition-colors hover:text-ink"
        >
          Sign out
        </button>
      </motion.div>
    </main>
  );
}

"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { supabase } from "@/lib/supabase";
import { ThemeToggle } from "./ThemeToggle";
import {
  ChatIcon,
  SearchIcon,
  SpinnerIcon,
  StarIcon,
  UsersIcon,
} from "./icons";

const FEATURES = [
  {
    icon: SearchIcon,
    text: "Search any game, movie, series or anime — covers and details fill themselves in.",
  },
  {
    icon: StarIcon,
    text: "Track what's next, what you're playing or watching, and rate what you finish.",
  },
  {
    icon: UsersIcon,
    text: "Add friends to browse their shelves, compare taste, and comment on reviews.",
  },
  {
    icon: ChatIcon,
    text: "Send recommendations straight to a friend as a tap-to-add card.",
  },
];

/** Landing for signed-out visitors: what Backlog is, plus the login card. */
export function AuthScreen() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      if (mode === "login") {
        const { error: err } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (err) setError(err.message);
        // Success: the auth listener swaps in the app.
      } else {
        const { data, error: err } = await supabase.auth.signUp({
          email,
          password,
        });
        if (err) setError(err.message);
        else if (!data.session) {
          setMessage("Check your inbox to confirm your email, then log in.");
        }
      }
    } finally {
      setPending(false);
    }
  }

  function switchMode(next: "login" | "signup") {
    setMode(next);
    setError(null);
    setMessage(null);
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="fixed right-4 top-4">
        <ThemeToggle />
      </div>

      <div className="grid w-full max-w-5xl items-center gap-10 lg:grid-cols-[1fr_24rem] lg:gap-16">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="text-center lg:text-left"
        >
          <p className="font-serif text-2xl font-semibold tracking-tight text-ink">
            Backlog<span className="text-accent">.</span>
          </p>
          <h1 className="mt-4 font-serif text-4xl font-semibold leading-tight tracking-tight text-ink sm:text-5xl">
            Every game, film and show you{" "}
            <span className="text-accent">mean to get to.</span>
          </h1>
          <p className="mx-auto mt-4 max-w-md text-[15px] leading-relaxed text-muted lg:mx-0">
            One clean place for your backlog across Games, Movies, Series and
            Anime — synced to your account, shared with your friends.
          </p>

          <ul className="mx-auto mt-8 hidden max-w-md space-y-3 text-left sm:block lg:mx-0">
            {FEATURES.map(({ icon: Icon, text }, i) => (
              <motion.li
                key={text}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.15 + i * 0.08, duration: 0.35 }}
                className="flex items-start gap-3"
              >
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <span className="text-sm leading-relaxed text-body">{text}</span>
              </motion.li>
            ))}
          </ul>
        </motion.div>

        {/* Auth card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-sm justify-self-center rounded-2xl border border-line bg-surface p-8 shadow-[0_2px_12px_rgba(38,37,33,0.05)] lg:justify-self-end"
        >
          <h2 className="font-serif text-2xl font-semibold tracking-tight text-ink">
            {mode === "login" ? "Welcome back" : "Create your account"}
          </h2>
          <p className="mt-1.5 text-sm text-muted">
            {mode === "login"
              ? "Log in — your library syncs across devices."
              : "One account, four backlogs — free."}
          </p>

          {message ? (
            <p className="mt-6 rounded-xl bg-sage-soft px-3.5 py-3 text-sm leading-relaxed text-sage">
              {message}
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div>
                <label
                  htmlFor="email"
                  className="mb-1.5 block text-sm font-medium text-ink"
                >
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-line bg-paper px-3.5 py-2.5 text-[15px] text-ink placeholder:text-muted/70 transition-colors focus:border-line-strong"
                  placeholder="you@example.com"
                />
              </div>
              <div>
                <label
                  htmlFor="password"
                  className="mb-1.5 block text-sm font-medium text-ink"
                >
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  autoComplete={
                    mode === "login" ? "current-password" : "new-password"
                  }
                  required
                  minLength={mode === "signup" ? 8 : undefined}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-line bg-paper px-3.5 py-2.5 text-[15px] text-ink transition-colors focus:border-line-strong"
                  placeholder={
                    mode === "signup" ? "At least 8 characters" : "••••••••"
                  }
                />
              </div>

              {error && (
                <p className="rounded-xl bg-accent-soft px-3.5 py-2.5 text-sm text-accent-hover">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={pending}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-[15px] font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-60"
              >
                {pending && <SpinnerIcon className="h-4 w-4 animate-spin" />}
                {mode === "login" ? "Log in" : "Sign up"}
              </button>
            </form>
          )}

          <p className="mt-6 text-center text-sm text-muted">
            {mode === "login" ? (
              <>
                First time here?{" "}
                <button
                  type="button"
                  onClick={() => switchMode("signup")}
                  className="font-medium text-accent hover:text-accent-hover"
                >
                  Create an account
                </button>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => switchMode("login")}
                  className="font-medium text-accent hover:text-accent-hover"
                >
                  Log in
                </button>
              </>
            )}
          </p>
        </motion.div>
      </div>
    </main>
  );
}

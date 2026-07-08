"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { supabase } from "@/lib/supabase";
import { SpinnerIcon } from "./icons";

/** Centered Claude-style login / signup card, shown when signed out. */
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
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-16">
      <p className="mb-8 font-serif text-2xl font-semibold tracking-tight text-ink">
        Backlog<span className="text-accent">.</span>
      </p>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-sm rounded-2xl border border-line bg-surface p-8 shadow-[0_2px_12px_rgba(38,37,33,0.05)]"
      >
        <h1 className="font-serif text-2xl font-semibold tracking-tight text-ink">
          {mode === "login" ? "Welcome back" : "Create your account"}
        </h1>
        <p className="mt-1.5 text-sm text-muted">
          {mode === "login"
            ? "Log in — your library syncs across devices."
            : "One account, four backlogs — games, movies, series and anime."}
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
    </main>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { AuthContext, useSession } from "@/lib/backlog-store";
import { fetchProfile } from "@/lib/social";
import { startTour } from "@/lib/tour-bus";
import type { Profile } from "@/lib/types";
import { AuthScreen } from "./AuthScreen";
import { Onboarding } from "./Onboarding";
import { CommandPalette } from "./CommandPalette";
import { ConfirmProvider } from "./ConfirmDialog";
import { FeatureTour } from "./FeatureTour";
import { Toaster } from "./Toaster";
import Nav from "./Nav";
import { BottomNav } from "./BottomNav";

/**
 * Client-side gate: login screen when signed out, an onboarding step until a
 * profile exists, then the app with session + profile in context.
 */
export default function AppShell({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { session, ready } = useSession();
  const userId = session?.user?.id ?? null;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const tourChecked = useRef(false);

  // First-ever visit: auto-run the tour once (edits to profile re-fire this
  // effect with a new object reference, so guard with a ref, not a flag in
  // state). Manual replays go through the Nav menu's "Take a tour" instead.
  useEffect(() => {
    if (!profile || tourChecked.current) return;
    tourChecked.current = true;
    try {
      if (localStorage.getItem("backlog:tourSeen")) return;
      localStorage.setItem("backlog:tourSeen", "true");
    } catch {
      return;
    }
    const t = setTimeout(() => startTour(), 800);
    return () => clearTimeout(t);
  }, [profile]);

  useEffect(() => {
    if (!userId) {
      setProfile(null);
      setProfileLoaded(false);
      return undefined;
    }
    let alive = true;
    setProfileLoaded(false);
    fetchProfile(userId)
      .then((p) => {
        if (alive) {
          setProfile(p);
          setProfileLoaded(true);
        }
      })
      .catch(() => {
        if (alive) setProfileLoaded(true);
      });
    return () => {
      alive = false;
    };
  }, [userId]);

  if (!ready) return null;
  if (!session) return <AuthScreen />;
  if (!profileLoaded) return null;
  if (!profile) {
    return <Onboarding userId={session.user.id} onDone={setProfile} />;
  }

  return (
    <AuthContext.Provider value={{ session, profile, setProfile }}>
      <ConfirmProvider>
        <Nav />
        <main className="mx-auto w-full max-w-6xl px-4 pb-20 sm:px-6 sm:pb-24">
          {children}
        </main>
        <BottomNav />
        <Toaster />
        <FeatureTour />
        <CommandPalette />
      </ConfirmProvider>
    </AuthContext.Provider>
  );
}

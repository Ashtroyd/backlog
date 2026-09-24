"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AuthContext, useSession } from "@/lib/backlog-store";
import { fetchProfile } from "@/lib/social";
import { openWelcome } from "@/lib/welcome-bus";
import { NavContext } from "@/lib/nav-context";
import { useUnreadMessages } from "@/lib/use-unread-messages";
import type { Profile } from "@/lib/types";
import { AuthScreen } from "./AuthScreen";
import { Onboarding } from "./Onboarding";
import { CommandPalette } from "./CommandPalette";
import { ConfirmProvider } from "./ConfirmDialog";
import { WelcomeSheet } from "./WelcomeSheet";
import { Toaster } from "./Toaster";
import Nav from "./Nav";
import { BottomNav } from "./BottomNav";
import { Sidebar } from "./Sidebar";
import { AccountSheet } from "./AccountSheet";

/**
 * Client-side gate: login screen when signed out, an onboarding step until a
 * profile exists, then the app with session + profile in context.
 */
export default function AppShell({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { session, ready } = useSession();
  const userId = session?.user?.id ?? null;

  // Tagged with the user it was fetched for, so a sign-out or account switch
  // reads as "not loaded yet" without resetting anything by hand.
  const [loaded, setLoaded] = useState<{ userId: string; profile: Profile | null } | null>(
    null,
  );
  const profileLoaded = userId !== null && loaded?.userId === userId;
  const profile = profileLoaded ? loaded.profile : null;
  const setProfile = useCallback(
    (p: Profile) => {
      if (userId) setLoaded({ userId, profile: p });
    },
    [userId],
  );
  const welcomeChecked = useRef(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const unread = useUnreadMessages(profile ? userId : null);

  // First-ever visit: show the welcome sheet once (edits to profile re-fire this
  // effect with a new object reference, so guard with a ref, not a flag in
  // state). It can be reopened from the account sheet.
  useEffect(() => {
    if (!profile || welcomeChecked.current) return;
    welcomeChecked.current = true;
    try {
      if (localStorage.getItem("backlog:tourSeen")) return;
      localStorage.setItem("backlog:tourSeen", "true");
    } catch {
      return;
    }
    const t = setTimeout(() => openWelcome(), 600);
    return () => clearTimeout(t);
  }, [profile]);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    fetchProfile(userId)
      .then((p) => {
        if (alive) setLoaded({ userId, profile: p });
      })
      .catch(() => {
        if (alive) setLoaded({ userId, profile: null });
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
        <NavContext.Provider
          value={{ unread, openAccount: () => setAccountOpen(true) }}
        >
          <Sidebar />
          <div className="lg:pl-60">
            <Nav />
            <main className="mx-auto w-full max-w-6xl px-4 pb-32 sm:px-6 sm:pb-24 lg:px-10">
              {children}
            </main>
          </div>
          <BottomNav />
          <AccountSheet
            open={accountOpen}
            onClose={() => setAccountOpen(false)}
          />
          <Toaster />
          <WelcomeSheet />
          <CommandPalette />
        </NavContext.Provider>
      </ConfirmProvider>
    </AuthContext.Provider>
  );
}

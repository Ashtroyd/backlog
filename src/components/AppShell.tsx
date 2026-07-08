"use client";

import { AuthContext, useSession } from "@/lib/backlog-store";
import { AuthScreen } from "./AuthScreen";
import Nav from "./Nav";

/** Client-side auth gate: login screen when signed out, the app when in. */
export default function AppShell({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { session, ready } = useSession();

  if (!ready) return null;
  if (!session) return <AuthScreen />;

  return (
    <AuthContext.Provider value={{ session }}>
      <Nav />
      <main className="mx-auto w-full max-w-6xl px-6 pb-24">{children}</main>
    </AuthContext.Provider>
  );
}

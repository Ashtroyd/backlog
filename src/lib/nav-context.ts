"use client";

import { createContext, useContext } from "react";

/** App-wide nav state, provided once by AppShell for every nav surface. */
export const NavContext = createContext<{
  unread: number;
  openAccount: () => void;
}>({ unread: 0, openAccount: () => {} });

export const useUnread = () => useContext(NavContext).unread;
export const useOpenAccount = () => useContext(NavContext).openAccount;

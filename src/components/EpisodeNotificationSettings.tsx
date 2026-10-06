"use client";

import { useState, useSyncExternalStore } from "react";
import { useAuth } from "@/lib/backlog-store";
import { episodeNotificationsKey } from "@/lib/use-episodes";

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener("episode-preference", callback);
  return () => { window.removeEventListener("storage", callback); window.removeEventListener("episode-preference", callback); };
}

export function EpisodeNotificationSettings() {
  const { session } = useAuth();
  const userId = session?.user.id;
  const enabled = useSyncExternalStore(subscribe, () => {
    try { return !!userId && localStorage.getItem(episodeNotificationsKey(userId)) === "on"; } catch { return false; }
  }, () => false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function toggle() {
    if (!userId || busy) return;
    setBusy(true);
    try {
      if (!enabled) {
        if (!("Notification" in window) || !("serviceWorker" in navigator)) {
          setMessage("This browser doesn't support notifications. On iPhone, add Backlog to your Home Screen first."); return;
        }
        const permission = await Notification.requestPermission();
        if (permission !== "granted") { setMessage("Notifications are off. You can change permission in your browser settings."); return; }
        if (!await navigator.serviceWorker.getRegistration()) {
          setMessage("Notifications aren't ready yet. Reload Backlog and try again."); return;
        }
      }
      localStorage.setItem(episodeNotificationsKey(userId), enabled ? "off" : "on");
      window.dispatchEvent(new Event("episode-preference")); setMessage("");
    } catch { setMessage("Couldn't save this preference on your device."); }
    finally { setBusy(false); }
  }
  return <div className="mt-4 overflow-hidden rounded-xl bg-ivory/60 p-4">
    <div className="flex items-center justify-between gap-3">
      <span className="text-subhead font-medium text-ink">Episode notifications</span>
      <button type="button" role="switch" aria-checked={enabled} aria-label="Episode notifications" disabled={busy}
        onClick={toggle} className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${enabled ? "bg-sage" : "bg-muted/30"}`}>
        <span className={`absolute left-0.5 top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${enabled ? "translate-x-5" : "translate-x-0"}`} />
      </button>
    </div>
    <p className="mt-2 text-footnote text-muted">Checks series and anime in Continue while Backlog is open. Background push isn&apos;t enabled. This preference applies to this device.</p>
    {message && <p role="status" className="mt-2 text-footnote text-body">{message}</p>}
  </div>;
}

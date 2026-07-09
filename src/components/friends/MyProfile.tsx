"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/backlog-store";
import { fetchFavorites, updateProfile } from "@/lib/social";
import { uploadProfileImage } from "@/lib/profile-media";
import type { BacklogItem } from "@/lib/types";
import { SpinnerIcon } from "@/components/icons";
import { ProfileHero } from "./ProfileHero";
import { FavouritesRow } from "./FavouritesRow";

export default function MyProfile() {
  const { session, profile, setProfile } = useAuth();
  const myId = session?.user?.id ?? null;

  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [uploading, setUploading] = useState<"avatar" | "banner" | null>(null);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<BacklogItem[]>([]);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name);
      setBio(profile.bio ?? "");
    }
  }, [profile]);

  useEffect(() => {
    if (myId) fetchFavorites(myId).then(setFavorites).catch(() => {});
  }, [myId]);

  if (!profile || !myId) return null;

  const dirty =
    displayName.trim() !== profile.display_name ||
    bio.trim() !== (profile.bio ?? "");

  async function handlePick(kind: "avatar" | "banner", file: File) {
    setNote(null);
    setUploading(kind);
    try {
      const url = await uploadProfileImage(myId!, kind, file);
      const patch =
        kind === "avatar" ? { avatar_url: url } : { banner_url: url };
      const { profile: updated, error } = await updateProfile(myId!, patch);
      if (updated) setProfile(updated);
      else setNote(error);
    } catch {
      setNote("Couldn't upload that image — try another.");
    } finally {
      setUploading(null);
    }
  }

  async function handleSave() {
    setNote(null);
    setSaving(true);
    const { profile: updated, error } = await updateProfile(myId!, {
      display_name: displayName,
      bio,
    });
    setSaving(false);
    if (updated) {
      setProfile(updated);
      setNote("Saved.");
    } else {
      setNote(error);
    }
  }

  return (
    <div className="pt-12">
      <ProfileHero
        profile={profile}
        editable
        uploading={uploading}
        onPickAvatar={(f) => handlePick("avatar", f)}
        onPickBanner={(f) => handlePick("banner", f)}
      />

      <section className="mt-10">
        <h2 className="mb-4 font-serif text-xl font-semibold text-ink">
          About you
        </h2>
        <div className="max-w-xl space-y-4 rounded-2xl border border-line bg-surface p-5">
          <div>
            <label htmlFor="displayName" className="mb-1.5 block text-sm font-medium text-ink">
              Display name
            </label>
            <input
              id="displayName"
              value={displayName}
              maxLength={40}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full rounded-xl border border-line bg-paper px-3.5 py-2.5 text-[15px] text-ink transition-colors focus:border-line-strong"
            />
          </div>
          <div>
            <label htmlFor="bio" className="mb-1.5 block text-sm font-medium text-ink">
              Bio
            </label>
            <textarea
              id="bio"
              value={bio}
              maxLength={280}
              rows={3}
              onChange={(e) => setBio(e.target.value)}
              placeholder="A line or two about your taste…"
              className="w-full resize-none rounded-xl border border-line bg-paper px-3.5 py-2.5 text-[15px] leading-relaxed text-ink placeholder:text-muted/70 transition-colors focus:border-line-strong"
            />
            <p className="mt-1 text-right text-xs text-muted">{bio.length}/280</p>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-sage">{note}</span>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !dirty}
              className="flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
            >
              {saving && <SpinnerIcon className="h-4 w-4 animate-spin" />}
              Save
            </button>
          </div>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="mb-1 font-serif text-xl font-semibold text-ink">Favourites</h2>
        <p className="mb-4 text-sm text-muted">
          One pick per list. Set them with the heart on any item.
        </p>
        <FavouritesRow
          favorites={favorites}
          emptyText="No favourites yet — open an item and tap the heart to feature it here."
        />
      </section>
    </div>
  );
}

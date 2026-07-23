"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/backlog-store";
import { fetchFavorites, fetchUserItems, updateProfile } from "@/lib/social";
import { IMAGE_SPEC, uploadProfileImage, type ImageKind } from "@/lib/profile-media";
import type { BacklogItem } from "@/lib/types";
import { SpinnerIcon } from "@/components/icons";
import { ImageCropper } from "@/components/ImageCropper";
import { ProfileHero } from "./ProfileHero";
import { FavouritesRow } from "./FavouritesRow";
import { StatsPanel } from "./StatsPanel";
import { YearInReviewModal } from "./YearInReviewModal";
import { TopPicksMonthSection } from "./TopPicksMonthSection";

export default function MyProfile() {
  const { session, profile, setProfile } = useAuth();
  const myId = session?.user?.id ?? null;

  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [uploading, setUploading] = useState<ImageKind | null>(null);
  const [cropping, setCropping] = useState<{ kind: ImageKind; file: File } | null>(
    null,
  );
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [editingAbout, setEditingAbout] = useState(false);
  const [favorites, setFavorites] = useState<BacklogItem[]>([]);
  const [allItems, setAllItems] = useState<BacklogItem[]>([]);
  const [yearInReviewOpen, setYearInReviewOpen] = useState(false);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name);
      setBio(profile.bio ?? "");
    }
  }, [profile]);

  useEffect(() => {
    if (myId) {
      fetchFavorites(myId).then(setFavorites).catch(() => {});
      fetchUserItems(myId).then(setAllItems).catch(() => {});
    }
  }, [myId]);

  if (!profile || !myId) return null;

  const dirty =
    displayName.trim() !== profile.display_name ||
    bio.trim() !== (profile.bio ?? "");

  /** Upload the framed crop, then point the profile at it. */
  async function handleCropped(blob: Blob) {
    const kind = cropping!.kind;
    setCropping(null);
    setNote(null);
    setUploading(kind);
    try {
      const url = await uploadProfileImage(myId!, kind, blob);
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
      setEditingAbout(false);
    } else {
      setNote(error);
    }
  }

  function openEditAbout() {
    setDisplayName(profile!.display_name);
    setBio(profile!.bio ?? "");
    setNote(null);
    setEditingAbout(true);
  }

  function cancelEditAbout() {
    setDisplayName(profile!.display_name);
    setBio(profile!.bio ?? "");
    setNote(null);
    setEditingAbout(false);
  }

  return (
    <div className="pt-12">
      <ProfileHero
        profile={profile}
        editable
        uploading={uploading}
        onPickAvatar={(file) => setCropping({ kind: "avatar", file })}
        onPickBanner={(file) => setCropping({ kind: "banner", file })}
      />

      {cropping && (
        <ImageCropper
          file={cropping.file}
          aspect={IMAGE_SPEC[cropping.kind].aspect}
          outputWidth={IMAGE_SPEC[cropping.kind].outputWidth}
          label={IMAGE_SPEC[cropping.kind].label}
          round={IMAGE_SPEC[cropping.kind].round}
          onCancel={() => setCropping(null)}
          onConfirm={handleCropped}
        />
      )}

      <section className="mt-10">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-serif text-xl font-semibold text-ink">About you</h2>
          {!editingAbout && (
            <button
              type="button"
              onClick={openEditAbout}
              className="text-sm font-medium text-accent transition-colors hover:text-accent-hover"
            >
              Edit
            </button>
          )}
        </div>

        {editingAbout ? (
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
              <span className="text-sm text-accent-hover">{note}</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={cancelEditAbout}
                  disabled={saving}
                  className="rounded-full border border-line px-4 py-2 text-sm font-medium text-ink transition-colors hover:border-line-strong hover:bg-ivory disabled:opacity-50"
                >
                  Cancel
                </button>
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
          </div>
        ) : (
          <div className="max-w-xl rounded-2xl border border-line bg-surface p-5">
            <p className="text-sm font-medium text-ink">{profile.display_name}</p>
            {profile.bio ? (
              <p className="mt-2 whitespace-pre-wrap text-[15px] leading-relaxed text-body">
                {profile.bio}
              </p>
            ) : (
              <p className="mt-2 text-sm italic text-muted">No bio yet.</p>
            )}
          </div>
        )}
      </section>

      {allItems.length > 0 && (
        <section className="mt-10">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-serif text-xl font-semibold text-ink">
              Your stats
            </h2>
            <button
              type="button"
              onClick={() => setYearInReviewOpen(true)}
              className="text-sm font-medium text-accent transition-colors hover:text-accent-hover"
            >
              Year in review →
            </button>
          </div>
          <StatsPanel items={allItems} />
        </section>
      )}

      <YearInReviewModal
        open={yearInReviewOpen}
        onClose={() => setYearInReviewOpen(false)}
        items={allItems}
      />

      <div className="mt-10">
        <TopPicksMonthSection userId={myId} />
      </div>

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

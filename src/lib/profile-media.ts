"use client";

import { supabase } from "./supabase";

/** Crop frame + exported size for each kind of profile image. */
export const IMAGE_SPEC = {
  avatar: { aspect: 1, outputWidth: 512, label: "profile picture", round: true },
  banner: { aspect: 3, outputWidth: 1500, label: "banner", round: false },
} as const;

export type ImageKind = keyof typeof IMAGE_SPEC;

/**
 * Upload an already-cropped avatar or banner to the public `avatars` bucket.
 * One file per user per kind (overwritten in place); the returned URL carries a
 * cache-buster so the new image shows up immediately.
 */
export async function uploadProfileImage(
  userId: string,
  kind: ImageKind,
  blob: Blob,
): Promise<string> {
  const path = `${userId}/${kind}.jpg`;
  const { error } = await supabase.storage
    .from("avatars")
    .upload(path, blob, { contentType: "image/jpeg", upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  return `${data.publicUrl}?v=${Date.now()}`;
}

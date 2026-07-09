"use client";

import { supabase } from "./supabase";

/** Downscale an image file to fit within max dimensions, as a JPEG blob. */
async function resizeImage(
  file: File,
  maxW: number,
  maxH: number,
): Promise<Blob> {
  const img = await loadImage(file);
  const scale = Math.min(1, maxW / img.width, maxH / img.height);
  const width = Math.max(1, Math.round(img.width * scale));
  const height = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported.");
  ctx.drawImage(img, 0, 0, width, height);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Could not process image."))),
      "image/jpeg",
      0.85,
    );
  });
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("That file isn't a readable image."));
    };
    img.src = url;
  });
}

const LIMITS = {
  avatar: [512, 512],
  banner: [1600, 600],
} as const;

/**
 * Resize + upload an avatar or banner to the public `avatars` bucket, one file
 * per user per kind (overwritten in place), returning a cache-busted URL.
 */
export async function uploadProfileImage(
  userId: string,
  kind: "avatar" | "banner",
  file: File,
): Promise<string> {
  const [maxW, maxH] = LIMITS[kind];
  const blob = await resizeImage(file, maxW, maxH);
  const path = `${userId}/${kind}.jpg`;
  const { error } = await supabase.storage
    .from("avatars")
    .upload(path, blob, { contentType: "image/jpeg", upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  return `${data.publicUrl}?v=${Date.now()}`;
}

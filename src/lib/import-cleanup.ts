/** Conservative suggestions only: the user can always include these entries. */
export function importExclusion(
  title: string,
): "Playtest or demo" | "Utility" | null {
  if (
    /\b(playtest|test server|open beta|closed beta|demo)\b|\s[-–]\salpha\b/i.test(
      title,
    )
  )
    return "Playtest or demo";
  if (
    /^(3dmark|wallpaper engine|aseprite|lossless scaling|tmodloader|aimlabs)$/i.test(
      title.trim(),
    )
  )
    return "Utility";
  return null;
}

export function normalizedTitle(title: string): string {
  return title
    .replace(/[™®]/g, "")
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

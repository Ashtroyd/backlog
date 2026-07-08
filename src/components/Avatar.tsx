import type { Profile } from "@/lib/types";

/**
 * Initial-based avatar with a deterministic warm tint derived from the handle,
 * so each person keeps a stable colour without needing an uploaded image.
 */
const TINTS = [
  "#c96442", // terracotta
  "#66805c", // sage
  "#b08544", // ochre
  "#7a6aa8", // muted violet
  "#4f7d8c", // teal
  "#a85454", // clay
  "#5f8a6a", // green
];

function tintFor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return TINTS[h % TINTS.length];
}

export function Avatar({
  profile,
  size = 40,
}: {
  profile: Pick<Profile, "username" | "display_name">;
  size?: number;
}) {
  const label = profile.display_name || profile.username;
  const initial = label.trim().charAt(0).toUpperCase() || "?";
  const tint = tintFor(profile.username);

  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center rounded-full font-serif font-semibold text-white select-none"
      style={{
        width: size,
        height: size,
        backgroundColor: tint,
        fontSize: size * 0.42,
      }}
    >
      {initial}
    </span>
  );
}

import type { Profile } from "@/lib/types";

/**
 * Initial-based avatar with a deterministic system-colour tint derived from the handle,
 * so each person keeps a stable colour without needing an uploaded image.
 */
const TINTS = [
  "#c94a17", // orange
  "#248a3d", // green
  "#a05a00", // brown
  "#5856d6", // indigo
  "#0e7c86", // teal
  "#c9302c", // red
  "#1f7a8c", // cyan
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
  profile: Pick<Profile, "username" | "display_name"> & {
    avatar_url?: string | null;
  };
  size?: number;
}) {
  const label = profile.display_name || profile.username;
  const initial = label.trim().charAt(0).toUpperCase() || "?";

  if (profile.avatar_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={profile.avatar_url}
        alt=""
        aria-hidden
        width={size}
        height={size}
        className="inline-block shrink-0 rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center rounded-full font-display font-semibold text-white select-none"
      style={{
        width: size,
        height: size,
        backgroundColor: tintFor(profile.username),
        fontSize: size * 0.42,
      }}
    >
      {initial}
    </span>
  );
}

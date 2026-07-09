"use client";

import { useRef } from "react";
import type { Profile } from "@/lib/types";
import { Avatar } from "@/components/Avatar";
import { CameraIcon, SpinnerIcon } from "@/components/icons";

/**
 * Banner + avatar + name/handle/bio header, shared by the friend profile and
 * the editable own-profile page. Pass `editable` with pick handlers to show the
 * camera controls; pass `actions` for the right-hand buttons.
 */
export function ProfileHero({
  profile,
  actions,
  editable = false,
  uploading = null,
  onPickAvatar,
  onPickBanner,
}: {
  profile: Profile;
  actions?: React.ReactNode;
  editable?: boolean;
  uploading?: "avatar" | "banner" | null;
  onPickAvatar?: (file: File) => void;
  onPickBanner?: (file: File) => void;
}) {
  const avatarInput = useRef<HTMLInputElement>(null);
  const bannerInput = useRef<HTMLInputElement>(null);

  return (
    <div>
      <div
        className="relative h-40 overflow-hidden rounded-2xl border border-line sm:h-52"
        style={
          profile.banner_url
            ? undefined
            : { background: "linear-gradient(135deg, var(--ivory), var(--accent-soft))" }
        }
      >
        {profile.banner_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={profile.banner_url}
            alt=""
            className="h-full w-full object-cover"
          />
        )}
        {editable && (
          <button
            type="button"
            onClick={() => bannerInput.current?.click()}
            className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full bg-ink/55 px-3 py-1.5 text-xs font-medium text-white backdrop-blur transition-colors hover:bg-ink/70"
          >
            {uploading === "banner" ? (
              <SpinnerIcon className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <CameraIcon className="h-3.5 w-3.5" />
            )}
            Banner
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-4 px-1 sm:px-4">
        <div className="relative -mt-12">
          <span className="block rounded-full ring-4 ring-paper">
            <Avatar profile={profile} size={96} />
          </span>
          {editable && (
            <button
              type="button"
              onClick={() => avatarInput.current?.click()}
              title="Change photo"
              className="absolute bottom-1 right-1 flex h-8 w-8 items-center justify-center rounded-full bg-ink/60 text-white backdrop-blur transition-colors hover:bg-ink/80"
            >
              {uploading === "avatar" ? (
                <SpinnerIcon className="h-4 w-4 animate-spin" />
              ) : (
                <CameraIcon className="h-4 w-4" />
              )}
            </button>
          )}
        </div>

        <div className="min-w-0 flex-1 pb-1">
          <h1 className="truncate font-serif text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            {profile.display_name}
          </h1>
          <p className="truncate text-sm text-muted">@{profile.username}</p>
        </div>

        {actions && <div className="pb-1">{actions}</div>}
      </div>

      {profile.bio && (
        <p className="mt-4 max-w-2xl whitespace-pre-wrap px-1 text-[15px] leading-relaxed text-body sm:px-4">
          {profile.bio}
        </p>
      )}

      <input
        ref={avatarInput}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) onPickAvatar?.(f);
        }}
      />
      <input
        ref={bannerInput}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) onPickBanner?.(f);
        }}
      />
    </div>
  );
}

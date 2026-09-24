"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

/**
 * Cover art that degrades to the title's initial when the image is missing.
 * Steam's portrait art is guessed from the appid and 404s for obscure games,
 * so search rows need a graceful fallback.
 */
export function CoverImage({
  src,
  title,
  sizes,
  className = "object-cover",
}: {
  src: string | null;
  title: string;
  sizes: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (!src || failed) {
    return (
      <div className="flex h-full w-full items-center justify-center font-display text-xl text-line-strong">
        {title.charAt(0)}
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt=""
      fill
      sizes={sizes}
      className={className}
      onError={() => setFailed(true)}
    />
  );
}

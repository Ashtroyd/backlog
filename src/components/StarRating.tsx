"use client";

import { useState } from "react";
import { StarIcon } from "./icons";

/**
 * 5-star rating with half-star steps. Interactive when `onChange` is given:
 * the left half of each star sets n − 0.5, the right half sets n.
 */
export function StarRating({
  value,
  onChange,
  size = 22,
}: {
  value: number | null;
  onChange?: (v: number) => void;
  size?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const shown = hover ?? value ?? 0;
  const interactive = Boolean(onChange);

  return (
    <div
      className="flex items-center gap-0.5"
      onMouseLeave={() => setHover(null)}
      role={interactive ? "radiogroup" : undefined}
      aria-label={interactive ? "Rating" : `Rated ${value ?? 0} out of 5`}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <div key={n} className="relative" style={{ width: size, height: size }}>
          <StarIcon
            className="text-line-strong"
            style={{ width: size, height: size }}
          />
          <div
            className="absolute inset-y-0 left-0 overflow-hidden transition-[width] duration-150"
            style={{
              width: shown >= n ? "100%" : shown >= n - 0.5 ? "50%" : "0%",
            }}
          >
            <StarIcon
              className="text-star"
              style={{ width: size, height: size }}
            />
          </div>
          {interactive && (
            <>
              <button
                type="button"
                aria-label={`${n - 0.5} stars`}
                className="absolute inset-y-0 left-0 w-1/2 cursor-pointer"
                onMouseEnter={() => setHover(n - 0.5)}
                onClick={() => onChange?.(n - 0.5)}
              />
              <button
                type="button"
                aria-label={`${n} stars`}
                className="absolute inset-y-0 right-0 w-1/2 cursor-pointer"
                onMouseEnter={() => setHover(n)}
                onClick={() => onChange?.(n)}
              />
            </>
          )}
        </div>
      ))}
    </div>
  );
}

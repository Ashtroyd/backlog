"use client";

import { useEffect, useRef, useState } from "react";
import { animate, motion, useMotionValue, useTransform, type PanInfo } from "motion/react";

export type SwipeAction = {
  label: string;
  icon: React.ReactNode;
  tone: "accent" | "danger";
  onAction: () => void;
};

/** How far a partial swipe opens: one action button's width. */
const ACTION_W = 84;
/** Past this share of the row, letting go runs the action outright. */
const FULL_SWIPE = 0.55;
const SPRING = { type: "spring", duration: 0.35, bounce: 0 } as const;

/**
 * A list row with Mail-style swipe actions: drag right for `leading`, left
 * for `trailing`. A short swipe parks the row open on its button; a long one
 * runs the action straight away. Tapping the row while it's open just closes
 * it, as does touching anywhere else. Vertical scrolling is left alone.
 */
export function SwipeRow({
  leading,
  trailing,
  disabled = false,
  children,
}: {
  leading?: SwipeAction | null;
  trailing?: SwipeAction | null;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const x = useMotionValue(0);
  const rowRef = useRef<HTMLDivElement>(null);
  const dragged = useRef(false);
  const [open, setOpen] = useState<"leading" | "trailing" | null>(null);
  const leadingW = useTransform(x, (v) => Math.max(v, 0));
  const trailingW = useTransform(x, (v) => Math.max(-v, 0));

  function settle(to: "leading" | "trailing" | null) {
    setOpen(to);
    animate(x, to === "leading" ? ACTION_W : to === "trailing" ? -ACTION_W : 0, SPRING);
  }

  function run(action: SwipeAction) {
    settle(null);
    action.onAction();
  }

  // Touching anywhere outside an open row closes it.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rowRef.current?.contains(e.target as Node)) settle(null);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
    // settle only touches the motion value and state setter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function onDragEnd(_: unknown, info: PanInfo) {
    const width = rowRef.current?.offsetWidth ?? 320;
    const offset = x.get();
    const flick = info.velocity.x;
    if (trailing && offset < -width * FULL_SWIPE) run(trailing);
    else if (leading && offset > width * FULL_SWIPE) run(leading);
    else if (trailing && (offset < -ACTION_W / 2 || (offset < 0 && flick < -500)))
      settle("trailing");
    else if (leading && (offset > ACTION_W / 2 || (offset > 0 && flick > 500)))
      settle("leading");
    else settle(null);
  }

  if (disabled || (!leading && !trailing)) return <>{children}</>;

  return (
    <div ref={rowRef} className="relative overflow-hidden">
      {leading && (
        <ActionButton
          action={leading}
          side="left"
          width={leadingW}
          focusable={open === "leading"}
          onRun={() => run(leading)}
        />
      )}
      {trailing && (
        <ActionButton
          action={trailing}
          side="right"
          width={trailingW}
          focusable={open === "trailing"}
          onRun={() => run(trailing)}
        />
      )}
      <motion.div
        drag="x"
        dragDirectionLock
        dragMomentum={false}
        dragElastic={0}
        dragConstraints={{ left: trailing ? -10_000 : 0, right: leading ? 10_000 : 0 }}
        onDragStart={() => {
          dragged.current = true;
        }}
        onDragEnd={onDragEnd}
        // A drag or a tap on an open row mustn't also open the title.
        onClickCapture={(e) => {
          if (dragged.current || open) {
            e.preventDefault();
            e.stopPropagation();
            dragged.current = false;
            if (open) settle(null);
          }
        }}
        onPointerDown={() => {
          dragged.current = false;
        }}
        style={{ x, touchAction: "pan-y" }}
        className="relative bg-paper"
      >
        {children}
      </motion.div>
    </div>
  );
}

function ActionButton({
  action,
  side,
  width,
  focusable,
  onRun,
}: {
  action: SwipeAction;
  side: "left" | "right";
  width: ReturnType<typeof useTransform<number, number>>;
  focusable: boolean;
  onRun: () => void;
}) {
  return (
    <motion.button
      type="button"
      onClick={onRun}
      tabIndex={focusable ? 0 : -1}
      aria-hidden={!focusable}
      style={{ width }}
      className={`absolute inset-y-0 flex items-center overflow-hidden text-white ${
        side === "left" ? "left-0 justify-start" : "right-0 justify-end"
      } ${action.tone === "danger" ? "bg-danger" : "bg-accent"}`}
    >
      <span className="flex w-[84px] shrink-0 flex-col items-center gap-1 text-caption2 font-semibold">
        {action.icon}
        {action.label}
      </span>
    </motion.button>
  );
}

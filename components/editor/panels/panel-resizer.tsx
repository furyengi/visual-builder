"use client";

import { useState } from "react";

/**
 * A drag handle for panel width.
 *
 * Exposed as a separator with `aria-valuenow`, and driven by arrow keys
 * as well as the pointer — panel sizing is a real preference, not a
 * mouse-only flourish.
 */
export function PanelResizer({
  side,
  width,
  min,
  max,
  label,
  onResize,
}: {
  /** Which edge of the panel the handle sits on. */
  side: "left" | "right";
  width: number;
  min: number;
  max: number;
  label: string;
  onResize: (width: number) => void;
}) {
  const [active, setActive] = useState(false);

  const clamp = (value: number) => Math.min(max, Math.max(min, Math.round(value)));

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const element = event.currentTarget;
    element.setPointerCapture(event.pointerId);
    setActive(true);
    document.documentElement.classList.add("is-dragging");

    const startX = event.clientX;
    const startWidth = width;
    // A left-edge handle grows the panel as the pointer moves left.
    const direction = side === "right" ? 1 : -1;

    const onMove = (move: PointerEvent) => {
      onResize(clamp(startWidth + (move.clientX - startX) * direction));
    };
    const onUp = () => {
      setActive(false);
      document.documentElement.classList.remove("is-dragging");
      element.releasePointerCapture(event.pointerId);
      element.removeEventListener("pointermove", onMove);
      element.removeEventListener("pointerup", onUp);
    };

    element.addEventListener("pointermove", onMove);
    element.addEventListener("pointerup", onUp);
  };

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuenow={width}
      aria-valuemin={min}
      aria-valuemax={max}
      tabIndex={0}
      data-active={active ? "true" : undefined}
      className={`panel-resizer panel-resizer--${side}`}
      onPointerDown={onPointerDown}
      onKeyDown={(event) => {
        const step = event.shiftKey ? 32 : 8;
        const direction = side === "right" ? 1 : -1;
        if (event.key === "ArrowRight") {
          event.preventDefault();
          onResize(clamp(width + step * direction));
        } else if (event.key === "ArrowLeft") {
          event.preventDefault();
          onResize(clamp(width - step * direction));
        }
      }}
    />
  );
}

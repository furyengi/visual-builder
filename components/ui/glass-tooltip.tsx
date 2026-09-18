"use client";

import { useCallback, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

type Placement = "top" | "bottom" | "left" | "right";

const OFFSET = 8;
const OPEN_DELAY = 350;

export type TooltipOptions = {
  label: ReactNode;
  /** Rendered dimmed after the label, e.g. "⌘Z". */
  shortcut?: string;
  placement?: Placement;
  disabled?: boolean;
};

/**
 * Tooltip as a hook rather than a wrapper component.
 *
 * Returning props to spread avoids both a layout wrapper element and
 * `cloneElement`: the trigger keeps its exact place in its parent's
 * flex or grid layout, which matters inside the toolbar capsules.
 *
 * The tooltip is `aria-describedby`, never `aria-labelledby` — the
 * trigger keeps its own accessible name, so the tooltip is always
 * supplementary rather than the only way to identify a control.
 */
export function useTooltip({
  label,
  shortcut,
  placement = "bottom",
  disabled,
}: TooltipOptions) {
  const id = useId();
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const timer = useRef<number | null>(null);

  const clear = useCallback(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const place = useCallback(
    (element: Element) => {
      const rect = element.getBoundingClientRect();
      setPosition(
        placement === "top"
          ? { x: rect.left + rect.width / 2, y: rect.top - OFFSET }
          : placement === "bottom"
            ? { x: rect.left + rect.width / 2, y: rect.bottom + OFFSET }
            : placement === "left"
              ? { x: rect.left - OFFSET, y: rect.top + rect.height / 2 }
              : { x: rect.right + OFFSET, y: rect.top + rect.height / 2 },
      );
    },
    [placement],
  );

  const hide = useCallback(() => {
    clear();
    setPosition(null);
  }, [clear]);

  const triggerProps = {
    "aria-describedby": position ? id : undefined,
    onPointerEnter: (event: React.PointerEvent) => {
      // A tooltip under the finger on tap is noise, not help.
      if (disabled || event.pointerType === "touch") return;
      const element = event.currentTarget;
      clear();
      timer.current = window.setTimeout(() => place(element), OPEN_DELAY);
    },
    onPointerLeave: hide,
    onPointerDown: hide,
    // Keyboard focus shows immediately; the delay exists only to stop
    // tooltips flickering as a pointer crosses a row of controls.
    onFocus: (event: React.FocusEvent) => {
      if (disabled) return;
      place(event.currentTarget);
    },
    onBlur: hide,
  };

  const translate =
    placement === "top"
      ? "translate(-50%, -100%)"
      : placement === "bottom"
        ? "translate(-50%, 0)"
        : placement === "left"
          ? "translate(-100%, -50%)"
          : "translate(0, -50%)";

  const tooltip =
    position && typeof document !== "undefined"
      ? createPortal(
          <div
            id={id}
            role="tooltip"
            className="fw-tooltip"
            style={{ left: position.x, top: position.y, transform: translate }}
          >
            {label}
            {shortcut && <kbd>{shortcut}</kbd>}
          </div>,
          document.body,
        )
      : null;

  return { triggerProps, tooltip };
}

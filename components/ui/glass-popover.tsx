"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { GlassSurface } from "./glass-surface";

type Align = "start" | "center" | "end";

type PopoverProps = {
  open: boolean;
  onClose: () => void;
  /** The control the popover grows out of. */
  anchorRef: RefObject<HTMLElement | null>;
  align?: Align;
  /** Distance from the anchor edge, in pixels. */
  offset?: number;
  label?: string;
  className?: string;
  children: ReactNode;
};

const VIEWPORT_MARGIN = 8;

/**
 * A portalled glass popover anchored to a trigger. Position is measured
 * after mount and flipped above the anchor when it would overflow the
 * viewport bottom; the transform origin is set from the final placement
 * so the panel always appears to grow out of the control that opened it.
 */
export function Popover({
  open,
  onClose,
  anchorRef,
  align = "start",
  offset = 8,
  label,
  className,
  children,
}: PopoverProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [placement, setPlacement] = useState<{
    left: number;
    top: number;
    origin: string;
  } | null>(null);

  const position = useCallback(() => {
    const anchor = anchorRef.current;
    const panel = panelRef.current;
    if (!anchor || !panel) return;

    const a = anchor.getBoundingClientRect();
    const p = panel.getBoundingClientRect();

    let left =
      align === "start"
        ? a.left
        : align === "end"
          ? a.right - p.width
          : a.left + a.width / 2 - p.width / 2;

    left = Math.min(
      Math.max(VIEWPORT_MARGIN, left),
      window.innerWidth - p.width - VIEWPORT_MARGIN,
    );

    const below = a.bottom + offset;
    const flip = below + p.height > window.innerHeight - VIEWPORT_MARGIN;
    const top = flip ? Math.max(VIEWPORT_MARGIN, a.top - offset - p.height) : below;

    // Origin follows the anchor horizontally so the growth animation
    // points back at the trigger even when the panel was shifted to
    // stay on screen.
    const originX = Math.min(Math.max(a.left + a.width / 2 - left, 12), p.width - 12);
    setPlacement({
      left,
      top,
      origin: `${originX}px ${flip ? "100%" : "0%"}`,
    });
  }, [align, anchorRef, offset]);

  useLayoutEffect(() => {
    if (open) position();
    else setPlacement(null);
  }, [open, position]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target)) return;
      if (anchorRef.current?.contains(target)) return;
      onClose();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
        anchorRef.current?.focus();
      }
    };

    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("keydown", onKeyDown, true);
    // Reposition rather than track: a popover that follows a scrolling
    // anchor pixel-for-pixel is more distracting than one that closes.
    window.addEventListener("resize", position);
    window.addEventListener("scroll", onClose, true);

    return () => {
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("resize", position);
      window.removeEventListener("scroll", onClose, true);
    };
  }, [anchorRef, onClose, open, position]);

  // Focus moves into the panel so keyboard users are not stranded on
  // the trigger while a menu is open.
  useEffect(() => {
    if (!open || !placement) return;
    const first = panelRef.current?.querySelector<HTMLElement>(
      "button:not(:disabled), [href], input, select, textarea, [tabindex]:not([tabindex='-1'])",
    );
    first?.focus();
  }, [open, placement]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <GlassSurface
      ref={panelRef}
      role="menu"
      aria-label={label}
      className={cn("fw-popover", className)}
      style={{
        left: placement?.left ?? -9999,
        top: placement?.top ?? -9999,
        visibility: placement ? "visible" : "hidden",
        ["--fw-popover-origin" as string]: placement?.origin,
      }}
    >
      {children}
    </GlassSurface>,
    document.body,
  );
}

export function PopoverItem({
  icon,
  danger,
  onSelect,
  children,
  ...rest
}: {
  icon?: ReactNode;
  danger?: boolean;
  onSelect: () => void;
  children: ReactNode;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onSelect">) {
  return (
    <button
      type="button"
      role="menuitem"
      className={cn("fw-popover__item", danger && "fw-popover__item--danger")}
      onClick={onSelect}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}

export function PopoverSeparator() {
  return <div className="fw-popover__separator" role="separator" />;
}

export function PopoverLabel({ children }: { children: ReactNode }) {
  return <div className="fw-popover__label label-caps">{children}</div>;
}

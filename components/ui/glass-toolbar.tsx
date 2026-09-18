"use client";

import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { GlassSurface, type GlassLevel } from "./glass-surface";

type ToolbarProps = HTMLAttributes<HTMLDivElement> & {
  label: string;
  children: ReactNode;
};

/**
 * A row of glass control islands. The toolbar itself has no surface —
 * grouping is expressed by the capsules inside it, so unrelated actions
 * are separated by real space rather than by a divider line.
 */
export function GlassToolbar({ label, className, children, ...rest }: ToolbarProps) {
  return (
    <div
      role="toolbar"
      aria-label={label}
      aria-orientation="horizontal"
      className={cn("fw-toolbar", className)}
      {...rest}
    >
      {children}
    </div>
  );
}

type GroupProps = HTMLAttributes<HTMLDivElement> & {
  /** Names the relationship the capsule expresses, e.g. "History". */
  label?: string;
  level?: GlassLevel;
  /** Rounded-rect capsule instead of a pill. */
  squared?: boolean;
  children: ReactNode;
};

/**
 * One capsule. Controls placed together here are asserting that they
 * are related; anything unrelated belongs in its own group.
 */
export function ToolbarGroup({
  label,
  level = "regular",
  squared,
  className,
  children,
  ...rest
}: GroupProps) {
  return (
    <GlassSurface
      level={level}
      role="group"
      aria-label={label}
      radius={squared ? "var(--radius-7)" : "var(--radius-full)"}
      className={cn("glass-group", squared && "glass-group--squared", className)}
      {...rest}
    >
      {children}
    </GlassSurface>
  );
}

/** A hairline between two sub-groups that share one capsule. */
export function ToolbarSeparator() {
  return <span className="glass-separator" role="separator" aria-orientation="vertical" />;
}

/** Pushes everything after it to the far end of the toolbar. */
export function ToolbarSpacer() {
  return <span className="flex-1" aria-hidden="true" />;
}

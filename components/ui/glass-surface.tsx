"use client";

import { forwardRef, type ElementType, type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type GlassLevel = "thin" | "regular" | "thick";

type GlassSurfaceProps = HTMLAttributes<HTMLDivElement> & {
  /** Blur and tint strength. Larger surfaces cover more backdrop and
   *  need more blur to keep their own content legible. */
  level?: GlassLevel;
  /** Corner radius token value, e.g. `var(--radius-8)`. */
  radius?: string;
  /** Elevation token value, e.g. `var(--elevation-3)`. */
  elevation?: string;
  as?: ElementType;
};

const levelClass: Record<GlassLevel, string | undefined> = {
  thin: "glass--thin",
  regular: undefined,
  thick: "glass--thick",
};

/**
 * The single place glass is applied. Every floating control surface in
 * the editor composes this rather than declaring its own backdrop
 * filter, so the whole control layer can be retuned from one file.
 */
export const GlassSurface = forwardRef<HTMLDivElement, GlassSurfaceProps>(
  function GlassSurface(
    { level = "regular", radius, elevation, as, className, style, ...rest },
    ref,
  ) {
    const Component = (as ?? "div") as ElementType;

    return (
      <Component
        ref={ref}
        className={cn("glass", levelClass[level], className)}
        style={{
          ...(radius ? { ["--_radius" as string]: radius } : null),
          ...(elevation ? { ["--_elevation" as string]: elevation } : null),
          ...style,
        }}
        {...rest}
      />
    );
  },
);

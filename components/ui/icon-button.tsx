"use client";

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useTooltip } from "./glass-tooltip";

type Size = "xs" | "sm" | "md" | "lg";

type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  /** Required: it becomes the accessible name and the tooltip text. */
  label: string;
  icon: ReactNode;
  size?: Size;
  round?: boolean;
  danger?: boolean;
  /** Shown dimmed in the tooltip, e.g. "⌘Z". */
  shortcut?: string;
  tooltip?: boolean;
  tooltipPlacement?: "top" | "bottom" | "left" | "right";
};

const sizeClass: Record<Size, string | undefined> = {
  xs: "fw-icon-button--xs",
  sm: "fw-icon-button--sm",
  md: undefined,
  lg: "fw-icon-button--lg",
};

/**
 * An icon-only control. `label` is mandatory because an icon alone has
 * no accessible name; it feeds both `aria-label` and the tooltip, so
 * the two can never disagree.
 */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton(
    {
      label,
      icon,
      size = "md",
      round,
      danger,
      shortcut,
      tooltip = true,
      tooltipPlacement = "bottom",
      className,
      type = "button",
      ...rest
    },
    ref,
  ) {
    const { triggerProps, tooltip: tooltipNode } = useTooltip({
      label,
      shortcut,
      placement: tooltipPlacement,
      disabled: !tooltip || rest.disabled,
    });

    return (
      <>
        <button
          ref={ref}
          type={type}
          aria-label={label}
          className={cn(
            "fw-icon-button motion-press hit-expand focus-ring-contrast",
            sizeClass[size],
            round && "fw-icon-button--round",
            danger && "fw-icon-button--danger",
            className,
          )}
          {...triggerProps}
          {...rest}
        >
          {icon}
        </button>
        {tooltipNode}
      </>
    );
  },
);

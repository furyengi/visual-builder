"use client";

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type Variant = "ghost" | "glass" | "solid" | "accent" | "outline" | "danger";
type Size = "sm" | "md" | "lg";

type GlassButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  /** Fully rounded, for controls living inside a glass capsule. */
  pill?: boolean;
  fullWidth?: boolean;
  icon?: ReactNode;
  /** Renders after the label, e.g. a chevron or shortcut hint. */
  trailing?: ReactNode;
};

const variantClass: Record<Variant, string | undefined> = {
  ghost: undefined,
  glass: "fw-button--glass",
  solid: "fw-button--solid",
  accent: "fw-button--accent",
  outline: "fw-button--outline",
  danger: "fw-button--danger",
};

const sizeClass: Record<Size, string | undefined> = {
  sm: "fw-button--sm",
  md: undefined,
  lg: "fw-button--lg",
};

export const GlassButton = forwardRef<HTMLButtonElement, GlassButtonProps>(
  function GlassButton(
    {
      variant = "ghost",
      size = "md",
      pill,
      fullWidth,
      icon,
      trailing,
      children,
      className,
      type = "button",
      ...rest
    },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          "fw-button motion-press focus-ring-contrast",
          variantClass[variant],
          sizeClass[size],
          pill && "fw-button--pill",
          fullWidth && "fw-button--full",
          className,
        )}
        {...rest}
      >
        {icon}
        {children}
        {trailing}
      </button>
    );
  },
);

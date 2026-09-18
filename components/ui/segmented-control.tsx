"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";
import { useTooltip } from "./glass-tooltip";

export type SegmentedOption<T extends string> = {
  value: T;
  label: string;
  icon?: ReactNode;
  /** Hides the text label, keeping it as the accessible name. */
  iconOnly?: boolean;
  shortcut?: string;
};

type SegmentedControlProps<T extends string> = {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Announced to assistive tech as the group name. */
  label: string;
  glass?: boolean;
  pill?: boolean;
  className?: string;
};

/**
 * A radiogroup whose selection indicator is one element that slides
 * between options. Arrow keys move the selection, matching the native
 * radio group pattern, and roving tabindex keeps the whole control a
 * single tab stop.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  label,
  glass,
  pill,
  className,
}: SegmentedControlProps<T>) {
  const listRef = useRef<HTMLDivElement>(null);
  const [thumb, setThumb] = useState<{ x: number; width: number } | null>(null);
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  const iconOnly = options.every((option) => option.iconOnly);

  const measure = useCallback(() => {
    const list = listRef.current;
    if (!list) return;
    const active = list.children[selectedIndex + 1] as HTMLElement | undefined;
    if (!active) return;
    setThumb({ x: active.offsetLeft, width: active.offsetWidth });
  }, [selectedIndex]);

  // Measured in a layout effect so the thumb never paints at the wrong
  // position on first render.
  useLayoutEffect(measure, [measure, options.length]);

  useEffect(() => {
    if (typeof ResizeObserver === "undefined") return;
    const list = listRef.current;
    if (!list) return;
    const observer = new ResizeObserver(measure);
    observer.observe(list);
    return () => observer.disconnect();
  }, [measure]);

  const move = (delta: number) => {
    const next = (selectedIndex + delta + options.length) % options.length;
    onChange(options[next].value);
    const list = listRef.current;
    const button = list?.children[next + 1] as HTMLElement | undefined;
    button?.focus();
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      move(1);
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      move(-1);
    } else if (event.key === "Home") {
      event.preventDefault();
      onChange(options[0].value);
    } else if (event.key === "End") {
      event.preventDefault();
      onChange(options[options.length - 1].value);
    }
  };

  return (
    <div
      ref={listRef}
      role="radiogroup"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={cn(
        "fw-segmented",
        glass && "fw-segmented--glass",
        pill && "fw-segmented--pill",
        iconOnly && "fw-segmented--icons",
        className,
      )}
    >
      <span
        className="fw-segmented__thumb"
        aria-hidden="true"
        style={
          thumb
            ? { transform: `translateX(${thumb.x - 2}px)`, width: thumb.width }
            : { opacity: 0 }
        }
      />
      {options.map((option, index) => (
        <Option
          key={option.value}
          option={option}
          selected={option.value === value}
          tabbable={index === selectedIndex}
          onSelect={() => onChange(option.value)}
        />
      ))}
    </div>
  );
}

/**
 * One option. Icon-only options carry a tooltip, since the label is
 * present for assistive tech but invisible on screen.
 */
function Option<T extends string>({
  option,
  selected,
  tabbable,
  onSelect,
}: {
  option: SegmentedOption<T>;
  selected: boolean;
  tabbable: boolean;
  onSelect: () => void;
}) {
  const { triggerProps, tooltip } = useTooltip({
    label: option.label,
    shortcut: option.shortcut,
    disabled: !option.iconOnly,
  });

  return (
    <>
      <button
        type="button"
        role="radio"
        aria-checked={selected}
        aria-label={option.iconOnly ? option.label : undefined}
        tabIndex={tabbable ? 0 : -1}
        className="fw-segmented__option focus-ring-inset"
        onClick={onSelect}
        {...triggerProps}
      >
        {option.icon}
        {!option.iconOnly && option.label}
      </button>
      {tooltip}
    </>
  );
}

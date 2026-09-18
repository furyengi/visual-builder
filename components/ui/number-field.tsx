"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type NumberFieldProps = {
  label?: string;
  value: number | undefined;
  onChange: (value: number) => void;
  /** Called once at the end of a scrub or on blur, for history batching. */
  onCommit?: () => void;
  min?: number;
  max?: number;
  step?: number;
  /** Multiplier applied while Shift is held. */
  shiftStep?: number;
  precision?: number;
  unit?: string;
  placeholder?: string;
  /** Value comes from a wider breakpoint rather than being set here. */
  inherited?: boolean;
  /** Value overrides a wider breakpoint at the current one. */
  overridden?: boolean;
  disabled?: boolean;
  suffix?: ReactNode;
  className?: string;
  ariaLabel?: string;
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const round = (value: number, precision: number) => {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
};

/**
 * A numeric input with the two affordances a design tool needs: the
 * label scrubs the value horizontally, and arrow keys step it (Shift
 * for coarse movement). Typing is never interrupted — the raw string
 * is held in local state and only parsed on blur or Enter, so a
 * half-typed "-" or "1." does not get rewritten under the cursor.
 */
export function NumberField({
  label,
  value,
  onChange,
  onCommit,
  min = -Infinity,
  max = Infinity,
  step = 1,
  shiftStep,
  precision = 2,
  unit,
  placeholder = "auto",
  inherited,
  overridden,
  disabled,
  suffix,
  className,
  ariaLabel,
}: NumberFieldProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const scrubbing = useRef(false);

  // Drop the draft whenever the committed value changes from outside
  // (undo, breakpoint switch, a different element selected).
  useEffect(() => {
    if (!scrubbing.current) setDraft(null);
  }, [value]);

  const commit = (raw: string) => {
    setDraft(null);
    const parsed = Number.parseFloat(raw);
    if (Number.isNaN(parsed)) return;
    onChange(round(clamp(parsed, min, max), precision));
    onCommit?.();
  };

  const nudge = (direction: number, event: React.KeyboardEvent) => {
    const magnitude = event.shiftKey ? (shiftStep ?? step * 10) : event.altKey ? step / 10 : step;
    const next = round(clamp((value ?? 0) + direction * magnitude, min, max), precision);
    onChange(next);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowUp") {
      event.preventDefault();
      nudge(1, event);
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      nudge(-1, event);
    } else if (event.key === "Enter") {
      event.preventDefault();
      commit(event.currentTarget.value);
      event.currentTarget.blur();
    } else if (event.key === "Escape") {
      setDraft(null);
      event.currentTarget.blur();
    }
  };

  /** Pointer capture keeps the scrub alive if the pointer leaves the label. */
  const startScrub = (event: React.PointerEvent<HTMLSpanElement>) => {
    if (disabled) return;
    event.preventDefault();
    const element = event.currentTarget;
    element.setPointerCapture(event.pointerId);
    scrubbing.current = true;
    document.documentElement.classList.add("is-dragging");

    const startX = event.clientX;
    const startValue = value ?? 0;

    const onMove = (move: PointerEvent) => {
      const magnitude = move.shiftKey ? (shiftStep ?? step * 10) : move.altKey ? step / 10 : step;
      const delta = (move.clientX - startX) * magnitude;
      onChange(round(clamp(startValue + delta, min, max), precision));
    };

    const onUp = () => {
      scrubbing.current = false;
      document.documentElement.classList.remove("is-dragging");
      element.releasePointerCapture(event.pointerId);
      element.removeEventListener("pointermove", onMove);
      element.removeEventListener("pointerup", onUp);
      onCommit?.();
    };

    element.addEventListener("pointermove", onMove);
    element.addEventListener("pointerup", onUp);
  };

  const display = draft ?? (value === undefined ? "" : String(round(value, precision)));

  return (
    <div
      className={cn("fw-field", className)}
      data-inherited={inherited || undefined}
      data-overridden={overridden || undefined}
    >
      {label && (
        <span
          className="fw-field__label fw-field__label--scrub"
          onPointerDown={startScrub}
          aria-hidden="true"
        >
          {label}
        </span>
      )}
      <input
        className="fw-field__input"
        type="text"
        inputMode="decimal"
        role="spinbutton"
        aria-label={ariaLabel ?? label}
        aria-valuenow={value}
        aria-valuemin={Number.isFinite(min) ? min : undefined}
        aria-valuemax={Number.isFinite(max) ? max : undefined}
        value={display}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={onKeyDown}
        onBlur={(event) => commit(event.target.value)}
      />
      {unit && <span className="fw-field__unit">{unit}</span>}
      {suffix && <span className="fw-field__suffix">{suffix}</span>}
    </div>
  );
}

type SliderFieldProps = NumberFieldProps & { min: number; max: number };

/** A slider bound to a NumberField, sharing one value and one commit. */
export function SliderField({ className, ...props }: SliderFieldProps) {
  const { value, onChange, onCommit, min, max, step = 1, label, ariaLabel } = props;
  const current = value ?? min;
  const percent = ((clamp(current, min, max) - min) / (max - min)) * 100;

  return (
    <div className={cn("fw-slider", className)}>
      <div className="fw-slider__track">
        <span className="fw-slider__fill" style={{ width: `${percent}%` }} />
        <span className="fw-slider__thumb" style={{ left: `${percent}%` }} />
        <input
          type="range"
          aria-label={ariaLabel ?? label}
          min={min}
          max={max}
          step={step}
          value={current}
          disabled={props.disabled}
          onChange={(event) => onChange(Number(event.target.value))}
          onPointerUp={() => onCommit?.()}
          onKeyUp={() => onCommit?.()}
        />
      </div>
      <NumberField {...props} className="w-[68px] flex-none" />
    </div>
  );
}

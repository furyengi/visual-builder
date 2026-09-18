"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { formatColor, isHex, parseColor } from "@/lib/color";

type ColorFieldProps = {
  label?: string;
  value: string | undefined;
  onChange: (value: string) => void;
  onCommit?: () => void;
  /** Hides the opacity input for properties where alpha is meaningless. */
  alpha?: boolean;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
};

/**
 * Colour input built from three coordinated controls: a swatch that
 * opens the native picker, an editable HEX field, and an opacity
 * percentage. The hex text is held as a draft while typing so a partial
 * value like "#3f" is not parsed and rewritten mid-keystroke.
 */
export function ColorField({
  label,
  value,
  onChange,
  onCommit,
  alpha = true,
  placeholder = "None",
  disabled,
  className,
}: ColorFieldProps) {
  const parsed = parseColor(value);
  const [draft, setDraft] = useState<string | null>(null);

  useEffect(() => setDraft(null), [value]);

  const setHex = (hex: string) => {
    onChange(formatColor({ hex, alpha: parsed.alpha }));
  };

  const commitHex = (raw: string) => {
    setDraft(null);
    const next = raw.trim().startsWith("#") ? raw.trim() : `#${raw.trim()}`;
    if (!isHex(next)) return;
    setHex(parseColor(next).hex);
    onCommit?.();
  };

  const setAlpha = (percent: number) => {
    const next = Math.min(100, Math.max(0, percent)) / 100;
    onChange(formatColor({ hex: parsed.hex, alpha: next }));
  };

  const hexDisplay = draft ?? (value ? parsed.hex.replace("#", "") : "");

  return (
    <div className={cn("fw-color-field", className)}>
      <label className="fw-color-swatch" title={label ? `${label} colour` : "Colour"}>
        <span
          className="fw-color-swatch__fill"
          style={{ background: value || "transparent" }}
        />
        <input
          type="color"
          value={parsed.hex}
          disabled={disabled}
          aria-label={label ? `${label} colour` : "Colour"}
          onChange={(event) => setHex(event.target.value)}
          onBlur={() => onCommit?.()}
        />
      </label>

      <input
        className="fw-color-field__hex"
        value={hexDisplay}
        placeholder={placeholder}
        disabled={disabled}
        spellCheck={false}
        aria-label={label ? `${label} hex value` : "Hex value"}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commitHex(event.currentTarget.value);
          } else if (event.key === "Escape") {
            setDraft(null);
            event.currentTarget.blur();
          }
        }}
        onBlur={(event) => commitHex(event.target.value)}
      />

      {alpha && (
        <input
          className="fw-color-field__alpha"
          type="text"
          inputMode="numeric"
          disabled={disabled}
          aria-label={label ? `${label} opacity percentage` : "Opacity percentage"}
          value={value ? `${Math.round(parsed.alpha * 100)}%` : ""}
          onChange={(event) => setAlpha(Number.parseFloat(event.target.value) || 0)}
          onBlur={() => onCommit?.()}
        />
      )}
    </div>
  );
}

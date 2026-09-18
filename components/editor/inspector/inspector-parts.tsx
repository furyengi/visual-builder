"use client";

import { useId, useState, type ReactNode } from "react";
import { ChevronRight, Link2, Link2Off, RotateCcw } from "lucide-react";

import { NumberField } from "@/components/ui/number-field";
import { useEditor } from "@/lib/editor/store";
import type { StyleProperty } from "@/lib/editor/types";
import {
  formatLength,
  parseLength,
  UNIT_LABELS,
  useStyleEditor,
  type Unit,
} from "./use-style";

/* ------------------------------------------------------------------
   Collapsible section
   ------------------------------------------------------------------ */

export function Section({
  id,
  title,
  /** Count of properties set here, shown when collapsed. */
  badge,
  children,
}: {
  id: string;
  title: string;
  badge?: number;
  children: ReactNode;
}) {
  const { state, dispatch } = useEditor();
  const contentId = useId();
  const collapsed = state.panels.collapsedSections.includes(id);

  const toggle = () => {
    const current = state.panels.collapsedSections;
    dispatch({
      type: "setPanels",
      patch: {
        collapsedSections: collapsed
          ? current.filter((entry) => entry !== id)
          : [...current, id],
      },
    });
  };

  return (
    <section className="inspector-section">
      <h3>
        <button
          type="button"
          className="inspector-section__trigger focus-ring-inset"
          aria-expanded={!collapsed}
          aria-controls={contentId}
          onClick={toggle}
        >
          <ChevronRight size={12} className="inspector-section__chevron" aria-hidden="true" />
          {title}
          {badge ? (
            <span className="inspector-section__badge">{badge}</span>
          ) : null}
        </button>
      </h3>
      {/* Animated with grid-template-rows so the browser measures the
          content; no height calculation, and it stays correct when the
          contents change while open. */}
      <div id={contentId} className="fw-collapse" data-open={!collapsed}>
        <div className="fw-collapse__inner">
          <div className="inspector-section__content">{children}</div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------
   Labelled row with reset
   ------------------------------------------------------------------ */

export function Row({
  label,
  properties,
  children,
}: {
  label: string;
  /** Properties this row owns, used for the reset action. */
  properties?: StyleProperty[];
  children: ReactNode;
}) {
  const { reset, isSetHere, overridden } = useStyleEditor();
  const resettable = properties?.some(isSetHere) ?? false;
  const isOverride = properties?.some(overridden) ?? false;

  return (
    <div className="inspector-row">
      <span className="inspector-row__label flex items-center gap-1.5">
        {isOverride && (
          <span
            className="override-dot"
            title={`Overridden at this breakpoint`}
            aria-hidden="true"
          />
        )}
        {label}
      </span>
      <div className="flex min-w-0 items-center gap-1">
        <div className="min-w-0 flex-1">{children}</div>
        {properties && (
          <button
            type="button"
            className="reset-button"
            aria-label={`Reset ${label.toLowerCase()}`}
            disabled={!resettable}
            style={resettable ? undefined : { visibility: "hidden" }}
            onClick={() => reset(properties)}
          >
            <RotateCcw size={11} />
          </button>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------
   Length field with a unit selector
   ------------------------------------------------------------------ */

export function LengthField({
  property,
  units = ["px", "%", "vw", "auto", "fit"],
  min,
  label,
}: {
  property: Extract<
    StyleProperty,
    "width" | "height" | "minWidth" | "minHeight" | "maxWidth" | "maxHeight"
  >;
  units?: Unit[];
  min?: number;
  label: string;
}) {
  const { styles, set, commit, inherited, overridden } = useStyleEditor();
  const { amount, unit } = parseLength(styles[property]);
  const noValue = unit === "auto" || unit === "fit";

  return (
    <div
      className="fw-field"
      data-inherited={inherited(property) || undefined}
      data-overridden={overridden(property) || undefined}
    >
      <input
        className="fw-field__input"
        type="text"
        inputMode="decimal"
        aria-label={label}
        disabled={noValue}
        value={noValue ? "" : (amount ?? "")}
        placeholder={noValue ? UNIT_LABELS[unit] : "0"}
        onChange={(event) => {
          const next = Number.parseFloat(event.target.value);
          set({ [property]: formatLength(Number.isNaN(next) ? 0 : next, unit) });
        }}
        onBlur={commit}
      />
      <select
        className="unit-select"
        aria-label={`${label} unit`}
        value={unit}
        onChange={(event) => {
          const nextUnit = event.target.value as Unit;
          // Switching to px from a relative unit keeps the number; the
          // value is the user's, and silently resetting it is worse than
          // a value that needs adjusting.
          set({
            [property]: formatLength(
              amount ?? (min ?? 0),
              nextUnit,
            ),
          });
          commit();
        }}
      >
        {units.map((value) => (
          <option key={value} value={value}>
            {UNIT_LABELS[value]}
          </option>
        ))}
      </select>
    </div>
  );
}

/* ------------------------------------------------------------------
   Numeric style field
   ------------------------------------------------------------------ */

export function StyleNumber({
  property,
  label,
  min,
  max,
  step,
  unit,
  precision,
}: {
  property: StyleProperty;
  label: string;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  precision?: number;
}) {
  const { styles, set, commit, inherited, overridden, isMixed } = useStyleEditor();
  const value = styles[property];

  return (
    <NumberField
      label={label}
      ariaLabel={label}
      value={typeof value === "number" ? value : undefined}
      placeholder={isMixed(property) ? "Mixed" : "auto"}
      min={min}
      max={max}
      step={step}
      precision={precision}
      unit={unit}
      inherited={inherited(property)}
      overridden={overridden(property)}
      onChange={(next) => set({ [property]: next })}
      onCommit={commit}
    />
  );
}

/* ------------------------------------------------------------------
   Four-value group with a link toggle (spacing, radii)
   ------------------------------------------------------------------ */

export function LinkedQuad({
  label,
  properties,
  labels,
  min = 0,
}: {
  label: string;
  /** In order: top/right/bottom/left, or the four corners. */
  properties: [StyleProperty, StyleProperty, StyleProperty, StyleProperty];
  labels: [string, string, string, string];
  min?: number;
}) {
  const { styles, set, commit, inherited } = useStyleEditor();
  const values = properties.map((property) => styles[property] as number | undefined);
  const allEqual = values.every((value) => value === values[0]);
  const [linked, setLinked] = useState(allEqual);

  const update = (index: number, next: number) => {
    if (linked) {
      set(Object.fromEntries(properties.map((property) => [property, next])));
    } else {
      set({ [properties[index]]: next });
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="inspector-row__label">{label}</span>
        <button
          type="button"
          className="link-toggle"
          aria-pressed={linked}
          aria-label={linked ? `Unlink ${label} values` : `Link ${label} values`}
          onClick={() => setLinked((value) => !value)}
        >
          {linked ? <Link2 size={12} /> : <Link2Off size={12} />}
        </button>
      </div>
      <div className="inspector-grid">
        {properties.map((property, index) => (
          <NumberField
            key={property}
            label={labels[index]}
            ariaLabel={`${label} ${labels[index]}`}
            value={values[index]}
            min={min}
            inherited={inherited(property)}
            onChange={(next) => update(index, next)}
            onCommit={commit}
          />
        ))}
      </div>
    </div>
  );
}

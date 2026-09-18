"use client";

import { Link2, Link2Off } from "lucide-react";
import { useState } from "react";

import type { StyleProperty } from "@/lib/editor/types";
import { useStyleEditor } from "./use-style";

type Side = "Top" | "Right" | "Bottom" | "Left";
const SIDES: Side[] = ["Top", "Right", "Bottom", "Left"];

/**
 * Padding and margin edited on a diagram of the box.
 *
 * Four bare number inputs in a row require the user to remember a
 * convention; a box with the value on the matching edge does not. Each
 * cell is a real input, so it stays keyboard-reachable and typeable.
 */
export function BoxModel({
  prefix,
  label,
}: {
  prefix: "padding" | "margin";
  label: string;
}) {
  const { styles, set, commit, inherited } = useStyleEditor();
  const [linked, setLinked] = useState(false);

  const propertyFor = (side: Side) => `${prefix}${side}` as StyleProperty;
  const valueFor = (side: Side) => styles[propertyFor(side)] as number | undefined;

  const update = (side: Side, raw: string) => {
    const next = Number.parseFloat(raw);
    const value = Number.isNaN(next) ? 0 : next;
    if (linked) {
      set(Object.fromEntries(SIDES.map((each) => [propertyFor(each), value])));
    } else {
      set({ [propertyFor(side)]: value });
    }
  };

  const cell = (side: Side) => (
    <input
      className="box-model__input"
      type="text"
      inputMode="numeric"
      aria-label={`${label} ${side.toLowerCase()}`}
      data-inherited={inherited(propertyFor(side)) || undefined}
      value={valueFor(side) ?? 0}
      onChange={(event) => update(side, event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        // Arrow keys adjust by one, or by ten with Shift, matching the
        // behaviour of every other numeric control in the inspector.
        if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
        event.preventDefault();
        const step = (event.shiftKey ? 10 : 1) * (event.key === "ArrowUp" ? 1 : -1);
        update(side, String((valueFor(side) ?? 0) + step));
      }}
    />
  );

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="inspector-row__label">{label}</span>
        <button
          type="button"
          className="link-toggle"
          aria-pressed={linked}
          aria-label={linked ? `Unlink ${label} sides` : `Link ${label} sides`}
          onClick={() => setLinked((value) => !value)}
        >
          {linked ? <Link2 size={12} /> : <Link2Off size={12} />}
        </button>
      </div>

      <div className="box-model">
        <div className="box-model__ring">
          <span />
          {cell("Top")}
          <span />
          {cell("Left")}
          <span className="box-model__centre" aria-hidden="true">
            {label}
          </span>
          {cell("Right")}
          <span />
          {cell("Bottom")}
          <span />
        </div>
      </div>
    </div>
  );
}

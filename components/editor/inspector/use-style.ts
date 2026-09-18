"use client";

import { useCallback, useMemo } from "react";

import {
  isInherited,
  isOverride,
  resolveStyles,
} from "@/lib/editor/breakpoints";
import { useEditor } from "@/lib/editor/store";
import type { StyleMap, StyleProperty } from "@/lib/editor/types";

/**
 * Reading and writing styles for the current selection.
 *
 * Every field goes through here so three things stay consistent across
 * the whole inspector: values reflect the breakpoint cascade, edits
 * apply to the entire selection, and the inherited/overridden state is
 * derived from the document rather than tracked separately.
 */
export function useStyleEditor() {
  const { state, run, commit } = useEditor();
  const ids = state.selectedIds;
  const breakpoint = state.breakpoint;

  const primary = ids[0] ? state.document.nodes[ids[0]] : null;

  const resolved: StyleMap = useMemo(
    () => (primary ? resolveStyles(primary, breakpoint) : {}),
    [breakpoint, primary],
  );

  /**
   * True when the selected nodes disagree on a property. The field then
   * shows nothing rather than one node's value standing in for all of
   * them, which would quietly misreport the others.
   */
  const isMixed = useCallback(
    (property: StyleProperty) => {
      if (ids.length < 2) return false;
      const first = resolveStyles(state.document.nodes[ids[0]], breakpoint)[property];
      return ids.some(
        (id) => resolveStyles(state.document.nodes[id], breakpoint)[property] !== first,
      );
    },
    [breakpoint, ids, state.document.nodes],
  );

  const set = useCallback(
    (patch: StyleMap) => {
      if (!ids.length) return;
      run({ type: "setStyles", ids, breakpoint, patch });
    },
    [breakpoint, ids, run],
  );

  const reset = useCallback(
    (properties: StyleProperty[]) => {
      if (!ids.length) return;
      run({ type: "resetStyles", ids, breakpoint, properties });
      commit();
    },
    [breakpoint, commit, ids, run],
  );

  const inherited = useCallback(
    (property: StyleProperty) =>
      primary ? isInherited(primary, breakpoint, property) : false,
    [breakpoint, primary],
  );

  const overridden = useCallback(
    (property: StyleProperty) =>
      primary ? isOverride(primary, breakpoint, property) : false,
    [breakpoint, primary],
  );

  /** True when the property is set at this breakpoint, so it can be reset. */
  const isSetHere = useCallback(
    (property: StyleProperty) =>
      primary ? primary.styles[breakpoint]?.[property] !== undefined : false,
    [breakpoint, primary],
  );

  return {
    ids,
    breakpoint,
    node: primary,
    styles: resolved,
    set,
    reset,
    commit,
    inherited,
    overridden,
    isSetHere,
    isMixed,
    multiple: ids.length > 1,
  };
}

/* ---------------------------------------------------------------
   CSS length helpers

   The document stores lengths as raw CSS strings so that `auto`,
   `fit-content` and percentages round-trip losslessly. These split a
   string into a number and a unit for editing, and put it back
   together afterwards.
   --------------------------------------------------------------- */

export type Unit = "px" | "%" | "vw" | "vh" | "auto" | "fit";

export const UNIT_LABELS: Record<Unit, string> = {
  px: "px",
  "%": "%",
  vw: "vw",
  vh: "vh",
  auto: "auto",
  fit: "fit",
};

export function parseLength(value: string | undefined): {
  amount: number | undefined;
  unit: Unit;
} {
  if (!value) return { amount: undefined, unit: "auto" };
  if (value === "auto") return { amount: undefined, unit: "auto" };
  if (value === "fit-content" || value === "max-content" || value === "min-content") {
    return { amount: undefined, unit: "fit" };
  }

  const match = value.match(/^(-?[\d.]+)(px|%|vw|vh|rem|em)?$/);
  if (!match) return { amount: undefined, unit: "auto" };

  const amount = Number.parseFloat(match[1]);
  const raw = match[2] ?? "px";
  const unit: Unit = raw === "%" || raw === "vw" || raw === "vh" ? raw : "px";
  return { amount, unit };
}

export function formatLength(amount: number | undefined, unit: Unit): string | undefined {
  if (unit === "auto") return undefined;
  if (unit === "fit") return "fit-content";
  if (amount === undefined || Number.isNaN(amount)) return undefined;
  return `${amount}${unit}`;
}

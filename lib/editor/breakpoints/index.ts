import type { Breakpoint, EditorNode, StyleMap, StyleProperty } from "../types";

/**
 * Breakpoints cascade widest-first: a tablet style inherits from
 * desktop, and mobile inherits from both. Only properties the user
 * actually changed at a narrower size are stored there, so widening a
 * desktop value automatically flows down unless it was overridden.
 */
export const BREAKPOINT_ORDER: Breakpoint[] = ["desktop", "tablet", "mobile"];

export const BREAKPOINT_WIDTHS: Record<Breakpoint, number> = {
  desktop: 1280,
  tablet: 834,
  mobile: 390,
};

/** Upper bound of each breakpoint, used to label the viewport frame. */
export const BREAKPOINT_MAX_WIDTH: Record<Breakpoint, number | null> = {
  desktop: null,
  tablet: 1023,
  mobile: 767,
};

export const BREAKPOINT_LABELS: Record<Breakpoint, string> = {
  desktop: "Desktop",
  tablet: "Tablet",
  mobile: "Mobile",
};

/** Every breakpoint from widest down to and including `breakpoint`. */
export function cascadeChain(breakpoint: Breakpoint): Breakpoint[] {
  const index = BREAKPOINT_ORDER.indexOf(breakpoint);
  return BREAKPOINT_ORDER.slice(0, index + 1);
}

/** The flattened style a node renders with at a given breakpoint. */
export function resolveStyles(node: EditorNode, breakpoint: Breakpoint): StyleMap {
  return cascadeChain(breakpoint).reduce<StyleMap>(
    (merged, level) => Object.assign(merged, node.styles[level]),
    {},
  );
}

/** Which breakpoint a resolved property actually came from. */
export function styleOrigin(
  node: EditorNode,
  breakpoint: Breakpoint,
  property: StyleProperty,
): Breakpoint | null {
  const chain = cascadeChain(breakpoint);
  for (let i = chain.length - 1; i >= 0; i -= 1) {
    if (node.styles[chain[i]]?.[property] !== undefined) return chain[i];
  }
  return null;
}

/** True when the value shown is set at a wider breakpoint than this one. */
export function isInherited(
  node: EditorNode,
  breakpoint: Breakpoint,
  property: StyleProperty,
): boolean {
  const origin = styleOrigin(node, breakpoint, property);
  return origin !== null && origin !== breakpoint;
}

/** True when this breakpoint overrides a value that a wider one also sets. */
export function isOverride(
  node: EditorNode,
  breakpoint: Breakpoint,
  property: StyleProperty,
): boolean {
  if (breakpoint === "desktop") return false;
  if (node.styles[breakpoint]?.[property] === undefined) return false;
  return cascadeChain(breakpoint)
    .slice(0, -1)
    .some((level) => node.styles[level]?.[property] !== undefined);
}

/** Count of properties overridden at a breakpoint, for the panel badge. */
export function overrideCount(node: EditorNode, breakpoint: Breakpoint): number {
  if (breakpoint === "desktop") return 0;
  return Object.keys(node.styles[breakpoint] ?? {}).length;
}

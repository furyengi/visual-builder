import {
  ancestorIds,
  descendantIds,
  flattenTree,
  isEffectivelyLocked,
} from "../document";
import type { EditorDocument } from "../types";

/**
 * Selection rules.
 *
 * Selection is an ordered list of ids kept in document order, which
 * makes group operations (move, align, delete) deterministic regardless
 * of the order the user clicked things in.
 */

/** Sorts a selection into document order and removes anything stale. */
export function normalize(document: EditorDocument, ids: string[]): string[] {
  const order = flattenTree(document.nodes, document.rootId);
  const unique = new Set(ids.filter((id) => document.nodes[id]));
  return order.filter((id) => unique.has(id));
}

/**
 * Multi-selection is restricted to siblings. Selecting a node together
 * with its own ancestor has no coherent meaning for a group move, and
 * every design tool that allows it ends up with ambiguous drags.
 */
export function addToSelection(
  document: EditorDocument,
  current: string[],
  id: string,
): string[] {
  if (!document.nodes[id]) return current;
  if (current.includes(id)) return current.filter((existing) => existing !== id);
  if (!current.length) return [id];

  const parentId = document.nodes[id].parentId;
  const sameParent = current.every(
    (existing) => document.nodes[existing]?.parentId === parentId,
  );
  return sameParent ? normalize(document, [...current, id]) : [id];
}

/** Shift-click: every sibling between the anchor and the clicked node. */
export function extendSelection(
  document: EditorDocument,
  current: string[],
  id: string,
): string[] {
  const anchor = current.at(-1);
  if (!anchor || !document.nodes[id]) return [id];

  const parentId = document.nodes[id].parentId;
  if (!parentId || document.nodes[anchor]?.parentId !== parentId) return [id];

  const siblings = document.nodes[parentId].children;
  const from = siblings.indexOf(anchor);
  const to = siblings.indexOf(id);
  if (from < 0 || to < 0) return [id];

  const [start, end] = from < to ? [from, to] : [to, from];
  return normalize(document, siblings.slice(start, end + 1));
}

/**
 * Escape steps out: to the parent when something is selected inside a
 * container, and to nothing at the top. This gives a keyboard-only way
 * to reach containers that are fully covered by their children.
 */
export function selectParent(document: EditorDocument, ids: string[]): string[] {
  const first = ids[0];
  if (!first) return [];
  const parentId = document.nodes[first]?.parentId;
  if (!parentId || parentId === document.rootId) return parentId ? [parentId] : [];
  return [parentId];
}

export function selectFirstChild(
  document: EditorDocument,
  ids: string[],
): string[] {
  const first = ids[0];
  const child = first ? document.nodes[first]?.children[0] : undefined;
  return child ? [child] : ids;
}

/** Previous or next sibling, for arrow-key traversal of the layer tree. */
export function selectSibling(
  document: EditorDocument,
  ids: string[],
  direction: 1 | -1,
): string[] {
  const current = ids.at(-1);
  if (!current) return ids;
  const parentId = document.nodes[current]?.parentId;
  if (!parentId) return ids;
  const siblings = document.nodes[parentId].children;
  const next = siblings[siblings.indexOf(current) + direction];
  return next ? [next] : ids;
}

/**
 * The deepest selectable node at a point, honouring locks. Used by the
 * canvas so a click lands on the element the user sees rather than on
 * whichever container happens to be on top.
 */
export function selectableAt(
  document: EditorDocument,
  candidateIds: string[],
): string | null {
  for (let i = candidateIds.length - 1; i >= 0; i -= 1) {
    const id = candidateIds[i];
    if (document.nodes[id] && !isEffectivelyLocked(document.nodes, id)) return id;
  }
  return null;
}

/**
 * Clicking a nested element first selects its outermost ancestor below
 * the root, then drills in on repeat clicks — the behaviour designers
 * expect from grouped objects.
 */
export function drillTarget(
  document: EditorDocument,
  clickedId: string,
  current: string[],
): string {
  const chain = [...ancestorIds(document.nodes, clickedId).reverse(), clickedId].filter(
    (id) => id !== document.rootId,
  );
  if (!chain.length) return clickedId;

  const selected = current[0];
  if (!selected) return chain[0];

  const index = chain.indexOf(selected);
  if (index === -1) {
    // Selection is elsewhere in the tree: start at the top of this branch.
    return chain[0];
  }
  return chain[Math.min(index + 1, chain.length - 1)];
}

/** Ancestors of the selection, for drawing parent outlines. */
export function selectionAncestors(
  document: EditorDocument,
  ids: string[],
): string[] {
  const set = new Set<string>();
  for (const id of ids) {
    for (const ancestor of ancestorIds(document.nodes, id)) {
      if (ancestor !== document.rootId) set.add(ancestor);
    }
  }
  return [...set];
}

/** Direct children of the selection, for drawing child outlines. */
export function selectionChildren(
  document: EditorDocument,
  ids: string[],
): string[] {
  return ids.flatMap((id) => document.nodes[id]?.children ?? []);
}

/** True when any selected node contains any other node in the list. */
export function containsDescendant(
  document: EditorDocument,
  ids: string[],
  candidate: string,
): boolean {
  return ids.some((id) => descendantIds(document.nodes, id).includes(candidate));
}

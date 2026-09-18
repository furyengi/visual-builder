import { descendantIds } from "../document";
import type { EditorDocument, EditorNode } from "../types";

/**
 * An in-memory clipboard holding whole subtrees.
 *
 * The system clipboard is deliberately not used: reading it requires a
 * permission prompt in most browsers, and writing editor JSON into it
 * would clobber whatever the user had copied elsewhere. Copy/paste here
 * is scoped to the editor, which is what the keyboard shortcuts imply.
 */

export type ClipboardEntry = {
  /** Flat table of every node in the copied subtrees. */
  nodes: Record<string, EditorNode>;
  /** Roots of the copied selection, in document order. */
  rootIds: string[];
  copiedAt: number;
};

let clipboard: ClipboardEntry | null = null;

export function copyNodes(
  document: EditorDocument,
  ids: string[],
): ClipboardEntry | null {
  const roots = ids.filter((id) => document.nodes[id] && id !== document.rootId);
  if (!roots.length) return null;

  // The snapshot is deep-cloned so later edits to the originals, or an
  // undo past the copy, cannot mutate what is on the clipboard.
  const nodes: Record<string, EditorNode> = {};
  for (const root of roots) {
    for (const id of descendantIds(document.nodes, root)) {
      nodes[id] = structuredClone(document.nodes[id]);
    }
  }

  clipboard = { nodes, rootIds: roots, copiedAt: Date.now() };
  return clipboard;
}

export function readClipboard(): ClipboardEntry | null {
  return clipboard;
}

export function hasClipboard(): boolean {
  return clipboard !== null && clipboard.rootIds.length > 0;
}

export function clearClipboard() {
  clipboard = null;
}

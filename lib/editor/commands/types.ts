import type { Breakpoint, EditorNode, NodeKind, StyleMap, StyleProperty } from "../types";

/**
 * Every document mutation is expressed as one of these. Keeping them as
 * plain serialisable data is what makes the rest of the roadmap cheap:
 * a command log can be sent to a server, replayed for collaboration, or
 * diffed for a code exporter without the editor being involved.
 */
export type Command =
  | {
      type: "insertNode";
      kind: NodeKind;
      parentId: string;
      /** Appended when omitted. */
      index?: number;
    }
  | {
      type: "insertSubtree";
      /** Flat node table of the subtree, keyed by its original ids. */
      nodes: Record<string, EditorNode>;
      rootId: string;
      parentId: string;
      index?: number;
    }
  | { type: "deleteNodes"; ids: string[] }
  | { type: "duplicateNodes"; ids: string[] }
  | { type: "moveNodes"; ids: string[]; parentId: string; index: number }
  | {
      type: "setStyles";
      ids: string[];
      breakpoint: Breakpoint;
      patch: StyleMap;
    }
  | {
      type: "resetStyles";
      ids: string[];
      breakpoint: Breakpoint;
      properties: StyleProperty[];
    }
  | { type: "setContent"; id: string; content: string }
  | { type: "renameNode"; id: string; name: string }
  | { type: "setNodeProps"; id: string; patch: Partial<Pick<EditorNode, "src" | "alt" | "href">> }
  | { type: "setNodeFlag"; ids: string[]; flag: "hidden" | "locked"; value: boolean }
  | { type: "renameDocument"; name: string };

export type CommandResult = {
  /** Unchanged reference when the command was a no-op. */
  document: import("../types").EditorDocument;
  /** Selection the command implies, e.g. the node it just inserted. */
  selection?: string[];
  /** Short past-tense phrase announced to assistive tech. */
  announcement?: string;
};

/**
 * Commands that should merge with the previous history entry when they
 * repeat quickly — dragging a slider must not produce fifty undo steps.
 */
export const COALESCING_COMMANDS = new Set<Command["type"]>([
  "setStyles",
  "setContent",
  "renameNode",
  "renameDocument",
]);

/** Commands that never produce a history entry. */
export const TRANSIENT_COMMANDS = new Set<Command["type"]>([]);

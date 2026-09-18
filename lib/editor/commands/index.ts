import {
  ancestorIds,
  canHaveChildren,
  cloneSubtree,
  createNode,
  descendantIds,
  isAncestor,
  NODE_LABELS,
} from "../document";
import type { EditorDocument, EditorNode, StyleMap } from "../types";
import type { Command, CommandResult } from "./types";

export * from "./types";

/** Shallow-copies the node table so reducers stay referentially honest. */
const draft = (document: EditorDocument) => ({ ...document.nodes });

const touch = (
  document: EditorDocument,
  nodes: Record<string, EditorNode>,
): EditorDocument => ({ ...document, nodes, updatedAt: Date.now() });

const noop = (document: EditorDocument): CommandResult => ({ document });

/** Removes `id` from its current parent, mutating the draft in place. */
function detach(nodes: Record<string, EditorNode>, id: string) {
  const parentId = nodes[id]?.parentId;
  if (!parentId || !nodes[parentId]) return;
  nodes[parentId] = {
    ...nodes[parentId],
    children: nodes[parentId].children.filter((child) => child !== id),
  };
}

function insertAt(
  nodes: Record<string, EditorNode>,
  parentId: string,
  id: string,
  index?: number,
) {
  const parent = nodes[parentId];
  const children = [...parent.children];
  children.splice(index ?? children.length, 0, id);
  nodes[parentId] = { ...parent, children };
  nodes[id] = { ...nodes[id], parentId };
}

/**
 * Drops any id that is a descendant of another id in the same list.
 * Moving or deleting a parent already takes its children with it, and
 * acting on both would double-apply the operation.
 */
function topMost(nodes: Record<string, EditorNode>, ids: string[]): string[] {
  return ids.filter((id) => !ids.some((other) => other !== id && isAncestor(nodes, other, id)));
}

const plural = (count: number, word: string) =>
  `${count} ${word}${count === 1 ? "" : "s"}`;

/**
 * Applies one command to a document, returning a new document plus any
 * selection change it implies. Pure: no React, no storage, no clock
 * beyond the `updatedAt` stamp.
 */
export function applyCommand(
  document: EditorDocument,
  command: Command,
): CommandResult {
  switch (command.type) {
    case "insertNode": {
      const parent = document.nodes[command.parentId];
      if (!canHaveChildren(parent)) return noop(document);

      const nodes = draft(document);
      const node = createNode(command.kind, command.parentId);
      nodes[node.id] = node;
      insertAt(nodes, command.parentId, node.id, command.index);

      return {
        document: touch(document, nodes),
        selection: [node.id],
        announcement: `${NODE_LABELS[command.kind]} added`,
      };
    }

    case "insertSubtree": {
      const parent = document.nodes[command.parentId];
      if (!canHaveChildren(parent)) return noop(document);

      // The pasted subtree carries the ids it had when copied, which may
      // still be live in this document. It is staged into the table,
      // cloned to get fresh ids, then the staged originals are removed.
      const nodes = draft(document);
      const staged = Object.keys(command.nodes).filter((id) => !nodes[id]);
      for (const id of staged) nodes[id] = command.nodes[id];
      if (!nodes[command.rootId]) return noop(document);

      const newId = cloneSubtree(nodes, command.rootId, command.parentId);
      for (const id of staged) delete nodes[id];

      insertAt(nodes, command.parentId, newId, command.index);
      return {
        document: touch(document, nodes),
        selection: [newId],
        announcement: "Element pasted",
      };
    }

    case "deleteNodes": {
      const targets = topMost(document.nodes, command.ids).filter(
        (id) => id !== document.rootId && document.nodes[id],
      );
      if (!targets.length) return noop(document);

      const nodes = draft(document);
      // Selection falls back to the parent of the first deleted node,
      // so the user keeps a sensible place in the tree.
      const fallback = nodes[targets[0]].parentId;

      for (const id of targets) {
        detach(nodes, id);
        for (const descendant of descendantIds(nodes, id)) delete nodes[descendant];
      }

      return {
        document: touch(document, nodes),
        selection: fallback ? [fallback] : [],
        announcement: `${plural(targets.length, "element")} deleted`,
      };
    }

    case "duplicateNodes": {
      const targets = topMost(document.nodes, command.ids).filter(
        (id) => id !== document.rootId && document.nodes[id],
      );
      if (!targets.length) return noop(document);

      const nodes = draft(document);
      const created: string[] = [];

      for (const id of targets) {
        const parentId = nodes[id].parentId;
        if (!parentId) continue;
        const copyId = cloneSubtree(nodes, id, parentId);
        // Placed immediately after the original, which is where the
        // user expects a duplicate to appear.
        const index = nodes[parentId].children.indexOf(id) + 1;
        insertAt(nodes, parentId, copyId, index);
        created.push(copyId);
      }

      if (!created.length) return noop(document);
      return {
        document: touch(document, nodes),
        selection: created,
        announcement: `${plural(created.length, "element")} duplicated`,
      };
    }

    case "moveNodes": {
      const destination = document.nodes[command.parentId];
      if (!canHaveChildren(destination)) return noop(document);

      const targets = topMost(document.nodes, command.ids).filter(
        (id) =>
          id !== document.rootId &&
          document.nodes[id] &&
          // Dropping a node into its own subtree would orphan the tree.
          id !== command.parentId &&
          !isAncestor(document.nodes, id, command.parentId),
      );
      if (!targets.length) return noop(document);

      const nodes = draft(document);
      // The insertion index is measured before removal, then corrected
      // for any earlier siblings that the move itself takes out.
      const siblings = nodes[command.parentId].children;
      const removedBefore = targets.filter(
        (id) => siblings.includes(id) && siblings.indexOf(id) < command.index,
      ).length;
      let index = Math.max(0, command.index - removedBefore);

      for (const id of targets) detach(nodes, id);
      for (const id of targets) {
        insertAt(nodes, command.parentId, id, index);
        index += 1;
      }

      return {
        document: touch(document, nodes),
        selection: targets,
        announcement: `${plural(targets.length, "element")} moved into ${
          nodes[command.parentId].name
        }`,
      };
    }

    case "setStyles": {
      const ids = command.ids.filter((id) => document.nodes[id]);
      if (!ids.length) return noop(document);

      const nodes = draft(document);
      for (const id of ids) {
        const node = nodes[id];
        const current = node.styles[command.breakpoint] ?? {};
        const next: StyleMap = { ...current, ...command.patch };
        // An explicit `undefined` in the patch means "unset here and
        // let the cascade decide", so those keys are dropped entirely.
        for (const key of Object.keys(command.patch) as (keyof StyleMap)[]) {
          if (command.patch[key] === undefined) delete next[key];
        }
        nodes[id] = { ...node, styles: { ...node.styles, [command.breakpoint]: next } };
      }
      return { document: touch(document, nodes) };
    }

    case "resetStyles": {
      const ids = command.ids.filter((id) => document.nodes[id]);
      if (!ids.length) return noop(document);

      const nodes = draft(document);
      for (const id of ids) {
        const node = nodes[id];
        const current = { ...(node.styles[command.breakpoint] ?? {}) };
        for (const property of command.properties) delete current[property];
        const styles = { ...node.styles };
        if (Object.keys(current).length) styles[command.breakpoint] = current;
        else delete styles[command.breakpoint];
        nodes[id] = { ...node, styles };
      }
      return {
        document: touch(document, nodes),
        announcement: "Reset to inherited value",
      };
    }

    case "setContent": {
      const node = document.nodes[command.id];
      if (!node || node.content === command.content) return noop(document);
      const nodes = draft(document);
      nodes[command.id] = { ...node, content: command.content };
      return { document: touch(document, nodes) };
    }

    case "renameNode": {
      const node = document.nodes[command.id];
      const name = command.name.trim();
      if (!node || !name || node.name === name) return noop(document);
      const nodes = draft(document);
      nodes[command.id] = { ...node, name };
      return { document: touch(document, nodes) };
    }

    case "setNodeProps": {
      const node = document.nodes[command.id];
      if (!node) return noop(document);
      const nodes = draft(document);
      nodes[command.id] = { ...node, ...command.patch };
      return { document: touch(document, nodes) };
    }

    case "setNodeFlag": {
      const ids = command.ids.filter((id) => document.nodes[id]);
      if (!ids.length) return noop(document);
      const nodes = draft(document);
      for (const id of ids) nodes[id] = { ...nodes[id], [command.flag]: command.value };
      const verb =
        command.flag === "hidden"
          ? command.value
            ? "hidden"
            : "shown"
          : command.value
            ? "locked"
            : "unlocked";
      return {
        document: touch(document, nodes),
        announcement: `${plural(ids.length, "element")} ${verb}`,
      };
    }

    case "renameDocument": {
      const name = command.name.trim();
      if (!name || name === document.name) return noop(document);
      return { document: { ...document, name, updatedAt: Date.now() } };
    }

    default: {
      // Exhaustiveness guard: adding a command without handling it here
      // becomes a compile error rather than a silent no-op.
      const exhaustive: never = command;
      void exhaustive;
      return noop(document);
    }
  }
}

/** Where a node would be inserted given a drop target reference. */
export function resolveDropIndex(
  document: EditorDocument,
  referenceId: string,
  position: "before" | "after" | "inside",
): { parentId: string; index: number } | null {
  const reference = document.nodes[referenceId];
  if (!reference) return null;

  if (position === "inside") {
    if (!canHaveChildren(reference)) return null;
    return { parentId: referenceId, index: reference.children.length };
  }

  const parentId = reference.parentId;
  if (!parentId) return null;
  const index = document.nodes[parentId].children.indexOf(referenceId);
  return { parentId, index: position === "before" ? index : index + 1 };
}

/** Breadcrumb trail from the root down to a node. */
export function breadcrumbFor(
  document: EditorDocument,
  id: string,
): EditorNode[] {
  return [...ancestorIds(document.nodes, id).reverse(), id]
    .map((nodeId) => document.nodes[nodeId])
    .filter(Boolean);
}

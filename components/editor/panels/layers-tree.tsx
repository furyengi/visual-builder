"use client";

import { useMemo, useState } from "react";
import {
  Box,
  ChevronRight,
  Columns3,
  Eye,
  EyeOff,
  Heading1,
  Image as ImageIcon,
  LayoutPanelTop,
  Lock,
  Minus,
  MousePointerClick,
  Move3d,
  Type,
  Unlock,
} from "lucide-react";

import { IconButton } from "@/components/ui/icon-button";
import { resolveDropIndex } from "@/lib/editor/commands";
import { ancestorIds, canHaveChildren, isAncestor } from "@/lib/editor/document";
import { useEditor } from "@/lib/editor/store";
import type { DropPosition, NodeKind } from "@/lib/editor/types";

const ICONS: Record<NodeKind, React.ReactNode> = {
  section: <LayoutPanelTop size={13} />,
  container: <Box size={13} />,
  grid: <Columns3 size={13} />,
  heading: <Heading1 size={13} />,
  text: <Type size={13} />,
  button: <MousePointerClick size={13} />,
  image: <ImageIcon size={13} />,
  divider: <Minus size={13} />,
  spacer: <Move3d size={13} />,
};

const INDENT = 14;

/**
 * The layers tree.
 *
 * Every canvas manipulation has an equivalent here, which is what makes
 * the editor usable without pointer precision: reordering, nesting,
 * renaming, hiding and locking are all reachable by keyboard.
 */
export function LayersTree() {
  const { state } = useEditor();
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [dropHint, setDropHint] = useState<{ id: string; position: DropPosition } | null>(
    null,
  );

  const expandedAncestors = useMemo(
    () => new Set(state.selectedIds.flatMap((id) => ancestorIds(state.document.nodes, id))),
    [state.document.nodes, state.selectedIds],
  );

  return (
    <div className="layer-tree" role="tree" aria-label="Layers">
      <LayerRow
        id={state.document.rootId}
        depth={0}
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        expandedAncestors={expandedAncestors}
        dropHint={dropHint}
        setDropHint={setDropHint}
      />
    </div>
  );
}

function LayerRow({
  id,
  depth,
  collapsed,
  setCollapsed,
  expandedAncestors,
  dropHint,
  setDropHint,
}: {
  id: string;
  depth: number;
  collapsed: Set<string>;
  setCollapsed: (value: Set<string>) => void;
  expandedAncestors: Set<string>;
  dropHint: { id: string; position: DropPosition } | null;
  setDropHint: (value: { id: string; position: DropPosition } | null) => void;
}) {
  const { state, dispatch, run } = useEditor();
  const [renaming, setRenaming] = useState(false);

  const node = state.document.nodes[id];
  if (!node) return null;

  const selected = state.selectedIds.includes(id);
  const isAncestorOfSelection = expandedAncestors.has(id) && !selected;
  const container = canHaveChildren(node);
  // A collapsed branch still opens automatically when the selection
  // moves inside it, so the tree never hides where you are.
  const open = container && (!collapsed.has(id) || expandedAncestors.has(id));
  const isRoot = id === state.document.rootId;

  const toggle = () => {
    const next = new Set(collapsed);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setCollapsed(next);
  };

  const hint = dropHint?.id === id ? dropHint.position : null;

  const onDragOver = (event: React.DragEvent) => {
    if (!state.drag) return;
    // Refuse a drop that would move a node into its own subtree.
    if (
      state.drag.kind === "move" &&
      state.drag.nodeIds.some(
        (dragged) => dragged === id || isAncestor(state.document.nodes, dragged, id),
      )
    ) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();

    const rect = event.currentTarget.getBoundingClientRect();
    const offset = event.clientY - rect.top;
    const zone = rect.height / 4;

    const position: DropPosition = container
      ? offset < zone
        ? "before"
        : offset > rect.height - zone
          ? "after"
          : "inside"
      : offset < rect.height / 2
        ? "before"
        : "after";

    setDropHint({ id, position: isRoot ? "inside" : position });
  };

  const onDrop = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const payload = state.drag;
    const position = hint ?? "after";
    setDropHint(null);
    dispatch({ type: "setDrag", payload: null });
    if (!payload) return;

    const resolved = resolveDropIndex(state.document, id, position);
    if (!resolved) return;

    if (payload.kind === "new") {
      run({
        type: "insertNode",
        kind: payload.nodeKind,
        parentId: resolved.parentId,
        index: resolved.index,
      });
    } else {
      run({
        type: "moveNodes",
        ids: payload.nodeIds,
        parentId: resolved.parentId,
        index: resolved.index,
      });
    }
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowRight" && container && !open) {
      event.preventDefault();
      toggle();
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      if (container && open) toggle();
      else dispatch({ type: "selectParent" });
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      dispatch({ type: "selectSibling", direction: 1 });
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      dispatch({ type: "selectSibling", direction: -1 });
    } else if (event.key === "F2" || (event.key === "Enter" && !isRoot)) {
      event.preventDefault();
      setRenaming(true);
    }
  };

  return (
    <>
      <div
        role="treeitem"
        aria-selected={selected}
        aria-expanded={container ? open : undefined}
        aria-level={depth + 1}
        tabIndex={selected ? 0 : -1}
        data-selected={selected || undefined}
        data-ancestor={isAncestorOfSelection || undefined}
        data-hidden={node.hidden || undefined}
        data-flagged={node.hidden || node.locked || undefined}
        data-drop={hint === "inside" ? "inside" : undefined}
        data-dragging={
          state.drag?.kind === "move" && state.drag.nodeIds.includes(id) ? "true" : undefined
        }
        className="layer-row focus-ring-inset"
        style={{ paddingLeft: 4 + depth * INDENT }}
        draggable={!isRoot && !node.locked}
        onDragStart={(event) => {
          event.stopPropagation();
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData("text/plain", node.name);
          const ids = selected ? state.selectedIds : [id];
          dispatch({ type: "setDrag", payload: { kind: "move", nodeIds: ids } });
        }}
        onDragEnd={() => {
          dispatch({ type: "setDrag", payload: null });
          setDropHint(null);
        }}
        onDragOver={onDragOver}
        onDragLeave={() => dropHint?.id === id && setDropHint(null)}
        onDrop={onDrop}
        onKeyDown={onKeyDown}
        onClick={(event) => {
          if (event.shiftKey) dispatch({ type: "selectRange", id });
          else if (event.metaKey || event.ctrlKey) dispatch({ type: "selectAdditive", id });
          else dispatch({ type: "select", ids: [id] });
        }}
        onDoubleClick={() => !isRoot && setRenaming(true)}
        onPointerEnter={() => dispatch({ type: "hover", id })}
        onPointerLeave={() => dispatch({ type: "hover", id: null })}
      >
        {hint && hint !== "inside" && (
          <span className="layer-drop-line" data-position={hint} aria-hidden="true" />
        )}

        {container ? (
          <span
            className="layer-row__twisty"
            data-open={open ? "true" : undefined}
            role="button"
            tabIndex={-1}
            aria-label={open ? "Collapse" : "Expand"}
            onClick={(event) => {
              event.stopPropagation();
              toggle();
            }}
          >
            <ChevronRight size={11} />
          </span>
        ) : (
          <span className="layer-row__twisty" aria-hidden="true" />
        )}

        <span className="layer-row__icon" aria-hidden="true">
          {ICONS[node.type]}
        </span>

        {renaming ? (
          <input
            className="layer-row__rename"
            autoFocus
            defaultValue={node.name}
            aria-label="Layer name"
            onClick={(event) => event.stopPropagation()}
            onBlur={(event) => {
              run({ type: "renameNode", id, name: event.target.value });
              setRenaming(false);
            }}
            onKeyDown={(event) => {
              event.stopPropagation();
              if (event.key === "Enter") event.currentTarget.blur();
              if (event.key === "Escape") setRenaming(false);
            }}
          />
        ) : (
          <span className="layer-row__name">{node.name}</span>
        )}

        <span className="layer-row__actions">
          <IconButton
            label={node.hidden ? `Show ${node.name}` : `Hide ${node.name}`}
            icon={node.hidden ? <EyeOff size={11} /> : <Eye size={11} />}
            size="xs"
            tooltip={false}
            onClick={(event) => {
              event.stopPropagation();
              run({ type: "setNodeFlag", ids: [id], flag: "hidden", value: !node.hidden });
            }}
          />
          <IconButton
            label={node.locked ? `Unlock ${node.name}` : `Lock ${node.name}`}
            icon={node.locked ? <Lock size={11} /> : <Unlock size={11} />}
            size="xs"
            tooltip={false}
            onClick={(event) => {
              event.stopPropagation();
              run({ type: "setNodeFlag", ids: [id], flag: "locked", value: !node.locked });
            }}
          />
        </span>
      </div>

      {container &&
        open &&
        node.children.map((childId) => (
          <LayerRow
            key={childId}
            id={childId}
            depth={depth + 1}
            collapsed={collapsed}
            setCollapsed={setCollapsed}
            expandedAncestors={expandedAncestors}
            dropHint={dropHint}
            setDropHint={setDropHint}
          />
        ))}
    </>
  );
}

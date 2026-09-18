"use client";

import { useCallback, useEffect, useRef, type RefObject } from "react";

import { resolveDropIndex } from "@/lib/editor/commands";
import { canHaveChildren, isAncestor, isEffectivelyLocked } from "@/lib/editor/document";
import { useEditor } from "@/lib/editor/store";
import type { DropPosition, DropTarget } from "@/lib/editor/types";
import { useNodeRegistry } from "../canvas/node-registry";

/** Fraction of a node's length treated as its before/after zone. */
const EDGE_RATIO = 0.28;
/** Never let the edge zone exceed this, or large sections become unfillable. */
const MAX_EDGE_PX = 26;
/** Distance from the stage edge that starts auto-scrolling. */
const AUTOSCROLL_MARGIN = 56;
const AUTOSCROLL_SPEED = 14;

/**
 * Resolves a pointer position into a concrete insertion point.
 *
 * The rule is orientation-aware: in a column the before/after zones are
 * the top and bottom edges, in a row they are the left and right. A
 * container's middle means "inside", so nesting is a deliberate aim at
 * the body of a box rather than an accident of hovering.
 */
export function useCanvasDrop(stageRef: RefObject<HTMLDivElement | null>) {
  const { state, dispatch, run } = useEditor();
  const registry = useNodeRegistry();
  const autoScroll = useRef<number | null>(null);

  const stopAutoScroll = useCallback(() => {
    if (autoScroll.current !== null) {
      window.clearInterval(autoScroll.current);
      autoScroll.current = null;
    }
  }, []);

  useEffect(() => stopAutoScroll, [stopAutoScroll]);

  const computeTarget = useCallback(
    (clientX: number, clientY: number): DropTarget | null => {
      const hits = registry.hitTest(clientX, clientY);
      const hovered = hits.at(-1);
      if (!hovered) return null;

      const moving = state.drag?.kind === "move" ? state.drag.nodeIds : [];

      // Walk outward until a node is found that the drag may legally
      // land on: not itself, not inside itself, not locked.
      let candidateId: string | null = hovered;
      while (candidateId) {
        const isSelf = moving.includes(candidateId);
        const inside = moving.some((id) =>
          isAncestor(state.document.nodes, id, candidateId as string),
        );
        const locked = isEffectivelyLocked(state.document.nodes, candidateId);
        if (!isSelf && !inside && !locked) break;
        candidateId = state.document.nodes[candidateId]?.parentId ?? null;
      }
      if (!candidateId) return null;

      const node = state.document.nodes[candidateId];
      const element = registry.get(candidateId);
      if (!node || !element) return null;

      const rect = element.getBoundingClientRect();
      const parentId = node.parentId;
      const parent = parentId ? state.document.nodes[parentId] : null;
      const parentStyles = parent
        ? { ...parent.styles.desktop, ...parent.styles[state.breakpoint] }
        : null;
      const horizontal = parentStyles?.flexDirection === "row";

      const length = horizontal ? rect.width : rect.height;
      const offset = horizontal ? clientX - rect.left : clientY - rect.top;
      const edge = Math.min(length * EDGE_RATIO, MAX_EDGE_PX);

      let position: DropPosition;
      if (canHaveChildren(node)) {
        // An empty container is all "inside": there is nothing to sit
        // before or after, and the user clearly means to fill it.
        if (!node.children.length) position = "inside";
        else if (offset < edge && parentId) position = "before";
        else if (offset > length - edge && parentId) position = "after";
        else position = "inside";
      } else {
        position = offset < length / 2 ? "before" : "after";
      }

      const resolved = resolveDropIndex(state.document, candidateId, position);
      if (!resolved) return null;

      return {
        nodeId: candidateId,
        position,
        parentId: resolved.parentId,
        index: resolved.index,
      };
    },
    [registry, state.breakpoint, state.document, state.drag],
  );

  const onDragOver = useCallback(
    (event: React.DragEvent) => {
      if (!state.drag) return;
      event.preventDefault();

      const target = computeTarget(event.clientX, event.clientY);
      event.dataTransfer.dropEffect = target
        ? state.drag.kind === "move"
          ? "move"
          : "copy"
        : "none";

      dispatch({ type: "setDropTarget", target });

      // Auto-pan when the pointer nears a stage edge, so a drag can
      // reach parts of the page that are off screen.
      const stage = stageRef.current;
      if (!stage) return;
      const bounds = stage.getBoundingClientRect();

      let dx = 0;
      let dy = 0;
      if (event.clientX - bounds.left < AUTOSCROLL_MARGIN) dx = AUTOSCROLL_SPEED;
      else if (bounds.right - event.clientX < AUTOSCROLL_MARGIN) dx = -AUTOSCROLL_SPEED;
      if (event.clientY - bounds.top < AUTOSCROLL_MARGIN) dy = AUTOSCROLL_SPEED;
      else if (bounds.bottom - event.clientY < AUTOSCROLL_MARGIN) dy = -AUTOSCROLL_SPEED;

      stopAutoScroll();
      if (dx || dy) {
        autoScroll.current = window.setInterval(() => {
          dispatch({
            type: "setPan",
            pan: { x: state.pan.x + dx, y: state.pan.y + dy },
          });
        }, 16);
      }
    },
    [computeTarget, dispatch, stageRef, state.drag, state.pan.x, state.pan.y, stopAutoScroll],
  );

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      stopAutoScroll();

      const payload = state.drag;
      const target = state.dropTarget ?? computeTarget(event.clientX, event.clientY);

      dispatch({ type: "setDrag", payload: null });
      dispatch({ type: "setDropTarget", target: null });

      if (!payload || !target) return;

      if (payload.kind === "new") {
        run({
          type: "insertNode",
          kind: payload.nodeKind,
          parentId: target.parentId,
          index: target.index,
        });
      } else {
        run({
          type: "moveNodes",
          ids: payload.nodeIds,
          parentId: target.parentId,
          index: target.index,
        });
      }
    },
    [computeTarget, dispatch, run, state.drag, state.dropTarget, stopAutoScroll],
  );

  const onDragLeave = useCallback(
    (event: React.DragEvent) => {
      // Leaving to a child element still counts as being over the stage.
      if (event.currentTarget.contains(event.relatedTarget as Node)) return;
      stopAutoScroll();
      dispatch({ type: "setDropTarget", target: null });
    },
    [dispatch, stopAutoScroll],
  );

  return { onDragOver, onDrop, onDragLeave };
}

"use client";

import { useLayoutEffect, useRef, type RefObject } from "react";

import { measureNode, useNodeRegistry } from "../canvas/node-registry";
import { useEditor } from "@/lib/editor/store";
import type { DropTarget } from "@/lib/editor/types";

/**
 * Shows exactly where a dragged element will land.
 *
 * A line for before/after, a filled outline for inside. The distinction
 * matters: "between these two" and "into this" are different outcomes,
 * and one generic highlight would leave the user guessing which they
 * are about to get.
 */
export function DropIndicator({
  containerRef,
}: {
  containerRef: RefObject<HTMLDivElement | null>;
}) {
  const { state } = useEditor();
  if (!state.dropTarget) return null;
  return <Indicator target={state.dropTarget} containerRef={containerRef} />;
}

function Indicator({
  target,
  containerRef,
}: {
  target: DropTarget;
  containerRef: RefObject<HTMLDivElement | null>;
}) {
  const { state } = useEditor();
  const registry = useNodeRegistry();
  const ref = useRef<HTMLDivElement>(null);

  const parent = state.document.nodes[target.parentId];
  const parentStyles = parent
    ? { ...parent.styles.desktop, ...parent.styles[state.breakpoint] }
    : null;
  const horizontal = parentStyles?.flexDirection === "row";

  // Geometry is written straight onto the element instead of being kept
  // in state: the indicator moves on every dragover, and a render pass
  // per pointer move is wasted work for a purely visual overlay.
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;

    const rect = measureNode(
      registry.get(target.nodeId),
      containerRef.current,
      state.zoom,
    );
    if (!rect) {
      element.style.display = "none";
      return;
    }

    element.style.display = "";
    const thickness = 2 / state.zoom;

    if (target.position === "inside") {
      Object.assign(element.style, {
        left: `${rect.x}px`,
        top: `${rect.y}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
      });
      return;
    }

    // The line sits on the leading or trailing edge of the reference
    // element, along whichever axis its parent flows.
    Object.assign(
      element.style,
      horizontal
        ? {
            left: `${(target.position === "before" ? rect.x : rect.x + rect.width) - thickness / 2}px`,
            top: `${rect.y}px`,
            width: `${thickness}px`,
            height: `${rect.height}px`,
          }
        : {
            left: `${rect.x}px`,
            top: `${(target.position === "before" ? rect.y : rect.y + rect.height) - thickness / 2}px`,
            width: `${rect.width}px`,
            height: `${thickness}px`,
          },
    );
  }, [containerRef, horizontal, registry, state.zoom, target]);

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className={
        target.position === "inside"
          ? "drop-inside"
          : `drop-line drop-line--${horizontal ? "v" : "h"}`
      }
      style={{ ["--canvas-zoom" as string]: state.zoom }}
    />
  );
}

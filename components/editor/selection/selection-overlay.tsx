"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import { Lock } from "lucide-react";

import {
  findSnaps,
  measureNeighbours,
  unionRect,
  type Guide,
  type Measurement,
  type Rect,
} from "@/lib/editor/geometry";
import { isEffectivelyLocked } from "@/lib/editor/document";
import {
  selectionAncestors,
  selectionChildren,
} from "@/lib/editor/selection";
import { useEditor } from "@/lib/editor/store";
import { measureNode, useNodeRegistry } from "../canvas/node-registry";
import { ContextToolbar } from "./context-toolbar";

type Handle = "n" | "s" | "e" | "w" | "nw" | "ne" | "se" | "sw";

const CORNER_HANDLES: Handle[] = ["nw", "ne", "se", "sw"];
const EDGE_HANDLES: Handle[] = ["n", "e", "s", "w"];

/**
 * All selection chrome: outlines, the name badge, eight resize handles,
 * live dimensions, alignment guides and spacing measurements.
 *
 * Rectangles are measured from the DOM rather than derived from the
 * style map, because the real geometry is whatever the browser laid
 * out — percentage widths, flex growth and intrinsic content sizes have
 * no meaning until they are resolved.
 */
export function SelectionOverlay({
  containerRef,
}: {
  containerRef: RefObject<HTMLDivElement | null>;
}) {
  const { state } = useEditor();
  const registry = useNodeRegistry();

  const [rects, setRects] = useState<Record<string, Rect>>({});
  const [guides, setGuides] = useState<Guide[]>([]);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [liveSize, setLiveSize] = useState<{ width: number; height: number } | null>(null);

  const ancestors = useMemo(
    () => selectionAncestors(state.document, state.selectedIds),
    [state.document, state.selectedIds],
  );
  const children = useMemo(
    () =>
      state.panels.showOutlines
        ? selectionChildren(state.document, state.selectedIds)
        : [],
    [state.document, state.panels.showOutlines, state.selectedIds],
  );

  const tracked = useMemo(() => {
    const ids = new Set<string>([...state.selectedIds, ...ancestors, ...children]);
    if (state.hoveredId) ids.add(state.hoveredId);
    // Siblings are tracked so snapping and spacing have candidates
    // ready the moment a drag starts.
    for (const id of state.selectedIds) {
      const parentId = state.document.nodes[id]?.parentId;
      if (parentId) {
        for (const sibling of state.document.nodes[parentId].children) ids.add(sibling);
      }
    }
    return [...ids];
  }, [ancestors, children, state.document, state.hoveredId, state.selectedIds]);

  const measureAll = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const next: Record<string, Rect> = {};
    for (const id of tracked) {
      const rect = measureNode(registry.get(id), container, state.zoom);
      if (rect) next[id] = rect;
    }
    setRects(next);
  }, [containerRef, registry, state.zoom, tracked]);

  useLayoutEffect(measureAll, [measureAll, state.document]);

  // Layout can settle after paint — web fonts, images decoding, flex
  // reflow — so geometry is re-read whenever anything observable moves.
  useEffect(() => {
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measureAll);
    for (const id of tracked) {
      const element = registry.get(id);
      if (element) observer.observe(element);
    }
    window.addEventListener("resize", measureAll);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measureAll);
    };
  }, [measureAll, registry, tracked]);

  const selectedRects = state.selectedIds
    .map((id) => rects[id])
    .filter((rect): rect is Rect => Boolean(rect));
  const bounds = unionRect(selectedRects);
  const multiple = state.selectedIds.length > 1;
  const primaryId = state.selectedIds[0];
  const primary = primaryId ? state.document.nodes[primaryId] : null;
  const locked = primaryId ? isEffectivelyLocked(state.document.nodes, primaryId) : false;

  const counterScale = { transform: `scale(${1 / state.zoom})` };

  return (
    <div
      className="selection-layer"
      style={{ ["--canvas-zoom" as string]: state.zoom }}
    >
      {/* Ancestors, then children, then hover, then selection: painted
          weakest first so the strongest outline is never obscured. */}
      {ancestors.map((id) =>
        rects[id] ? <Box key={`a-${id}`} rect={rects[id]} variant="parent" /> : null,
      )}
      {children.map((id) =>
        rects[id] ? <Box key={`c-${id}`} rect={rects[id]} variant="child" /> : null,
      )}
      {state.hoveredId &&
        !state.selectedIds.includes(state.hoveredId) &&
        rects[state.hoveredId] && (
          <Box rect={rects[state.hoveredId]} variant="hover" />
        )}

      {selectedRects.map((rect, index) => (
        <Box
          key={`s-${state.selectedIds[index]}`}
          rect={rect}
          variant={locked ? "locked" : "selected"}
        />
      ))}

      {/* Group bounds get their own outline so a multi-selection reads
          as one object to move. */}
      {multiple && bounds && <Box rect={bounds} variant="selected" />}

      {bounds && primary && (
        <>
          <div
            className="selection-box"
            style={{
              left: bounds.x,
              top: bounds.y,
              width: bounds.width,
              height: bounds.height,
            }}
          >
            <span
              className={`selection-badge${locked ? " selection-badge--locked" : ""}`}
              style={counterScale}
            >
              {locked && <Lock size={9} />}
              {multiple ? `${state.selectedIds.length} selected` : primary.name}
            </span>

            {liveSize && (
              <span className="selection-size numeric" style={counterScale}>
                {Math.round(liveSize.width)} × {Math.round(liveSize.height)}
              </span>
            )}
          </div>

          {!locked && !multiple && primaryId !== state.document.rootId && (
            <ResizeHandles
              nodeId={primaryId}
              rect={bounds}
              rects={rects}
              onGuides={setGuides}
              onMeasure={setMeasurements}
              onLiveSize={setLiveSize}
            />
          )}
        </>
      )}

      {guides.map((guide, index) => (
        <GuideLine key={`g-${index}`} guide={guide} />
      ))}
      {measurements.map((measurement, index) => (
        <MeasureLine
          key={`m-${index}`}
          measurement={measurement}
          counterScale={counterScale}
        />
      ))}

      {bounds && primaryId && !state.editingId && (
        <ContextToolbar nodeId={primaryId} containerRef={containerRef} rect={bounds} />
      )}
    </div>
  );
}

function Box({
  rect,
  variant,
}: {
  rect: Rect;
  variant: "selected" | "hover" | "parent" | "child" | "locked";
}) {
  return (
    <div
      className={`selection-box selection-box--${variant}`}
      style={{ left: rect.x, top: rect.y, width: rect.width, height: rect.height }}
    />
  );
}

function GuideLine({ guide }: { guide: Guide }) {
  return guide.axis === "x" ? (
    <div
      className="alignment-guide alignment-guide--v"
      style={{ left: guide.position, top: guide.start, height: guide.end - guide.start }}
    />
  ) : (
    <div
      className="alignment-guide alignment-guide--h"
      style={{ top: guide.position, left: guide.start, width: guide.end - guide.start }}
    />
  );
}

function MeasureLine({
  measurement,
  counterScale,
}: {
  measurement: Measurement;
  counterScale: React.CSSProperties;
}) {
  const { axis, from, to, cross, distance } = measurement;
  const midpoint = from + (to - from) / 2;

  return (
    <>
      <div
        className={`measure-line measure-line--${axis === "x" ? "h" : "v"}`}
        style={
          axis === "x"
            ? { left: from, top: cross, width: to - from }
            : { top: from, left: cross, height: to - from }
        }
      />
      <span
        className="measure-label numeric"
        style={{
          ...(axis === "x"
            ? { left: midpoint, top: cross }
            : { top: midpoint, left: cross }),
          ...counterScale,
          translate: "-50% -50%",
        }}
      >
        {Math.round(distance)}
      </span>
    </>
  );
}

/**
 * Eight handles. Corners resize both axes, edges constrain to one.
 * Shift preserves the aspect ratio; Alt resizes about the centre.
 */
function ResizeHandles({
  nodeId,
  rect,
  rects,
  onGuides,
  onMeasure,
  onLiveSize,
}: {
  nodeId: string;
  rect: Rect;
  rects: Record<string, Rect>;
  onGuides: (guides: Guide[]) => void;
  onMeasure: (measurements: Measurement[]) => void;
  onLiveSize: (size: { width: number; height: number } | null) => void;
}) {
  const { state, run, commit } = useEditor();
  const zoom = state.zoom;
  const dragging = useRef(false);

  const siblingRects = useMemo(() => {
    const parentId = state.document.nodes[nodeId]?.parentId;
    if (!parentId) return [];
    return state.document.nodes[parentId].children
      .filter((id) => id !== nodeId)
      .map((id) => rects[id])
      .filter((value): value is Rect => Boolean(value));
  }, [nodeId, rects, state.document.nodes]);

  const start = (handle: Handle) => (event: React.PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();

    const element = event.currentTarget;
    element.setPointerCapture(event.pointerId);
    dragging.current = true;
    document.documentElement.classList.add("is-dragging");

    const startX = event.clientX;
    const startY = event.clientY;
    const startRect = { ...rect };
    const ratio = startRect.height === 0 ? 1 : startRect.width / startRect.height;

    const onMove = (move: PointerEvent) => {
      // Pointer deltas are in screen pixels; dividing by zoom converts
      // them into the document space the rectangles live in.
      const dx = (move.clientX - startX) / zoom;
      const dy = (move.clientY - startY) / zoom;

      const growX = handle.includes("e") ? 1 : handle.includes("w") ? -1 : 0;
      const growY = handle.includes("s") ? 1 : handle.includes("n") ? -1 : 0;
      const factor = move.altKey ? 2 : 1;

      let width = Math.max(8, startRect.width + dx * growX * factor);
      let height = Math.max(8, startRect.height + dy * growY * factor);

      if (move.shiftKey && growX !== 0 && growY !== 0) {
        // Corner drag with Shift: the larger change wins so the
        // rectangle tracks the pointer rather than fighting it.
        if (Math.abs(dx) > Math.abs(dy)) height = width / ratio;
        else width = height * ratio;
      }

      const candidate: Rect = {
        x: growX < 0 ? startRect.x + (startRect.width - width) : startRect.x,
        y: growY < 0 ? startRect.y + (startRect.height - height) : startRect.y,
        width,
        height,
      };

      if (!move.metaKey && !move.ctrlKey) {
        const { guides } = findSnaps(candidate, siblingRects);
        onGuides(guides);
        // Snapping adjusts the edge being dragged, not the whole rect,
        // so the opposite edge stays anchored.
        for (const guide of guides) {
          if (guide.axis === "x" && growX !== 0) width += guide.delta * growX;
          if (guide.axis === "y" && growY !== 0) height += guide.delta * growY;
        }
      } else {
        onGuides([]);
      }

      onLiveSize({ width, height });
      onMeasure(measureNeighbours({ ...candidate, width, height }, siblingRects));

      run({
        type: "setStyles",
        ids: [nodeId],
        breakpoint: state.breakpoint,
        patch: {
          ...(growX !== 0 ? { width: `${Math.round(width)}px` } : null),
          ...(growY !== 0 ? { height: `${Math.round(height)}px` } : null),
        },
      });
    };

    const onUp = () => {
      dragging.current = false;
      document.documentElement.classList.remove("is-dragging");
      element.releasePointerCapture(event.pointerId);
      element.removeEventListener("pointermove", onMove);
      element.removeEventListener("pointerup", onUp);
      onGuides([]);
      onMeasure([]);
      onLiveSize(null);
      // Ends the coalescing window so the whole drag is one undo step.
      commit();
    };

    element.addEventListener("pointermove", onMove);
    element.addEventListener("pointerup", onUp);
  };

  const size = 9 / zoom;
  const half = size / 2;

  const positionFor = (handle: Handle): React.CSSProperties => {
    const x =
      handle.includes("w")
        ? rect.x - half
        : handle.includes("e")
          ? rect.x + rect.width - half
          : rect.x + rect.width / 2 - half;
    const y =
      handle.includes("n")
        ? rect.y - half
        : handle.includes("s")
          ? rect.y + rect.height - half
          : rect.y + rect.height / 2 - half;
    return { left: x, top: y };
  };

  const edgeStyle = (handle: Handle): React.CSSProperties => {
    const thickness = 6 / zoom;
    if (handle === "n" || handle === "s") {
      return {
        left: rect.x,
        top: (handle === "n" ? rect.y : rect.y + rect.height) - thickness / 2,
        width: rect.width,
        height: thickness,
      };
    }
    return {
      top: rect.y,
      left: (handle === "w" ? rect.x : rect.x + rect.width) - thickness / 2,
      width: thickness,
      height: rect.height,
    };
  };

  return (
    <>
      {EDGE_HANDLES.map((handle) => (
        <button
          key={handle}
          type="button"
          tabIndex={-1}
          aria-hidden="true"
          className={`resize-handle resize-handle--edge resize-handle--${handle}`}
          style={edgeStyle(handle)}
          onPointerDown={start(handle)}
        />
      ))}
      {CORNER_HANDLES.map((handle) => (
        <button
          key={handle}
          type="button"
          aria-label={`Resize ${handle}`}
          className={`resize-handle resize-handle--${handle}`}
          style={positionFor(handle)}
          onPointerDown={start(handle)}
        />
      ))}
    </>
  );
}

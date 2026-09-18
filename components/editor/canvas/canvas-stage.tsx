"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import {
  BREAKPOINT_LABELS,
  BREAKPOINT_WIDTHS,
} from "@/lib/editor/breakpoints";
import { isEffectivelyLocked } from "@/lib/editor/document";
import { drillTarget } from "@/lib/editor/selection";
import { useEditor, ZOOM_MAX, ZOOM_MIN } from "@/lib/editor/store";
import { SelectionOverlay } from "../selection/selection-overlay";
import { DropIndicator } from "../dnd/drop-indicator";
import { useCanvasDrop } from "../dnd/use-canvas-drop";
import { NodeRegistryProvider, useNodeRegistry } from "./node-registry";
import { RenderNode } from "./node-renderer";

/** Workspace padding kept around the frame when fitting to screen. */
const FIT_PADDING = 96;

export function CanvasStage() {
  return (
    <NodeRegistryProvider>
      <CanvasStageInner />
    </NodeRegistryProvider>
  );
}

function CanvasStageInner() {
  const { state, dispatch } = useEditor();
  const registry = useNodeRegistry();

  const stageRef = useRef<HTMLDivElement>(null);
  const transformRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);

  const [spaceHeld, setSpaceHeld] = useState(false);
  const [panning, setPanning] = useState(false);
  const [resizing, setResizing] = useState(false);
  const [animated, setAnimated] = useState(false);
  // Measured rather than read from the ref during render, so the size
  // readout updates when the page reflows.
  const [frameHeight, setFrameHeight] = useState(0);

  const frameWidth =
    state.viewportMode === "custom"
      ? state.customWidth
      : BREAKPOINT_WIDTHS[state.breakpoint];

  const drop = useCanvasDrop(stageRef);

  /* --- Fit to screen ------------------------------------------- */
  const fitToScreen = useCallback(() => {
    const stage = stageRef.current;
    const frame = frameRef.current;
    if (!stage || !frame) return;

    const available = stage.getBoundingClientRect();
    const contentHeight = frame.scrollHeight || frame.offsetHeight || 1;

    const scale = Math.min(
      (available.width - FIT_PADDING * 2) / frameWidth,
      (available.height - FIT_PADDING * 2) / contentHeight,
      1,
    );
    const zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, scale));

    setAnimated(true);
    dispatch({ type: "setZoom", zoom });
    dispatch({
      type: "setPan",
      pan: {
        x: (available.width - frameWidth * zoom) / 2,
        y: Math.max(FIT_PADDING / 2, (available.height - contentHeight * zoom) / 2),
      },
    });
    window.setTimeout(() => setAnimated(false), 340);
  }, [dispatch, frameWidth]);

  /** Horizontally centres the frame without changing zoom. */
  const centreCanvas = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const available = stage.getBoundingClientRect();
    setAnimated(true);
    dispatch({
      type: "setPan",
      pan: {
        x: (available.width - frameWidth * state.zoom) / 2,
        y: state.pan.y,
      },
    });
    window.setTimeout(() => setAnimated(false), 340);
  }, [dispatch, frameWidth, state.pan.y, state.zoom]);

  // Centre once on mount, after the frame has laid out.
  const initialised = useRef(false);
  useLayoutEffect(() => {
    if (initialised.current) return;
    initialised.current = true;
    fitToScreen();
  }, [fitToScreen]);

  // Re-centre when the frame width changes so a breakpoint switch does
  // not push the page off to one side.
  const previousWidth = useRef(frameWidth);
  useEffect(() => {
    if (previousWidth.current === frameWidth) return;
    previousWidth.current = frameWidth;
    if (!resizing) centreCanvas();
  }, [centreCanvas, frameWidth, resizing]);

  // Tracks the rendered page height for the size readout and for
  // fit-to-screen, which both need the laid-out height rather than the
  // declared one.
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => setFrameHeight(frame.offsetHeight));
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const handler = () => fitToScreen();
    window.addEventListener("formwork:fit-canvas", handler);
    window.addEventListener("formwork:centre-canvas", centreCanvas);
    return () => {
      window.removeEventListener("formwork:fit-canvas", handler);
      window.removeEventListener("formwork:centre-canvas", centreCanvas);
    };
  }, [centreCanvas, fitToScreen]);

  /* --- Spacebar panning ---------------------------------------- */
  useEffect(() => {
    const isTypingTarget = (target: EventTarget | null) => {
      const element = target as HTMLElement | null;
      return (
        !!element &&
        (element.isContentEditable ||
          ["INPUT", "TEXTAREA", "SELECT"].includes(element.tagName))
      );
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== "Space" || isTypingTarget(event.target)) return;
      // Prevents the page scrolling while space is used as a modifier.
      event.preventDefault();
      setSpaceHeld(true);
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === "Space") setSpaceHeld(false);
    };
    // A lost window focus would otherwise strand the canvas in pan mode.
    const onBlur = () => setSpaceHeld(false);

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, []);

  /* --- Wheel: trackpad zoom and two-axis pan -------------------- */
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const onWheel = (event: WheelEvent) => {
      // Pinch gestures arrive as ctrl+wheel on every major browser.
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault();
        const rect = stage.getBoundingClientRect();
        // Exponential so each notch changes zoom by a constant ratio,
        // which is what makes trackpad pinching feel linear.
        const zoom = state.zoom * Math.exp(-event.deltaY / 240);
        dispatch({
          type: "setZoom",
          zoom,
          anchor: { x: event.clientX - rect.left, y: event.clientY - rect.top },
        });
        return;
      }

      event.preventDefault();
      dispatch({
        type: "setPan",
        pan: { x: state.pan.x - event.deltaX, y: state.pan.y - event.deltaY },
      });
    };

    stage.addEventListener("wheel", onWheel, { passive: false });
    return () => stage.removeEventListener("wheel", onWheel);
  }, [dispatch, state.pan.x, state.pan.y, state.zoom]);

  /* --- Pointer: pan or select ----------------------------------- */
  const onPointerDown = (event: React.PointerEvent) => {
    const wantsPan = event.button === 1 || spaceHeld || event.altKey;

    if (wantsPan) {
      event.preventDefault();
      const origin = { x: state.pan.x, y: state.pan.y };
      const start = { x: event.clientX, y: event.clientY };
      setPanning(true);
      document.documentElement.classList.add("is-dragging");

      const onMove = (move: PointerEvent) => {
        dispatch({
          type: "setPan",
          pan: {
            x: origin.x + move.clientX - start.x,
            y: origin.y + move.clientY - start.y,
          },
        });
      };
      const onUp = () => {
        setPanning(false);
        document.documentElement.classList.remove("is-dragging");
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      return;
    }

    if (event.button !== 0 || state.preview) return;

    const hits = registry.hitTest(event.clientX, event.clientY);
    const clicked = hits.at(-1);

    if (!clicked) {
      dispatch({ type: "select", ids: [] });
      return;
    }
    if (isEffectivelyLocked(state.document.nodes, clicked)) return;

    if (event.shiftKey) {
      dispatch({ type: "selectRange", id: clicked });
    } else if (event.metaKey || event.ctrlKey) {
      dispatch({ type: "selectAdditive", id: clicked });
    } else {
      // Click selects the outermost group first and drills in on
      // repeat clicks, rather than jumping straight to a leaf.
      dispatch({
        type: "select",
        ids: [drillTarget(state.document, clicked, state.selectedIds)],
      });
    }
  };

  const onDoubleClick = (event: React.MouseEvent) => {
    if (state.preview) return;
    const clicked = registry.hitTest(event.clientX, event.clientY).at(-1);
    if (!clicked) return;

    const node = state.document.nodes[clicked];
    if (!node || isEffectivelyLocked(state.document.nodes, clicked)) return;

    if (["text", "heading", "button"].includes(node.type)) {
      dispatch({ type: "select", ids: [clicked] });
      dispatch({ type: "setEditing", id: clicked });
      // The span becomes editable this render; focus lands after paint.
      requestAnimationFrame(() => {
        const element = registry.get(clicked)?.querySelector<HTMLElement>("[contenteditable]");
        element?.focus();
        const selection = window.getSelection();
        if (element && selection) selection.selectAllChildren(element);
      });
    } else {
      dispatch({ type: "selectChild" });
    }
  };

  return (
    <div
      ref={stageRef}
      className="canvas-stage"
      data-grid={state.panels.showGrid && !state.preview ? "true" : "false"}
      data-preview={state.preview ? "true" : "false"}
      data-panning={panning ? "true" : undefined}
      data-space={spaceHeld ? "true" : undefined}
      onPointerDown={onPointerDown}
      onDoubleClick={onDoubleClick}
      onPointerMove={(event) => {
        if (state.preview || panning) return;
        const hovered = registry.hitTest(event.clientX, event.clientY).at(-1) ?? null;
        dispatch({ type: "hover", id: hovered });
      }}
      onPointerLeave={() => dispatch({ type: "hover", id: null })}
      onDragOver={drop.onDragOver}
      onDrop={drop.onDrop}
      onDragLeave={drop.onDragLeave}
    >
      <div
        ref={transformRef}
        className="canvas-transform"
        data-animated={animated ? "true" : undefined}
        style={{
          transform: `translate(${state.pan.x}px, ${state.pan.y}px) scale(${state.zoom})`,
        }}
      >
        <div
          ref={frameRef}
          className="canvas-frame"
          data-resizing={resizing ? "true" : undefined}
          style={{ width: frameWidth }}
        >
          {!state.preview && (
            <FrameLabel
              width={frameWidth}
              height={frameHeight}
              zoom={state.zoom}
            />
          )}

          <div className="canvas-page">
            <RenderNode id={state.document.rootId} breakpoint={state.breakpoint} />
          </div>

          {!state.preview && (
            <>
              <ResizeEdge side="left" onResizing={setResizing} />
              <ResizeEdge side="right" onResizing={setResizing} />
            </>
          )}
        </div>

        {!state.preview && (
          <>
            <SelectionOverlay containerRef={transformRef} />
            <DropIndicator containerRef={transformRef} />
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Size readout above the frame. Counter-scaled by the zoom factor so it
 * stays a constant physical size — chrome should not shrink with the
 * design it is annotating.
 */
function FrameLabel({
  width,
  height,
  zoom,
}: {
  width: number;
  height: number;
  zoom: number;
}) {
  const { state } = useEditor();
  return (
    <div
      className="canvas-frame__label"
      style={{ transform: `scale(${1 / zoom})`, transformOrigin: "left bottom" }}
    >
      <span className="canvas-frame__breakpoint">
        {state.viewportMode === "custom"
          ? `Custom · ${BREAKPOINT_LABELS[state.breakpoint]} styles`
          : BREAKPOINT_LABELS[state.breakpoint]}
      </span>
      <span className="canvas-frame__dimensions numeric">
        {Math.round(width)} × {Math.round(height)}
      </span>
    </div>
  );
}

/**
 * Draggable frame edge. Dragging either side changes the width about
 * the centre, so the page stays put instead of sliding under the
 * pointer, which is what makes it feel like resizing a window.
 */
function ResizeEdge({
  side,
  onResizing,
}: {
  side: "left" | "right";
  onResizing: (value: boolean) => void;
}) {
  const { state, dispatch } = useEditor();
  const [active, setActive] = useState(false);

  const width =
    state.viewportMode === "custom" ? state.customWidth : BREAKPOINT_WIDTHS[state.breakpoint];

  const onPointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const element = event.currentTarget;
    element.setPointerCapture(event.pointerId);

    setActive(true);
    onResizing(true);
    document.documentElement.classList.add("is-dragging");

    const startX = event.clientX;
    const startWidth = width;
    const direction = side === "right" ? 1 : -1;

    const onMove = (move: PointerEvent) => {
      const delta = ((move.clientX - startX) * direction * 2) / state.zoom;
      dispatch({ type: "setCustomWidth", width: startWidth + delta });
    };
    const onUp = () => {
      setActive(false);
      onResizing(false);
      document.documentElement.classList.remove("is-dragging");
      element.releasePointerCapture(event.pointerId);
      element.removeEventListener("pointermove", onMove);
      element.removeEventListener("pointerup", onUp);
    };

    element.addEventListener("pointermove", onMove);
    element.addEventListener("pointerup", onUp);
  };

  return (
    <button
      type="button"
      className={`canvas-frame__handle canvas-frame__handle--${side}`}
      data-active={active ? "true" : undefined}
      aria-label={`Resize viewport from the ${side}`}
      onPointerDown={onPointerDown}
      onKeyDown={(event) => {
        // Keyboard equivalent, so viewport width is not mouse-only.
        const step = event.shiftKey ? 50 : 10;
        if (event.key === "ArrowRight") {
          event.preventDefault();
          dispatch({ type: "setCustomWidth", width: width + step });
        } else if (event.key === "ArrowLeft") {
          event.preventDefault();
          dispatch({ type: "setCustomWidth", width: width - step });
        }
      }}
    />
  );
}

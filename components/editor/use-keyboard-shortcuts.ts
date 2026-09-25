"use client";

import { useEffect } from "react";

import { copyNodes, readClipboard } from "@/lib/editor/clipboard";
import { nearestContainer } from "@/lib/editor/document";
import { useEditor, ZOOM_MAX, ZOOM_MIN } from "@/lib/editor/store";
import type { StyleMap } from "@/lib/editor/types";

/** Arrow-key nudge distance, and the accelerated Shift variant. */
const NUDGE = 1;
const NUDGE_LARGE = 10;

/** True when a keystroke belongs to a field rather than the editor. */
function isTypingTarget(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  if (!element) return false;
  return (
    element.isContentEditable ||
    ["INPUT", "TEXTAREA", "SELECT"].includes(element.tagName)
  );
}

/**
 * Global editor shortcuts.
 *
 * Bound on the window so they work wherever focus happens to be, but
 * every handler bails out when the user is typing — a builder where
 * Backspace deletes the selected element while you are editing its
 * text is worse than one with no shortcuts at all.
 */
export function useKeyboardShortcuts() {
  const { state, dispatch, run, commit, announce } = useEditor();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return;

      const modifier = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();
      const ids = state.selectedIds;

      /* --- History ------------------------------------------- */
      if (modifier && key === "z") {
        event.preventDefault();
        dispatch({ type: event.shiftKey ? "redo" : "undo" });
        return;
      }
      if (modifier && key === "y") {
        event.preventDefault();
        dispatch({ type: "redo" });
        return;
      }

      /* --- Clipboard ----------------------------------------- */
      if (modifier && key === "c" && ids.length) {
        event.preventDefault();
        copyNodes(state.document, ids);
        announce(`${ids.length} element${ids.length === 1 ? "" : "s"} copied`);
        return;
      }
      if (modifier && key === "x" && ids.length) {
        event.preventDefault();
        copyNodes(state.document, ids);
        run({ type: "deleteNodes", ids });
        return;
      }
      if (modifier && key === "v") {
        const entry = readClipboard();
        if (!entry) return;
        event.preventDefault();
        // Paste lands inside the selection when it can hold children,
        // otherwise alongside it.
        const anchor = ids[0] ?? state.document.rootId;
        const parentId = nearestContainer(
          state.document.nodes,
          anchor,
          state.document.rootId,
        );
        for (const rootId of entry.rootIds) {
          run({ type: "insertSubtree", nodes: entry.nodes, rootId, parentId });
        }
        return;
      }
      if (modifier && key === "d" && ids.length) {
        event.preventDefault();
        run({ type: "duplicateNodes", ids });
        return;
      }

      /* --- Selection ----------------------------------------- */
      if (modifier && key === "a") {
        event.preventDefault();
        const root = state.document.nodes[state.document.rootId];
        dispatch({ type: "select", ids: root.children });
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        // Steps out one level at a time, clearing at the top.
        dispatch({ type: "selectParent" });
        return;
      }
      if (event.key === "Enter" && ids.length === 1) {
        const node = state.document.nodes[ids[0]];
        if (node && ["text", "heading", "button"].includes(node.type)) {
          event.preventDefault();
          dispatch({ type: "setEditing", id: node.id });
        }
        return;
      }

      /* --- Delete -------------------------------------------- */
      if ((event.key === "Backspace" || event.key === "Delete") && ids.length) {
        event.preventDefault();
        run({ type: "deleteNodes", ids });
        return;
      }

      /* --- Nudge ---------------------------------------------- */
      if (event.key.startsWith("Arrow") && ids.length) {
        const node = state.document.nodes[ids[0]];
        if (!node) return;

        // Nudging only makes sense for positioned elements; in normal
        // flow the arrows traverse the tree instead.
        const positioned =
          { ...node.styles.desktop, ...node.styles[state.breakpoint] }.position === "absolute";

        if (!positioned) {
          if (event.key === "ArrowUp" || event.key === "ArrowDown") {
            event.preventDefault();
            dispatch({
              type: "selectSibling",
              direction: event.key === "ArrowDown" ? 1 : -1,
            });
          } else if (event.key === "ArrowLeft") {
            event.preventDefault();
            dispatch({ type: "selectParent" });
          } else if (event.key === "ArrowRight") {
            event.preventDefault();
            dispatch({ type: "selectChild" });
          }
          return;
        }

        event.preventDefault();
        const step = event.shiftKey ? NUDGE_LARGE : NUDGE;
        const current = { ...node.styles.desktop, ...node.styles[state.breakpoint] };
        const patch: StyleMap =
          event.key === "ArrowLeft"
            ? { left: (current.left ?? 0) - step }
            : event.key === "ArrowRight"
              ? { left: (current.left ?? 0) + step }
              : event.key === "ArrowUp"
                ? { top: (current.top ?? 0) - step }
                : { top: (current.top ?? 0) + step };

        run({ type: "setStyles", ids, breakpoint: state.breakpoint, patch });
        return;
      }

      /* --- View ----------------------------------------------- */
      if (modifier && (key === "=" || key === "+")) {
        event.preventDefault();
        dispatch({ type: "setZoom", zoom: Math.min(ZOOM_MAX, state.zoom * 1.2) });
        return;
      }
      if (modifier && key === "-") {
        event.preventDefault();
        dispatch({ type: "setZoom", zoom: Math.max(ZOOM_MIN, state.zoom / 1.2) });
        return;
      }
      if (modifier && key === "0") {
        event.preventDefault();
        dispatch({ type: "setZoom", zoom: 1 });
        window.dispatchEvent(new Event("formwork:centre-canvas"));
        return;
      }
      if (key === "1" && event.shiftKey) {
        event.preventDefault();
        window.dispatchEvent(new Event("formwork:fit-canvas"));
        return;
      }

      /* --- Panels and modes ----------------------------------- */
      if (!modifier && !event.altKey && !event.shiftKey && key === "v") {
        event.preventDefault();
        dispatch({ type: "setActiveTool", tool: "select" });
        return;
      }
      if (!modifier && !event.altKey && !event.shiftKey && key === "h") {
        event.preventDefault();
        dispatch({ type: "setActiveTool", tool: "pan" });
        return;
      }
      if (!modifier && !event.altKey && event.shiftKey && key === "f") {
        event.preventDefault();
        dispatch({ type: "toggleFocusMode" });
        return;
      }
      if (event.altKey && key === "1") {
        event.preventDefault();
        dispatch({ type: "setPanels", patch: { leftOpen: !state.panels.leftOpen } });
        return;
      }
      if (event.altKey && key === "2") {
        event.preventDefault();
        dispatch({ type: "setPanels", patch: { rightOpen: !state.panels.rightOpen } });
        return;
      }
      if (!modifier && !event.altKey && key === "p") {
        event.preventDefault();
        dispatch({ type: "togglePreview" });
        return;
      }
      if (!modifier && !event.altKey && key === "g") {
        event.preventDefault();
        dispatch({ type: "setPanels", patch: { showGrid: !state.panels.showGrid } });
        return;
      }
      if (!modifier && !event.altKey && key === "r") {
        event.preventDefault();
        dispatch({ type: "setPanels", patch: { showRulers: !state.panels.showRulers } });
      }
    };

    // Any key-up ends a coalescing window, so a burst of nudges is one
    // undo step but the next edit starts a fresh one.
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key.startsWith("Arrow")) commit();
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [announce, commit, dispatch, run, state]);
}

"use client";

import { useEffect, type CSSProperties } from "react";

import { useEditor } from "@/lib/editor/store";
import { CanvasStage } from "./canvas/canvas-stage";
import { EditorToolbar } from "./chrome/editor-toolbar";
import { ViewportControls } from "./chrome/viewport-controls";
import { Inspector } from "./inspector/inspector";
import { LeftPanel } from "./panels/left-panel";
import { useKeyboardShortcuts } from "./use-keyboard-shortcuts";
import { useModelTools } from "./use-model-tools";

/**
 * The editor shell.
 *
 * Three visual levels, as laid out in the redesign: the canvas content,
 * the workspace it floats on, and the glass control layer above both.
 * The canvas fills the shell and every control overlays it, so the
 * design under edit is never boxed into a column.
 */
export function EditorShell() {
  const { state } = useEditor();
  useKeyboardShortcuts();
  useModelTools();

  const leftDock = state.panels.leftOpen && !state.focusMode ? state.panels.leftWidth : 0;
  const rightDock = state.panels.rightOpen && !state.focusMode ? state.panels.rightWidth : 0;
  const shellStyle = {
    "--dock-left": `${leftDock}px`,
    "--dock-right": `${rightDock}px`,
  } as CSSProperties;

  // Keep the page visually centred when a dock opens, closes, or Focus Mode
  // changes the available canvas width. The delayed pass lands after the dock
  // transition, avoiding a visible intermediate jump.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      window.dispatchEvent(new Event("formwork:centre-canvas"));
    }, 280);
    return () => window.clearTimeout(timer);
  }, [leftDock, rightDock, state.focusMode]);

  return (
    <main
      className="editor-shell"
      style={shellStyle}
      data-preview={state.preview ? "true" : "false"}
      data-focus-mode={state.focusMode ? "true" : "false"}
      data-left-open={state.panels.leftOpen ? "true" : "false"}
      data-inspector-open={state.panels.rightOpen ? "true" : "false"}
      data-has-selection={state.selectedIds.length ? "true" : "false"}
    >
      <a href="#formwork-canvas" className="sr-only sr-only-focusable">
        Skip to canvas
      </a>

      <div className="editor-workspace" id="formwork-canvas">
        <CanvasStage />
      </div>

      <EditorToolbar />
      <LeftPanel />
      <Inspector />
      <ViewportControls />

      <LiveRegion />
    </main>
  );
}

/**
 * Announces state changes that are otherwise only visible: what was
 * added, deleted, moved, hidden or saved. Without this, the entire
 * editor is silent to a screen reader.
 */
function LiveRegion() {
  const { state } = useEditor();

  return (
    // Keyed by the announcement timestamp so repeating an action
    // remounts the region and is announced again; assistive tech
    // ignores a live region whose text has not changed.
    <div
      key={state.announcement?.at ?? 0}
      className="editor-live-region"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      {state.announcement?.message ?? ""}
    </div>
  );
}

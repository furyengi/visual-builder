"use client";

import { useCallback, useRef, useState } from "react";
import {
  Box,
  Grid2x2,
  Hand,
  Maximize2,
  Minus,
  MousePointer2,
  Plus,
  Ruler,
  SquareDashed,
  Type,
} from "lucide-react";

import { Popover, PopoverItem } from "@/components/ui/glass-popover";
import { ToolbarGroup, ToolbarSeparator } from "@/components/ui/glass-toolbar";
import { IconButton } from "@/components/ui/icon-button";
import { BREAKPOINT_WIDTHS } from "@/lib/editor/breakpoints";
import { nearestContainer } from "@/lib/editor/document";
import { useEditor, ZOOM_MAX, ZOOM_MIN } from "@/lib/editor/store";
import type { NodeKind } from "@/lib/editor/types";

const ZOOM_PRESETS = [0.25, 0.5, 0.75, 1, 1.5, 2];

/** The bottom tool island combines direct manipulation, view aids, and zoom. */
export function ViewportControls() {
  const { state, dispatch, run } = useEditor();
  const [zoomOpen, setZoomOpen] = useState(false);
  const zoomAnchor = useRef<HTMLButtonElement>(null);

  const width =
    state.viewportMode === "custom"
      ? state.customWidth
      : BREAKPOINT_WIDTHS[state.breakpoint];

  const insert = useCallback(
    (kind: NodeKind) => {
      const anchor = state.selectedIds[0] ?? state.document.rootId;
      const parentId = nearestContainer(
        state.document.nodes,
        anchor,
        state.document.rootId,
      );
      run({ type: "insertNode", kind, parentId });
      dispatch({ type: "setActiveTool", tool: "select" });
    },
    [dispatch, run, state.document, state.selectedIds],
  );

  return (
    <div className="editor-footer-region" aria-label="Canvas tools">
      <ToolbarGroup label="Tools" className="bottom-tool-island">
        <IconButton
          label="Select tool"
          shortcut="V"
          icon={<MousePointer2 size={14} />}
          size="sm"
          round
          aria-pressed={state.activeTool === "select"}
          onClick={() => dispatch({ type: "setActiveTool", tool: "select" })}
        />
        <IconButton
          label="Hand tool"
          shortcut="H"
          icon={<Hand size={14} />}
          size="sm"
          round
          aria-pressed={state.activeTool === "pan"}
          onClick={() => dispatch({ type: "setActiveTool", tool: "pan" })}
        />
        <ToolbarSeparator />
        <IconButton
          label="Add text"
          icon={<Type size={14} />}
          size="sm"
          round
          onClick={() => insert("text")}
        />
        <IconButton
          label="Add container"
          icon={<Box size={14} />}
          size="sm"
          round
          onClick={() => insert("container")}
        />
      </ToolbarGroup>

      <ToolbarGroup label="Viewport and guides" className="bottom-canvas-meta">
        <span className="viewport-width">
          <label className="sr-only" htmlFor="viewport-width-input">
            Viewport width in pixels
          </label>
          <input
            id="viewport-width-input"
            type="text"
            inputMode="numeric"
            value={Math.round(width)}
            onChange={(event) => {
              const next = Number.parseInt(event.target.value, 10);
              if (!Number.isNaN(next)) dispatch({ type: "setCustomWidth", width: next });
            }}
          />
          <span aria-hidden="true">px</span>
        </span>

        <ToolbarSeparator />

        <IconButton
          label={state.panels.showGrid ? "Hide grid" : "Show grid"}
          shortcut="G"
          icon={<Grid2x2 size={13} />}
          size="sm"
          round
          aria-pressed={state.panels.showGrid}
          onClick={() =>
            dispatch({ type: "setPanels", patch: { showGrid: !state.panels.showGrid } })
          }
        />
        <IconButton
          label={state.panels.showRulers ? "Hide rulers" : "Show rulers"}
          shortcut="R"
          icon={<Ruler size={13} />}
          size="sm"
          round
          aria-pressed={state.panels.showRulers}
          onClick={() =>
            dispatch({ type: "setPanels", patch: { showRulers: !state.panels.showRulers } })
          }
        />
        <IconButton
          label={state.panels.showOutlines ? "Hide child outlines" : "Show child outlines"}
          icon={<SquareDashed size={13} />}
          size="sm"
          round
          aria-pressed={state.panels.showOutlines}
          onClick={() =>
            dispatch({
              type: "setPanels",
              patch: { showOutlines: !state.panels.showOutlines },
            })
          }
        />
      </ToolbarGroup>

      <ToolbarGroup label="Zoom" className="bottom-zoom-island">
        <IconButton
          label="Zoom out"
          shortcut="⌘−"
          icon={<Minus size={13} />}
          size="sm"
          round
          disabled={state.zoom <= ZOOM_MIN}
          onClick={() => dispatch({ type: "setZoom", zoom: state.zoom / 1.2 })}
        />
        <button
          ref={zoomAnchor}
          type="button"
          className="zoom-value numeric focus-ring-contrast"
          aria-haspopup="menu"
          aria-expanded={zoomOpen}
          aria-label={`Zoom level ${Math.round(state.zoom * 100)} percent`}
          onClick={() => setZoomOpen((value) => !value)}
        >
          {Math.round(state.zoom * 100)}%
        </button>
        <IconButton
          label="Zoom in"
          shortcut="⌘+"
          icon={<Plus size={13} />}
          size="sm"
          round
          disabled={state.zoom >= ZOOM_MAX}
          onClick={() => dispatch({ type: "setZoom", zoom: state.zoom * 1.2 })}
        />
        <ToolbarSeparator />
        <IconButton
          label="Fit to screen"
          shortcut="⇧1"
          icon={<Maximize2 size={13} />}
          size="sm"
          round
          onClick={() => window.dispatchEvent(new Event("formwork:fit-canvas"))}
        />
      </ToolbarGroup>

      <Popover
        open={zoomOpen}
        onClose={() => setZoomOpen(false)}
        anchorRef={zoomAnchor}
        align="center"
        label="Zoom presets"
        className="w-[160px]"
      >
        {ZOOM_PRESETS.map((preset) => (
          <PopoverItem
            key={preset}
            onSelect={() => {
              dispatch({ type: "setZoom", zoom: preset });
              window.dispatchEvent(new Event("formwork:centre-canvas"));
              setZoomOpen(false);
            }}
          >
            {preset * 100}%
          </PopoverItem>
        ))}
        <PopoverItem
          onSelect={() => {
            window.dispatchEvent(new Event("formwork:fit-canvas"));
            setZoomOpen(false);
          }}
        >
          Fit to screen
        </PopoverItem>
      </Popover>
    </div>
  );
}

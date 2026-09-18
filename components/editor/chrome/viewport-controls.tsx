"use client";

import { useRef, useState } from "react";
import {
  Grid2x2,
  Maximize2,
  Minus,
  Plus,
  Ruler,
  SquareDashed,
} from "lucide-react";

import { Popover, PopoverItem } from "@/components/ui/glass-popover";
import { IconButton } from "@/components/ui/icon-button";
import { ToolbarGroup, ToolbarSeparator } from "@/components/ui/glass-toolbar";
import { BREAKPOINT_WIDTHS } from "@/lib/editor/breakpoints";
import { useEditor, ZOOM_MAX, ZOOM_MIN } from "@/lib/editor/store";

const ZOOM_PRESETS = [0.25, 0.5, 0.75, 1, 1.5, 2];

/**
 * Floating footer controls: exact viewport width, zoom, and the
 * workspace guides. Grouped into two capsules because "how wide is the
 * page" and "how close am I looking" are different questions.
 */
export function ViewportControls() {
  const { state, dispatch } = useEditor();
  const [zoomOpen, setZoomOpen] = useState(false);
  const zoomAnchor = useRef<HTMLButtonElement>(null);

  const width =
    state.viewportMode === "custom"
      ? state.customWidth
      : BREAKPOINT_WIDTHS[state.breakpoint];

  return (
    <div className="editor-footer-region">
      <ToolbarGroup label="Viewport width">
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

      <ToolbarGroup label="Zoom">
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

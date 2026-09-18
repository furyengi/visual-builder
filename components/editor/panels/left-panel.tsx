"use client";

import { Blocks, Layers } from "lucide-react";

import { GlassSurface } from "@/components/ui/glass-surface";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { useEditor } from "@/lib/editor/store";
import { ComponentLibrary } from "./component-library";
import { LayersTree } from "./layers-tree";
import { PanelResizer } from "./panel-resizer";

const MIN_WIDTH = 220;
const MAX_WIDTH = 420;

/**
 * The left panel: component library and layer tree, sharing one glass
 * shell. Collapsing it is a transform rather than an unmount, so panel
 * scroll position and tree expansion survive a toggle.
 */
export function LeftPanel() {
  const { state, dispatch } = useEditor();
  const { leftOpen, leftWidth, leftTab } = state.panels;

  return (
    <div className="editor-panel-region editor-panel-region--left">
      <GlassSurface
        level="thick"
        radius="var(--radius-10)"
        className="side-panel relative"
        data-collapsed={!leftOpen ? "true" : undefined}
        style={{
          ["--panel-width" as string]: `${leftWidth}px`,
          transform: leftOpen
            ? undefined
            : "translateX(calc(-100% - var(--space-6)))",
        }}
        aria-hidden={!leftOpen}
        // Hidden panels must leave the tab order, not just the screen.
        inert={!leftOpen}
      >
        <div className="side-panel__header">
          <SegmentedControl
            className="panel-tabs"
            label="Left panel view"
            glass
            value={leftTab}
            onChange={(tab) => dispatch({ type: "setPanels", patch: { leftTab: tab } })}
            options={[
              { value: "components", label: "Components", icon: <Blocks size={12} /> },
              { value: "layers", label: "Layers", icon: <Layers size={12} /> },
            ]}
          />
        </div>

        <div className="side-panel__body glass-content">
          <div className="side-panel__scroll scroll-y">
            {leftTab === "components" ? <ComponentLibrary /> : <LayersTree />}
          </div>
        </div>

        <PanelResizer
          side="right"
          width={leftWidth}
          min={MIN_WIDTH}
          max={MAX_WIDTH}
          label="Resize component panel"
          onResize={(width) => dispatch({ type: "setPanels", patch: { leftWidth: width } })}
        />
      </GlassSurface>
    </div>
  );
}

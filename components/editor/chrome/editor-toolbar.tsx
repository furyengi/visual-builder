"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ChevronLeft,
  Eye,
  Focus,
  Keyboard,
  Minimize2,
  Monitor,
  PanelLeft,
  PanelRight,
  Redo2,
  Smartphone,
  Tablet,
  Undo2,
  Upload,
} from "lucide-react";

import { GlassButton } from "@/components/ui/glass-button";
import { AccountControl } from "@/components/auth/account-control";
import {
  GlassToolbar,
  ToolbarGroup,
  ToolbarSeparator,
  ToolbarSpacer,
} from "@/components/ui/glass-toolbar";
import { IconButton } from "@/components/ui/icon-button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { canRedo, canUndo } from "@/lib/editor/history";
import { useEditor } from "@/lib/editor/store";
import type { Breakpoint } from "@/lib/editor/types";
import { AppearanceMenu } from "./appearance-menu";
import { CommandCenter } from "./command-center";
import { SaveStatus } from "./save-status";

const VIEWPORTS = [
  { value: "desktop" as const, label: "Desktop", icon: <Monitor size={14} /> },
  { value: "tablet" as const, label: "Tablet", icon: <Tablet size={14} /> },
  { value: "mobile" as const, label: "Mobile", icon: <Smartphone size={14} /> },
];

/** The docked command bar: project context, responsive canvas, and global actions. */
export function EditorToolbar() {
  const { state, dispatch } = useEditor();
  const [renaming, setRenaming] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);

  return (
    <GlassToolbar label="Editor" className="editor-toolbar-region">
      <ToolbarGroup label="Project" squared className="toolbar-project-group">
        <Link href="/" aria-label="Back to projects" className="contents">
          <IconButton
            label="Back to projects"
            icon={<ChevronLeft size={16} />}
            tooltipPlacement="bottom"
          />
        </Link>
        <span className="toolbar-brand" aria-hidden="true">
          F
        </span>
        <span className="toolbar-project">
          <span className="toolbar-project__text">
            {renaming ? (
              <input
                className="toolbar-project__input"
                autoFocus
                defaultValue={state.document.name}
                aria-label="Project name"
                onBlur={(event) => {
                  dispatch({
                    type: "run",
                    command: { type: "renameDocument", name: event.target.value },
                  });
                  setRenaming(false);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") event.currentTarget.blur();
                  if (event.key === "Escape") setRenaming(false);
                }}
              />
            ) : (
              <button
                type="button"
                className="toolbar-project__name focus-ring-inset"
                onClick={() => setRenaming(true)}
                title="Rename project"
              >
                {state.document.name}
              </button>
            )}
            <SaveStatus />
          </span>
        </span>
      </ToolbarGroup>

      <ToolbarGroup label="Panels" className="toolbar-panel-group">
        <IconButton
          label={state.panels.leftOpen ? "Hide component dock" : "Show component dock"}
          shortcut="⌥1"
          icon={<PanelLeft size={15} />}
          round
          aria-pressed={state.panels.leftOpen}
          onClick={() =>
            dispatch({ type: "setPanels", patch: { leftOpen: !state.panels.leftOpen } })
          }
        />
        <IconButton
          label={state.panels.rightOpen ? "Hide inspector" : "Show inspector"}
          shortcut="⌥2"
          icon={<PanelRight size={15} />}
          round
          aria-pressed={state.panels.rightOpen}
          onClick={() =>
            dispatch({ type: "setPanels", patch: { rightOpen: !state.panels.rightOpen } })
          }
        />
      </ToolbarGroup>

      <ToolbarSpacer />

      <ToolbarGroup label="Viewport" className="toolbar-viewport-group">
        <SegmentedControl
          label="Viewport size"
          glass
          pill
          value={state.breakpoint}
          onChange={(breakpoint: Breakpoint) =>
            dispatch({ type: "setBreakpoint", breakpoint })
          }
          options={VIEWPORTS}
        />
      </ToolbarGroup>

      <ToolbarSpacer />

      <ToolbarGroup label="History" className="toolbar-history-group">
        <IconButton
          label="Undo"
          shortcut="⌘Z"
          icon={<Undo2 size={15} />}
          round
          disabled={!canUndo(state.history)}
          onClick={() => dispatch({ type: "undo" })}
        />
        <IconButton
          label="Redo"
          shortcut="⇧⌘Z"
          icon={<Redo2 size={15} />}
          round
          disabled={!canRedo(state.history)}
          onClick={() => dispatch({ type: "redo" })}
        />
      </ToolbarGroup>

      <ToolbarGroup label="Command Center" className="toolbar-command-group">
        <GlassButton
          pill
          size="sm"
          className="command-trigger"
          icon={<Keyboard size={14} />}
          trailing={<kbd>⌘K</kbd>}
          onClick={() => setCommandOpen(true)}
        >
          <span className="toolbar-command-label">Commands</span>
        </GlassButton>
      </ToolbarGroup>

      <ToolbarGroup label="Focus Mode" className="toolbar-focus-group">
        <GlassButton
          pill
          size="sm"
          icon={state.focusMode ? <Minimize2 size={14} /> : <Focus size={14} />}
          aria-pressed={state.focusMode}
          onClick={() => dispatch({ type: "toggleFocusMode" })}
        >
          {state.focusMode ? "Exit focus" : "Focus"}
        </GlassButton>
      </ToolbarGroup>

      <ToolbarGroup label="Actions" className="toolbar-actions-group">
        <AccountControl compact />
        <AppearanceMenu />
        <ToolbarSeparator />
        <GlassButton
          pill
          size="sm"
          icon={<Eye size={14} />}
          aria-pressed={state.preview}
          onClick={() => dispatch({ type: "togglePreview" })}
        >
          {state.preview ? "Exit preview" : "Preview"}
        </GlassButton>
        <GlassButton pill size="sm" variant="solid" icon={<Upload size={13} />} disabled>
          Publish
        </GlassButton>
      </ToolbarGroup>

      <CommandCenter open={commandOpen} onOpenChange={setCommandOpen} />
    </GlassToolbar>
  );
}

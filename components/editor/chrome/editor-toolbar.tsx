"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import {
  ChevronLeft,
  Eye,
  Monitor,
  PanelLeft,
  PanelRight,
  Redo2,
  Share2,
  Smartphone,
  Tablet,
  Undo2,
  Upload,
} from "lucide-react";

import { GlassButton } from "@/components/ui/glass-button";
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
import { SaveStatus } from "./save-status";

const VIEWPORTS = [
  { value: "desktop" as const, label: "Desktop", icon: <Monitor size={14} />, iconOnly: true },
  { value: "tablet" as const, label: "Tablet", icon: <Tablet size={14} />, iconOnly: true },
  { value: "mobile" as const, label: "Mobile", icon: <Smartphone size={14} />, iconOnly: true },
];

/**
 * The primary toolbar, built as separate glass capsules.
 *
 * Grouping carries meaning here: controls that affect each other share
 * a capsule, and anything unrelated gets its own. Undo and redo belong
 * together; undo and "publish" emphatically do not.
 */
export function EditorToolbar() {
  const { state, dispatch } = useEditor();
  const [renaming, setRenaming] = useState(false);

  return (
    <GlassToolbar label="Editor" className="editor-toolbar-region">
      {/* --- Navigation: where you are and whether it is safe to leave --- */}
      <ToolbarGroup label="Project" squared>
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

      {/* --- Panels: two toggles that do the same kind of thing --- */}
      <ToolbarGroup label="Panels" className="toolbar-hide-md">
        <IconButton
          label={state.panels.leftOpen ? "Hide left panel" : "Show left panel"}
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

      {/* --- History --- */}
      <ToolbarGroup label="History" className="toolbar-hide-sm">
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

      <ToolbarSpacer />

      {/* --- Viewport --- */}
      <ToolbarGroup label="Viewport">
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

      {/* --- Actions: preview is reversible, publish is not, so the
              destructive-adjacent pair is held apart from it. --- */}
      <ToolbarGroup label="Actions">
        <AppearanceMenu />
        <ToolbarSeparator />
        <GlassButton
          pill
          size="sm"
          icon={<Eye size={14} />}
          aria-pressed={state.preview}
          onClick={() => dispatch({ type: "togglePreview" })}
        >
          <span className="toolbar-hide-sm">
            {state.preview ? "Exit preview" : "Preview"}
          </span>
        </GlassButton>
      </ToolbarGroup>

      <ToolbarGroup label="Publishing" className="toolbar-hide-lg">
        <ShareButton />
        <GlassButton pill size="sm" variant="solid" icon={<Upload size={13} />} disabled>
          Publish
        </GlassButton>
      </ToolbarGroup>
    </GlassToolbar>
  );
}

/** Placeholder until sharing exists; disabled rather than fake. */
function ShareButton() {
  const anchor = useRef<HTMLButtonElement>(null);
  return (
    <IconButton
      ref={anchor}
      label="Share (not available yet)"
      icon={<Share2 size={14} />}
      round
      disabled
    />
  );
}

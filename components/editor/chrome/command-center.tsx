"use client";

import { useCallback, useEffect } from "react";
import {
  Box,
  Eye,
  Focus,
  Grid2x2,
  Heading1,
  Image as ImageIcon,
  Layers3,
  Monitor,
  MousePointer2,
  PanelLeft,
  PanelRight,
  Redo2,
  Ruler,
  Smartphone,
  Tablet,
  Type,
  Undo2,
} from "lucide-react";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { nearestContainer } from "@/lib/editor/document";
import { canRedo, canUndo } from "@/lib/editor/history";
import { useEditor } from "@/lib/editor/store";
import type { Breakpoint, NodeKind } from "@/lib/editor/types";

type CommandCenterProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const INSERT_ITEMS: Array<{
  kind: NodeKind;
  label: string;
  icon: React.ReactNode;
}> = [
  { kind: "section", label: "Add section", icon: <Layers3 /> },
  { kind: "container", label: "Add container", icon: <Box /> },
  { kind: "heading", label: "Add heading", icon: <Heading1 /> },
  { kind: "text", label: "Add text", icon: <Type /> },
  { kind: "button", label: "Add button", icon: <MousePointer2 /> },
  { kind: "image", label: "Add image", icon: <ImageIcon /> },
];

const BREAKPOINTS: Array<{
  value: Breakpoint;
  label: string;
  icon: React.ReactNode;
  shortcut: string;
}> = [
  { value: "desktop", label: "Desktop canvas", icon: <Monitor />, shortcut: "1280" },
  { value: "tablet", label: "Tablet canvas", icon: <Tablet />, shortcut: "834" },
  { value: "mobile", label: "Mobile canvas", icon: <Smartphone />, shortcut: "390" },
];

/** Searchable access to editor actions without adding permanent chrome. */
export function CommandCenter({ open, onOpenChange }: CommandCenterProps) {
  const { state, dispatch, run } = useEditor();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onOpenChange, open]);

  const choose = useCallback(
    (action: () => void) => {
      action();
      onOpenChange(false);
    },
    [onOpenChange],
  );

  const insert = useCallback(
    (kind: NodeKind) => {
      const anchor = state.selectedIds[0] ?? state.document.rootId;
      const parentId = nearestContainer(
        state.document.nodes,
        anchor,
        state.document.rootId,
      );
      choose(() => run({ type: "insertNode", kind, parentId }));
    },
    [choose, run, state.document, state.selectedIds],
  );

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Command Center"
      description="Search editor actions, views, and components"
      className="command-center"
      showCloseButton={false}
    >
      <CommandInput placeholder="Search actions and components…" />
      <CommandList>
        <CommandEmpty>No matching command.</CommandEmpty>

        <CommandGroup heading="Workspace">
          <CommandItem onSelect={() => choose(() => dispatch({ type: "toggleFocusMode" }))}>
            <Focus />
            {state.focusMode ? "Exit Focus Mode" : "Enter Focus Mode"}
            <CommandShortcut>⇧F</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => choose(() => dispatch({ type: "togglePreview" }))}>
            <Eye />
            {state.preview ? "Exit preview" : "Preview site"}
            <CommandShortcut>P</CommandShortcut>
          </CommandItem>
          <CommandItem
            onSelect={() =>
              choose(() =>
                dispatch({
                  type: "setPanels",
                  patch: { leftOpen: !state.panels.leftOpen },
                }),
              )
            }
          >
            <PanelLeft />
            {state.panels.leftOpen ? "Hide component dock" : "Show component dock"}
            <CommandShortcut>⌥1</CommandShortcut>
          </CommandItem>
          <CommandItem
            onSelect={() =>
              choose(() =>
                dispatch({
                  type: "setPanels",
                  patch: { rightOpen: !state.panels.rightOpen },
                }),
              )
            }
          >
            <PanelRight />
            {state.panels.rightOpen ? "Hide inspector" : "Show inspector"}
            <CommandShortcut>⌥2</CommandShortcut>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Canvas">
          {BREAKPOINTS.map((breakpoint) => (
            <CommandItem
              key={breakpoint.value}
              onSelect={() =>
                choose(() =>
                  dispatch({ type: "setBreakpoint", breakpoint: breakpoint.value }),
                )
              }
            >
              {breakpoint.icon}
              {breakpoint.label}
              <CommandShortcut>{breakpoint.shortcut}px</CommandShortcut>
            </CommandItem>
          ))}
          <CommandItem
            onSelect={() =>
              choose(() => window.dispatchEvent(new Event("formwork:fit-canvas")))
            }
          >
            <Focus />
            Fit canvas to screen
            <CommandShortcut>⇧1</CommandShortcut>
          </CommandItem>
          <CommandItem
            onSelect={() =>
              choose(() =>
                dispatch({
                  type: "setPanels",
                  patch: { showGrid: !state.panels.showGrid },
                }),
              )
            }
          >
            <Grid2x2 />
            {state.panels.showGrid ? "Hide canvas grid" : "Show canvas grid"}
            <CommandShortcut>G</CommandShortcut>
          </CommandItem>
          <CommandItem
            onSelect={() =>
              choose(() =>
                dispatch({
                  type: "setPanels",
                  patch: { showRulers: !state.panels.showRulers },
                }),
              )
            }
          >
            <Ruler />
            {state.panels.showRulers ? "Hide rulers" : "Show rulers"}
            <CommandShortcut>R</CommandShortcut>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Add to page">
          {INSERT_ITEMS.map((item) => (
            <CommandItem key={item.kind} onSelect={() => insert(item.kind)}>
              {item.icon}
              {item.label}
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="History">
          <CommandItem
            disabled={!canUndo(state.history)}
            onSelect={() => choose(() => dispatch({ type: "undo" }))}
          >
            <Undo2 />
            Undo
            <CommandShortcut>⌘Z</CommandShortcut>
          </CommandItem>
          <CommandItem
            disabled={!canRedo(state.history)}
            onSelect={() => choose(() => dispatch({ type: "redo" }))}
          >
            <Redo2 />
            Redo
            <CommandShortcut>⇧⌘Z</CommandShortcut>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}

/* eslint-disable @next/next/no-img-element */
"use client";

import { memo, useCallback, useEffect, useRef, type CSSProperties } from "react";
import { resolveStyles } from "@/lib/editor/breakpoints";
import { canHaveChildren } from "@/lib/editor/document";
import { useEditor } from "@/lib/editor/store";
import type { Breakpoint, EditorNode, StyleMap } from "@/lib/editor/types";
import { useNodeRegistry } from "./node-registry";

/** Style keys stored as numbers that need a px unit when rendered. */
const PX_PROPERTIES = new Set<keyof StyleMap>([
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "marginTop",
  "marginRight",
  "marginBottom",
  "marginLeft",
  "gap",
  "fontSize",
  "letterSpacing",
  "borderWidth",
  "borderRadius",
  "borderTopLeftRadius",
  "borderTopRightRadius",
  "borderBottomRightRadius",
  "borderBottomLeftRadius",
  "left",
  "top",
  "right",
  "bottom",
]);

/** Converts the stored style map into a React style object. */
export function toCssProperties(styles: StyleMap): CSSProperties {
  const output: Record<string, string | number> = {};

  for (const [key, value] of Object.entries(styles)) {
    if (value === undefined || value === null || value === "") continue;
    output[key] =
      typeof value === "number" && PX_PROPERTIES.has(key as keyof StyleMap)
        ? `${value}px`
        : value;
  }

  // A border colour or width alone does nothing without a style; the
  // inspector only exposes the two, so the third is implied.
  if ((styles.borderWidth ?? 0) > 0 && !styles.borderStyle) {
    output.borderStyle = "solid";
  }

  return output as CSSProperties;
}

type NodeProps = { id: string; breakpoint: Breakpoint };

/**
 * Renders one document node.
 *
 * Memoised on the node object and breakpoint: a document is a tree of
 * immutable nodes, so editing one element only re-renders that element
 * and its ancestors, not the whole page.
 */
export const RenderNode = memo(function RenderNode({ id, breakpoint }: NodeProps) {
  const { state } = useEditor();
  const node = state.document.nodes[id];
  if (!node) return null;
  return <NodeElement node={node} breakpoint={breakpoint} />;
});

function NodeElement({ node, breakpoint }: { node: EditorNode; breakpoint: Breakpoint }) {
  const { state, run, dispatch } = useEditor();
  const registry = useNodeRegistry();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    registry.register(node.id, ref.current);
    return () => registry.register(node.id, null);
  }, [node.id, registry]);

  const style = toCssProperties(resolveStyles(node, breakpoint));
  const editing = state.editingId === node.id;
  const isTextual = node.type === "text" || node.type === "heading" || node.type === "button";

  const commitText = useCallback(
    (element: HTMLElement) => {
      const content = element.innerText.replace(/ /g, " ");
      if (content !== node.content) {
        run({ type: "setContent", id: node.id, content });
      }
      dispatch({ type: "setEditing", id: null });
    },
    [dispatch, node.content, node.id, run],
  );

  const dropActive =
    state.dropTarget?.position === "inside" && state.dropTarget.nodeId === node.id;

  return (
    <div
      ref={ref}
      data-node-id={node.id}
      data-node-type={node.type}
      data-hidden={node.hidden ? "true" : undefined}
      data-editing={editing ? "true" : undefined}
      data-drop-active={dropActive ? "true" : undefined}
      className={`builder-node node-${node.type}`}
      style={style}
    >
      <NodeContent
        node={node}
        breakpoint={breakpoint}
        editing={editing}
        isTextual={isTextual}
        preview={state.preview}
        onCommitText={commitText}
      />
    </div>
  );
}

function NodeContent({
  node,
  breakpoint,
  editing,
  isTextual,
  preview,
  onCommitText,
}: {
  node: EditorNode;
  breakpoint: Breakpoint;
  editing: boolean;
  isTextual: boolean;
  preview: boolean;
  onCommitText: (element: HTMLElement) => void;
}) {
  if (node.type === "image") {
    return <img src={node.src} alt={node.alt ?? ""} draggable={false} />;
  }

  if (node.type === "divider" || node.type === "spacer") return null;

  if (isTextual) {
    return (
      <span
        className={node.type === "button" ? "node-button-label" : `node-${node.type}`}
        // contentEditable is enabled only for the node actively being
        // edited. Leaving every text node editable makes the canvas
        // focus-trap unpredictable and breaks click-to-select.
        contentEditable={editing}
        suppressContentEditableWarning
        spellCheck={editing}
        onBlur={(event) => editing && onCommitText(event.currentTarget)}
        onKeyDown={(event) => {
          if (!editing) return;
          event.stopPropagation();
          if (event.key === "Escape") {
            event.preventDefault();
            event.currentTarget.blur();
          }
          // Enter commits for single-line-ish elements; Shift+Enter
          // always inserts a break.
          if (event.key === "Enter" && !event.shiftKey && node.type === "button") {
            event.preventDefault();
            event.currentTarget.blur();
          }
        }}
      >
        {node.content}
      </span>
    );
  }

  if (canHaveChildren(node)) {
    if (!node.children.length) {
      return preview ? null : <div className="empty-slot">Drop elements here</div>;
    }
    return (
      <>
        {node.children.map((childId) => (
          <RenderNode key={childId} id={childId} breakpoint={breakpoint} />
        ))}
      </>
    );
  }

  return null;
}

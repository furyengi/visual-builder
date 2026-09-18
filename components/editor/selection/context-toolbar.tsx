"use client";

import { useLayoutEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import {
  ChevronRight,
  Copy,
  Eye,
  EyeOff,
  Lock,
  Trash2,
  Unlock,
} from "lucide-react";

import { GlassSurface } from "@/components/ui/glass-surface";
import { IconButton } from "@/components/ui/icon-button";
import { breadcrumbFor } from "@/lib/editor/commands";
import type { Rect } from "@/lib/editor/geometry";
import { useEditor } from "@/lib/editor/store";

const GAP = 10;
const ESTIMATED_HEIGHT = 36;

/**
 * A small glass capsule anchored to the selection.
 *
 * Portalled to the document body rather than rendered in place. The
 * canvas sits inside a scaled transform, and a transformed ancestor
 * makes `position: fixed` resolve against that ancestor — so an
 * in-place toolbar would shrink along with the zoom level.
 *
 * Positioned in viewport coordinates, and flipped below the element
 * when there is no room above, so it never covers what it acts on.
 */
export function ContextToolbar({
  nodeId,
  containerRef,
  rect,
}: {
  nodeId: string;
  containerRef: RefObject<HTMLDivElement | null>;
  rect: Rect;
}) {
  const { state, dispatch, run } = useEditor();
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);

  const node = state.document.nodes[nodeId];
  const trail = node ? breadcrumbFor(state.document, nodeId) : [];
  const isRoot = nodeId === state.document.rootId;

  useLayoutEffect(() => {
    const container = containerRef.current;
    const element = ref.current;
    if (!container || !element) return;

    const base = container.getBoundingClientRect();
    const width = element.offsetWidth;

    // Convert the document-space rect back into viewport coordinates.
    const left = base.left + rect.x * state.zoom;
    const top = base.top + rect.y * state.zoom;
    const bottom = top + rect.height * state.zoom;

    const above = top - GAP - ESTIMATED_HEIGHT;
    const flip = above < 68; // clears the floating toolbar

    setPosition({
      left: Math.min(
        Math.max(8, left),
        window.innerWidth - width - 8,
      ),
      top: flip ? bottom + GAP : above,
    });
  }, [containerRef, rect, state.zoom, state.pan.x, state.pan.y]);

  if (!node || state.selectedIds.length > 1 || typeof window === "undefined") {
    return null;
  }

  return createPortal(
    <GlassSurface
      ref={ref}
      level="thin"
      radius="var(--radius-full)"
      className="context-toolbar"
      style={{
        left: position?.left ?? -9999,
        top: position?.top ?? -9999,
        visibility: position ? "visible" : "hidden",
      }}
      role="toolbar"
      aria-label={`${node.name} actions`}
    >
      <nav className="context-toolbar__breadcrumb" aria-label="Element path">
        {/* Only the last three levels: a deep tree would otherwise push
            the action buttons off screen. */}
        {trail.slice(-3).map((crumb, index) => (
          <span key={crumb.id} className="contents">
            {index > 0 && (
              <ChevronRight size={10} className="context-toolbar__chevron" aria-hidden="true" />
            )}
            <button
              type="button"
              className="context-toolbar__crumb"
              aria-current={crumb.id === nodeId ? "true" : undefined}
              onClick={() => dispatch({ type: "select", ids: [crumb.id] })}
            >
              {crumb.name}
            </button>
          </span>
        ))}
      </nav>

      <span className="glass-separator" />

      <IconButton
        label={node.hidden ? "Show element" : "Hide element"}
        icon={node.hidden ? <EyeOff size={13} /> : <Eye size={13} />}
        size="sm"
        round
        onClick={() =>
          run({ type: "setNodeFlag", ids: [nodeId], flag: "hidden", value: !node.hidden })
        }
      />
      <IconButton
        label={node.locked ? "Unlock element" : "Lock element"}
        icon={node.locked ? <Unlock size={13} /> : <Lock size={13} />}
        size="sm"
        round
        onClick={() =>
          run({ type: "setNodeFlag", ids: [nodeId], flag: "locked", value: !node.locked })
        }
      />
      <IconButton
        label="Duplicate"
        shortcut="⌘D"
        icon={<Copy size={13} />}
        size="sm"
        round
        disabled={isRoot}
        onClick={() => run({ type: "duplicateNodes", ids: [nodeId] })}
      />
      <IconButton
        label="Delete"
        shortcut="⌫"
        icon={<Trash2 size={13} />}
        size="sm"
        round
        danger
        disabled={isRoot}
        onClick={() => run({ type: "deleteNodes", ids: [nodeId] })}
      />
    </GlassSurface>,
    window.document.body,
  );
}

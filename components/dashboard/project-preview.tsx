"use client";

import { useEffect, useRef, useState } from "react";

import { resolveStyles } from "@/lib/editor/breakpoints";
import { toCssProperties } from "@/components/editor/canvas/node-renderer";
import type { EditorDocument } from "@/lib/editor/types";

const PREVIEW_WIDTH = 1280;

/**
 * A live miniature of a project.
 *
 * The real document is rendered at full width and scaled down with a
 * transform, rather than stored as an image. A card therefore always
 * matches the current state of the project, with no thumbnail capture
 * step to go stale or fail.
 */
export function ProjectPreview({ document }: { document: EditorDocument }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.2);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === "undefined") return;
    const update = () => setScale(container.clientWidth / PREVIEW_WIDTH);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="project-card__preview">
      <div
        className="project-card__scaled"
        style={{ width: PREVIEW_WIDTH, transform: `scale(${scale})` }}
        aria-hidden="true"
      >
        <StaticNode document={document} id={document.rootId} />
      </div>
    </div>
  );
}

/**
 * A read-only renderer, separate from the editor's.
 *
 * It takes a document as a prop instead of reading the editor store, so
 * the dashboard can show many projects at once without instantiating an
 * editor for each of them.
 */
function StaticNode({
  document,
  id,
  depth = 0,
}: {
  document: EditorDocument;
  id: string;
  depth?: number;
}) {
  const node = document.nodes[id];
  // Deep trees cost more than they add at thumbnail scale, where the
  // detail is invisible anyway.
  if (!node || node.hidden || depth > 6) return null;

  const style = toCssProperties(resolveStyles(node, "desktop"));

  if (node.type === "image") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={node.src} alt="" style={style} draggable={false} />
    );
  }

  if (node.type === "divider" || node.type === "spacer") {
    return <div style={style} />;
  }

  if (node.type === "text" || node.type === "heading" || node.type === "button") {
    return <div style={style}>{node.content}</div>;
  }

  return (
    <div style={style}>
      {node.children.map((childId) => (
        <StaticNode key={childId} document={document} id={childId} depth={depth + 1} />
      ))}
    </div>
  );
}

"use client";

import { useCallback, useMemo, useState } from "react";
import {
  Box,
  Columns3,
  Heading1,
  Image as ImageIcon,
  LayoutPanelTop,
  Minus,
  MousePointerClick,
  Move3d,
  Search,
  Type,
} from "lucide-react";

import { nearestContainer } from "@/lib/editor/document";
import { createLocalStore, useLocalStore } from "@/lib/local-store";
import { useEditor } from "@/lib/editor/store";
import type { NodeKind } from "@/lib/editor/types";

type LibraryItem = {
  kind: NodeKind;
  label: string;
  /** Matched against the search box alongside the label. */
  keywords: string;
  icon: React.ReactNode;
};

const GROUPS: { title: string; items: LibraryItem[] }[] = [
  {
    title: "Layout",
    items: [
      {
        kind: "section",
        label: "Section",
        keywords: "band row block region",
        icon: <LayoutPanelTop size={16} />,
      },
      {
        kind: "container",
        label: "Container",
        keywords: "div box group stack wrapper",
        icon: <Box size={16} />,
      },
      {
        kind: "grid",
        label: "Grid",
        keywords: "columns layout cards",
        icon: <Columns3 size={16} />,
      },
      {
        kind: "spacer",
        label: "Spacer",
        keywords: "gap space margin",
        icon: <Move3d size={16} />,
      },
    ],
  },
  {
    title: "Basic",
    items: [
      {
        kind: "heading",
        label: "Heading",
        keywords: "title h1 h2 headline",
        icon: <Heading1 size={16} />,
      },
      {
        kind: "text",
        label: "Text",
        keywords: "paragraph body copy p",
        icon: <Type size={16} />,
      },
      {
        kind: "button",
        label: "Button",
        keywords: "cta link action",
        icon: <MousePointerClick size={16} />,
      },
      {
        kind: "divider",
        label: "Divider",
        keywords: "rule line hr separator",
        icon: <Minus size={16} />,
      },
    ],
  },
  {
    title: "Media",
    items: [
      {
        kind: "image",
        label: "Image",
        keywords: "picture photo img media",
        icon: <ImageIcon size={16} />,
      },
    ],
  },
];

const ALL_ITEMS = GROUPS.flatMap((group) => group.items);
const RECENT_KEY = "formwork:v2:recent-components";

const recentStore = createLocalStore<NodeKind[]>(RECENT_KEY, []);
const NO_RECENT: NodeKind[] = [];
const RECENT_LIMIT = 4;

/**
 * The component library.
 *
 * Both insertion routes lead to the same command: dragging aims at a
 * precise position, clicking appends to the current container. Clicking
 * exists because dragging is a fine-motor task, and every drag action
 * here needs a keyboard-and-click equivalent.
 */
export function ComponentLibrary() {
  const { state, run } = useEditor();
  const [query, setQuery] = useState("");
  const recent = useLocalStore(recentStore, NO_RECENT);

  const remember = useCallback((kind: NodeKind) => {
    recentStore.set((current) =>
      [kind, ...current.filter((item) => item !== kind)].slice(0, RECENT_LIMIT),
    );
  }, []);

  /** Click-to-add: into the selection if it can hold children, else beside it. */
  const insert = useCallback(
    (kind: NodeKind) => {
      const anchor = state.selectedIds[0] ?? state.document.rootId;
      const parentId = nearestContainer(
        state.document.nodes,
        anchor,
        state.document.rootId,
      );
      run({ type: "insertNode", kind, parentId });
      remember(kind);
    },
    [remember, run, state.document, state.selectedIds],
  );

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return null;
    return ALL_ITEMS.filter(
      (item) =>
        item.label.toLowerCase().includes(term) || item.keywords.includes(term),
    );
  }, [query]);

  const recentItems = recent
    .map((kind) => ALL_ITEMS.find((item) => item.kind === kind))
    .filter((item): item is LibraryItem => Boolean(item));

  return (
    <div className="flex flex-col gap-4">
      <label className="fw-search">
        <Search size={13} aria-hidden="true" />
        <input
          type="search"
          value={query}
          placeholder="Search components"
          aria-label="Search components"
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>

      {filtered ? (
        filtered.length ? (
          <Group title={`${filtered.length} result${filtered.length === 1 ? "" : "s"}`}>
            {filtered.map((item) => (
              <Tile key={item.kind} item={item} onInsert={insert} onDragStart={remember} />
            ))}
          </Group>
        ) : (
          <p className="fw-empty__body px-2 py-6">
            Nothing matches “{query.trim()}”.
          </p>
        )
      ) : (
        <>
          {recentItems.length > 0 && (
            <Group title="Recent">
              {recentItems.map((item) => (
                <Tile
                  key={`recent-${item.kind}`}
                  item={item}
                  compact
                  onInsert={insert}
                  onDragStart={remember}
                />
              ))}
            </Group>
          )}
          {GROUPS.map((group) => (
            <Group key={group.title} title={group.title}>
              {group.items.map((item) => (
                <Tile
                  key={item.kind}
                  item={item}
                  onInsert={insert}
                  onDragStart={remember}
                />
              ))}
            </Group>
          ))}
        </>
      )}

      <p className="fw-empty__body px-2 pb-2 pt-1">
        Drag onto the canvas to place precisely, or click to add inside the current
        selection.
      </p>

    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="component-group">
      <span className="component-group__title label-caps">{title}</span>
      <div className="component-grid">{children}</div>
    </section>
  );
}

function Tile({
  item,
  compact,
  onInsert,
  onDragStart,
}: {
  item: LibraryItem;
  compact?: boolean;
  onInsert: (kind: NodeKind) => void;
  onDragStart: (kind: NodeKind) => void;
}) {
  const { dispatch } = useEditor();
  const [dragging, setDragging] = useState(false);

  return (
    <button
      type="button"
      draggable
      data-dragging={dragging ? "true" : undefined}
      className={`component-tile${compact ? " component-tile--recent" : ""} focus-ring-inset`}
      onClick={() => onInsert(item.kind)}
      onDragStart={(event) => {
        setDragging(true);
        onDragStart(item.kind);
        event.dataTransfer.effectAllowed = "copy";
        // A payload is set for completeness, but the drag state in the
        // store is what the canvas reads: dataTransfer contents are not
        // readable during dragover in most browsers.
        event.dataTransfer.setData("text/plain", item.label);
        dispatch({
          type: "setDrag",
          payload: { kind: "new", nodeKind: item.kind },
        });
      }}
      onDragEnd={() => {
        setDragging(false);
        dispatch({ type: "setDrag", payload: null });
        dispatch({ type: "setDropTarget", target: null });
      }}
    >
      <span className="component-tile__preview" aria-hidden="true">
        {item.icon}
      </span>
      <span className="component-tile__label">{item.label}</span>
    </button>
  );
}

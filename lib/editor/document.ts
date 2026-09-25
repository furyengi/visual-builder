import { DOCUMENT_SCHEMA_VERSION } from "./types";
import type { EditorDocument, EditorNode, NodeKind, StyleMap } from "./types";

export function makeId(): string {
  // crypto.randomUUID is unavailable in some embedded webviews, so a
  // short random id is used instead; ids only need to be unique within
  // one document, not globally.
  return Math.random().toString(36).slice(2, 10);
}

/** Node kinds that accept children. */
const CONTAINER_KINDS = new Set<NodeKind>(["section", "container", "grid"]);

export function isContainer(kind: NodeKind): boolean {
  return CONTAINER_KINDS.has(kind);
}

export function canHaveChildren(node: EditorNode | undefined): boolean {
  return !!node && isContainer(node.type);
}

export const NODE_LABELS: Record<NodeKind, string> = {
  section: "Section",
  container: "Container",
  grid: "Grid",
  text: "Text",
  heading: "Heading",
  button: "Button",
  image: "Image",
  divider: "Divider",
  spacer: "Spacer",
};

const node = (
  type: NodeKind,
  name: string,
  parentId: string | null,
  styles: StyleMap,
  extra: Partial<EditorNode> = {},
): EditorNode => ({
  id: makeId(),
  type,
  name,
  parentId,
  children: [],
  styles: { desktop: styles },
  ...extra,
});

/** Default styles a freshly inserted node starts with. */
const DEFAULT_STYLES: Record<NodeKind, StyleMap> = {
  section: {
    width: "100%",
    minHeight: "240px",
    paddingTop: 64,
    paddingRight: 64,
    paddingBottom: 64,
    paddingLeft: 64,
    display: "flex",
    flexDirection: "column",
    gap: 16,
    backgroundColor: "#ffffff",
  },
  container: {
    width: "100%",
    minHeight: "120px",
    paddingTop: 24,
    paddingRight: 24,
    paddingBottom: 24,
    paddingLeft: 24,
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  grid: {
    width: "100%",
    minHeight: "160px",
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 20,
  },
  heading: {
    fontSize: 40,
    fontWeight: 600,
    lineHeight: 1.1,
    letterSpacing: -1,
    color: "#171717",
  },
  text: {
    fontSize: 16,
    fontWeight: 400,
    lineHeight: 1.6,
    color: "#404040",
  },
  button: {
    fontSize: 15,
    fontWeight: 600,
    color: "#ffffff",
    backgroundColor: "#171717",
    paddingTop: 12,
    paddingRight: 22,
    paddingBottom: 12,
    paddingLeft: 22,
    borderRadius: 8,
    width: "fit-content",
    textAlign: "center",
  },
  image: {
    width: "100%",
    height: "280px",
    objectFit: "cover",
    borderRadius: 12,
  },
  divider: {
    width: "100%",
    height: "1px",
    backgroundColor: "#e5e5e5",
  },
  spacer: {
    width: "100%",
    height: "48px",
  },
};

const DEFAULT_CONTENT: Partial<Record<NodeKind, string>> = {
  heading: "A headline worth reading",
  text: "Describe what makes this different in a sentence or two.",
  button: "Get started",
};

const PLACEHOLDER_IMAGE =
  "https://images.unsplash.com/photo-1558655146-9f40138edfeb?auto=format&fit=crop&w=1200&q=80";

export function createNode(kind: NodeKind, parentId: string): EditorNode {
  return {
    id: makeId(),
    type: kind,
    name: NODE_LABELS[kind],
    parentId,
    children: [],
    styles: { desktop: { ...DEFAULT_STYLES[kind] } },
    ...(DEFAULT_CONTENT[kind] ? { content: DEFAULT_CONTENT[kind] } : null),
    ...(kind === "image" ? { src: PLACEHOLDER_IMAGE, alt: "" } : null),
  };
}

export function makeDocument(blank = false, name?: string): EditorDocument {
  const now = Date.now();
  const root = node("section", "Page", null, {
    width: "100%",
    minHeight: "100%",
    backgroundColor: "#ffffff",
    display: "flex",
    flexDirection: "column",
  });

  const nodes: Record<string, EditorNode> = { [root.id]: root };

  if (!blank) {
    const hero = node("section", "Hero", root.id, {
      width: "100%",
      minHeight: "620px",
      backgroundColor: "#f4f3ef",
      paddingTop: 112,
      paddingRight: 72,
      paddingBottom: 96,
      paddingLeft: 72,
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      gap: 24,
    });
    const eyebrow = node(
      "text",
      "Eyebrow",
      hero.id,
      {
        fontSize: 13,
        fontWeight: 600,
        lineHeight: 1.4,
        letterSpacing: 1.2,
        textTransform: "uppercase",
        color: "#6f6d66",
      },
      { content: "Independent creative studio" },
    );
    const heading = node(
      "heading",
      "Heading",
      hero.id,
      {
        fontSize: 72,
        fontWeight: 600,
        lineHeight: 1.02,
        letterSpacing: -2.5,
        color: "#161714",
        maxWidth: "760px",
      },
      { content: "Build things people remember." },
    );
    const body = node(
      "text",
      "Paragraph",
      hero.id,
      {
        fontSize: 18,
        fontWeight: 400,
        lineHeight: 1.55,
        color: "#5b5d57",
        maxWidth: "520px",
      },
      {
        content:
          "We shape bold digital products for ambitious teams and thoughtful founders.",
      },
    );
    const cta = node(
      "button",
      "Primary button",
      hero.id,
      {
        fontSize: 15,
        fontWeight: 600,
        color: "#ffffff",
        backgroundColor: "#171815",
        borderRadius: 999,
        paddingTop: 15,
        paddingRight: 26,
        paddingBottom: 15,
        paddingLeft: 26,
        width: "fit-content",
      },
      { content: "Start a project" },
    );

    // Narrower screens need the display type dialled back; these are
    // real overrides so the starter document demonstrates the cascade.
    heading.styles.tablet = { fontSize: 52, letterSpacing: -1.6 };
    heading.styles.mobile = { fontSize: 36, letterSpacing: -1 };
    hero.styles.tablet = { paddingLeft: 40, paddingRight: 40, minHeight: "520px" };
    hero.styles.mobile = {
      paddingLeft: 24,
      paddingRight: 24,
      paddingTop: 72,
      minHeight: "460px",
    };

    hero.children = [eyebrow.id, heading.id, body.id, cta.id];
    root.children = [hero.id];
    Object.assign(nodes, {
      [hero.id]: hero,
      [eyebrow.id]: eyebrow,
      [heading.id]: heading,
      [body.id]: body,
      [cta.id]: cta,
    });
  }

  return {
    schemaVersion: DOCUMENT_SCHEMA_VERSION,
    id: makeId(),
    name: name ?? (blank ? "Untitled site" : "Studio landing"),
    rootId: root.id,
    nodes,
    createdAt: now,
    updatedAt: now,
  };
}

/* ------------------------------------------------------------------
   Tree helpers
   ------------------------------------------------------------------ */

/** A node and all of its descendants, depth first. */
export function descendantIds(
  nodes: Record<string, EditorNode>,
  id: string,
): string[] {
  const node = nodes[id];
  if (!node) return [];
  return [id, ...node.children.flatMap((child) => descendantIds(nodes, child))];
}

/** Ancestors from the immediate parent up to the root. */
export function ancestorIds(
  nodes: Record<string, EditorNode>,
  id: string,
): string[] {
  const chain: string[] = [];
  let current = nodes[id]?.parentId ?? null;
  while (current) {
    chain.push(current);
    current = nodes[current]?.parentId ?? null;
  }
  return chain;
}

export function isAncestor(
  nodes: Record<string, EditorNode>,
  ancestor: string,
  descendant: string,
): boolean {
  return ancestorIds(nodes, descendant).includes(ancestor);
}

/** Nearest ancestor that accepts children, including the node itself. */
export function nearestContainer(
  nodes: Record<string, EditorNode>,
  id: string,
  rootId: string,
): string {
  let current: string | null = id;
  while (current) {
    if (canHaveChildren(nodes[current])) return current;
    current = nodes[current]?.parentId ?? null;
  }
  return rootId;
}

/** True when the node, or any ancestor, is hidden. */
export function isEffectivelyHidden(
  nodes: Record<string, EditorNode>,
  id: string,
): boolean {
  if (nodes[id]?.hidden) return true;
  return ancestorIds(nodes, id).some((ancestor) => nodes[ancestor]?.hidden);
}

export function isEffectivelyLocked(
  nodes: Record<string, EditorNode>,
  id: string,
): boolean {
  if (nodes[id]?.locked) return true;
  return ancestorIds(nodes, id).some((ancestor) => nodes[ancestor]?.locked);
}

/** Deep-copies a subtree under `parentId`, returning the new root id. */
export function cloneSubtree(
  nodes: Record<string, EditorNode>,
  sourceId: string,
  parentId: string | null,
): string {
  const source = nodes[sourceId];
  const id = makeId();
  const copy: EditorNode = {
    ...source,
    id,
    parentId,
    children: [],
    styles: structuredClone(source.styles),
  };
  nodes[id] = copy;
  copy.children = source.children.map((child) => cloneSubtree(nodes, child, id));
  return id;
}

/** Document order, used to keep multi-selection stable. */
export function flattenTree(
  nodes: Record<string, EditorNode>,
  rootId: string,
): string[] {
  return descendantIds(nodes, rootId);
}

/**
 * A stable, empty document used for the server render only.
 *
 * Real documents get random ids, which cannot match between the server
 * and the client and would produce a hydration mismatch. The editor
 * renders this placeholder during SSR and swaps in the stored (or
 * freshly created) document once it is on the client.
 */
export const PLACEHOLDER_DOCUMENT_ID = "__placeholder__";

export function makePlaceholderDocument(): EditorDocument {
  return {
    schemaVersion: DOCUMENT_SCHEMA_VERSION,
    id: PLACEHOLDER_DOCUMENT_ID,
    name: "Untitled site",
    rootId: "__root__",
    nodes: {
      __root__: {
        id: "__root__",
        type: "section",
        name: "Page",
        parentId: null,
        children: [],
        styles: {
          desktop: {
            width: "100%",
            minHeight: "100%",
            backgroundColor: "#ffffff",
            display: "flex",
            flexDirection: "column",
          },
        },
      },
    },
    createdAt: 0,
    updatedAt: 0,
  };
}

/**
 * The Formwork document model.
 *
 * The graph is deliberately UI-independent: nodes are a flat record
 * keyed by stable id, parents hold ordered child ids, and styles are
 * stored per breakpoint. Nothing here imports React, so the same model
 * can later be driven by a server, a collaborative session, or a code
 * exporter without touching the editor.
 */

export type NodeKind =
  | "section"
  | "container"
  | "grid"
  | "text"
  | "heading"
  | "button"
  | "image"
  | "divider"
  | "spacer";

/** Ordered widest-first. The cascade in `breakpoints/` relies on this. */
export type Breakpoint = "desktop" | "tablet" | "mobile";

export type CssLength = string;

export type StyleMap = {
  display?: "flex" | "block" | "grid" | "inline-flex" | "none";
  flexDirection?: "row" | "column";
  flexWrap?: "nowrap" | "wrap";
  justifyContent?: string;
  alignItems?: string;
  gap?: number;
  gridTemplateColumns?: string;

  position?: "relative" | "absolute" | "fixed" | "sticky";
  left?: number;
  top?: number;
  right?: number;
  bottom?: number;
  zIndex?: number;

  width?: CssLength;
  height?: CssLength;
  minWidth?: CssLength;
  minHeight?: CssLength;
  maxWidth?: CssLength;
  maxHeight?: CssLength;

  paddingTop?: number;
  paddingRight?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  marginTop?: number;
  marginRight?: number;
  marginBottom?: number;
  marginLeft?: number;

  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number;
  lineHeight?: number;
  letterSpacing?: number;
  textAlign?: "left" | "center" | "right" | "justify";
  textTransform?: "none" | "uppercase" | "capitalize" | "lowercase";
  color?: string;

  backgroundColor?: string;
  backgroundImage?: string;
  objectFit?: "cover" | "contain" | "fill" | "none";

  borderWidth?: number;
  borderColor?: string;
  borderStyle?: "solid" | "dashed" | "dotted";
  borderRadius?: number;
  borderTopLeftRadius?: number;
  borderTopRightRadius?: number;
  borderBottomRightRadius?: number;
  borderBottomLeftRadius?: number;

  opacity?: number;
  boxShadow?: string;
  overflow?: "visible" | "hidden" | "auto" | "scroll";
};

export type StyleProperty = keyof StyleMap;

export type EditorNode = {
  id: string;
  type: NodeKind;
  name: string;
  content?: string;
  src?: string;
  alt?: string;
  href?: string;
  children: string[];
  parentId: string | null;
  /** Sparse: only breakpoints with an explicit override appear. */
  styles: Partial<Record<Breakpoint, StyleMap>>;
  /** Hidden from the canvas but kept in the document. */
  hidden?: boolean;
  /** Not selectable or draggable on the canvas. */
  locked?: boolean;
};

/** Increment when the persisted document shape needs a migration. */
export const DOCUMENT_SCHEMA_VERSION = 1 as const;

export type EditorDocument = {
  schemaVersion: typeof DOCUMENT_SCHEMA_VERSION;
  id: string;
  name: string;
  rootId: string;
  nodes: Record<string, EditorNode>;
  createdAt: number;
  updatedAt: number;
};

/** Where a dragged node will land, relative to a reference node. */
export type DropPosition = "before" | "after" | "inside";

export type DropTarget = {
  /** The reference node; for "inside" this is the container itself. */
  nodeId: string;
  position: DropPosition;
  /** Resolved parent and index, so the drop needs no re-derivation. */
  parentId: string;
  index: number;
};

export type DragPayload =
  | { kind: "new"; nodeKind: NodeKind }
  | { kind: "move"; nodeIds: string[] };

export type ViewportMode = Breakpoint | "custom";

/** The persistent pointer mode used by the canvas tool island. */
export type EditorTool = "select" | "pan";

export type PanelPreferences = {
  leftOpen: boolean;
  rightOpen: boolean;
  leftWidth: number;
  rightWidth: number;
  leftTab: "components" | "layers";
  /** Inspector sections the user has collapsed, by section id. */
  collapsedSections: string[];
  showGrid: boolean;
  showRulers: boolean;
  showOutlines: boolean;
};

export type Appearance = "light" | "dark" | "system";

export type AccessibilityPreferences = {
  appearance: Appearance;
  contrast: "normal" | "high" | "system";
  transparency: "full" | "reduced" | "system";
  motion: "full" | "reduced" | "system";
};

export type SaveStatus = "idle" | "saving" | "saved" | "error";

export type ProjectSummary = {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  /** Data URL of the last canvas render, used on dashboard cards. */
  thumbnail?: string;
};

/** The slice of state that undo/redo restores. */
export type HistorySnapshot = {
  document: EditorDocument;
  selectedIds: string[];
};

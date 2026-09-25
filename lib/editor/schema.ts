import { z } from "zod";

import { DOCUMENT_SCHEMA_VERSION, type EditorDocument } from "./types";

const NodeKindSchema = z.enum([
  "section",
  "container",
  "grid",
  "text",
  "heading",
  "button",
  "image",
  "divider",
  "spacer",
]);

const StyleMapSchema = z
  .object({
    display: z.enum(["flex", "block", "grid", "inline-flex", "none"]).optional(),
    flexDirection: z.enum(["row", "column"]).optional(),
    flexWrap: z.enum(["nowrap", "wrap"]).optional(),
    justifyContent: z.string().optional(),
    alignItems: z.string().optional(),
    gap: z.number().finite().optional(),
    gridTemplateColumns: z.string().optional(),
    position: z.enum(["relative", "absolute", "fixed", "sticky"]).optional(),
    left: z.number().finite().optional(),
    top: z.number().finite().optional(),
    right: z.number().finite().optional(),
    bottom: z.number().finite().optional(),
    zIndex: z.number().finite().optional(),
    width: z.string().optional(),
    height: z.string().optional(),
    minWidth: z.string().optional(),
    minHeight: z.string().optional(),
    maxWidth: z.string().optional(),
    maxHeight: z.string().optional(),
    paddingTop: z.number().finite().optional(),
    paddingRight: z.number().finite().optional(),
    paddingBottom: z.number().finite().optional(),
    paddingLeft: z.number().finite().optional(),
    marginTop: z.number().finite().optional(),
    marginRight: z.number().finite().optional(),
    marginBottom: z.number().finite().optional(),
    marginLeft: z.number().finite().optional(),
    fontFamily: z.string().optional(),
    fontSize: z.number().finite().optional(),
    fontWeight: z.number().finite().optional(),
    lineHeight: z.number().finite().optional(),
    letterSpacing: z.number().finite().optional(),
    textAlign: z.enum(["left", "center", "right", "justify"]).optional(),
    textTransform: z
      .enum(["none", "uppercase", "capitalize", "lowercase"])
      .optional(),
    color: z.string().optional(),
    backgroundColor: z.string().optional(),
    backgroundImage: z.string().optional(),
    objectFit: z.enum(["cover", "contain", "fill", "none"]).optional(),
    borderWidth: z.number().finite().optional(),
    borderColor: z.string().optional(),
    borderStyle: z.enum(["solid", "dashed", "dotted"]).optional(),
    borderRadius: z.number().finite().optional(),
    borderTopLeftRadius: z.number().finite().optional(),
    borderTopRightRadius: z.number().finite().optional(),
    borderBottomRightRadius: z.number().finite().optional(),
    borderBottomLeftRadius: z.number().finite().optional(),
    opacity: z.number().finite().optional(),
    boxShadow: z.string().optional(),
    overflow: z.enum(["visible", "hidden", "auto", "scroll"]).optional(),
  })
  .strict();

const EditorNodeSchema = z
  .object({
    id: z.string().min(1),
    type: NodeKindSchema,
    name: z.string().min(1),
    content: z.string().optional(),
    src: z.string().optional(),
    alt: z.string().optional(),
    href: z.string().optional(),
    children: z.array(z.string().min(1)),
    parentId: z.string().min(1).nullable(),
    styles: z
      .object({
        desktop: StyleMapSchema.optional(),
        tablet: StyleMapSchema.optional(),
        mobile: StyleMapSchema.optional(),
      })
      .strict(),
    hidden: z.boolean().optional(),
    locked: z.boolean().optional(),
  })
  .strict();

const CONTAINER_KINDS = new Set(["section", "container", "grid"]);

const EditorDocumentSchema = z
  .object({
    schemaVersion: z.literal(DOCUMENT_SCHEMA_VERSION),
    id: z.string().min(1),
    name: z.string().min(1),
    rootId: z.string().min(1),
    nodes: z.record(EditorNodeSchema),
    createdAt: z.number().finite().nonnegative(),
    updatedAt: z.number().finite().nonnegative(),
  })
  .strict()
  .superRefine((document, context) => {
    const root = document.nodes[document.rootId];
    if (!root) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "The document root does not exist",
        path: ["rootId"],
      });
      return;
    }

    if (root.parentId !== null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "The document root cannot have a parent",
        path: ["nodes", document.rootId, "parentId"],
      });
    }

    for (const [key, node] of Object.entries(document.nodes)) {
      if (key !== node.id) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "A node key must match its id",
          path: ["nodes", key, "id"],
        });
      }

      if (new Set(node.children).size !== node.children.length) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "A node cannot contain the same child twice",
          path: ["nodes", key, "children"],
        });
      }

      if (node.children.length > 0 && !CONTAINER_KINDS.has(node.type)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "This node type cannot contain children",
          path: ["nodes", key, "children"],
        });
      }

      for (const childId of node.children) {
        const child = document.nodes[childId];
        if (!child) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: "A child reference points to a missing node",
            path: ["nodes", key, "children"],
          });
        } else if (child.parentId !== key) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: "A child and parent reference disagree",
            path: ["nodes", childId, "parentId"],
          });
        }
      }

      if (key !== document.rootId) {
        const parent = node.parentId ? document.nodes[node.parentId] : undefined;
        const references = parent?.children.filter((childId) => childId === key).length ?? 0;
        if (!parent || references !== 1) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Every non-root node must belong to exactly one parent",
            path: ["nodes", key, "parentId"],
          });
        }
      }
    }

    const reachable = new Set<string>();
    const visiting = new Set<string>();
    const visit = (id: string) => {
      if (visiting.has(id)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "The node tree contains a cycle",
          path: ["nodes", id],
        });
        return;
      }
      if (reachable.has(id)) return;
      const node = document.nodes[id];
      if (!node) return;
      visiting.add(id);
      reachable.add(id);
      node.children.forEach(visit);
      visiting.delete(id);
    };
    visit(document.rootId);

    for (const id of Object.keys(document.nodes)) {
      if (!reachable.has(id)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Every node must be reachable from the document root",
          path: ["nodes", id],
        });
      }
    }
  });

export type DocumentParseResult =
  | { success: true; document: EditorDocument; migrated: boolean }
  | { success: false; error: string };

/** Validates persisted input and upgrades known older document versions. */
export function parseEditorDocument(input: unknown): DocumentParseResult {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { success: false, error: "Document data is not an object" };
  }

  const candidate = input as Record<string, unknown>;
  const version = candidate.schemaVersion;
  if (
    typeof version === "number" &&
    version > DOCUMENT_SCHEMA_VERSION
  ) {
    return {
      success: false,
      error: `Document version ${version} is newer than this editor supports`,
    };
  }

  // Version 0 was the original unversioned document shape. Its fields
  // already match v1, so the migration is explicit and lossless.
  const migrated = version === undefined || version === 0;
  const upgraded = migrated
    ? { ...candidate, schemaVersion: DOCUMENT_SCHEMA_VERSION }
    : candidate;
  const result = EditorDocumentSchema.safeParse(upgraded);

  if (!result.success) {
    return {
      success: false,
      error: result.error.issues.map((issue) => issue.message).join("; "),
    };
  }

  return { success: true, document: result.data, migrated };
}


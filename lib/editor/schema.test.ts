import { describe, expect, it } from "vitest";

import { makeDocument } from "./document";
import { parseEditorDocument } from "./schema";
import { DOCUMENT_SCHEMA_VERSION } from "./types";

describe("parseEditorDocument", () => {
  it("accepts a valid current document", () => {
    const document = makeDocument();
    const result = parseEditorDocument(document);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.document).toEqual(document);
      expect(result.migrated).toBe(false);
    }
  });

  it("migrates the original unversioned shape", () => {
    const legacy = structuredClone(makeDocument()) as Record<string, unknown>;
    delete legacy.schemaVersion;

    const result = parseEditorDocument(legacy);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.document.schemaVersion).toBe(DOCUMENT_SCHEMA_VERSION);
      expect(result.migrated).toBe(true);
    }
  });

  it("rejects a broken parent-child relationship", () => {
    const document = makeDocument();
    const childId = document.nodes[document.rootId].children[0];
    document.nodes[childId].parentId = null;

    const result = parseEditorDocument(document);

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("parent");
  });

  it("rejects nodes that are unreachable from the root", () => {
    const document = makeDocument();
    const childId = document.nodes[document.rootId].children[0];
    document.nodes[document.rootId].children = [];
    document.nodes[childId].parentId = childId;

    const result = parseEditorDocument(document);

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("reachable");
  });

  it("refuses future document versions instead of guessing", () => {
    const future = { ...makeDocument(), schemaVersion: 99 };
    const result = parseEditorDocument(future);

    expect(result).toEqual({
      success: false,
      error: "Document version 99 is newer than this editor supports",
    });
  });
});


import { describe, expect, it } from "vitest";

import { makeDocument } from "../document";
import { parseEditorDocument } from "../schema";
import { applyCommand } from ".";

describe("applyCommand", () => {
  it("inserts a node without mutating the previous document", () => {
    const document = makeDocument();
    const parentId = document.nodes[document.rootId].children[0];
    const before = document.nodes[parentId].children;

    const result = applyCommand(document, {
      type: "insertNode",
      kind: "text",
      parentId,
    });

    expect(document.nodes[parentId].children).toBe(before);
    expect(document.nodes[parentId].children).toHaveLength(4);
    expect(result.document.nodes[parentId].children).toHaveLength(5);
    expect(parseEditorDocument(result.document).success).toBe(true);
  });

  it("refuses to delete the document root", () => {
    const document = makeDocument();
    const result = applyCommand(document, {
      type: "deleteNodes",
      ids: [document.rootId],
    });

    expect(result.document).toBe(document);
  });

  it("refuses to move a node into its own subtree", () => {
    const document = makeDocument();
    const parentId = document.nodes[document.rootId].children[0];
    const childId = document.nodes[parentId].children[0];
    const result = applyCommand(document, {
      type: "moveNodes",
      ids: [parentId],
      parentId: childId,
      index: 0,
    });

    expect(result.document).toBe(document);
  });

  it("writes responsive style overrides independently", () => {
    const document = makeDocument();
    const heroId = document.nodes[document.rootId].children[0];
    const result = applyCommand(document, {
      type: "setStyles",
      ids: [heroId],
      breakpoint: "mobile",
      patch: { gap: 12 },
    });

    expect(result.document.nodes[heroId].styles.mobile?.gap).toBe(12);
    expect(result.document.nodes[heroId].styles.desktop?.gap).toBe(24);
  });
});


import { describe, expect, it } from "vitest";

import { makeDocument } from "../document";
import { emptyHistory, record, redo, undo } from ".";

describe("editor history", () => {
  it("coalesces rapid edits to the same property into one undo step", () => {
    const document = makeDocument();
    const id = document.nodes[document.rootId].children[0];
    const snapshot = { document, selectedIds: [id] };
    const command = {
      type: "setStyles" as const,
      ids: [id],
      breakpoint: "desktop" as const,
      patch: { gap: 12 },
    };

    const first = record(emptyHistory, snapshot, command, 100);
    const second = record(first, snapshot, command, 200);

    expect(second.past).toHaveLength(1);
  });

  it("round-trips snapshots through undo and redo", () => {
    const before = makeDocument();
    const after = { ...before, name: "Renamed", updatedAt: before.updatedAt + 1 };
    const beforeSnapshot = { document: before, selectedIds: [] };
    const afterSnapshot = { document: after, selectedIds: [] };
    const history = record(emptyHistory, beforeSnapshot, {
      type: "renameDocument",
      name: "Renamed",
    });

    const undone = undo(history, afterSnapshot);
    expect(undone?.snapshot.document.name).toBe(before.name);

    const redone = undone && redo(undone.history, undone.snapshot);
    expect(redone?.snapshot.document.name).toBe("Renamed");
  });
});


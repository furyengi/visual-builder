import { describe, expect, it } from "vitest";

import { makeDocument } from "./document";
import { syncDirection } from "./cloud-sync";

describe("cloud project reconciliation", () => {
  it("uploads projects that exist only on the device", () => {
    expect(syncDirection(makeDocument(), undefined)).toBe("upload");
  });

  it("downloads projects that exist only in the cloud", () => {
    expect(syncDirection(undefined, makeDocument())).toBe("download");
  });

  it("keeps the newest valid version", () => {
    const local = makeDocument();
    const cloud = { ...local, updatedAt: local.updatedAt + 1 };

    expect(syncDirection(local, cloud)).toBe("download");
    expect(syncDirection(cloud, local)).toBe("upload");
  });

  it("does nothing when both versions have the same timestamp", () => {
    const document = makeDocument();
    expect(syncDirection(document, structuredClone(document))).toBe("none");
  });
});


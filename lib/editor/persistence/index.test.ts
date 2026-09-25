import { beforeEach, describe, expect, it } from "vitest";

import { makeDocument } from "../document";
import { DOCUMENT_SCHEMA_VERSION } from "../types";
import {
  deleteProject,
  loadDocument,
  loadDocumentWithRecovery,
  migrateLegacyDocument,
  saveDocument,
} from ".";

class MemoryStorage implements Storage {
  private values = new Map<string, string>();

  get length() {
    return this.values.size;
  }

  clear() {
    this.values.clear();
  }

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  key(index: number) {
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

const storage = () => window.localStorage;

beforeEach(() => {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { localStorage: new MemoryStorage() },
  });
});

describe("document persistence", () => {
  it("validates before saving and loads the saved project", () => {
    const document = makeDocument();

    expect(saveDocument(document)).toBe(true);
    expect(loadDocument(document.id)).toEqual(document);
  });

  it("keeps the previous valid snapshot for crash recovery", () => {
    const first = makeDocument();
    expect(saveDocument(first)).toBe(true);

    const second = { ...first, name: "Second draft", updatedAt: first.updatedAt + 1 };
    expect(saveDocument(second)).toBe(true);
    storage().setItem(`formwork:v2:doc:${first.id}`, "{truncated");

    const loaded = loadDocumentWithRecovery(first.id);
    expect(loaded?.source).toBe("recovery");
    expect(loaded?.document.name).toBe(first.name);
  });

  it("does not overwrite storage with an invalid document", () => {
    const document = makeDocument();
    const invalid = structuredClone(document);
    invalid.nodes[invalid.rootId].parentId = "missing";

    expect(saveDocument(invalid)).toBe(false);
    expect(storage().getItem(`formwork:v2:doc:${document.id}`)).toBeNull();
  });

  it("migrates the pre-project legacy draft", () => {
    const document = makeDocument();
    const legacy = structuredClone(document) as Record<string, unknown>;
    delete legacy.schemaVersion;
    storage().setItem("formwork:document:v1", JSON.stringify(legacy));

    const migrated = migrateLegacyDocument();

    expect(migrated?.schemaVersion).toBe(DOCUMENT_SCHEMA_VERSION);
    expect(loadDocument(document.id)).toEqual(migrated);
    expect(storage().getItem("formwork:document:v1")).toBeNull();
  });

  it("deletes both current and recovery snapshots", () => {
    const document = makeDocument();
    saveDocument(document);
    saveDocument({ ...document, name: "Changed", updatedAt: document.updatedAt + 1 });

    deleteProject(document.id);

    expect(storage().getItem(`formwork:v2:doc:${document.id}`)).toBeNull();
    expect(storage().getItem(`formwork:v2:recovery:${document.id}`)).toBeNull();
  });
});


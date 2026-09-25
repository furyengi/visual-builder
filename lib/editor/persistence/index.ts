import type {
  AccessibilityPreferences,
  EditorDocument,
  PanelPreferences,
  ProjectSummary,
} from "../types";
import { DOCUMENT_SCHEMA_VERSION } from "../types";
import { parseEditorDocument } from "../schema";

/**
 * Local persistence.
 *
 * Everything lives in localStorage under a versioned prefix. Reads are
 * defensive by design: a corrupt or half-written entry must degrade to
 * a default rather than taking the editor down, and every entry is
 * namespaced so a schema change can migrate or discard cleanly.
 */

const VERSION = "v2";
const PREFIX = `formwork:${VERSION}`;
const INDEX_KEY = `${PREFIX}:projects`;
const PANEL_KEY = `${PREFIX}:panels`;
const A11Y_KEY = `${PREFIX}:a11y`;
const TOMBSTONES_KEY = `${PREFIX}:deletions`;
const LEGACY_DOCUMENT_KEY = "formwork:document:v1";

const documentKey = (id: string) => `${PREFIX}:doc:${id}`;
const recoveryKey = (id: string) => `${PREFIX}:recovery:${id}`;

const available = () => typeof window !== "undefined" && !!window.localStorage;

function read<T>(key: string, fallback: T): T {
  if (!available()) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    // Private-mode quota errors and malformed JSON both land here.
    return fallback;
  }
}

function readUnknown(key: string): unknown | null {
  return read<unknown | null>(key, null);
}

function write(key: string, value: unknown): boolean {
  if (!available()) return false;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function remove(key: string) {
  if (!available()) return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* nothing useful to do */
  }
}

/* ---------------------------------------------------------------
   Projects
   --------------------------------------------------------------- */

export function listProjects(): ProjectSummary[] {
  const projects = readUnknown(INDEX_KEY);
  if (!Array.isArray(projects)) return [];

  return projects
    .filter((project): project is ProjectSummary => {
      if (!project || typeof project !== "object") return false;
      const value = project as Partial<ProjectSummary>;
      return (
        typeof value.id === "string" &&
        typeof value.name === "string" &&
        typeof value.createdAt === "number" &&
        Number.isFinite(value.createdAt) &&
        typeof value.updatedAt === "number" &&
        Number.isFinite(value.updatedAt) &&
        (value.thumbnail === undefined || typeof value.thumbnail === "string")
      );
    })
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export type LoadedDocument = {
  document: EditorDocument;
  source: "primary" | "recovery";
};

function parseStoredDocument(key: string, expectedId: string): EditorDocument | null {
  const parsed = parseEditorDocument(readUnknown(key));
  if (!parsed.success || parsed.document.id !== expectedId) return null;
  if (parsed.migrated) write(key, parsed.document);
  return parsed.document;
}

/** Loads the current snapshot, falling back to the last known-good one. */
export function loadDocumentWithRecovery(id: string): LoadedDocument | null {
  const primary = parseStoredDocument(documentKey(id), id);
  if (primary) return { document: primary, source: "primary" };

  const recovery = parseStoredDocument(recoveryKey(id), id);
  return recovery ? { document: recovery, source: "recovery" } : null;
}

export function loadDocument(id: string): EditorDocument | null {
  return loadDocumentWithRecovery(id)?.document ?? null;
}

export function hasRecoveryDocument(id: string): boolean {
  return parseStoredDocument(recoveryKey(id), id) !== null;
}

/** Replaces the current snapshot with its last known-good predecessor. */
export function restoreRecoveryDocument(id: string): EditorDocument | null {
  const recovery = parseStoredDocument(recoveryKey(id), id);
  if (!recovery) return null;
  if (!write(documentKey(id), recovery)) return null;
  return recovery;
}

export function saveDocument(
  document: EditorDocument,
  thumbnail?: string,
): boolean {
  const parsed = parseEditorDocument(document);
  if (!parsed.success) return false;

  const next = parsed.document;
  const nextJson = JSON.stringify(next);
  const current = parseEditorDocument(readUnknown(documentKey(next.id)));
  if (
    current.success &&
    current.document.id === next.id &&
    JSON.stringify(current.document) !== nextJson &&
    !write(recoveryKey(next.id), current.document)
  ) {
    // Never overwrite the only valid copy if the safety snapshot fails.
    return false;
  }

  const ok = write(documentKey(next.id), next);
  if (!ok) return false;

  const projects = listProjects();
  const existing = projects.find((project) => project.id === next.id);
  const summary: ProjectSummary = {
    id: next.id,
    name: next.name,
    createdAt: existing?.createdAt ?? next.createdAt,
    updatedAt: next.updatedAt,
    thumbnail: thumbnail ?? existing?.thumbnail,
  };

  const indexed = write(INDEX_KEY, [
    summary,
    ...projects.filter((project) => project.id !== next.id),
  ]);
  if (indexed) clearDeletionTombstone(next.id);
  return indexed;
}

export function deleteProject(id: string) {
  const tombstones = read<Record<string, number>>(TOMBSTONES_KEY, {});
  write(TOMBSTONES_KEY, { ...tombstones, [id]: Date.now() });
  remove(documentKey(id));
  remove(recoveryKey(id));
  write(
    INDEX_KEY,
    read<ProjectSummary[]>(INDEX_KEY, []).filter((project) => project.id !== id),
  );
}

/** Project ids awaiting deletion from the signed-in user's cloud account. */
export function listDeletionTombstones(): string[] {
  const tombstones = readUnknown(TOMBSTONES_KEY);
  if (!tombstones || typeof tombstones !== "object" || Array.isArray(tombstones)) {
    return [];
  }
  return Object.entries(tombstones)
    .filter(([, deletedAt]) => typeof deletedAt === "number" && Number.isFinite(deletedAt))
    .map(([id]) => id);
}

export function clearDeletionTombstone(id: string) {
  const tombstones = read<Record<string, number>>(TOMBSTONES_KEY, {});
  if (!(id in tombstones)) return;
  const next = { ...tombstones };
  delete next[id];
  write(TOMBSTONES_KEY, next);
}

export function renameProject(id: string, name: string) {
  const document = loadDocument(id);
  if (document) saveDocument({ ...document, name, updatedAt: Date.now() });
}

/** Copies a project, including its whole node tree, under a new id. */
export function duplicateProject(id: string): string | null {
  const source = loadDocument(id);
  if (!source) return null;
  const now = Date.now();
  const copy: EditorDocument = {
    ...structuredClone(source),
    id: Math.random().toString(36).slice(2, 10),
    name: `${source.name} copy`,
    createdAt: now,
    updatedAt: now,
  };
  return saveDocument(copy) ? copy.id : null;
}

/**
 * Pulls a document saved by the pre-restructure editor into the project
 * index, so an existing local draft is not silently orphaned.
 */
export function migrateLegacyDocument(): EditorDocument | null {
  if (!available()) return null;
  try {
    const raw = window.localStorage.getItem(LEGACY_DOCUMENT_KEY);
    if (!raw) return null;

    const legacy = JSON.parse(raw) as Partial<EditorDocument>;
    if (!legacy?.nodes || !legacy.rootId) return null;

    const now = Date.now();
    const migrated: EditorDocument = {
      schemaVersion: DOCUMENT_SCHEMA_VERSION,
      id: legacy.id ?? Math.random().toString(36).slice(2, 10),
      name: legacy.name ?? "Recovered site",
      rootId: legacy.rootId,
      nodes: legacy.nodes,
      createdAt: now,
      updatedAt: legacy.updatedAt ?? now,
    };

    const parsed = parseEditorDocument(migrated);
    if (!parsed.success || !saveDocument(parsed.document)) return null;
    window.localStorage.removeItem(LEGACY_DOCUMENT_KEY);
    return parsed.document;
  } catch {
    return null;
  }
}

/* ---------------------------------------------------------------
   Preferences
   --------------------------------------------------------------- */

export const DEFAULT_PANELS: PanelPreferences = {
  leftOpen: true,
  rightOpen: true,
  leftWidth: 264,
  rightWidth: 300,
  leftTab: "components",
  collapsedSections: [],
  showGrid: true,
  showRulers: false,
  showOutlines: false,
};

export const DEFAULT_A11Y: AccessibilityPreferences = {
  appearance: "dark",
  contrast: "system",
  transparency: "system",
  motion: "system",
};

/** Spread over defaults so a preference added later is never missing. */
export function loadPanelPreferences(): PanelPreferences {
  return { ...DEFAULT_PANELS, ...read<Partial<PanelPreferences>>(PANEL_KEY, {}) };
}

export function savePanelPreferences(preferences: PanelPreferences) {
  write(PANEL_KEY, preferences);
}

export function loadAccessibilityPreferences(): AccessibilityPreferences {
  return { ...DEFAULT_A11Y, ...read<Partial<AccessibilityPreferences>>(A11Y_KEY, {}) };
}

export function saveAccessibilityPreferences(preferences: AccessibilityPreferences) {
  write(A11Y_KEY, preferences);
}

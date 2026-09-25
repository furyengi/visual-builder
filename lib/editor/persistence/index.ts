import type {
  AccessibilityPreferences,
  EditorDocument,
  PanelPreferences,
  ProjectSummary,
} from "../types";

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
const LEGACY_DOCUMENT_KEY = "formwork:document:v1";

const documentKey = (id: string) => `${PREFIX}:doc:${id}`;

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
  return read<ProjectSummary[]>(INDEX_KEY, []).sort(
    (a, b) => b.updatedAt - a.updatedAt,
  );
}

export function loadDocument(id: string): EditorDocument | null {
  const document = read<EditorDocument | null>(documentKey(id), null);
  // Guard against a truncated write leaving an object without its tree.
  if (!document?.nodes || !document.rootId || !document.nodes[document.rootId]) {
    return null;
  }
  return document;
}

export function saveDocument(
  document: EditorDocument,
  thumbnail?: string,
): boolean {
  const ok = write(documentKey(document.id), document);
  if (!ok) return false;

  const projects = read<ProjectSummary[]>(INDEX_KEY, []);
  const existing = projects.find((project) => project.id === document.id);
  const summary: ProjectSummary = {
    id: document.id,
    name: document.name,
    createdAt: existing?.createdAt ?? document.createdAt,
    updatedAt: document.updatedAt,
    thumbnail: thumbnail ?? existing?.thumbnail,
  };

  return write(INDEX_KEY, [
    summary,
    ...projects.filter((project) => project.id !== document.id),
  ]);
}

export function deleteProject(id: string) {
  remove(documentKey(id));
  write(
    INDEX_KEY,
    read<ProjectSummary[]>(INDEX_KEY, []).filter((project) => project.id !== id),
  );
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
      id: legacy.id ?? Math.random().toString(36).slice(2, 10),
      name: legacy.name ?? "Recovered site",
      rootId: legacy.rootId,
      nodes: legacy.nodes,
      createdAt: now,
      updatedAt: legacy.updatedAt ?? now,
    };

    saveDocument(migrated);
    window.localStorage.removeItem(LEGACY_DOCUMENT_KEY);
    return migrated;
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

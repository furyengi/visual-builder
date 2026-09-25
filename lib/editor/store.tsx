"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type Dispatch,
  type ReactNode,
} from "react";

import { applyCommand, type Command } from "./commands";
import { saveDocumentForCurrentUser } from "./cloud-sync";
import {
  makeDocument,
  makePlaceholderDocument,
  PLACEHOLDER_DOCUMENT_ID,
} from "./document";
import * as history from "./history";
import * as selection from "./selection";
import {
  DEFAULT_PANELS,
  listProjects,
  loadDocumentWithRecovery,
  loadPanelPreferences,
  migrateLegacyDocument,
  savePanelPreferences,
  saveDocument,
} from "./persistence";
import type {
  Breakpoint,
  DragPayload,
  DropTarget,
  EditorTool,
  EditorDocument,
  HistorySnapshot,
  PanelPreferences,
  SaveStatus,
  ViewportMode,
} from "./types";

export type EditorState = {
  document: EditorDocument;
  selectedIds: string[];
  hoveredId: string | null;
  /** Node currently being text-edited on the canvas. */
  editingId: string | null;

  breakpoint: Breakpoint;
  viewportMode: ViewportMode;
  customWidth: number;

  zoom: number;
  pan: { x: number; y: number };
  preview: boolean;
  focusMode: boolean;
  activeTool: EditorTool;

  panels: PanelPreferences;

  drag: DragPayload | null;
  dropTarget: DropTarget | null;

  history: history.HistoryState;
  saveStatus: SaveStatus;
  saveError: "local" | "cloud" | null;
  savedAt: number | null;
  /** Latest message for the aria-live region. */
  announcement: { message: string; at: number } | null;
};

export type EditorAction =
  | { type: "run"; command: Command }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "breakCoalescing" }
  | { type: "select"; ids: string[] }
  | { type: "selectAdditive"; id: string }
  | { type: "selectRange"; id: string }
  | { type: "selectParent" }
  | { type: "selectChild" }
  | { type: "selectSibling"; direction: 1 | -1 }
  | { type: "hover"; id: string | null }
  | { type: "setEditing"; id: string | null }
  | { type: "setBreakpoint"; breakpoint: Breakpoint }
  | { type: "setCustomWidth"; width: number }
  | { type: "setZoom"; zoom: number; anchor?: { x: number; y: number } }
  | { type: "setPan"; pan: { x: number; y: number } }
  | { type: "togglePreview" }
  | { type: "toggleFocusMode" }
  | { type: "setActiveTool"; tool: EditorTool }
  | { type: "setPanels"; patch: Partial<PanelPreferences> }
  | { type: "setDrag"; payload: DragPayload | null }
  | { type: "setDropTarget"; target: DropTarget | null }
  | { type: "loadDocument"; document: EditorDocument; recovered?: boolean }
  | {
      type: "setSaveStatus";
      status: SaveStatus;
      at?: number;
      error?: "local" | "cloud";
    }
  | { type: "announce"; message: string };

export const ZOOM_MIN = 0.1;
export const ZOOM_MAX = 4;

const snapshotOf = (state: EditorState): HistorySnapshot => ({
  document: state.document,
  selectedIds: state.selectedIds,
});

function initialState(document: EditorDocument): EditorState {
  return {
    document,
    selectedIds: [],
    hoveredId: null,
    editingId: null,
    breakpoint: "desktop",
    viewportMode: "desktop",
    customWidth: 1280,
    zoom: 0.75,
    pan: { x: 0, y: 0 },
    preview: false,
    focusMode: false,
    activeTool: "select",
    panels: DEFAULT_PANELS,
    drag: null,
    dropTarget: null,
    history: history.emptyHistory,
    saveStatus: "idle",
    saveError: null,
    savedAt: null,
    announcement: null,
  };
}

function reducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case "run": {
      const before = snapshotOf(state);
      const result = applyCommand(state.document, action.command);

      // A command that changed nothing must not create an undo step.
      if (result.document === state.document && !result.selection) return state;

      return {
        ...state,
        document: result.document,
        selectedIds: result.selection
          ? selection.normalize(result.document, result.selection)
          : selection.normalize(result.document, state.selectedIds),
        history: history.record(state.history, before, action.command),
        saveStatus: "saving",
        saveError: null,
        announcement: result.announcement
          ? { message: result.announcement, at: Date.now() }
          : state.announcement,
      };
    }

    case "undo": {
      const step = history.undo(state.history, snapshotOf(state));
      if (!step) return state;
      return {
        ...state,
        document: step.snapshot.document,
        selectedIds: selection.normalize(
          step.snapshot.document,
          step.snapshot.selectedIds,
        ),
        history: step.history,
        editingId: null,
        saveStatus: "saving",
        saveError: null,
        announcement: { message: "Undo", at: Date.now() },
      };
    }

    case "redo": {
      const step = history.redo(state.history, snapshotOf(state));
      if (!step) return state;
      return {
        ...state,
        document: step.snapshot.document,
        selectedIds: selection.normalize(
          step.snapshot.document,
          step.snapshot.selectedIds,
        ),
        history: step.history,
        editingId: null,
        saveStatus: "saving",
        saveError: null,
        announcement: { message: "Redo", at: Date.now() },
      };
    }

    case "breakCoalescing":
      return { ...state, history: history.breakCoalescing(state.history) };

    case "select": {
      const ids = selection.normalize(state.document, action.ids);
      if (
        ids.length === state.selectedIds.length &&
        ids.every((id, index) => id === state.selectedIds[index])
      ) {
        return state;
      }
      return { ...state, selectedIds: ids, editingId: null };
    }

    case "selectAdditive":
      return {
        ...state,
        selectedIds: selection.addToSelection(
          state.document,
          state.selectedIds,
          action.id,
        ),
        editingId: null,
      };

    case "selectRange":
      return {
        ...state,
        selectedIds: selection.extendSelection(
          state.document,
          state.selectedIds,
          action.id,
        ),
        editingId: null,
      };

    case "selectParent":
      return {
        ...state,
        selectedIds: selection.selectParent(state.document, state.selectedIds),
        editingId: null,
      };

    case "selectChild":
      return {
        ...state,
        selectedIds: selection.selectFirstChild(state.document, state.selectedIds),
      };

    case "selectSibling":
      return {
        ...state,
        selectedIds: selection.selectSibling(
          state.document,
          state.selectedIds,
          action.direction,
        ),
      };

    case "hover":
      return state.hoveredId === action.id ? state : { ...state, hoveredId: action.id };

    case "setEditing":
      return { ...state, editingId: action.id };

    case "setBreakpoint":
      return {
        ...state,
        breakpoint: action.breakpoint,
        viewportMode: action.breakpoint,
      };

    case "setCustomWidth":
      return {
        ...state,
        viewportMode: "custom",
        customWidth: Math.max(240, Math.min(2560, Math.round(action.width))),
        // A custom width still has to edit *some* breakpoint, so it maps
        // onto whichever named breakpoint contains it.
        breakpoint:
          action.width <= 767 ? "mobile" : action.width <= 1023 ? "tablet" : "desktop",
      };

    case "setZoom": {
      const zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, action.zoom));
      if (zoom === state.zoom) return state;
      if (!action.anchor) return { ...state, zoom };

      // Zoom about a point: the content under the cursor must stay under
      // the cursor, so pan is corrected by the scale delta around it.
      const ratio = zoom / state.zoom;
      return {
        ...state,
        zoom,
        pan: {
          x: action.anchor.x - (action.anchor.x - state.pan.x) * ratio,
          y: action.anchor.y - (action.anchor.y - state.pan.y) * ratio,
        },
      };
    }

    case "setPan":
      return { ...state, pan: action.pan };

    case "togglePreview":
      return {
        ...state,
        preview: !state.preview,
        selectedIds: [],
        hoveredId: null,
        editingId: null,
        announcement: {
          message: state.preview ? "Preview closed" : "Preview opened",
          at: Date.now(),
        },
      };

    case "toggleFocusMode":
      return {
        ...state,
        focusMode: !state.focusMode,
        announcement: {
          message: state.focusMode ? "Focus mode closed" : "Focus mode opened",
          at: Date.now(),
        },
      };

    case "setActiveTool":
      return state.activeTool === action.tool
        ? state
        : {
            ...state,
            activeTool: action.tool,
            announcement: {
              message: `${action.tool === "select" ? "Select" : "Hand"} tool active`,
              at: Date.now(),
            },
          };

    case "setPanels":
      return { ...state, panels: { ...state.panels, ...action.patch } };

    case "setDrag":
      return {
        ...state,
        drag: action.payload,
        dropTarget: action.payload ? state.dropTarget : null,
      };

    case "setDropTarget":
      return { ...state, dropTarget: action.target };

    case "loadDocument":
      return {
        ...state,
        document: action.document,
        selectedIds: [],
        history: history.emptyHistory,
        saveStatus: "saved",
        saveError: null,
        savedAt: Date.now(),
        announcement: action.recovered
          ? { message: "Recovered the last safe version of this project", at: Date.now() }
          : state.announcement,
      };

    case "setSaveStatus":
      return {
        ...state,
        saveStatus: action.status,
        saveError: action.status === "error" ? (action.error ?? "local") : null,
        savedAt: action.at ?? state.savedAt,
      };

    case "announce":
      return { ...state, announcement: { message: action.message, at: Date.now() } };

    default: {
      const exhaustive: never = action;
      void exhaustive;
      return state;
    }
  }
}

type EditorContextValue = {
  state: EditorState;
  dispatch: Dispatch<EditorAction>;
  /** Runs a document command through history. */
  run: (command: Command) => void;
  /** Ends the current coalescing window (drag end, field blur). */
  commit: () => void;
  announce: (message: string) => void;
};

const EditorContext = createContext<EditorContextValue | null>(null);

const AUTOSAVE_DELAY_MS = 600;

export function EditorProvider({
  children,
  blank = false,
  projectId,
}: {
  children: ReactNode;
  blank?: boolean;
  projectId?: string | null;
}) {
  // Seeded with a placeholder whose ids are fixed, so the server and
  // the first client render produce identical markup. The real document
  // arrives in the effect below.
  const [state, dispatch] = useReducer(reducer, undefined, () =>
    initialState(makePlaceholderDocument()),
  );

  const hydrated = useRef(false);
  const latestDocument = useRef(state.document);

  useEffect(() => {
    latestDocument.current = state.document;
  }, [state.document]);

  // --- Load stored project and preferences -------------------------
  useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;

    dispatch({ type: "setPanels", patch: loadPanelPreferences() });

    if (blank) {
      dispatch({ type: "loadDocument", document: makeDocument(true) });
      return;
    }

    // Resolution order: the requested project, then a draft left by the
    // previous editor, then the most recently edited project, and only
    // if there is nothing at all a fresh starter document. Without the
    // third step, opening /editor without a project id would mint a new
    // project on every visit and fill the dashboard with duplicates.
    const requested = projectId ? loadDocumentWithRecovery(projectId) : null;
    const migratedLegacy = requested ? null : migrateLegacyDocument();
    const mostRecent =
      requested || migratedLegacy ? null : (listProjects()[0]?.id ?? null);
    const recent = mostRecent ? loadDocumentWithRecovery(mostRecent) : null;
    const loaded = requested ?? recent;

    dispatch({
      type: "loadDocument",
      document:
        loaded?.document ??
        migratedLegacy ??
        makeDocument(false),
      recovered: loaded?.source === "recovery",
    });
  }, [blank, projectId]);

  // --- Autosave ----------------------------------------------------
  // Debounced so a drag does not write on every frame. The status is
  // driven from the write result rather than assumed, so a full quota
  // surfaces as an error instead of a silent data loss.
  useEffect(() => {
    // The placeholder is never written: it is a render artefact, not a
    // project, and saving it would create a phantom dashboard entry.
    if (state.document.id === PLACEHOLDER_DOCUMENT_ID) return;

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      const localSaved = saveDocument(state.document);
      const cloudSaved = localSaved
        ? await saveDocumentForCurrentUser(state.document)
        : false;
      if (cancelled) return;
      dispatch({
        type: "setSaveStatus",
        status: localSaved && cloudSaved ? "saved" : "error",
        error: !localSaved ? "local" : !cloudSaved ? "cloud" : undefined,
        at: localSaved && cloudSaved ? Date.now() : undefined,
      });
    }, AUTOSAVE_DELAY_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [state.document]);

  // A backgrounded tab can be suspended before the debounce fires.
  // pagehide and visibilitychange are synchronous last-chance flushes.
  useEffect(() => {
    const flushLatest = () => {
      const document = latestDocument.current;
      if (document.id !== PLACEHOLDER_DOCUMENT_ID) saveDocument(document);
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") flushLatest();
    };

    window.addEventListener("pagehide", flushLatest);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("pagehide", flushLatest);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  // --- Persist preferences -----------------------------------------
  useEffect(() => {
    if (!hydrated.current) return;
    savePanelPreferences(state.panels);
  }, [state.panels]);

  // Appearance lives in its own store (see components/appearance.tsx)
  // so the dashboard and the editor share one source of truth.

  const run = useCallback((command: Command) => {
    dispatch({ type: "run", command });
  }, []);

  const commit = useCallback(() => {
    dispatch({ type: "breakCoalescing" });
  }, []);

  const announce = useCallback((message: string) => {
    dispatch({ type: "announce", message });
  }, []);

  const value = useMemo<EditorContextValue>(
    () => ({ state, dispatch, run, commit, announce }),
    [state, run, commit, announce],
  );

  return <EditorContext.Provider value={value}>{children}</EditorContext.Provider>;
}

export function useEditor(): EditorContextValue {
  const context = useContext(EditorContext);
  if (!context) throw new Error("useEditor must be used inside an EditorProvider");
  return context;
}

/** The single selected node, or null when the selection is empty or multiple. */
export function useSelectedNode() {
  const { state } = useEditor();
  return state.selectedIds.length === 1
    ? (state.document.nodes[state.selectedIds[0]] ?? null)
    : null;
}

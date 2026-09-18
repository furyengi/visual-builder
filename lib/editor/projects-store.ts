"use client";

import { useSyncExternalStore } from "react";

import {
  listProjects,
  loadDocument,
  migrateLegacyDocument,
} from "./persistence";
import type { EditorDocument, ProjectSummary } from "./types";

export type ProjectsSnapshot = {
  summaries: ProjectSummary[];
  documents: Record<string, EditorDocument>;
  /** False until the first client-side read completes. */
  loaded: boolean;
};

const EMPTY: ProjectsSnapshot = { summaries: [], documents: {}, loaded: false };

let snapshot: ProjectsSnapshot = EMPTY;
const listeners = new Set<() => void>();

/**
 * The dashboard's view of local storage.
 *
 * Exposed as an external store rather than component state so the
 * server snapshot is well defined (nothing loaded), reads happen once
 * per change instead of once per component, and any mutation —
 * rename, duplicate, delete — refreshes every subscriber.
 */
function read(): ProjectsSnapshot {
  // A draft written by the pre-restructure editor is adopted before
  // listing, so an existing local project is never stranded.
  migrateLegacyDocument();

  const summaries = listProjects();
  const documents: Record<string, EditorDocument> = {};
  for (const summary of summaries) {
    const document = loadDocument(summary.id);
    if (document) documents[summary.id] = document;
  }
  return { summaries, documents, loaded: true };
}

export function refreshProjects() {
  snapshot = read();
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  // The first subscriber triggers the initial read; without this the
  // store would stay empty until something mutated it.
  if (listeners.size === 0 && !snapshot.loaded) {
    // Queued so the read happens after the subscribing render commits.
    queueMicrotask(refreshProjects);
  }
  listeners.add(listener);

  const onStorage = () => refreshProjects();
  window.addEventListener("storage", onStorage);

  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function useProjects(): ProjectsSnapshot {
  return useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => EMPTY,
  );
}

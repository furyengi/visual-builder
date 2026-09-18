import type { HistorySnapshot } from "../types";
import type { Command } from "../commands/types";
import { COALESCING_COMMANDS } from "../commands/types";

/**
 * Snapshot-based undo. The document is a plain immutable tree and
 * commands already return new objects, so storing references is cheaper
 * and far less error-prone than writing an inverse for every command.
 * The cap bounds memory; unbounded histories are the usual cause of
 * editors slowing down over a long session.
 */
export const HISTORY_LIMIT = 100;

/** Rapid repeats of the same command merge for this long. */
const COALESCE_WINDOW_MS = 600;

export type HistoryState = {
  past: HistorySnapshot[];
  future: HistorySnapshot[];
  /** Identifies what produced the newest past entry, for coalescing. */
  lastEntry: { signature: string; at: number } | null;
};

export const emptyHistory: HistoryState = { past: [], future: [], lastEntry: null };

/**
 * Two commands merge only when they are the same kind of edit on the
 * same targets — dragging one slider coalesces, but switching to a
 * different property starts a new undo step.
 */
function signatureOf(command: Command): string | null {
  if (!COALESCING_COMMANDS.has(command.type)) return null;

  switch (command.type) {
    case "setStyles":
      return `setStyles:${command.ids.join(",")}:${command.breakpoint}:${Object.keys(
        command.patch,
      )
        .sort()
        .join(",")}`;
    case "setContent":
      return `setContent:${command.id}`;
    case "renameNode":
      return `renameNode:${command.id}`;
    case "renameDocument":
      return "renameDocument";
    default:
      return null;
  }
}

/**
 * Records the state as it was *before* a command ran. Called with the
 * pre-command snapshot, so an undo restores exactly what the user saw.
 */
export function record(
  history: HistoryState,
  before: HistorySnapshot,
  command: Command,
  now = Date.now(),
): HistoryState {
  const signature = signatureOf(command);
  const merges =
    signature !== null &&
    history.lastEntry?.signature === signature &&
    now - history.lastEntry.at < COALESCE_WINDOW_MS &&
    history.past.length > 0;

  // A merged edit keeps the older snapshot: undo should jump back to
  // before the whole drag, not to an arbitrary frame inside it.
  const past = merges
    ? history.past
    : [...history.past, before].slice(-HISTORY_LIMIT);

  return {
    past,
    // Any new edit invalidates the redo branch.
    future: [],
    lastEntry: signature ? { signature, at: now } : null,
  };
}

export function undo(
  history: HistoryState,
  current: HistorySnapshot,
): { history: HistoryState; snapshot: HistorySnapshot } | null {
  const previous = history.past.at(-1);
  if (!previous) return null;
  return {
    snapshot: previous,
    history: {
      past: history.past.slice(0, -1),
      future: [current, ...history.future].slice(0, HISTORY_LIMIT),
      lastEntry: null,
    },
  };
}

export function redo(
  history: HistoryState,
  current: HistorySnapshot,
): { history: HistoryState; snapshot: HistorySnapshot } | null {
  const next = history.future[0];
  if (!next) return null;
  return {
    snapshot: next,
    history: {
      past: [...history.past, current].slice(-HISTORY_LIMIT),
      future: history.future.slice(1),
      lastEntry: null,
    },
  };
}

export const canUndo = (history: HistoryState) => history.past.length > 0;
export const canRedo = (history: HistoryState) => history.future.length > 0;

/**
 * Ends the current coalescing window. Called when a drag finishes or
 * focus leaves a field, so the next edit always starts a fresh step.
 */
export function breakCoalescing(history: HistoryState): HistoryState {
  return history.lastEntry ? { ...history, lastEntry: null } : history;
}

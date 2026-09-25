"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Check, Cloud } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { useEditor } from "@/lib/editor/store";

const RESOLVE_DELAY_MS = 900;

/**
 * Save state as a single line of text plus a dot.
 *
 * "Saved" is held for a moment before relaxing to a timestamp, so a
 * fast autosave still registers visually instead of flickering — the
 * point is to reassure, and a change too quick to see does not.
 */
export function SaveStatus() {
  const { state } = useEditor();
  const { user } = useAuth();
  const [settledAt, setSettledAt] = useState<number | null>(null);

  useEffect(() => {
    if (state.saveStatus !== "saved") return;
    const timer = window.setTimeout(() => setSettledAt(Date.now()), RESOLVE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [state.saveStatus, state.savedAt]);

  // Derived rather than reset on every status change: the label only
  // relaxes to a timestamp once this particular save has had its moment.
  const settled =
    state.saveStatus === "saved" &&
    settledAt !== null &&
    state.savedAt !== null &&
    settledAt >= state.savedAt;

  const label =
    state.saveStatus === "error"
      ? state.saveError === "cloud"
        ? "Saved locally"
        : "Not saved"
      : state.saveStatus === "saving"
        ? "Saving"
        : settled && state.savedAt
          ? relativeTime(state.savedAt, user ? "Synced" : "Saved")
          : state.savedAt
            ? user
              ? "Synced"
              : "Saved"
            : "Ready";

  const Icon =
    state.saveStatus === "error" ? AlertCircle : state.saveStatus === "saving" ? Cloud : Check;

  return (
    <span className="save-status" data-status={state.saveStatus}>
      {state.saveStatus === "saving" ? (
        <span className="save-status__dot" aria-hidden="true" />
      ) : (
        <Icon size={10} aria-hidden="true" />
      )}
      <span>{label}</span>
      {/* The visible text is abbreviated; this is the full sentence. */}
      <span className="sr-only">
        {state.saveStatus === "error"
          ? state.saveError === "cloud"
            ? "Changes are safe on this device, but cloud sync could not finish."
            : "Changes could not be saved to this device."
          : state.saveStatus === "saving"
            ? "Saving changes."
            : user
              ? "All changes synced to the cloud."
              : "All changes saved on this device."}
      </span>
    </span>
  );
}

function relativeTime(timestamp: number, verb: "Saved" | "Synced"): string {
  const seconds = Math.round((Date.now() - timestamp) / 1000);
  if (seconds < 60) return verb;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${verb} ${minutes}m ago`;
  return `${verb} ${Math.round(minutes / 60)}h ago`;
}

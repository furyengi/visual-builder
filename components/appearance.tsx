"use client";

import { useEffect } from "react";

import { createLocalStore, useLocalStore } from "@/lib/local-store";
import { DEFAULT_A11Y } from "@/lib/editor/persistence";
import type { AccessibilityPreferences } from "@/lib/editor/types";

/**
 * Appearance preferences, shared by the dashboard and the editor.
 *
 * A single module-level store means both surfaces read the same value
 * and a change on one is reflected on the other without prop drilling
 * or a provider.
 */
export const appearanceStore = createLocalStore<AccessibilityPreferences>(
  "formwork:v2:a11y",
  DEFAULT_A11Y,
);

/**
 * Mirrors the preferences onto the document element.
 *
 * The CSS layers key off `data-theme`, `data-contrast`,
 * `data-transparency` and `data-motion`. "system" removes the
 * attribute entirely so the media queries decide, which is why each
 * preference has three states rather than two.
 */
export function useAppearance() {
  const stored = useLocalStore(appearanceStore, DEFAULT_A11Y);
  const preferences = { ...DEFAULT_A11Y, ...stored };

  useEffect(() => {
    const root = document.documentElement;
    const apply = (attribute: string, value: string) => {
      if (value === "system") root.removeAttribute(attribute);
      else root.setAttribute(attribute, value);
    };
    apply("data-theme", preferences.appearance);
    apply("data-contrast", preferences.contrast);
    apply("data-transparency", preferences.transparency);
    apply("data-motion", preferences.motion);
  }, [
    preferences.appearance,
    preferences.contrast,
    preferences.transparency,
    preferences.motion,
  ]);

  const update = (patch: Partial<AccessibilityPreferences>) => {
    appearanceStore.set((current) => ({ ...DEFAULT_A11Y, ...current, ...patch }));
  };

  return { preferences, update };
}

/** Applies appearance preferences without rendering anything. */
export function AppearanceSync() {
  useAppearance();
  return null;
}

"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * A localStorage-backed external store.
 *
 * Browser storage is an external system, so it is read through
 * `useSyncExternalStore` rather than copied into state inside an
 * effect. That gives a correct server snapshot (the fallback, so the
 * prerendered markup is stable), a single subscription per key, and no
 * cascading render on mount.
 *
 * Writes notify every subscriber in this tab, and the `storage` event
 * keeps other tabs in step.
 */
export type LocalStore<T> = {
  get: () => T;
  set: (value: T | ((current: T) => T)) => void;
  subscribe: (listener: () => void) => () => void;
  /** Re-reads from storage, for values other code may have written. */
  refresh: () => void;
};

export function createLocalStore<T>(key: string, fallback: T): LocalStore<T> {
  let cache: T | undefined;
  const listeners = new Set<() => void>();

  const read = (): T => {
    if (typeof window === "undefined") return fallback;
    try {
      const raw = window.localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : fallback;
    } catch {
      return fallback;
    }
  };

  const emit = () => listeners.forEach((listener) => listener());

  const get = () => {
    // The snapshot must be referentially stable between renders or
    // useSyncExternalStore will loop, so it is cached until a write.
    if (cache === undefined) cache = read();
    return cache;
  };

  const set: LocalStore<T>["set"] = (value) => {
    const next =
      typeof value === "function" ? (value as (current: T) => T)(get()) : value;
    cache = next;
    try {
      window.localStorage.setItem(key, JSON.stringify(next));
    } catch {
      // Quota or private-mode failures leave the in-memory value in
      // place: the session keeps working, it just will not persist.
    }
    emit();
  };

  const refresh = () => {
    cache = read();
    emit();
  };

  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    if (listeners.size === 1 && typeof window !== "undefined") {
      window.addEventListener("storage", onStorage);
    }
    return () => {
      listeners.delete(listener);
      if (listeners.size === 0 && typeof window !== "undefined") {
        window.removeEventListener("storage", onStorage);
      }
    };
  };

  function onStorage(event: StorageEvent) {
    if (event.key === key) refresh();
  }

  return { get, set, subscribe, refresh };
}

export function useLocalStore<T>(store: LocalStore<T>, serverValue: T): T {
  return useSyncExternalStore(store.subscribe, store.get, useCallback(() => serverValue, [serverValue]));
}

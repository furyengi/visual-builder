"use client";

import { createContext, useCallback, useContext, useMemo, useRef, type ReactNode } from "react";

/**
 * Maps node ids to their rendered DOM elements.
 *
 * The selection overlay, alignment guides and drop indicators all need
 * real geometry, and they are drawn in a layer *above* the canvas
 * rather than as pseudo-elements on the nodes themselves. That keeps
 * editor chrome from ever altering the user layout — an outline drawn
 * with `border` would shift the very design it is describing.
 */

type Registry = {
  register: (id: string, element: HTMLElement | null) => void;
  get: (id: string) => HTMLElement | null;
  /** Node ids under a point, outermost first. */
  hitTest: (x: number, y: number) => string[];
};

const RegistryContext = createContext<Registry | null>(null);

export function NodeRegistryProvider({ children }: { children: ReactNode }) {
  const elements = useRef(new Map<string, HTMLElement>());

  const register = useCallback((id: string, element: HTMLElement | null) => {
    if (element) elements.current.set(id, element);
    else elements.current.delete(id);
  }, []);

  const get = useCallback((id: string) => elements.current.get(id) ?? null, []);

  const hitTest = useCallback((x: number, y: number) => {
    if (typeof document === "undefined") return [];
    // elementsFromPoint returns topmost first; reversed to give
    // outermost first, which is the order selection drilling expects.
    return document
      .elementsFromPoint(x, y)
      .reverse()
      .map((element) => (element as HTMLElement).dataset?.nodeId)
      .filter((id): id is string => Boolean(id));
  }, []);

  const value = useMemo(() => ({ register, get, hitTest }), [register, get, hitTest]);

  return <RegistryContext.Provider value={value}>{children}</RegistryContext.Provider>;
}

export function useNodeRegistry(): Registry {
  const context = useContext(RegistryContext);
  if (!context) throw new Error("useNodeRegistry must be used inside NodeRegistryProvider");
  return context;
}

export type Rect = { x: number; y: number; width: number; height: number };

/**
 * A node rectangle in unscaled document space.
 *
 * Measurements are taken from the live DOM and divided back out by the
 * zoom factor, so overlay geometry is expressed in the same coordinate
 * system as the document regardless of the current zoom.
 */
export function measureNode(
  element: HTMLElement | null,
  container: HTMLElement | null,
  zoom: number,
): Rect | null {
  if (!element || !container) return null;
  const node = element.getBoundingClientRect();
  const base = container.getBoundingClientRect();
  return {
    x: (node.left - base.left) / zoom,
    y: (node.top - base.top) / zoom,
    width: node.width / zoom,
    height: node.height / zoom,
  };
}

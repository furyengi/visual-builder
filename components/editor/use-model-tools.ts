"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect } from "react";

import { nearestContainer } from "@/lib/editor/document";
import { useEditor } from "@/lib/editor/store";
import type { NodeKind } from "@/lib/editor/types";

const KINDS: NodeKind[] = [
  "section",
  "container",
  "grid",
  "text",
  "heading",
  "button",
  "image",
  "divider",
  "spacer",
];

/**
 * Exposes editor actions to a host that provides `document.modelContext`
 * (the ChatGPT apps runtime). Absent that host the hook does nothing,
 * so it is safe in an ordinary browser.
 */
export function useModelTools() {
  const { state, run } = useEditor();

  useEffect(() => {
    const context = (document as any).modelContext;
    if (!context?.registerTool) return;

    const lifecycle = new AbortController();

    void Promise.resolve(
      context.registerTool(
        {
          name: "add_editor_element",
          title: "Add editor element",
          description:
            "Add a supported element to the selected container in the visual website editor.",
          inputSchema: {
            type: "object",
            properties: { kind: { type: "string", enum: KINDS } },
            required: ["kind"],
            additionalProperties: false,
          },
          annotations: { readOnlyHint: false, untrustedContentHint: false },
          execute(input: any) {
            if (!KINDS.includes(input?.kind)) throw new Error("Unsupported element kind");
            const anchor = state.selectedIds[0] ?? state.document.rootId;
            const parentId = nearestContainer(
              state.document.nodes,
              anchor,
              state.document.rootId,
            );
            run({ type: "insertNode", kind: input.kind, parentId });
            return { added: input.kind };
          },
        },
        { signal: lifecycle.signal },
      ),
    ).catch(() => {
      /* the host may reject registration; the editor works regardless */
    });

    return () => lifecycle.abort();
    // Re-registered when the document identity changes so `execute`
    // never closes over a stale tree.
  }, [run, state.document, state.selectedIds]);
}

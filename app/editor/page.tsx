"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

import { EditorShell } from "@/components/editor/editor-shell";
import { EditorProvider } from "@/lib/editor/store";

function Editor() {
  const params = useSearchParams();
  return (
    <EditorProvider
      blank={params.get("new") === "1"}
      projectId={params.get("project")}
    >
      <EditorShell />
    </EditorProvider>
  );
}

export default function EditorPage() {
  return (
    <Suspense>
      <Editor />
    </Suspense>
  );
}

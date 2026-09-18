"use client";
import{useSearchParams}from"next/navigation";import{Suspense}from"react";import{EditorProvider}from"@/lib/editor/store";import{EditorShell}from"@/components/editor/editor-shell";
function EditorPage(){const p=useSearchParams();return <EditorProvider blank={p.get("new")==="1"}><EditorShell/></EditorProvider>};export default function Page(){return <Suspense><EditorPage/></Suspense>}

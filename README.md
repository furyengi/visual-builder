# Formwork

A browser-based visual website builder built with Next.js, React, and TypeScript. The first milestone provides a working responsive canvas, nested document model, component insertion, inline editing, style inspection, local autosave, undo/redo, keyboard shortcuts, preview mode, zoom, pan, and element resizing.

## Run locally

Requires Node.js 22.13 or newer.

```bash
pnpm install
pnpm dev
```

Open the URL printed by the development server. Use `pnpm build` for a production build.

## Editor shortcuts

- `Ctrl/Cmd + Z`: undo
- `Ctrl/Cmd + Shift + Z` or `Ctrl/Cmd + Y`: redo
- `Ctrl/Cmd + D`: duplicate selected element
- `Ctrl/Cmd + C` and `Ctrl/Cmd + V`: copy and paste selected element
- `Delete` or `Backspace`: delete selected element
- `Alt + drag` or middle-mouse drag: pan the canvas

## Architecture

- `lib/editor/types.ts` defines the document, node, breakpoint, style, and action contracts.
- `lib/editor/store.tsx` owns transactional editor state, history, persistence, and mutations.
- `lib/editor/document.ts` creates documents and component defaults.
- `components/editor/` contains the canvas, component/layers panel, inspector, and workspace shell.

The document graph is UI-independent and uses stable node IDs, nested references, and breakpoint-specific style maps. This keeps future pages, reusable symbols, collaborative operations, code export, templates, and publishing additive rather than requiring an editor rewrite.

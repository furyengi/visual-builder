# Formwork

A browser-based visual website builder built with Next.js, React, and TypeScript.

The interface follows Apple's Liquid Glass principles, with one rule that shapes
everything else: **glass is a control layer above content, never on the content
itself**. Toolbars, panels and popovers are translucent and blurred; the canvas
showing the user's design is plain, opaque and colour-accurate, because tinting
or blurring a design under edit would misrepresent it.

## Run locally

Requires Node.js 22.13 or newer.

```bash
pnpm install
pnpm dev
```

Open the URL printed by the development server. Use `pnpm build` for a
production build, `pnpm lint` for the linter, and `pnpm test` for the editor
core and persistence suite.

## Editor shortcuts

| Action | Shortcut |
| --- | --- |
| Undo / redo | `⌘Z` / `⇧⌘Z` (or `⌘Y`) |
| Copy / cut / paste | `⌘C` / `⌘X` / `⌘V` |
| Duplicate | `⌘D` |
| Delete | `Delete` or `Backspace` |
| Select all top-level elements | `⌘A` |
| Select parent / clear selection | `Escape` |
| Traverse the tree | Arrow keys |
| Nudge a positioned element | Arrow keys (`Shift` for 10px) |
| Edit text | `Enter`, or double-click |
| Zoom in / out / 100% | `⌘+` / `⌘−` / `⌘0` |
| Fit to screen | `⇧1` |
| Pan | Space-drag, `Alt`-drag, or middle-mouse drag |
| Zoom about the pointer | `⌘`/`Ctrl` + scroll, or trackpad pinch |
| Toggle panels | `⌥1` / `⌥2` |
| Select / hand tool | `V` / `H` |
| Focus Mode | `⇧F` |
| Command Center | `⌘K` / `Ctrl+K` |
| Preview | `P` |
| Grid / rulers | `G` / `R` |

## Architecture

### Design system

Styling is a token pipeline, not per-component CSS. Components only ever read
semantic tokens, so the entire look can be retuned from a handful of files.

- `styles/tokens.css` — primitive scales: colour ramps, spacing, radii, type,
  z-layers. No component knows these directly.
- `styles/themes.css` — semantic mappings (`--surface-1`, `--text-primary`,
  `--accent`) for light, dark and high-contrast.
- `styles/glass.css` — the glass recipe: backdrop filter, tint, rim highlight
  and elevation, plus the reduced-transparency and no-`backdrop-filter`
  fallbacks.
- `styles/motion.css` — durations, easings and named presets, with a full
  reduced-motion path.
- `styles/base.css` — element defaults, focus rings, hit targets, scrollbars.
- `styles/components/*.css` — one file per surface.

`components/ui/` holds the primitives every surface composes: `GlassSurface`,
`GlassButton`, `GlassToolbar`, `IconButton`, `SegmentedControl`, `Popover`,
`NumberField` and `ColorField`.

### Editor

- `lib/editor/types.ts` — the document, node, breakpoint and style contracts.
- `lib/editor/commands/` — every mutation as a plain, serialisable command
  applied by a pure function. This is what makes collaboration, server
  persistence and code export additive rather than a rewrite.
- `lib/editor/history/` — snapshot undo/redo, with coalescing so a slider drag
  is one undo step rather than fifty.
- `lib/editor/selection/` — multi-selection, click-to-drill, and tree traversal.
- `lib/editor/breakpoints/` — the widest-first style cascade, and the
  inherited/overridden state the inspector displays.
- `lib/editor/schema.ts` — versioned validation and migrations for saved documents.
- `lib/editor/persistence/` — validated local storage with a last-known-good
  recovery snapshot, plus project and accessibility preferences.
- `lib/editor/clipboard/` — subtree copy and paste.
- `components/editor/` — `chrome/`, `canvas/`, `selection/`, `panels/`,
  `inspector/` and `dnd/`.

The document graph is UI-independent: stable node ids, ordered child
references, and sparse per-breakpoint style maps. Nothing in `lib/editor`
imports React except the store that binds it to the view.

### Selection chrome

Outlines, resize handles, alignment guides and measurements are drawn in an
overlay above the canvas and measured from the live DOM, never applied to the
nodes themselves. An outline drawn with `border` would change the layout of the
design it is describing; measuring the real DOM is also the only way to get
correct geometry for percentage widths, flex growth and intrinsic sizes.

## Accessibility

Light, dark and system themes, plus independent high-contrast,
reduced-transparency and reduced-motion settings that each default to following
the operating system. Every drag interaction has a click or keyboard
equivalent, icon-only controls carry real accessible names, panels are
keyboard-reachable and removed from the tab order when hidden, and changes that
are only visible on the canvas — insertions, deletions, moves, saves — are
announced through a live region.

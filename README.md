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

## Cloud sync

Firebase Authentication and Firestore add optional account-based project sync.
The editor remains local-first: signed-out work stays in the browser, while a
signed-in account reconciles the newest valid copy of each project across
devices. Deletions are recorded locally until they can be confirmed in the
cloud.

Copy `.env.example` to `.env.local` and fill it with the public web-app values
from the Firebase console. The default project is configured in `.firebaserc`.

```bash
pnpm firebase:emulators
pnpm firebase:deploy
```

Firestore rules use an owner-scoped path, validate the complete project schema,
cap serialized document size, preserve immutable creation metadata, and deny
every unspecified operation.

## Cloudflare deployment

The Cloudflare Workers build uses Vinext and the settings in `wrangler.jsonc`.
Authenticate Wrangler once, then build or deploy with:

```bash
pnpm build:cloudflare
pnpm deploy:cloudflare
```

The Firebase `NEXT_PUBLIC_*` values are compiled into the browser bundle; keep
the same `.env.local` available when creating the Cloudflare build. Add the
final Workers hostname to Firebase Authentication's authorized domains before
testing Google sign-in in production.

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

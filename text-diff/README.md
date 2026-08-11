# Text Diff

Paste two versions of prose or code and see exactly what changed. Everything runs
client-side — nothing is uploaded.

## Files

- `index.html` — UI (two input panes, toolbar, diff mount)
- `app.js` — wiring for the [Diffs](https://diffs.com/docs) `FileDiff` renderer

## How it works

`@pierre/diffs` is loaded as an ES module from esm.sh:

```js
import { FileDiff } from 'https://esm.sh/@pierre/diffs@1.3.5';
```

Typing in either pane schedules a debounced (180ms) re-render. `FileDiff` renders
into shadow DOM, so page styles and the diff's own theme stay isolated.

Notes on the library that shaped the implementation:

- `FileDiff` compares by reference, so `render()` gets freshly built file objects.
- Layout options (`diffStyle`, `overflow`, `expandUnchanged`) are applied at
  construction. Changing one calls `cleanUp()` and builds a new instance, which is
  more reliable than `setOptions()` + `rerender()`.
- Syntax highlighting (Shiki) is inferred from the filename. The filename field
  defaults to `snippet.txt`, i.e. plain text; typing `app.ts` or `styles.css`
  switches the grammar.
- Theme follows the shared Atomic Tools toggle via `setThemeType()`, mapping to the
  `pierre-light` / `pierre-dark` themes.

## Controls

- **Split / Unified** — side-by-side or single-column view
- **Wrap lines** — wrap long lines instead of scrolling horizontally
- **Full context** — show every unchanged line; off collapses unchanged regions
  into expandable separators
- **Filename** — sets syntax highlighting
- **Swap** — exchange the two panes
- **Clear** — empty both panes

View, wrap, context, and filename persist in `localStorage` under `text-diff-prefs`.

## Local development

From the repo root:

```bash
python3 -m http.server 8080
```

Then visit http://localhost:8080/text-diff/.

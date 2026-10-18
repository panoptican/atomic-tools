# Text Diff

Paste two versions of prose or code and see exactly what changed. Everything runs
client-side — nothing is uploaded.

## Files

- `index.html` — UI (two input panes, toolbar, diff mount)
- `app.js` — wiring for the [Diffs](https://diffs.com/docs) `FileDiff` renderer

## How it works

`@pierre/diffs` is loaded from esm.sh with a dynamic `import()` at the end of
`app.js`, so the panes, line counts and buttons work before it arrives. If it
can't load, the page says so and asks for a reload instead of sitting on the
empty-state message.

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
- Theme follows the shared Atomic Tools toggle via `setThemeType()`, mapping to
  Shiki's `github-light-high-contrast` / `github-dark-high-contrast`. The
  `pierre-*` themes fell below 4.5:1 on changed lines. In light mode,
  `index.html` darkens the changed-line numbers through the library's
  `--diffs-fg-number-*-override` properties, and `DIFF_CSS` (the `unsafeCSS`
  option) darkens the -/+ counts and the theme's comment gray.
- The library draws collapsed-context expand controls as `<div role="button">`
  with no tabindex or name. `app.js` watches the diff's shadow root and gives each
  one `tabindex="0"`, an `aria-label` ("Show 16 unmodified lines") and
  Enter/Space handling.

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

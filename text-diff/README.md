# Text Diff

Paste two versions of prose or code and see exactly what changed. Everything runs
client-side — nothing is uploaded.

## Files

- `index.html` — UI (two input panes, toolbar, diff mount)
- `app.js` — wiring for the [Diffs](https://diffs.com/docs) `FileDiff` renderer
- `language.js` — the Language menu's list and the auto-detect heuristic

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
- Syntax highlighting (Shiki) is set with the `lang` field on each file. On
  Auto, `detectLanguage()` scores the pasted text against per-language line
  patterns and falls back to plain text when nothing scores at least 2, so prose
  stays unhighlighted. The Auto option shows its current guess
  (`Auto · Python`).
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

- **Split / Unified** — side-by-side or single-column view. Below 720px the diff
  is always unified and this switch is hidden; the saved choice returns on wider
  screens.
- **Wrap lines** — wrap long lines instead of scrolling horizontally
- **Full context** — show every unchanged line; off collapses unchanged regions
  into expandable separators
- **Language** — Auto (detected) or a fixed syntax-highlighting language
- **Swap** — exchange the two panes
- **Clear** — empty both panes

View, wrap, context, and language persist in `localStorage` under `text-diff-prefs`.

## Local development

From the repo root:

```bash
python3 -m http.server 8080
```

Then visit http://localhost:8080/text-diff/.

# Verification

## 2026-05-24: Swiss-system index + tool redesign

- Index lists three tools only: Wordle Checker, Madlib Maker, Clipboard Markdown (`/rich-text-markdown/`).
- House Prep remains at `/house-prep/` but is not linked from the index.
- Removed from repo: `/ai-coding-subscriptions/`, `/ergonomic-set/`.
- Shared shell: `assets/atomic-shell.css`, `assets/atomic-theme.js`.
- Clipboard Markdown logic split: `rich-text-markdown/converter.js`, `rich-text-markdown/app.js`.

## 2026-05-07: Root index polish

- Served the site from the repository root with `python3 -m http.server 8765`.
- Checked `http://127.0.0.1:8765/` in Playwright at 1365x900 and 390x844.
- Confirmed the root index renders 5 tool links with no horizontal overflow at either viewport.
- Confirmed the browser console reported no messages during page load.
- Confirmed local routes return `200`: `/`, `/wordle-checker/`, `/madlib-maker/`, `/rich-text-markdown/`, `/ai-coding-subscriptions/`, and `/ergonomic-set/`.
- Captured temporary screenshots outside the repository at `/private/tmp/atomic-tools-index-desktop.png` and `/private/tmp/atomic-tools-index-mobile.png`.

## 2026-05-07: Experimental tools section

- Served the site from the repository root with `python3 -m http.server 8766` because port 8765 was already in use.
- Checked `http://127.0.0.1:8766/` in Playwright at 1365x900 and 390x844.
- Confirmed the showcase section contains 3 links: `/wordle-checker/`, `/madlib-maker/`, and `/rich-text-markdown/`.
- Confirmed the experimental section contains 2 links: `/ai-coding-subscriptions/` and `/ergonomic-set/`.
- Confirmed the inventory reads `3 Showcase tools` and `2 Experimental`.
- Confirmed there is no horizontal overflow at either viewport and no console messages during page load.
- Captured temporary screenshots outside the repository at `/private/tmp/atomic-tools-index-desktop-experiments.png` and `/private/tmp/atomic-tools-index-mobile-experiments.png`.

## 2026-05-07: Weighted experimental tools

- Served the site from the repository root with `python3 -m http.server 8767`.
- Checked `http://127.0.0.1:8767/` in Playwright at 1365x900 and 390x844.
- Confirmed the experimental cards remain linked to `/ai-coding-subscriptions/` and `/ergonomic-set/`.
- Confirmed there is no horizontal overflow and no console output at either viewport.
- Confirmed the first experimental card is visually shorter than the first showcase card: 182px vs 248px on desktop, 250px vs 318px on mobile.
- Captured temporary screenshots outside the repository at `/private/tmp/atomic-tools-index-desktop-weighted-experiments.png` and `/private/tmp/atomic-tools-index-mobile-weighted-experiments.png`.

## 2026-05-07: Private testing tiles

- Served the site from the repository root with `python3 -m http.server 8768`.
- Checked `http://127.0.0.1:8768/` in Playwright at 1365x900 and 390x844.
- Confirmed private testing tiles link to `/ai-coding-subscriptions/` and `/ergonomic-set/`.
- Confirmed the private tile text contains only the `Testing` status and the tool name.
- Confirmed the private testing section has no icons and no descriptions.
- Confirmed there is no horizontal overflow and no console output at either viewport.
- Captured temporary screenshots outside the repository at `/private/tmp/atomic-tools-index-desktop-private-tiles.png` and `/private/tmp/atomic-tools-index-mobile-private-tiles.png`.

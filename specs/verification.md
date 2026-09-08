# Verification

## 2026-09-07: Selected Easter eggs, 404 hint, and Wordle copy

Implemented the selected proposals #1, #2, #3, #5, #7, and #8.

A later pass reversed the plain-404 decision and added one muted discovery line beneath the “All tools” link. Madlib additions remain unselected. The Wordle change in this pass is a copy fix, not an Easter egg: the two result headlines used em dashes, which was the only place on the bench that broke the period-terminated voice used everywhere else.

- Text Diff: three consecutive swaps of identical text containing at least one non-whitespace character reveal the aside. Editing or clearing resets the count and hides the note. A `sessionStorage` flag limits discovery to once per tab session, including reloads; if storage is unavailable, the flag lasts until reload. Only the flag is stored, never input text.
- Index: source comments contain the CSS confession and the `nothing/` discovery hint. The visible list still contains four tools and requires no JavaScript. Print CSS reveals the printer note.
- Nothing: unlisted `/nothing/`, with a `noindex` hint. “Do it again” shows “Done.” for 1.4 seconds before returning to “It’s working.” Uses the shared shell, system light/dark preference, and no saved state.
- Converter: plain-text or rich-text copies of the visible page heading reveal a separate note. Converted output and clipboard content contain only the conversion. Editing to other content, clearing, or a conversion error hides the note.
- `404.html`: root-relative assets and index link support nested missing URLs on the configured custom-domain root. The `nothing/` hint is plain text rather than a link, matching the index comment, so the page stays a discovery hint instead of navigation.
- Wordle Checker: result headlines read `Yes. Already used.` and `No. Still safe to guess.` Lookup logic and the not-an-answer message are unchanged.

Validation:

- `node --check text-diff/app.js` and `node --check rich-text-markdown/app.js` passed.
- Bundled Chromium browser checks passed with no uncaught page errors. Local files were fulfilled through Playwright request interception, with the existing converter and diff CDN dependencies loaded normally; no preview server was started.
- Verified trigger thresholds, resets, once-per-session behavior across reload, empty-input exclusions, ordinary diff rendering, both converter paste directions, copied text, and ordinary Markdown conversion.
- Verified Nothing with keyboard and pointer, repeated clicks, and its timed reset. Verified the index and nested 404 with JavaScript disabled, including navigation back to the index.
- Inspected desktop and mobile screenshots, including dark mode and an emulated print view. QA script and captures: `/private/tmp/atomic-tools-whimsy-qa/`.
- Re-verified after the 404 hint and Wordle copy change: `node --check` on both scripts, plus rendered checks of `404.html` and the Wordle result states in light and dark.
- Changes are local. Production hosting and its actual 404 fallback have not been verified for this change.

## 2026-05-24: Swiss-system index + tool redesign

- Index lists three tools only: Wordle Checker, Madlib Maker, Markdown ↔ Rich Text (`/rich-text-markdown/`).
- House Prep remains at `/house-prep/` but is not linked from the index.
- Removed from repo: `/ai-coding-subscriptions/`, `/ergonomic-set/`.
- Shared shell: `assets/atomic-shell.css`, `assets/atomic-theme.js`.
- Markdown ↔ Rich Text logic split: `rich-text-markdown/converter.js`, `rich-text-markdown/app.js`.

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

# Verification

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

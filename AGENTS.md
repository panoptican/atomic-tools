# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Project Overview

A collection of single-purpose web tools. Each tool lives in its own directory with related code, tests, and deployment configuration where needed.

## Project Structure

```
/
├── index.html                      # Atomic Tools index (launcher)
├── assets/
│   ├── atomic-shell.css            # Shared top bar + @font-face (fonts hosted off-repo)
│   └── atomic-theme.js             # Shared light/dark theme (tools with toggle)
├── specs/
│   └── BRIEF.md                    # Design contract for the index
├── wordle-checker/                 # Wordle Checker (Cloudflare Worker API)
├── madlib-maker/                   # Madlib creator + player
├── rich-text-markdown/             # Markdown ↔ Rich Text (converter.js + app.js)
├── text-diff/                      # Text Diff (@pierre/diffs via esm.sh)
└── nothing/                        # Unlisted Easter egg (not on index)
```

## Development

Serve locally from repo root:

```bash
python3 -m http.server 8080
```

Then visit:

- http://localhost:8080/ — Atomic Tools index
- http://localhost:8080/wordle-checker/ — Wordle Checker
- http://localhost:8080/madlib-maker/ — Madlib Maker
- http://localhost:8080/rich-text-markdown/ — Markdown ↔ Rich Text
- http://localhost:8080/text-diff/ — Text Diff

## Tool-Specific Commands

### Wordle Checker

```bash
cd wordle-checker

npm install
npm run dev           # Local worker at http://localhost:8787
npm run deploy        # Deploy to Cloudflare

node test-checker.js
node analyze-wordlist.js
node test-today-exclusion.js
```

## Adding New Tools

1. Create a new directory (e.g., `new-tool/`)
2. Add `index.html` with the tool UI
3. Include top bar with back link; reuse `assets/atomic-shell.css` and `assets/atomic-theme.js` when the tool has a theme toggle
4. Add tool-specific README, tests, and deployment config to the directory
5. Update root `index.html` to add a row for the new tool

## Deployment

Cloudflare Pages project **`atomic-tools`**, connected to GitHub
**`panoptican/atomic-tools`**. Cloudflare builds and deploys on push;
production tracks **`main`** and serves `tools.spidleweb.net`. Each tool is a
subpath (e.g. `/wordle-checker/`).

**Pushing to `main` is deploying.** There is no build step — plain HTML, CSS,
and JS are served as-is. Do not run `wrangler pages deploy`; it uploads a
one-off deployment out of band from git and leaves the dashboard's build
history disagreeing with `main`.

The site has no Pages Functions. The one exception was House Prep's state
endpoint, removed in September 2026. The Wordle Checker's API is not part of
this deploy either — it is its own Cloudflare Worker with its own
`wrangler.toml`, shipped from `wordle-checker/` with `npm run deploy`.

Fonts are not in this repo. GT America is licensed and this repo is public, so
both `@font-face` blocks load it from `https://spidleweb.net/fonts/`, which is
a private repo that sends `Access-Control-Allow-Origin: *` on `/fonts/*`. Do
not commit font binaries here.

### GitHub Pages is a leftover, not the deployment

GitHub Pages is still enabled on this repo and still rebuilds on every push,
now publishing to `https://panoptican.github.io/atomic-tools/`. Its custom
domain was removed in September 2026, so it no longer competes for
`tools.spidleweb.net` — but it is still a live, public second copy of the site.

If that copy is unwanted, turn it off in Settings → Pages by setting the source
to None. The root `CNAME` file belongs to it, not to Cloudflare, and can go at
the same time.

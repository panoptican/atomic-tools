# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Project Overview

A collection of single-purpose web tools. Each tool lives in its own directory with related code, tests, and deployment configuration where needed.

## Project Structure

```
/
├── index.html                      # Atomic Tools index (launcher)
├── assets/
│   ├── atomic-shell.css            # Shared top bar + GT America fonts
│   ├── atomic-theme.js             # Shared light/dark theme (tools with toggle)
│   └── fonts/                      # Self-hosted GT America files
├── specs/
│   └── BRIEF.md                    # Design contract for the index
├── wordle-checker/                 # Wordle Checker (Cloudflare Worker API)
├── madlib-maker/                   # Madlib creator + player
├── rich-text-markdown/             # Markdown ↔ Rich Text (converter.js + app.js)
└── house-prep/                     # Private tool (not on index)
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

GitHub Pages serves from the main branch root. Each tool is a subpath (e.g., `/wordle-checker/`).

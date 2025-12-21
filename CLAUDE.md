# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A collection of single-purpose web tools, starting with the Wordle Checker. Each tool lives in its own directory with all related code, tests, and deployment configuration.

## Project Structure

```
/
├── index.html                      # Atomic Tools index - lists all available tools
├── CLAUDE.md                       # This file
├── .gitignore
└── wordle-checker/                 # Wordle Checker tool
    ├── index.html                  # Frontend UI
    ├── README.md                   # Tool documentation
    ├── worker.js                   # Cloudflare Worker backend
    ├── wrangler.toml               # Worker configuration
    ├── package.json                # Dependencies
    ├── CLOUDFLARE_DEPLOYMENT.md    # Deployment guide
    ├── test-checker.js             # Test scripts
    ├── analyze-wordlist.js
    └── test-today-exclusion.js
```

## Development

Serve locally from repo root:
```bash
python3 -m http.server 8080
```

Then visit:
- http://localhost:8080/ - Atomic Tools index
- http://localhost:8080/wordle-checker/ - Wordle Checker

## Tool-Specific Commands

### Wordle Checker

```bash
cd wordle-checker

# Worker development
npm install
npm run dev           # Local worker at http://localhost:8787
npm run deploy        # Deploy to Cloudflare

# Testing
node test-checker.js
node analyze-wordlist.js
node test-today-exclusion.js
```

## Adding New Tools

1. Create a new directory (e.g., `new-tool/`)
2. Add `index.html` with the tool UI
3. Include top bar with back link matching this pattern:
   ```html
   <div class="top-bar">
     <a href="../" class="back-link">< All Tools</a>
     <span class="top-bar-title">Tool Name</span>
   </div>
   ```
4. Add tool-specific README, tests, and deployment config to the directory
5. Update root `index.html` to add a card for the new tool
6. Update category counts in the filter buttons

## Deployment

The repo is designed for GitHub Pages deployment from the main branch root directory. Each tool directory is accessible as a subpath (e.g., `/wordle-checker/`).

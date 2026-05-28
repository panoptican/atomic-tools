# Markdown ↔ Rich Text

A browser-only converter for moving content between rich text editors and Markdown workflows.

## Features

- Paste rich text from tools like Google Docs, Notion, or web pages and get Markdown.
- Type or paste Markdown and get copy-ready rich text.
- Automatically copies converted output to the clipboard.
- Swap direction: click the direction badge to feed output back as input (MD → RT round-trip).
- Visible error state when clipboard copy fails, with tap-to-retry.
- Supports light and dark mode with persisted preference.
- Runs entirely in the browser — no server calls.

## Local Development

Serve the repository root with any static HTTP server:

```bash
python3 -m http.server 8080
```

Then visit http://localhost:8080/rich-text-markdown/

## File Structure

```text
rich-text-markdown/
├── index.html    # Self-contained tool (HTML + CSS + JS)
└── README.md
```

## Dependencies (loaded from CDN)

- [Turndown](https://github.com/mixmark-io/turndown) — HTML to Markdown
- [turndown-plugin-gfm](https://github.com/mixmark-io/turndown-plugin-gfm) — GFM tables, strikethrough, task lists
- [markdown-it](https://github.com/markdown-it/markdown-it) — Markdown to HTML

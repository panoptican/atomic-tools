# Rich Text Markdown

A browser-only converter for moving content between rich text editors and Markdown workflows.

## Features

- Paste rich text from tools like Google Docs, Notion, or web pages and get Markdown.
- Type or paste Markdown and get copy-ready rich text.
- Automatically copies converted output to the clipboard.
- Supports light and dark mode.
- Runs entirely in the browser.

## Local Development

Serve the repository root with any static HTTP server:

```bash
python3 -m http.server 8080
```

Then visit http://localhost:8080/rich-text-markdown/

## File Structure

```text
rich-text-markdown/
├── index.html
├── README.md
└── assets/
    ├── index-CUrMMMOm.js
    └── index-DlXNN6VD.css
```

## Notes

The current checked-in tool is a built static bundle. If the original source project exists, future changes should ideally be made there and rebuilt so the generated assets stay reproducible.

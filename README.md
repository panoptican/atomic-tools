# Atomic Tools

A collection of lightweight web utilities. Each does one thing well.

## Tools

| Tool | Description |
|------|-------------|
| [Wordle Checker](wordle-checker/) | Check if a 5-letter word has been a past Wordle solution |
| [Madlib Maker](madlib-maker/) | Create and share custom madlibs with friends |
| [Markdown ↔ Rich Text](rich-text-markdown/) | Convert between Markdown and pasted rich text |
| [Text Diff](text-diff/) | Compare two blocks of text and see what changed |

## Development

Serve locally from the repo root:

```bash
python3 -m http.server 8080
```

Then visit http://localhost:8080/

## Deployment

Deployed by Cloudflare Pages from the `main` branch — pushing to `main` is
deploying. Live at [tools.spidleweb.net](https://tools.spidleweb.net).

The Wordle Checker's API is a separate Cloudflare Worker; see
[its README](wordle-checker/README.md).

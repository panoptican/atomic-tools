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

Cloudflare Pages project `atomic-tools` deploys from the `main` branch —
pushing to `main` is deploying. Live at [tools.spidleweb.net](https://tools.spidleweb.net).

Like the portfolio site, publication uses an explicit include list:
`node scripts/publish.mjs` copies only public pages and runtime assets into
`dist/`. In Pages → atomic-tools → Settings → Build configuration, use:

- Build command: `node scripts/publish.mjs`
- Build output directory: `dist`
- Root directory: leave empty

The publisher keeps the existing site paths and copies files without modifying
them. Elyx sources, `elyx.json`, design-only assets and licensed fonts,
documentation, tests, scripts, and Worker source/configuration stay out of the
published directory. Add new pages to `FILES` and runtime asset directories to
`FOLDERS` in `scripts/publish.mjs`. Only the listed web asset types are copied
inside those directories. Optional root `_headers` and `_redirects` files are
copied when present.

Build and verify locally:

```bash
node scripts/publish.mjs
python3 -m unittest discover -s tests -p 'test_publish.py' -v
```

The tests exercise the full publishing copy: page routes, local asset and module
references, sitemap coverage, design/backend exclusions, unchanged sources,
stale output cleanup, and preservation of the last build when an input is
missing. The script stages a complete build before replacing `dist/` and rejects
symlink inputs and outputs. `dist/` is generated and ignored.

Changing Pages settings does not republish the current site. The first push
containing this script uses the new build; then verify that `/index.elyx` and
`/elyx.json` return 404 while the tool pages and their assets still load.
Older deployment URLs are separate from the newly published production site.
Do not run `wrangler pages deploy`; keep deployments tied to the repository.

The Wordle Checker's API and Madlib Maker's URL shortener remain separate
Cloudflare Workers; this publisher includes neither Worker's source. See
[Wordle Checker](wordle-checker/README.md) and
[Madlib Maker](madlib-maker/README.md) for their deployment instructions.

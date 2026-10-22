# Madlib Maker

Create, play and share madlibs. `README.md` describes the features, file
layout and how the modules talk to each other; read it first.

## Conventions

- Plain HTML, CSS and vanilla JS: no framework, no build step in this folder.
  `scripts/publish.mjs` at the repo root copies the page, `js/` and `css/` into
  `dist/` for Cloudflare Pages.
- Plain `<script>` files sharing globals, loaded in order by `index.html`.
  Core modules first; each optional feature is one file in `js/` (plus one in
  `css/`), started from the `features` list in `js/main.js`, and the tool must
  keep working if that file is missing.
- No inline scripts: the page has a Content Security Policy. A new outside
  host (script, font, API) must be added to the policy in `index.html`.
- Mobile-friendly and keyboard accessible; light and dark themes use the CSS
  variables at the top of `styles.css`.

## Story format

The story text is the only source of truth for blanks (`MadlibFormat` in
`js/core.js`): `{noun}`, named blanks `{name:hero}` that share one answer, and
questions `{noun|Something squishy?}`. Older `{word01}` placeholder links are
converted on load. `MadlibFormat.COMMON_TYPES` is the shared list of word
types, used by the "Stuck?" dice and by generated madlibs.

## Storage

localStorage only: `madlib-library` (My madlibs), `madlib-stories` (My
stories), `madlib-ai-settings` (AI provider, model and the user's own API key;
sessionStorage instead when "Remember on this device" is off). The key must
never go into library entries, share links, the shortener or logs.

## Generate from a prompt

`js/generate-format.js` (pure: schema, model instructions, turning the answer
into a story, checks) and `js/generate.js` (settings, Claude and OpenAI
requests, dialogs). The browser calls the providers directly with the user's
key. Spec: `spec/generate-from-prompt.md` (local, not in Git). Designs:
`blocks/madlib-generation.elyx` and `controls/madlib-generate.elyx` at the
repo root, linked to code with `meta.code`.

Tests: `node --test madlib-maker/test-generate.js`

## Don'ts

- Don't add server-side code; the URL shortener Worker (`worker.js`) is the
  only backend and deploys separately.
- Don't use jQuery or add a framework.

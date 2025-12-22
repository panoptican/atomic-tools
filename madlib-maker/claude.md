# Madlib Creator

## Project Context

Building a madlib creator/player tool. See `/spec` for:
- `project-plan.md` — build order, key decisions, tech constraints
- `ticket-XX.md` — individual feature specs

## Reference Implementation

`index.html` contains an old hardcoded madlib player. Use it for:
- Visual styling reference (colors, fonts, button treatment)
- Player UX flow (intro → prompts → reveal → copy)

Do NOT extend the existing code — rewrite from scratch.

## Conventions

- Single HTML file with embedded CSS and JS
- Vanilla JS only (no jQuery, no frameworks)
- No build step or external dependencies (except Google Fonts, LZString)
- Mobile-friendly / responsive

## Patterns

- Placeholder IDs: `{word01}`, `{word02}`, etc. (stable, no renumbering on delete)
- URL hash formats: `#play=<data>` (player), `#edit=<data>` (creator)
- Local storage key: `madlib-creator-draft`

## Don'ts

- Don't add server-side components
- Don't use jQuery (the old implementation does, but we're moving away from it)
- Don't renumber placeholder IDs when items are deleted

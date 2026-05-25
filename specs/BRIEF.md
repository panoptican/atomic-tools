# Brief — Atomic Tools index

Extracted from the implementation as it stood on `main` (commit `ffd75d3`) and reconciled with `PRODUCT.md`. This file is the design contract for the root `index.html`. Individual tools have their own briefs.

## Raison d'être

A launcher for one person's bench of small, sharp web utilities. Open the index, find the tool, open it, get on with it. The index is not a product page, not a portfolio, not a hub. It is a door.

## What the index actually does

- Lists tools by name, with a one-line description on hover/focus
- Provides a stable URL for each tool as a subpath
- Survives being bookmarked, opened on a phone, and ignored for six months

That is the whole job.

## Audience

- Primary: Jason, opening this several times a week, usually knowing which tool he wants
- Secondary: anyone he shares a specific tool with — they arrive deep-linked, not at the index
- Almost nobody arrives at the index cold and browses

## Anti-goals (carried from PRODUCT.md, applied to the index specifically)

- No "Local utility bench" eyebrow, no inventory counters, no lede paragraph selling the bench to its only user
- No window-chrome decoration (traffic-light dots, fake terminal frames)
- No grid-paper background, crosshair motifs, or other decorative texture
- No tinted card headers, per-card accent colors used as identity instead of information
- No marketing tropes: hero, social proof, "what's inside," counts
- No competing typefaces fighting for the same role

## Design direction

Swiss-system, applied with discipline:

- One strong typographic system. One display face, one text face at most. Numerals tabular.
- A real grid that the eye can find — wide gutters, generous left rag, content aligned to the same vertical lines from masthead to footer.
- Tools listed as typographic rows or restrained tiles. The name does the work. Category and description are quiet supporting type, not chips.
- No color used decoratively. Color, if any, marks status (private/experimental) or appears as a single restrained accent for interactive affordance. Hover and focus are visible and calm.
- White space is the primary material. Nothing is added that does not earn its weight.
- Mobile: the same hierarchy, restacked. No separate "mobile look."

## Quality bar

- First paint shows the tool list above the fold on a laptop
- Keyboard tab order matches reading order, focus rings always visible
- WCAG AA contrast everywhere
- `prefers-reduced-motion` respected — no entrance animations regardless
- Zero JavaScript required to read or use the index
- Print stylesheet not required, but the page should print legibly by accident

## Out of scope for the index

- Search, filtering, tagging UI (there are three tools)
- An "experimental" or "private" section — if a tool isn't ready for the bench, it doesn't belong on the index
- Login, theming toggle, settings
- Any per-tool preview, screenshot, or live data
- Analytics or telemetry surfaced to the user

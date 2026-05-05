# Ergonomic Set

Interactive ergonomic desk-setup planner for computer workstations.

## Development

Serve from the repository root:

```bash
python3 -m http.server 8080
```

Then visit http://localhost:8080/ergonomic-set/

## Notes

- Static browser tool; no build step, external libraries, CDN scripts, or runtime API calls.
- Calculations use millimeters internally and display imperial or metric units across the full UI.
- Numeric source bands come from public primary OSHA workstation guidance and the HFES 100-2026 public draft.
- Height-derived body measurements and hardware geometry defaults are labeled as heuristics in the measurements table.

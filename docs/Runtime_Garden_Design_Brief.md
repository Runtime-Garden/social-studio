# Runtime Garden Design Brief — repository reconstruction

- **Status:** Reconstruction (2026-10-15).
- **Provenance:** The original *Runtime Garden Design Kit v2* was supplied as an
  external design input. This document reconstructs the binding rules **as
  they exist in this repository** (README, `studio.js` constants,
  `assets/runtime-garden-design-tokens.css`, embedded logo assets) so the
  editor's "Design source" link resolves to an accurate summary. If the
  original kit is restored to the repository, replace this file with it —
  never edit brand tokens to match unrelated third-party designs.

## Design authority

The official Runtime Garden Design Kit v2 is the single design authority for
every generated asset. The palette, logos and typography are intentionally
**immutable** in the editor UI; users edit content and typography scale, not
brand identity.

## Palette (immutable)

| Token | Light | Dark |
|---|---|---|
| Background | `#F6F8F3` | `#0D1713` |
| Surface | `#FFFFFF` | `#15231B` |
| Soft surface | `#EDF2E9` | `#1B2C22` |
| Ink | `#16271E` | `#EDF4ED` |
| Muted ink | `#506459` | `#AFBEB1` |
| Moss accent | `#286A47` | `#8DD5A3` |
| Accent soft | `#DCEDE0` | `#243E2C` |
| Border | `#D8E1D6` | `#304337` |
| Warm accent | `#AD7742` | `#D6AD77` |

## Typography

- Sans: **Inter** (Geist acceptable), system fallback stack.
- Editorial serif: **Newsreader** (Georgia fallback).
- Technical labels: **IBM Plex Mono** (monospace fallback).
- Webfonts are loaded from Google Fonts when available; the editor and the
  standalone artifact must render acceptably with system fallbacks when
  offline. No font files are distributed in this repository.

## Logo

- Only the authentic v2 terminal/leaf SVG marks
  (`assets/runtime-garden-logo-light.svg`, `-dark.svg`, `-white.svg`,
  `runtime-garden-mark.svg`, `-dark.svg`, favicon) may be used.
- For Canvas export, the exact same official SVGs are embedded as data URIs
  in `assets/brand-embedded.js` (`RG_OFFICIAL_LOGOS`).
- Do not redraw, recolor, or substitute the mark; keep clear space.

## Composition system (v2)

- 40 layouts across Editorial / Technical / Social categories.
- 12 connected series packs with shared theme, motif, numbering and narrative
  arc (opener → body → close), every frame individually editable.
- 16 size presets plus custom dimensions (400–4096 × 300–4096 px).
- Editorial direction: *Engineering Journal + Digital Research Lab* — quiet
  whitespace, thin dividers, readable hierarchy, sparse warm accents.

## Content integrity rules (brand-critical)

- No generated metric, benchmark, customer case or release status may be
  presented as real unless verified against a primary source.
- Placeholder/illustrative figures must be replaced before publishing.
- The v2 "preflight" checks are layout hints only — they do **not** validate
  facts; v3 adds evidence-checked drafts before approval.

## Dark/light theming

Both palettes above are first-class; every layout must render correctly in
both (verified by the 40 × 2 real-browser sweep in P0 evidence).

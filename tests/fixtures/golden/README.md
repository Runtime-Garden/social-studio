# Golden-image fixtures

Frozen `.rgstudio.json` inputs for the deterministic visual snapshots in
`tests/browser/golden.spec.ts`. Each fixture is imported through the real
editor (`restoreFrom()`), rendered to `#postCanvas`, and pixel-compared with
the committed baselines in `docs/evidence/golden/<fixture>.<engine>.png`.

| Fixture | What it pins |
|---|---|
| `cover-default` | App boot state (Editorial Cover, light, default branding) |
| `series-system` | Dark series pack: grid pattern, layered layouts, serif/sans mix |
| `layout-stat` | Structured `\|` bullets and large numeric type |
| `layout-comparison` | Two-column `\|` bullet comparison |
| `layout-terminal` | Code/terminal block rendering |
| `layout-image` | Embedded image, `cover` fit, crop position 35 |
| `custom-size` | Custom dimensions 800×1000 |

Provenance: generated once from `NEW_SLIDE()` in the studio-core registry (via
a throwaway VM script); `series-system` is a frozen copy of
`examples/series-system.rgstudio.json`. Slide `uid`s are placeholders — the
v2 importer regenerates them, and uids never affect rendering.

## Regenerating baselines

```sh
npm run update:goldens              # chromium + firefox
npm run update:goldens -- --engine=chromium
npm run test:browser                # must be green immediately after
```

Baselines are engine-specific on purpose (glyph rasterization differs between
browsers). Tolerances and the comparison reader live in
`tests/browser/golden.spec.ts`: chromium noise measures exactly zero across
repeated runs (strict bounds); firefox glyph edges occasionally rasterize in a
second stable AA state (~1,000 px, max delta 68 — loosened bound 96), while a
real one-word content change measures ~1.6% area / delta 224 and is caught.

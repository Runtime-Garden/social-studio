# Changelog

All notable changes to Runtime Garden Social Studio are documented here.
Status vocabulary: **planned / designed / coded / tested / deployed /
live-verified** — nothing is "production-ready" without executed evidence.

## [v3.0.0-dev] — in progress

### P0 — Repository audit and reproducible baseline (2026-10-15)

**Tested (evidence in this repository):**

- Baseline audit: HEAD `d2f202c` on `main` matches the blueprint's observed
  commit; `node --check studio.js` OK; render smoke → `[40, 16, 14336]`;
  series smoke → 12 packs, 0 failures.
- Added TypeScript + Vitest + Playwright toolchain without touching the
  static editor (`package.json`, `tsconfig.json`, `vitest.config.ts`,
  `playwright.config.ts`).
- 19 unit assertions (`tests/unit/project-roundtrip.test.ts`): v1 import,
  v2 example round-trips, clamping, hostile inputs (unknown layout, >100
  slides, oversized/invalid images, string caps, key injection).
- 10 real-browser tests (`tests/browser/*.spec.ts`) on Chromium headless
  shell 156: full 40-layout × light/dark render sweep with pixel hashing;
  live UI interactions; PNG/JSON/ZIP/JPEG/WebP/multi-size-bundle downloads
  validated by file signatures; all 12 series packs applied through the UI
  verified against README frame counts; all 16 size presets rendered at
  exact README dimensions; image upload + crop-position pixel change; v1
  import + localStorage persistence across reload; standalone artifact
  renders with **all network requests aborted**.
- Deliberate mutation check executed: a sabotaged size expectation was
  caught by the formats test (then reverted), proving the suite detects
  dimension regressions.
- Committed screenshots: `docs/evidence/p0/` (served vs standalone default
  render byte-identical).

**Fixed:**

- `tests/series-smoke.cjs` no longer rewrites the 12 tracked example projects
  (was polluting the working tree with fresh random uids every run); it now
  verifies them read-only. Regeneration moved to `npm run refresh:examples`.
- Missing `Runtime_Garden_Social_Studio_v2_Standalone.html`: now generated
  deterministically by `tools/build-standalone.cjs` and committed;
  CI rebuilds and diffs it.
- Missing `docs/` directory (broken links from README and editor):
  `docs/Runtime_Garden_Design_Brief.md`, ADR-001, ADR-002, initial threat
  model, project status added.

**Added:**

- `tools/serve.cjs` (dependency-free static test server).
- `tools/refresh-examples.cjs`, `tools/capture-evidence.cjs`.
- CI workflow `.github/workflows/ci.yml` (smoke, typecheck, unit, browser,
  standalone determinism check).
- `packages/shared` skeleton (version/format contract constants).

**Not done / blocked:**

- CI workflow not yet executed on GitHub (push requires owner approval).
- No online workspace code yet (P2+); Buffer/LLM integrations blocked on
  owner-provided accounts/keys.

### P1 — Shared Studio core (slice 1, commit `a26cef4`)

**Refactored (output-neutral, evidence below):**

- Extracted the pure registry — `FORMATS`, `getFormat`, `SAMPLES`,
  `SERIES_PACKS`, `DEFAULTS`, `SERIES_CONTENT`, `clamp`, `uid`, `NEW_SLIDE` —
  verbatim from `studio.js` into `packages/studio-core/src/registry.ts`.
- Added `npm run build:core` (esbuild, IIFE global `RGStudioCore`) producing
  the committed, deterministic bundle `packages/studio-core/dist/studio-core.js`.
- `studio.js`, `index.html`, `tools/build-standalone.cjs` and the
  smoke/unit/refresh VM loaders now consume the bundle; CI additionally diffs
  it to prove the committed bundle is current.

**Tested (evidence in this repository):**

- Render smoke `[40, 16, 14336]`; series smoke 12 packs, 0 failures.
- 26 unit assertions; 10/10 Playwright browser tests; standalone rebuilt and
  still renders with all network requests blocked.
- P0 evidence screenshots (`docs/evidence/p0/`) byte-identical after rebuild —
  extraction changed no rendered output.

**Still to do (P1):** Canvas `frame` extraction; explicit v1/v2 schema modules
and migrations; golden-image tolerance snapshots; undo/redo, large-text and
custom-dimension browser coverage.

### P1 — Content-brief-to-studio builder (commit `f9b8a07`)

**Added:**

- `packages/studio-core/src/project-builder.ts`,
  `validateContentBrief()` — strict ContentBrief v1 validation with coded
  errors (no silent repair): field limits, required claim evidence,
  http(s)-only URLs, confidence labels `verified`/`uncertain`/`unsupported`.
- `buildStudioProject()` — validated brief → editable v2 `.rgstudio.json`.
  Single card or coordinated series pack (mirrors the editor's
  `applySeriesPack()` styling); only brief-truthful text overlaid; bullets
  copied verbatim from **verified** claims only, onto plain line-list layouts;
  normalized brief embedded for provenance.

**Tested (evidence in this repository):**

- 19 unit tests written test-first (RED watched) + mutation check: sabotaging
  the verified-claims filter failed exactly the bullets test, then reverted.
- 2 VM integration tests: builder output restored through the real
  `restoreFrom()` (single card and pack; whitelist drops the provenance
  envelope from editor state).
- 1 real-browser test: both builder modes imported through the actual file
  input; app state matches the project.
- Full `npm run verify` green: 47 unit assertions, 11/11 Playwright,
  standalone artifact byte-identical.

### P1 — Deterministic golden-image snapshots (commit `8c2d3bd`)

**Added:**

- `tests/browser/golden.spec.ts` + 7 frozen fixtures
  (`tests/fixtures/golden/`) compared against engine-specific baselines in
  `docs/evidence/golden/` (with a sha256 manifest).
- `npm run update:goldens` (`tools/update-goldens.cjs`) regenerates baselines
  for chromium and firefox.
- Readable failure diagnostics: changed-pixel ratio, max/mean channel delta,
  changed-pixel bounding box, live-render attachment; missing baselines fail
  hard (no silent skips).

**Calibrated tolerances (measured, documented in the spec):**

- Chromium: exactly zero noise across repeated runs (≤0.2% area, delta ≤16).
- Firefox: glyph edges occasionally rasterize in a second stable AA state
  (~1,000 px ≈ 0.07%, delta 68; firefox delta bound 96).
- A deliberate one-word title mutation measured 1.6% area / delta 224 and was
  caught on both engines (mutation then reverted).

**Not done / blocked:**

- WebKit cannot start on the reference host (missing system libraries; no
  sudo for `--with-deps`) — documented environment blocker; CI installs
  chromium+firefox with dependencies.

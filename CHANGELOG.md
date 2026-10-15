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

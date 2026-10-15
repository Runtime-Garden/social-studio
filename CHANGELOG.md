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

### P1 — Canvas `frame` renderer extraction (commit `2bcbc2d`)

**Refactored (output-neutral, evidence below):**

- The Design-Kit-v2 palette (`C`), drawing helpers and `frame` moved **verbatim**
  (scripted line surgery) from `studio.js` into
  `packages/studio-core/src/render.ts` (25,996 bytes; `// @ts-nocheck` until
  deliberate typing, same ruling as the registry).
- Renderer is DOM-free via dependency injection: `configureRenderer({getLogo,
  getImage})`; `studio.js` wires the offline adapter (`logoImages`,
  `getCachedImage`).
- `packages/studio-core/src/index.ts` is the single bundle entry
  (re-exports registry + render); `studio.js` reduced 325 → 187 lines.

**Tested (evidence in this repository):**

- 3 contract tests (`render.test.ts`) written test-first (RED watched), pinning
  the dependency-injection contract.
- Full `npm run verify` green: smoke `[40, 16, 14336]`; 50 unit assertions;
  typecheck OK; 25/25 Playwright (18 chromium incl. 7 golden baselines + 7
  firefox golden baselines); standalone rebuilt (150,171 bytes, sha256
  `4d39e81d…`); P0 evidence screenshots byte-identical after rebuild —
  the renderer extraction changed no rendered output.

**Still to do (P1):** explicit schema modules + v1→v2 migration functions;
undo/redo, large-text and custom-dimension browser coverage.

### P1 — Explicit project schema + v1/v2 migrations (commit `765bd83`)

**Added:**

- `packages/studio-core/src/schema.ts` (typed): `PROJECT_FORMAT` /
  `PROJECT_FORMAT_VERSION`, `StudioProjectV2` / `StudioSlideV2`,
  `migrateProjectV1ToV2()` (documents the v1→v2 delta: six v2-only slide
  fields + project `seriesPack`; present values win; input never mutated) and
  `restoreProject()`.
- **Marker hardening (P0 finding F3):** a present-but-foreign `format` marker
  and unsupported `version` values are rejected with specific error messages;
  versionless localStorage autosave payloads remain accepted.
- `studio.js restoreFrom()` delegates to `RGStudioCore.restoreProject`;
  normalization behavior is verbatim (real v1/v2 files import unchanged).
  `project-builder.ts` reuses the schema constants (single source of truth).

**Tested (evidence in this repository):**

- 16 direct schema assertions RED→GREEN + 4 editor-path VM assertions
  RED→GREEN; mutation check (sabotaged `seriesVariant` default) failed exactly
  the two value-asserting tests, then reverted.
- Full `npm run verify` green: smoke `[40, 16, 14336]`; 70 unit assertions;
  typecheck OK; 25/25 Playwright; standalone rebuilt (152,604 bytes, sha256
  `d7501b4d…`).

### P1 — Golden tolerance recalibrated after observed chromium AA state (commit `c073b42`)

- A full-verify run failed chromium `cover-default` once with 289 changed px
  (0.02%, delta 57, sparse headline glyph edges) and passed on an immediate
  identical re-run — a rare chromium second glyph-AA rasterization state, the
  same class already calibrated for firefox (delta 68).
- Chromium `maxChannelDelta` widened 16 → 96 with the observation documented
  in the spec's tolerance policy; the one-word mutation signal (delta 224)
  remains caught. 14/14 goldens green after the change.

### P1 — Remaining offline browser coverage (commit `a214ce6`) — **P1 complete**

**Tested (evidence in this repository):**

- Undo/redo through the real `Ctrl+Z` / `Ctrl+Y` keyboard paths and the
  toolbar buttons, asserting app-state round-trips.
- Maximum-length input (260-char headline + 600-char supporting copy):
  renders with zero page errors, publish preflight flags the over-length
  headline, PNG export stays 1080×1350.
- Custom `1200×630` canvas: style-inspector flow, export verified by IHDR
  chunk parse and filename.
- Mutation check: disabling the undo shortcut, raising the preflight
  threshold and breaking `getFormat('custom')` failed exactly these three
  tests, each at its own assertion; all reverted (bundle byte-identical).

**P1 DoD (blueprint line 796) — MET:** offline v2 feature parity demonstrated
with tests; the shared builder emits importable projects; the offline edition
has zero online dependencies. Full `npm run verify`: smoke `[40, 16, 14336]`,
70 unit assertions, typecheck OK, 28/28 Playwright, standalone sha256
`d7501b4d…` byte-identical.

### P2 — Online app foundation: domain + SQLite storage (commit `776f941`)

**Added:**

- `packages/domain`: content + publication state machines (explicit
  transition tables; `buffer_sent` only via `buffer_scheduled` after remote
  readback), approval proof (canonical JSON → SHA-256, per-channel binding,
  `verifyApproval`), policy schema (blueprint 10.4 defaults with
  `publishing_enabled` / `autonomy_enabled` hard `false`).
- `packages/storage`: `node:sqlite` connection factory (foreign keys ON,
  busy timeout, WAL on file DBs), forward-only transactional migration
  runner, `migrations/0001_init.sql` with the full minimum domain contract
  (24 tables), and repositories: users, sessions (hash-at-rest opaque
  tokens), studio projects (immutable revisions +
  `OptimisticConcurrencyError`), audit events, policy settings.
- **Zero native dependencies** for the storage layer.

**Tested (evidence in this repository):**

- 30 new unit assertions RED→GREEN; combined mutation check failed exactly
  the three aimed tests (sabotaged `submitting -> buffer_sent`, removed
  canonical key sorting, skipped optimistic lock); all reverted.
- Full `npm run verify` green: smoke `[40, 16, 14336]`; **100 unit
  assertions**; typecheck OK; 28/28 Playwright; standalone byte-identical.

### P2 — Authenticated web skeleton (commit `f2acea3`)

**Added:**

- `apps/web`: Express 5 app with a hardened admin bootstrap (empty user
  table without credentials refuses to start), scrypt password hashes,
  session-bound CSRF (`migrations/0002_sessions_csrf.sql`, `x-csrf-token`
  required on mutating routes), login rate limiting (5/15 min sliding
  window), uniform 401s with dummy-hash verification for unknown users,
  `HttpOnly`/`SameSite=Strict` cookies (Secure forced in production),
  `/health/live` + dependency-backed `/health/ready`, uniform
  `{error:{code,message}}` responses, 64 kb body cap, security headers and
  audit events for auth actions.
- `npm run build:web` / `npm run serve:web`; the e2e-bundled dist is
  gitignored and verified by a real-process smoke.

**Tested (evidence in this repository):**

- 22 new assertions RED→GREEN: config boundaries, scrypt hashing,
  sliding-window limiter, and a real-HTTP integration suite (bootstrap,
  login/me/logout lifecycle, CSRF cross-session rejection, rate-limit
  lock/unlock/reset, restart persistence, disabled/expired sessions,
  error hygiene, readiness degradation).
- Combined mutation run (5 sabotages) failed exactly the 9 aimed tests,
  all reverted; live smoke of `apps/web/dist/web.js` as a real process
  (found + fixed an esbuild ESM dynamic-`require` bundle bug).
- Full `npm run verify` green: smoke `[40, 16, 14336]`; **122
  assertions**; typecheck OK; 28/28 Playwright; standalone sha256
  `d7501b4d…` byte-identical.

### P2 — Projects/revisions API and the online studio editor (commit `3f89959`)

**Added:**

- `/api/v1/projects` (session + CSRF): create, list with strict pagination,
  fetch with the current revision, append-only revision saves guarded by
  `expectedRevision` (a stale writer gets 409 `revision_conflict` carrying
  `currentRevision`), full revision history, fetch one historical revision,
  and an `attachment` export download. Project JSON is validated and
  normalized through the shared `restoreProject()` pipeline (v1 imports
  migrate up; unknown layouts rejected with no partial writes) and
  re-stamped with the v2 format markers before storage; the row name is a
  denormalized copy synced on save. Writes append `project.create` /
  `project.revision_saved` audit events.
- Web shell: `/` → `/studio/`; `/login` bounces authenticated visitors;
  `/studio/` is gated server-side and canonicalizes `/studio`. Express 5
  pattern matching makes a naive `/studio` → `/studio/` pair loop (the bare
  pattern also matches the slash form), so one array-pattern handler serves
  both. Static app files plus `/assets` (Design Kit files + the built
  `studio-core.js`); CSP extended with `img-src 'self' data:` for the
  embedded Design Kit logos, scripts/styles stay `'self'`-only.
- Online editor pages (`apps/web/static`, strict CSP: external JS/CSS only,
  no inline styles; v2 design tokens reused): sign-in with uniform failure
  copy, project list, cover-frame editor bound to `[data-key="title"]`,
  explicit revision saves (`Saved revision N` / `Unsaved changes`),
  immutable history with restore-as-new-revision (history is never
  rewritten), `.rgstudio.json` export, two-tab stale-writer conflict banner
  with a reconciling reload action. **No localStorage** — the server owns
  online state; restore = save-as-new-revision.

**Tested (evidence in this repository):**

- 11 new real-HTTP assertions: `tests/integration/web-projects.test.ts`
  (auth/CSRF, v1+v2 import through the shared schema, stale-writer 409 with
  `currentRevision`, immutable history, pagination, export attachment,
  typed 404s) and `tests/integration/web-pages.test.ts` (root redirect,
  gated `/studio/`, login bounce, `/studio` canonicalization that pins the
  Express-5 loop regression, asset content types).
- 3 new storage assertions (list/count helpers, name sync) and 4 real-browser
  journeys (`tests/browser/studio-online.spec.ts`): login page incl. wrong
  credentials, create/edit/save/reload/history/restore with
  `localStorage.length === 0`, export download (version 2), and a two-tab
  conflict with reload reconciliation.
- Mutation checks: combined 8-sabotage run (expectedRevision pass-through,
  dropped canonical `version`, broken name sync, CSRF removal, gate removal,
  canonicalization removal, CSP `img-src` removal, `/assets` unmount) failed
  exactly the 10 aimed tests; a focused browser run (2 sabotages) failed
  exactly the export-version and conflict journeys. All reverted.
- Full `npm run verify` green: smoke `[40, 16, 14336]`; **136 assertions**
  (16 files); typecheck OK; 32/32 Playwright (28 offline + 4 online);
  standalone sha256 `d7501b4d…` byte-identical (offline v2 untouched).

### P2 — Content inbox, approvals, policy gate and ops viewers (commits `fbfcde8`, `7b500bf`, `8fd7962`, `696dc10`, `6794c22`)

**Added:**

- Content repositories (`packages/storage/src/repos/content.ts`): sources,
  source items, story clusters, content items, evidence claims and
  platform variants over the migration-0001 tables, with citation joins
  (`getContentItem` returns sources + claims) and editorial transitions
  validated through the domain state machine (`canTransitionContent`).
- Inbox API (`/api/v1/content/items`): paginated list, single-item fetch
  with citation URLs, guarded transitions with `content.transition` audit
  events (invalid targets are 400 `invalid_content_transition`, no bypass).
- Variant approval flow with snapshot binding: approvals hash the exact
  subject via the domain `approvalHash` (variant revision, channel, text,
  source ids, asset hashes, schedule, policy version); `latest` validity is
  re-derived from live DB state, so editing variant text after approval
  flips the variant to `stale_approval` with an `approval.revoked` audit
  event. Submission stays gated: `POST …/submit` returns 409
  `publishing_disabled` while `publishing_enabled=false` and creates no
  jobs — zero outbound publication.
- Ops API (`/api/v1/ops`): safe-default policy read, type-validated policy
  writes with `policy.updated` audit, idempotent pause (`publishing.paused`
  audit), a resume endpoint that provably refuses (409
  `publishing_disabled_by_default`), newest-first audit viewer and jobs
  viewer with an honest empty state.
- Content UI (`/content/`, gated + canonicalized like `/studio/` with a
  `?next=` return after sign-in): read-only inbox, story view with
  clickable citation links, variant text editor, approve/reject with live
  snapshot state, and the pause control. Strict CSP kept throughout.

**Tested (evidence in this repository):**

- 22 new assertions RED→GREEN (6 storage, 9 content-API incl. variants
  listing, 7 ops) plus a 7-journey Playwright spec
  (`tests/browser/content-approvals.spec.ts`): gating/canonicalization,
  inbox with real citation hrefs, approval with every non-local request
  aborted, edit-after-approval revocation, rejected-reload display,
  approve-binds-visible-text, pause control.
- Mutation checks with clean per-test attribution (all reverted
  byte-identical): transition-guard bypass, pause-enables, submit-gate
  removal, and approve/verify hash-derivation drift each failed exactly
  their aimed tests (one initially-ineffective sabotage was redesigned —
  a uniform hash-scheme change is self-consistent — into a drift sabotage
  that failed exactly the 2 approval-validity tests).
- Full `npm run verify` green: smoke `[40, 16, 14336]`; **158 assertions**
  (19 files); typecheck OK; 39/39 Playwright (32 prior + 7 new);
  standalone sha256 `d7501b4d…` byte-identical (offline v2 untouched).
- Fresh whole-range review (subagent) returned *With fixes*: two approval-
  state display bugs fixed RED→GREEN in commit `cb91c89` (rejected story
  re-rendered as "Approved snapshot" on reload; Approve ignored unsaved
  textarea text) with six minors deferred to the ledger.

### P2 — Calendar, ops viewers UI and Compose dev stack (commits `721774b`, `3618e81`, `f908bb0`, `ae1770d`, `5c68877`) — **P2 complete**

**Added:**

- `packages/storage/src/repos/scheduling.ts`: durable job leases (single
  conditional `UPDATE` — a live lease updates 0 rows), completion states,
  publications with **live approval validity** (`getPublicationStatus`
  re-derives the domain approval subject from current variant state, so an
  edit flips `approvalValid` to false), and scheduled-variant listing.
- `/api/v1/schedule` (session-read-only): calendar entries grouped by UTC
  day with timezone rendering (unknown IANA names fall back to UTC), a
  93-day span cap protecting the event loop, and per-channel publication
  status. No submit path — publication stays gated upstream.
- `/calendar/` UI: month grid of scheduled placeholders, timezone and
  month selectors, per-channel status with `no approval / approval valid /
  stale`, live audit and jobs tables, and the pause control. Strict CSP;
  failed fetches render an error state distinct from empty.
- Local dev stack: multi-stage `Dockerfile` (build stage produces the
  esbuild bundles the entrypoint needs), `.dockerignore`, `compose.yaml`
  (`RG_PORT` mapped to the same container port, named volume for
  `/app/data`), `.env.example` with all `RG_*` variables, and
  `tools/seed-fixtures.cjs` (`npm run seed`) which is **idempotent** by
  construction and seeds a story/variant/project whose approval hash is
  the real canonical hash, so a fresh stack reports a *valid* approval.

**Tested (evidence in this repository):**

- 26 new assertions RED→GREEN (4 scheduling repos, 5 schedule API, 2 seed)
  plus 6 browser journeys: gating/canonicalization, scheduled entry on its
  UTC day, approval→valid→stale across an edit, empty-month state,
  unknown-timezone fallback, audit/jobs tables + pause.
- Fresh whole-range review returned *With fixes*; all Critical/Important
  findings fixed RED→GREEN in `5c68877` (Docker build stage + `.dockerignore`,
  port mapping, calendar range cap, seeded approval hash coherence, fetch
  failure vs. empty, atomic lease, jobs repo dedupe) plus minors
  (query-preserving redirect, current-month default, CSS duplication).
- Mutation checks: 4 sabotage classes each failed exactly their aimed
  tests (guard bypass, pause-inverts, gate removal, validity drift), all
  reverted byte-identical.
- Full `npm run verify` green: smoke `[40, 16, 14336]`; **170 assertions**
  (22 files); typecheck OK; 45/45 Playwright; standalone sha256
  `d7501b4d…` byte-identical.
- **Documented limitation:** the Docker image is verified by construction
  (multi-stage build, non-root user, healthcheck) and by `docker`-free
  checks only — no Docker daemon exists in this environment, so no
  `docker build`/`compose up` has been executed here. A CI `docker build`
  step is required before any deployment claim.

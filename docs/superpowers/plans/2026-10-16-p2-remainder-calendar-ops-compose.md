# P2 Remainder — Calendar, Ops Viewers UI, Compose Dev Stack Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the P2 checklist (lines 805, 807, visible half of 808) so P2 is fully done and everything after is credential-blocked.

**Architecture:** Storage repos stay DB-focused (new `packages/storage/src/repos/scheduling.ts` for jobs + publications reads/lease helpers over migration-0001 tables); one new router `apps/web/src/routes/schedule.ts` (`/api/v1/schedule`: calendar + per-channel status from real DB rows); one new gated page `/calendar/` (calendar grid + ops tables, reuses `studio-online.css` and strict-CSP conventions); dev stack as `Dockerfile` + `compose.yaml` + `.env.example` + `tools/seed-fixtures.cjs` (Node built-in only, seeds a demo story/variant/project through the repo layer).

**Tech Stack:** TypeScript strict, Express 5, `node:sqlite`, Vitest real-HTTP (`port: 0`), Playwright Chromium, Docker/Compose (files only — no daemon run in this environment).

**Spec:** `.opencode/RUNTIME_GARDEN_SOCIAL_STUDIO_V3_OPENCODE_IMPLEMENTATION_BLUEPRINT.md` (P2 lines 798–810, P2 DoD line 810; §9 schema; §11 API; §12 UI)

## Global Constraints

- Buffer's official GraphQL API is the only publishing gateway; no password/browser automation, no direct platform OAuth — this slice performs zero outbound publication; calendar entries are placeholders from real DB state only.
- No production deployment, no real social posts, no pushing to origin, no spending money, no external account changes without explicit owner approval.
- Preserve all v2 offline capabilities (smoke `[40, 16, 14336]`, standalone sha256 `d7501b4d` byte-identical).
- Strict CSP kept (`default-src 'self'` + `img-src 'self' data:`; no inline scripts/styles; external JS/CSS only; no `el.style`).
- All test servers bind `port: 0`; shared helpers in `tests/integration/helpers.ts`.
- Every mutating API route requires session + `x-csrf-token`; every write appends an audit event.
- Commits stay small and logical on branch `v3`; never push without approval.

## Review Focus

- Calendar with zero scheduled rows renders an empty state, not a failed fetch.
- A `tz` query with an unknown IANA name falls back to UTC instead of throwing.
- A publication whose variant was edited after approval surfaces `stale_approval`, not a clean bill.
- The seed script run twice does not duplicate fixtures (idempotent by UNIQUE keys).
- The jobs table on the ops page shows queued/leased states distinctly, never as "published".

---

### Task 1: Jobs + publications repositories

**Files:**
- Create: `packages/storage/src/repos/scheduling.ts`
- Test: `tests/unit/scheduling-repos.test.ts` (append approval-adjacent coverage into `content-repos.test.ts` only if signatures overlap — they do not; keep separate)

**Interfaces:**
- Consumes: `StudioDatabase` from `packages/storage/src/db.js`; `newId` from `packages/storage/src/ids.js`
- Produces (exact signatures later tasks use):
  - `createJob(db, {kind, correlationId, runAt, payloadJson?, idempotencyKey}) -> {id, state:'queued'}`
  - `leaseJob(db, id, {owner, leaseMs}) -> {id, state:'leased'} | null` (only from `queued`, or expired lease)
  - `completeJob(db, id, {state:'succeeded'|'failed'|'cancelled', error?}) -> void`
  - `listJobs(db, {limit, offset, state?}) -> {jobs, total}`
  - `createPublication(db, {variantId, variantRevision, channelId, localKey}) -> {id, submissionState:'not_submitted'}`
  - `getPublicationStatus(db, variantId) -> Array<{channelId, submissionState, bufferState, variantStatus, approvalValid}>` (joins variant row; `approvalValid` via `verifyVariantApproval` from `repos/content.js` against the live-derived subject — caller supplies a `subjectFor`-equivalent; simplest: reuse a new exported helper `currentVariantSubject(db, variantId, channelId)` from `repos/content.js`)
  - `listScheduled(db, {from, to}) -> Array<{variantId, channelId, scheduledAt, status}>` (variants with non-null `scheduled_at` in range; needs `setVariantSchedule(db, id, iso|null)` helper — add here or content.ts; decide: content.ts owns variant writes, so add `setVariantSchedule` there)

- [ ] **Step 1: Write the failing tests** in `tests/unit/scheduling-repos.test.ts`: `creates + leases + completes a job (double-lease returns null)`; `expired lease can be re-leased`; `publication status reflects variant edit → approvalValid false`; `listScheduled returns rows in range, excludes nulls`. Use `:memory:` DB + `applyMigrations`.
- [ ] **Step 2: Run to verify they fail.** Run: `npx vitest run tests/unit/scheduling-repos.test.ts` Expected: FAIL with "Cannot find module …/repos/scheduling.js".
- [ ] **Step 3: Implement `packages/storage/src/repos/scheduling.ts`** (+ `setVariantSchedule` + `currentVariantSubject` in `repos/content.ts`). ISO-8601 UTC; ids via `newId()`.
- [ ] **Step 4: Run to verify green.** Run: `npx vitest run tests/unit/scheduling-repos.test.ts tests/unit/content-repos.test.ts` Expected: PASS.
- [ ] **Step 5: Commit.** Run: `git add packages/storage/src/repos/scheduling.ts packages/storage/src/repos/content.ts tests/unit/scheduling-repos.test.ts && git commit -m "feat(p2): jobs and publications repositories with live approval validity"` Expected: commit created.

### Task 2: Schedule/calendar API

**Files:**
- Create: `apps/web/src/routes/schedule.ts`
- Modify: `apps/web/src/createApp.ts` (mount `/api/v1/schedule`)
- Test: `tests/integration/web-schedule.test.ts` (new; reuse helpers)

**Interfaces:**
- Consumes: Task 1 repo functions; `requireAuth` from session middleware (reads only — no CSRF needed; no mutations in this router)
- Produces: `GET /api/v1/schedule/calendar?from&to&tz` → `{days:[{date, entries:[{variantId, channelId, scheduledAtUtc, scheduledAtLocal, status}]}], tz}` (unknown `tz` → UTC fallback; `from`/`to` must be `YYYY-MM-DD`, else 400 `invalid_request`); `GET /api/v1/schedule/publications?variantId` → `{channels:[{channelId, submissionState, bufferState, variantStatus, approvalValid}]}`; `GET /api/v1/schedule/jobs?state` → `{jobs, total}` (read-only mirror for the calendar page; the ops viewer stays canonical)

- [ ] **Step 1: Write the failing tests** in `tests/integration/web-schedule.test.ts`: `calendar returns entries grouped by UTC day with local rendering for tz=America/New_York`; `unknown tz falls back to UTC`; `bad from= → 400 invalid_request`; `publications reflect stale_approval after edit`; `anonymous → 401`.
- [ ] **Step 2: Run to verify they fail.** Run: `npx vitest run tests/integration/web-schedule.test.ts` Expected: FAIL (404 `not_found` — router unmounted).
- [ ] **Step 3: Implement `createScheduleRouter({db})`** per contract; timezone via `Intl.DateTimeFormat` with try/catch fallback to UTC; mount in `createApp.ts`.
- [ ] **Step 4: Run to verify green.** Run: `npx vitest run tests/integration/web-schedule.test.ts` Expected: PASS (5/5).
- [ ] **Step 5: Commit.** Run: `git add apps/web/src/routes/schedule.ts apps/web/src/createApp.ts tests/integration/web-schedule.test.ts && git commit -m "feat(p2): schedule and publication-status read API"` Expected: commit created.

### Task 3: Calendar + ops viewers UI page

**Files:**
- Modify: `apps/web/src/routes/pages.ts` (add `/calendar/` gate + canonicalization, mirroring `/content/`)
- Create: `apps/web/static/calendar.html`, `apps/web/static/calendar.js`
- Modify: `apps/web/static/studio-online.css` (calendar grid + tables only, v2 tokens)
- Test: `tests/browser/calendar-ops.spec.ts` (new); extend `tests/integration/web-pages.test.ts` (gate + canonicalization)

**Interfaces:**
- Consumes: Task 2 APIs + `/api/v1/ops/audit`, `/ops/jobs`, `/ops/policy`, `/ops/pause`
- Produces (DOM contract): `#dayGrid .day` (one per day in range, each with `data-date`); `#tzSelect` (changes re-render with local times); `#channelStatus li` (per-channel `submissionState` + `approvalValid`); `#auditTable tr`, `#jobsTable tr` (real rows; empty → `#jobsEmpty` visible); `#pauseBtn` → `#opsState` text `Publishing paused`

- [ ] **Step 1: Write the failing browser spec** `tests/browser/calendar-ops.spec.ts`: seeds via repos (variant with `scheduled_at`, publication row, job row), then `gates + canonicalizes`; `shows scheduled entry on its UTC day with local time`; `unknown tz falls back without error`; `channel status shows stale after edit`; `audit/jobs tables render real rows + pause works`. Plus web-pages assertions for `/calendar` → `/calendar/` + unauth bounce. Run: `npx playwright test tests/browser/calendar-ops.spec.ts --timeout=45000` Expected: FAIL (pages absent).
- [ ] **Step 2: Implement pages route + static files** per DOM contract; strict CSP; v2 tokens only.
- [ ] **Step 3: Run to verify green.** Run: `npx playwright test tests/browser/calendar-ops.spec.ts --timeout=45000` Expected: PASS. Then `npx tsc --noEmit` Expected: exit 0.
- [ ] **Step 4: Mutation check** (combined, then revert byte-identical): sabotage tz-fallback (throw on unknown), publication-validity derivation (always true), pause wiring (button unbound). Run: `npx vitest run tests/integration/web-schedule.test.ts tests/integration/web-ops.test.ts` + browser spec Expected: each fails exactly its aimed tests.
- [ ] **Step 5: Commit.** Run: `git add` the pages/static/test files + `git commit -m "feat(p2): calendar and ops viewers UI"` Expected: commit created.

### Task 4: Compose dev stack, seeds, docs

**Files:**
- Create: `Dockerfile`, `compose.yaml`, `.env.example`, `tools/seed-fixtures.cjs`
- Modify: `package.json` (`seed`, `serve:web` already exists; add `stack:up` docs only — no script that needs a daemon in tests)
- Test: `tests/integration/web-seeds.test.ts` (new: runs the seed against a temp DB file, boots server on it, asserts seeded story + variant + project visible via API; seed twice → no duplicates)

**Interfaces:**
- Consumes: repo functions via a Node script using `node:sqlite` directly (CJS, no build step — mirroring `tools/*.cjs`); `RG_DB_PATH`, `RG_ADMIN_USERNAME`, `RG_ADMIN_PASSWORD` env
- Produces: `node tools/seed-fixtures.cjs [dbPath]` → seeds one demo source/story/variant (scheduled), one project, idempotent; `compose.yaml` builds `Dockerfile`, mounts `./data`, exposes `${RG_PORT:-8787}`, `env_file: .env`; `.env.example` documents all `RG_*` vars with safe defaults and no secrets

- [ ] **Step 1: Write the failing test** in `tests/integration/web-seeds.test.ts`: `seed creates visible inbox/project entries; second run changes nothing`. Run: `npx vitest run tests/integration/web-seeds.test.ts` Expected: FAIL (script missing).
- [ ] **Step 2: Implement `tools/seed-fixtures.cjs`** (idempotent via UNIQUE keys + `ON CONFLICT DO NOTHING`-style guards) + Docker/Compose/env files.
- [ ] **Step 3: Run to verify green.** Run: `npx vitest run tests/integration/web-seeds.test.ts` Expected: PASS. Then `docker compose config` only if a daemon exists — otherwise validate YAML by parse (node) and record as untested-in-this-env.
- [ ] **Step 4: Full verify + docs commit.** Run: `npm run verify` Expected: exit 0. Then commit code + `CHANGELOG.md` + `docs/project-status.md` (P2 complete) + close the SDD ledger. Expected: clean tree on `v3`.

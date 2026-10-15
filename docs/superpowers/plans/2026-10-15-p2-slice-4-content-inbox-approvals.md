# P2 Slice 4 — Content Inbox, Approvals, Policy Gate, Ops Viewers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement blueprint P2 lines 804, 806, 808 (read-only Content Inbox + approval page with source citations; explicit `publishing_enabled=false` / `autonomy_enabled=false` defaults enforced in backend; audit + job viewers + emergency pause) so the P2 DoD approval clause is met with mock-tested code and zero outbound publication.

**Architecture:** Storage repos stay DB-focused (new `packages/storage/src/repos/content.ts` for sources/clusters/items/evidence/variants/approvals; reuse existing `audit.ts`, `policy.ts`); new Express routers `apps/web/src/routes/content.ts` (inbox + transitions + variant approval) and `apps/web/src/routes/ops.ts` (policy get/set, audit list, jobs list, pause/resume) mounted under `/api/v1`; one new gated page `/content/` reusing slice-3 static tokens and strict-CSP conventions; approval binding reuses `packages/domain/src/approval.ts` (`approvalHash`/`verifyApproval`) verbatim.

**Tech Stack:** TypeScript strict, Express 5, `node:sqlite` via `packages/storage`, Vitest real-HTTP integration (ephemeral `port: 0`), Playwright Chromium journeys.

**Spec:** `.opencode/RUNTIME_GARDEN_SOCIAL_STUDIO_V3_OPENCODE_IMPLEMENTATION_BLUEPRINT.md` (P2 checklist lines 798–810, P2 DoD line 810; domain contracts sections 9–10; API table §11; UI §12)

## Global Constraints

- Buffer's official GraphQL API is the only publishing gateway; no password/browser automation, no direct platform OAuth — slice 4 performs zero outbound publication.
- No production deployment, no real social posts, no pushing to origin, no spending money, no external account changes without explicit owner approval.
- Preserve all v2 offline capabilities (smoke `[40, 16, 14336]`, standalone sha256 `d7501b4d` byte-identical).
- Strict CSP kept (`default-src 'self'` + `img-src 'self' data:`; no inline scripts/styles; external JS/CSS only; no `el.style`).
- All test servers bind `port: 0`; shared helpers in `tests/integration/helpers.ts`.
- Every mutating API route requires session + `x-csrf-token`; every write appends an audit event.
- Commits stay small and logical on branch `v3`; never push without approval.

## Review Focus

- Inbox item with zero evidence claims renders "no verified sources" instead of an empty citation block.
- Approval submitted for a variant whose text was edited after snapshot resolves to `stale_approval`, not silent success.
- `POST /api/v1/content/variants/:id/submit` with `publishing_enabled=false` refuses with `publishing_disabled`, never queues a job.
- Pause control with `publishing_enabled` already false is idempotent and still appends an audit event.
- Jobs viewer with zero rows renders an empty state, not a failed fetch.

---

### Task 1: Content read repositories

**Files:**
- Create: `packages/storage/src/repos/content.ts`
- Test: `tests/unit/content-repos.test.ts`

**Interfaces:**
- Consumes: `StudioDatabase` from `packages/storage/src/db.js`; `newId` from `packages/storage/src/ids.js`
- Produces (exact signatures later tasks use):
  - `createSource(db, {type:'manual', url, label}) -> {id, type, url, label}`
  - `createSourceItem(db, {sourceId, guid, canonicalUrl, title, summary}) -> {id, ...}`
  - `createCluster(db, {title}) -> {id, title, editorialState:'new'}`
  - `linkItemToCluster(db, clusterId, itemId, decision) -> void`
  - `createContentItem(db, {kind:'manual', title, clusterId?, sourceItemId?}) -> {id, title, editorialState:'discovered'}`
  - `addEvidenceClaim(db, {contentItemId?, clusterId?, claimText, evidenceUrl, verdict}) -> {id, ...}`
  - `listContentItems(db, {limit, offset, state?}) -> {items, total}`
  - `getContentItem(db, id) -> {item, sources: Array<{title, canonicalUrl}>, claims: Array<{claimText, evidenceUrl, verdict}>} | null`
  - `transitionContentItem(db, id, to, {actor}) -> {id, editorialState}` (validates via `canTransitionContent` from `packages/domain/src/lifecycle.js`; throws `Error('invalid_content_transition')` otherwise)
  - `createVariant(db, {contentItemId, platform:'linkedin', text}) -> {id, revision:1, status:'draft'}`
  - `getVariant(db, id) -> {id, contentItemId, platform, revision, text, status} | null`
  - `updateVariantText(db, id, text) -> {id, revision, status}` (revision+1, status reset to `'draft'`; the API text-edit layer upgrades this to `stale_approval` when a currently-valid approval existed — see Task 3)

- [ ] **Step 1: Write the failing tests** in `tests/unit/content-repos.test.ts`: `creates source → item → cluster → content item with discovered state`; `getContentItem returns sources + claims with citation URLs`; `transition discovered→researched succeeds, discovered→approved throws invalid_content_transition`; `updateVariantText bumps revision and resets status to draft`. Use `:memory:` DB + `applyMigrations`.
- [ ] **Step 2: Run to verify they fail.** Run: `npx vitest run tests/unit/content-repos.test.ts` Expected: FAIL with "Cannot find module …/repos/content.js".
- [ ] **Step 3: Implement `packages/storage/src/repos/content.ts`** with the exact signatures above. Timestamps ISO-8601 UTC; ids via `newId()`.
- [ ] **Step 4: Run to verify green.** Run: `npx vitest run tests/unit/content-repos.test.ts` Expected: PASS (4/4).
- [ ] **Step 5: Commit.** Run: `git add packages/storage/src/repos/content.ts tests/unit/content-repos.test.ts && git commit -m "feat(p2): content read repositories with citation joins and guarded transitions"` Expected: commit created.

### Task 2: Inbox + content-transition API

**Files:**
- Create: `apps/web/src/routes/content.ts`
- Modify: `apps/web/src/createApp.ts` (mount `/api/v1/content`)
- Test: `tests/integration/web-content.test.ts` (new; reuse `tests/integration/helpers.ts`)

**Interfaces:**
- Consumes: Task 1 repo functions; `requireAuth`/`requireCsrf`/`getAuth` from `../middleware/session.js`; `appendAuditEvent` from storage audit repo
- Produces: `GET /api/v1/content/items?limit&offset&state` → `{items:[{id,title,kind,editorialState,updatedAt}], total, limit, offset}`; `GET /api/v1/content/items/:id` → `{item, sources, claims}`; `POST /api/v1/content/items/:id/transition {to}` → `{item}` + audit `content.transition`; invalid `to` → 400 `invalid_content_transition`; unknown id → 404 `content_not_found`

- [ ] **Step 1: Write the failing tests** in `tests/integration/web-content.test.ts`: `lists seeded inbox items with pagination + total`; `gets one item with sources[] carrying canonicalUrl and claims[] carrying evidenceUrl+verdict`; `anonymous list → 401 unauthorized`; `transition researched→verified → 200 + audit content.transition`; `transition discovered→approved → 400 invalid_content_transition`; `transition without CSRF → 403 csrf_invalid`. Seed via Task-1 repo functions against the test server's `db`.
- [ ] **Step 2: Run to verify they fail.** Run: `npx vitest run tests/integration/web-content.test.ts` Expected: FAIL (404 `not_found` on `/api/v1/content/items` — route unmounted).
- [ ] **Step 3: Implement `createContentRouter({db})`** with the exact contract above; strict pagination (integers, limit 1..100) mirroring `routes/projects.ts`; mount in `createApp.ts` after the projects router.
- [ ] **Step 4: Run to verify green.** Run: `npx vitest run tests/integration/web-content.test.ts tests/integration/web-projects.test.ts` Expected: PASS, no regressions.
- [ ] **Step 5: Commit.** Run: `git add apps/web/src/routes/content.ts apps/web/src/createApp.ts tests/integration/web-content.test.ts && git commit -m "feat(p2): content inbox and transition API"` Expected: commit created.

### Task 3: Variant approval flow with snapshot binding

**Files:**
- Modify: `packages/storage/src/repos/content.ts` (approval writes + verify helper)
- Modify: `apps/web/src/routes/content.ts` (approval endpoints)
- Test: `tests/unit/content-repos.test.ts` (append) + `tests/integration/web-content.test.ts` (append)

**Interfaces:**
- Consumes: `approvalHash`/`verifyApproval` from `packages/domain/src/approval.js`; `getPolicy` from storage policy repo
- Produces (storage): `saveApproval(db, {variantId, variantRevision, channelId, approvalHash, approverUserId, decision}) -> row`; `latestApprovalForVariant(db, variantId) -> row | null`; `verifyVariantApproval(db, variantId, subject) -> boolean`
- Produces (API): `POST /api/v1/content/variants/:id/text {text}` → `updateVariantText` + audit `variant.edited`; when the variant held a currently-valid approval, status is set to `stale_approval` and audit `approval.revoked` (edit-after-approval revokes); `POST /api/v1/content/variants/:id/approvals {decision:'approved'|'rejected'|'returned', channelId, text, sourceIds, orderedAssetHashes, targetPublishAtUtc, formatMetadata, policyVersion}` → computes `approvalHash`, stores, sets variant `approved_snapshot` (approved) else leaves `draft`, audit `variant.approved|rejected|returned`; `GET .../approvals/latest` → `{approval, valid}` where `valid = verifyApproval(storedHash, currentSubject)`; `POST .../submit` → 409 `publishing_disabled` while `publishing_enabled=false` (never creates a job)

- [ ] **Step 1: Write the failing unit tests** (append): `saveApproval then verifyVariantApproval true on identical subject`; `edited text → verify false`. Run: `npx vitest run tests/unit/content-repos.test.ts` Expected: FAIL (functions missing).
- [ ] **Step 2: Implement storage approval functions** with exact signatures above. Run unit file. Expected: PASS.
- [ ] **Step 3: Write the failing API tests** (append to `web-content.test.ts`): `approve fixture variant → 201 + latest valid:true`; `edit text via updateVariantText path (new endpoint POST /variants/:id/text) → latest valid:false + status stale_approval`; `submit while publishing_enabled=false → 409 publishing_disabled + zero jobs rows`; `reject → decision stored, audit variant.rejected`.
- [ ] **Step 4: Implement approval + text-edit + submit-gate endpoints** per contract. Run: `npx vitest run tests/integration/web-content.test.ts` Expected: PASS.
- [ ] **Step 5: Commit.** Run: `git add packages/storage/src/repos/content.ts apps/web/src/routes/content.ts tests/unit/content-repos.test.ts tests/integration/web-content.test.ts && git commit -m "feat(p2): variant approval with snapshot binding and publishing gate"` Expected: commit created.

### Task 4: Policy, audit viewer, jobs viewer, pause controls

**Files:**
- Create: `apps/web/src/routes/ops.ts`
- Modify: `apps/web/src/createApp.ts` (mount `/api/v1/ops`)
- Test: `tests/integration/web-ops.test.ts` (new)

**Interfaces:**
- Consumes: `getPolicy`/`setPolicyValue` (storage policy repo), `listAuditEvents` (audit repo), direct `jobs` table reads
- Produces: `GET /api/v1/ops/policy` → `{policy}` (defaults `publishing_enabled:false`, `autonomy_enabled:false` when unset); `POST /api/v1/ops/policy {key, value}` (CSRF) → type-validated set + audit `policy.updated`, unknown key → 400; `POST /api/v1/ops/pause {reason?}` → sets `publishing_enabled=false` + audit `publishing.paused` (idempotent); `POST /api/v1/ops/resume` → 409 `publishing_disabled_by_default` always in slice 4 (the explicit re-authed enable flow is a later slice; this endpoint exists so the UI has a real target that provably refuses); `GET /api/v1/ops/audit?limit&offset` → `{events, total}` newest-first; `GET /api/v1/ops/jobs?limit&offset` → `{jobs, total}` (empty → `{jobs:[], total:0}`)

- [ ] **Step 1: Write the failing tests** in `tests/integration/web-ops.test.ts`: `policy defaults false on fresh DB`; `set autonomy_enabled true → audit policy.updated`; `pause → publishing_enabled false + audit publishing.paused; second pause idempotent 200`; `resume without explicit enable → 409`; `audit list newest-first contains seeded entries`; `jobs list empty → total 0`; `anonymous ops read → 401`.
- [ ] **Step 2: Run to verify they fail.** Run: `npx vitest run tests/integration/web-ops.test.ts` Expected: FAIL (404 `not_found` — router unmounted).
- [ ] **Step 3: Implement `createOpsRouter({db})`** per contract; mount in `createApp.ts`.
- [ ] **Step 4: Run to verify green.** Run: `npx vitest run tests/integration/web-ops.test.ts` Expected: PASS (7/7).
- [ ] **Step 5: Commit.** Run: `git add apps/web/src/routes/ops.ts apps/web/src/createApp.ts tests/integration/web-ops.test.ts && git commit -m "feat(p2): policy gate, audit/jobs viewers and pause controls"` Expected: commit created.

### Task 5: Content + approval UI page and browser journeys

**Files:**
- Modify: `apps/web/src/routes/pages.ts` (add `/content/` gate + canonicalization, mirroring `/studio/`)
- Modify: `apps/web/src/config.ts` (no change expected — reuse `staticDir`)
- Create: `apps/web/static/content.html`, `apps/web/static/content.js` (reuse `studio-online.css`; no new CSS file unless a conflict banner variant is needed)
- Test: `tests/browser/content-approvals.spec.ts` (new; own server like `studio-online.spec.ts`); extend `tests/integration/web-pages.test.ts` (gate + canonicalization assertions)

**Interfaces:**
- Consumes: Task 2–4 APIs (`/api/v1/content/items`, `:id`, `/variants/:id/approvals`, `/ops/pause`); session cookie + CSRF from `/api/v1/auth/me`
- Produces (DOM contract): `#inboxList li` (one per item); `#storyTitle`, `#citationList li a[href]` (real `canonicalUrl`/`evidenceUrl`); `#approveBtn` → `#approvalState` text `Approved snapshot <hash-prefix>`; `#rejectBtn` → `Rejected`; `#pauseBtn` → `#opsState` text `Publishing paused`; empty inbox → `#inboxEmpty` visible

- [ ] **Step 1: Write the failing browser spec** `tests/browser/content-approvals.spec.ts`: seeds via API (source→item→cluster→content+claim+variant), then `shows inbox with citation links`; `approves a fixture without any outbound request (route abort on http* except localhost → still Approved)`; `editing variant text revokes approval (valid:false + stale_approval)`; `pause control reports Publishing paused`. Plus integration assertions for `/content` → `/content/` canonicalization and unauth bounce. Run: `npx playwright test tests/browser/content-approvals.spec.ts --timeout=45000` Expected: FAIL (4/4 — pages absent).
- [ ] **Step 2: Implement pages route + static files** per DOM contract; strict CSP (external JS only, `hidden` attribute, no inline styles); v2 tokens only.
- [ ] **Step 3: Run to verify green.** Run: `npx playwright test tests/browser/content-approvals.spec.ts --timeout=45000` Expected: PASS 4/4. Then `npx tsc --noEmit` Expected: exit 0.
- [ ] **Step 4: Mutation check** (combined, then revert byte-identical): sabotage approval-hash input (drop `text`), submit-gate (`publishing_enabled` check removed), transition guard (`canTransitionContent` bypassed), pause idempotency (enable instead). Run: `npx vitest run tests/integration/web-content.test.ts tests/integration/web-ops.test.ts` Expected: each sabotage fails exactly its aimed tests.
- [ ] **Step 5: Full verify + commit docs.** Run: `npm run verify` Expected: exit 0 (smoke `[40, 16, 14336]`; standalone sha256 `d7501b4d…`). Then commit code + `CHANGELOG.md` + `docs/project-status.md` entries. Expected: clean tree on `v3`.

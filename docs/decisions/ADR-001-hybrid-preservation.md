# ADR-001: Preserve the offline Social Studio v2 editor as the foundation of v3

- **Date:** 2026-10-15
- **Status:** Accepted
- **Phase:** P0

## Context

`Runtime-Garden/social-studio` already contains a working, offline, local-first
Canvas editor: 40 layouts, 12 connected carousel packs, 16 size presets,
`.rgstudio.json` import/export (v1 and v2 files), localStorage autosave, and a
locked official Design Kit v2 brand identity. The v3 blueprint adds an online
workspace (research, AI drafting, approvals, Buffer publishing). The risk is
that building v3 "properly" tempts a rewrite that breaks the offline product,
the brand, or existing user projects.

## Decision

1. **Extend the existing repository and preserve the offline edition.** The
   static files `index.html`, `studio.css`, `studio.js` and `assets/` remain
   functional exactly as today, with no mandatory network, server, AI or auth
   dependency. The offline edition must keep working when all online
   components are absent.
2. **Refactor progressively, behind tests.** Shared logic (format presets,
   template/series definitions, project schema and migration, Canvas `frame`)
   will be extracted module by module into shared packages only when tests
   covering current behavior exist first. The mock-Canvas smoke tests, the new
   unit round-trip tests and the real-browser tests are the guardrails.
3. **The `.rgstudio.json` v1/v2 file format is a stable public contract.**
   Online editorial/publishing metadata lives in separate server records and
   never mutates the meaning of the offline file format.
4. **Imported slide uids are not identities.** `restoreFrom()` regenerates
   slide uids on every import (verified in
   `tests/unit/project-roundtrip.test.ts`). Online project identity is the
   server-side project + revision, not the offline uid.
5. **Offline autosave and online persistence are separate state machines.**
   localStorage autosave is never presented as synchronized with server
   revisions; online saves use explicit revisions with optimistic concurrency.
6. **The standalone HTML is a generated, committed artifact** built
   deterministically from the editable sources (`tools/build-standalone.cjs`),
   and CI verifies the committed artifact matches a fresh build.

## Consequences

- v3 features cannot silently change the offline rendering without a failing
  test first; visual regressions are caught by golden/browser tests (P1).
- Some duplication (e.g. palette constants in CSS and JS) is accepted while
  the extraction proceeds; each extraction step must be provably
  output-neutral.
- The repository temporarily hosts both the v2 layout at the root and v3
  structure (`apps/`, `packages/`) side by side; this is intentional during
  the transition.

## Alternatives considered

- **Rewriting the editor in a framework** — rejected: discards tested,
  brand-true rendering; violates preserve-v2 requirement.
- **Iframe-embedding the offline editor in v3 forever** — acceptable as a
  stopgap only if a clean module integration inside the same repo proves
  harder; `postMessage` boundaries would need origin pinning.
- **Moving all files into `packages/` immediately** — rejected: breaks the
  working static entry point and the documented start instructions.

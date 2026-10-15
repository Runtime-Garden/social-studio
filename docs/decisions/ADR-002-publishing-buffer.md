# ADR-002: Buffer GraphQL API as the single publishing gateway

- **Date:** 2026-10-15
- **Status:** Accepted
- **Phase:** P0 (implementation in P3)

## Context

Runtime Garden needs scheduled publishing to X, LinkedIn, Instagram and
Facebook for its own accounts. Direct platform APIs require four separate
developer apps, approval processes, OAuth flows and ongoing quota handling.
Collecting platform passwords and automating browser logins was considered in
earlier exploration and rejected: it is fragile, likely violates platform
terms, endangers the accounts, and cannot be responsibly automated 24/7.

The blueprint (section 6) selected **Buffer's official GraphQL API**
(`https://api.buffer.com`, personal API key as Bearer token) as the single
publishing gateway: users connect channels in Buffer's own UI; Social Studio
stores only the server-side key and the resulting channel IDs.

## Decision

1. Implement one internal `PublishingProvider` interface, with **Buffer as the
   first and only** adapter in v3. Direct provider adapters (X/LinkedIn/Meta
   OAuth) are a possible future interface implementation, explicitly **not
   implemented now**.
2. All GraphQL traffic is typed, schema-validated, uses variables (never
   string interpolation), and parses **both** the success union member and
   `MutationError`, plus top-level GraphQL `errors` and transport failures.
3. **Agents never receive authority to publish.** Only deterministic
   server-side authorization + policy + a durable publisher job may call the
   Buffer mutation.
4. **Publishing semantics:**
   - Destinations are chosen at approval time from connected channels and are
     immutable in the approval snapshot.
   - `schedulingType: automatic` is required for unattended flows; posts that
     would require notification-only handling are blocked, never downgraded
     silently.
   - Buffer statuses (`draft`, `needs_approval`, `scheduled`, `sending`,
     `sent`, `error`) are stored as-is; the UI distinguishes
     submitted-to-Buffer / scheduled / platform-sent / error / needs-manual-action.
   - On ambiguous create responses the publication is marked
     `submission_uncertain` and reconciled against Buffer; **no blind retry
     may ever create a duplicate post**.
5. **Media:** Buffer requires stable, direct, publicly accessible HTTPS URLs
   until publication. Social Studio will serve approved media from a strictly
   scoped public route (opaque content-hash names, approved derivatives only).
   Presigned short-lived URLs are rejected as fragile.
6. **Limits are configuration read from live evidence, not constants.**
   Buffer plan limits (Free: 3 channels, 10 queued posts/channel; rate-limit
   headers per window) are recorded and enforced at submission time, but the
   code prefers the stricter of policy/config/header values rather than
   hardcoding today's numbers.
7. **Capabilities are verified, never assumed.** Feature flags per channel
   (`supports_text`, `supports_single_image`, `supports_multiple_images`,
   `supports_auto`, `supports_exact_schedule`, `allowed_media_ratios`, …) are
   populated from schema checks and live integration tests; unsupported
   formats offer a manual export/draft fallback — never browser automation.

## Consequences

- v3 can ship with one integration instead of four; channel connection and
  reconnection happens in Buffer's UI by the owner.
- Buffer becomes an explicit single point of failure for automated publishing;
  publishing pauses fail closed, and the offline editor plus manual export
  remain fully functional fallbacks.
- Buffer plan/feature/pricing changes can block channels or formats; the
  capability matrix and status reconciliation make this visible instead of
  silently degrading.
- The live pilot (one explicitly approved post per validated channel/format)
  is a hard gate before the status "live-verified" may be used.

## Alternatives considered

- Direct platform OAuth ×4 — rejected for v3 scope (cost/approval friction);
  remains a possible future provider adapter behind the same interface.
- Password/browser automation — rejected outright (security, terms, account
  risk; see blueprint non-negotiables).
- Self-hosted schedulers posting via unofficial endpoints — rejected for the
  same reasons.

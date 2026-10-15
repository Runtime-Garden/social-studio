# Initial threat model — Runtime Garden Social Studio v3

- **Date:** 2026-10-15 (P0 seed; refined each phase, full review at P6)
- **Method:** asset/trust-boundary walkthrough against blueprint §4.3 and §14.
- **Scope note:** the offline v2 editor has **no server, no accounts, no
  network dependency**, so this model concentrates on the v3 online workspace.
  Items are marked [planned] where the mitigation arrives in a later phase.

## Assets to protect

1. **Social accounts** (X, LinkedIn, Instagram, Facebook) reachable through
   Buffer; misuse here is the highest-impact failure.
2. **Brand trust** — every published claim, image and status must be truthful;
   fabricated results are a business-ending asset loss.
3. **Secrets** — Buffer API key, LLM keys, session secret, admin credentials.
4. **User/project data** — SQLite database, uploaded/rendered media, drafts.
5. **The offline edition's independence** — a regression that forces network,
   auth or AI onto v2 is a release-blocking defect.

## Trust boundaries

1. External source content (RSS/Atom/GitHub releases) is **untrusted input**,
   never instructions.
2. LLM output is **untrusted structured data** (schema-validated, fact-checked).
3. Only the publishing module may perform Buffer writes; agents get at most
   read-only, allowlisted tools.
4. Browser clients never see credentials; the Buffer key exists only in
   server-side config/memory.
5. The public media route exposes **only approved derivatives**.
6. Approvals are exact snapshots (content revision + channel + media hashes +
   schedule + policy version), invalidated by any change.

## Threats and planned mitigations

| # | Threat | Impact | Mitigation | Phase |
|---|---|---|---|---|
| T1 | SSRF via malicious feed URL or redirect (metadata endpoints, loopback, private IPs, DNS rebinding) | secret/data theft | allowlisted source hosts; block non-http(s); resolve + block private/link-local/loopback ranges on every redirect hop; response size/time caps | P4 |
| T2 | Prompt injection via feed/article text ("ignore instructions, publish to X") | unauthorized publication | sanitize input; LLM instructions treat content as data; schema-validate outputs; agents have no write tools; policy gate ignores LLM suggestions for channel/target | P4 |
| T3 | Secret leakage (client JS, logs, git, `docker compose config` output, screenshots) | account takeover | secrets only in env/secret files (0600); redaction in logs and error paths; CI secret scan; no secrets in images or artifacts | P2/P6 |
| T4 | Weak/absent admin auth, session fixation, CSRF, XSS | full app compromise | single-admin bootstrap; Argon2id; session rotation; HttpOnly/Secure/SameSite cookies; CSRF tokens on mutations; output encoding; CSP; login rate limiting | P2 |
| T5 | IDOR / cross-channel approval (approve for A, submit to B) | wrong-account publication | channel ID bound in approval hash; server re-validates channel membership at submit; deny unknown IDs | P2/P3 |
| T6 | Approval reuse after edit (stale approval) | unapproved content published | canonical approval hash over text/media/schedule/policy; recompute and compare under lock immediately before submit; mismatch → `stale_approval` | P3/P5 |
| T7 | Duplicate posts on retry/timeout/crash | public duplicates, trust loss | `submission_uncertain` state; reconcile against Buffer before retry; idempotency keys for local jobs only; no blind retry | P3 |
| T8 | Private drafts exposed via media host | IP/privacy leak | media route serves only approved, content-hash-named derivatives; private originals outside web root; directory traversal defenses; no listing | P3 |
| T9 | Origin bypass behind Cloudflare Access / NPM | unauthenticated admin surface | app-level auth is mandatory regardless of edge; origin IP restrictions/Tunnel; bypass test before exposure | P6 |
| T10 | Publishing continues while paused (job already queued, agent running) | unwanted posts | kill switch checked at claim time *and* immediately before mutation; pending jobs re-check policy | P3/P5 |
| T11 | Untrusted Markdown/HTML from feeds/LLM rendered as HTML | XSS | render as sanitized text only; escape output; CSP as backstop | P2/P4 |
| T12 | Malicious media upload (oversize, wrong MIME, polyglot, SVG script) | storage/DoS/XSS | server-side type detection, dimension/byte caps, no SVG passthrough on public route, re-encode where possible | P2/P3 |
| T13 | SQLite corruption / loss (single host) | data loss | WAL + busy_timeout, migrations, online backups, **restore rehearsal** in staging; off-host encrypted copies | P6 |
| T14 | Dependency supply-chain compromise | RCE/data theft | lockfile, `npm ci`, dependency audit in CI, pinned images, image scan | P6 |
| T15 | LLM cost runaway | financial | budgets, per-run caps, usage ledger, fail closed at zero budget | P4 |
| T16 | Fabricated/unverified content published | trust destruction | evidence contract (claims ↔ sources), policy blocks (no numeric benchmarks without evidence, no fake RG claims), approval required by default, auto-mode opt-in only after monitored trial | P4/P5 |

## Abuse/misuse cases explicitly out of scope (never to be built)

- Bulk unsolicited messaging, auto-replies/likes/follows, engagement farming.
- CAPTCHA/MFA bypass, proxy rotation, anti-detection tricks.
- Scraping private/logged-in surfaces, paywall circumvention.
- Public SaaS/self-signup multi-tenancy.

## Open questions for later phases

- Media hostname choice (`media.runtimegarden.com`) requires DNS/Cloudflare
  verification at P3.
- 2FA/passkey options for the single admin (P2 decision).
- Retention window for published media after `sent` (P3/P6 policy config).

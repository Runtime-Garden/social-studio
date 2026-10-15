# P0 evidence — real-browser baseline (2026-10-15)

What these screenshots show, and how to reproduce them.

## Environment

- WSL2 Linux; Node v24.21.0; Playwright Chromium headless shell 156.0.8078.4.
- Served via `node tools/serve.cjs . 4174`; captured by
  `node tools/capture-evidence.cjs`.
- Viewport 1680×1050, device scale factor 1.

## Files

| File | Shows |
|---|---|
| `01-editor-light.png` | Full editor: templates grid (40), live Canvas preview, inspector, brand footer. |
| `02-editor-dark.png` | Same session with the dark theme applied to the slide. |
| `03-series-tab.png` | Series tab with the 12 connected packs. |
| `04-export-modal.png` | Export dialog (PNG/JPEG/WebP/ZIP/JSON/caption + multi-size bundle). |
| `05-standalone-file-protocol.png` | The generated standalone HTML opened via `file://` protocol — byte-identical to `01` (default state parity between the served source and the offline artifact). |

## Automated counterparts (stronger than screenshots)

- `tests/browser/studio.spec.ts` — 80-frame light/dark render sweep with real
  Canvas pixel hashes; UI template/theme interactions; PNG/JSON/ZIP downloads
  validated by file signature; v1 project import + localStorage persistence
  across reload.
- `tests/browser/standalone.spec.ts` — standalone artifact renders with **all
  network requests aborted** (offline invariant).

Reproduce:

```sh
npm ci
npm run build:standalone
npm run test:browser
node tools/capture-evidence.cjs
```

SHA-256 of the current files is recorded in the P0 commit; regenerate and
compare with `sha256sum docs/evidence/p0/*.png` if the UI legitimately changes
(visual differences are expected then; the automated tests are the contract).

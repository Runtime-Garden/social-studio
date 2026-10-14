# Runtime Garden Social Studio · v2.0

**Status:** Implemented. JavaScript syntax + mock Canvas rendering + series/project serialization tested; **real browser end-to-end testing not completed** (environment Chromium policy blocked even loopback access). Not deployed.

The official **Runtime Garden Design Kit v2** is the single design authority. A local-first static HTML visual editor for technical post designs, 40 layouts, 12 coordinated carousel series, and 16 output size choices (15 presets + custom). No paid SaaS, API key, CMS, database, or image uploading service.

## Start

1. Double-click **`Runtime_Garden_Social_Studio_v2_Standalone.html`**. Every required editor asset and the authentic brand SVG logos are embedded in this HTML file. External Google Fonts are optional; if unavailable the editor uses system fallbacks.
2. Or open `index.html` from the unpacked folder, with the CSS/JS/assets folders kept alongside it. If your browser enforces stricter `file:` security, serve locally with `python -m http.server 8080 --bind 127.0.0.1` and visit `http://127.0.0.1:8080`.
3. Keep regular `.rgstudio.json` project backups. Local browser autosave is not a cloud backup.

## What's new in v2

- **40 designs** (16 original layouts plus 24 new unique compositions). Filter Editorial / Technical / Social, then edit title, subtitle, code, numbered steps, research signals, method, Q&A, etc.
- **12 complete connected series**, under the new **Series** tab. A series generates 6–7 distinct frames with a shared theme, margin signature, numbering, progression track, coherent palette and typography, plus an intentional opener, body slides and close. Each frame is separately editable.
- **16 size choices:** 15 presets and a custom width/height option (400–4096 px wide; 300–4096 px tall). Choose a size in the persistent *Canvas Size* toolbar or under Style. Changes to a single slide do not resize the others unless **Apply to all** is clicked.
- **Export multiple size versions at once:** use Export → *Multi-size collection export*, select desired presets (Ctrl / ⌘ for multiple selection) and download a ZIP with one PNG folder for each selected size. The original project remains unchanged. Export current slide as PNG/JPEG/WebP; all original slides to ZIP; or save the editable project JSON.
- **Backward compatibility:** v1 JSON projects remain importable, v2 JSON preserves pack identity and custom dimensions. Switching themes/styles keeps the logo and brand colors protected.

## Connected series

| Series | Frames | Theme | Narrative |
|---|---:|---|---|
| Field Notes | 6 | Light · dots | Editorial opener → question → method → findings → insight → closing |
| Lab Notebook | 6 | Light · grid | Cover → open questions → method → diagram → findings → closing |
| System Anatomy | 6 | Dark · grid | Cover → layers → diagram → decision → checklist → closing |
| Open Source Dispatch | 6 | Light · dots | Hero → spotlight → terminal → release → roadmap → closing |
| Decision Record | 6 | Light · none | Thesis → questions → comparison → iteration → trade-offs → closing |
| Build in Public | 6 | Light · grid | Cover → timeline → spotlight → changes → roadmap → closing |
| Practical Field Guide | 7 | Light · dots | Hero → chapter → steps → do/avoid → Q&A → references → closing |
| Research Signals | 6 | Dark · dots | Cover → signal → metrics → method → findings → closing |
| Community Dispatch | 6 | Light · none | Invite → questions → digest → principle → resources → closing |
| Terminal Sessions | 6 | Dark · grid | Cover → terminal → code → layers → checklist → closing |
| Engineering Observatory | 6 | Light · grid | Thesis → signal → insight → timeline → findings → closing |
| Garden Principles | 6 | Dark · none | Cover → principle → thesis → myth/reality → insight → closing |

Each series has a sample editable `.rgstudio.json` in `examples/`. The `v2-series-preview.png` contact sheet is an **illustrative design overview**, not a browser screenshot. These are story structures, not automatically drafted factual announcements: replace placeholders with verifiable information.

## Sizes

| Profile | Pixels | Profile | Pixels |
|---|---|---|---|
| Instagram portrait | 1080×1350 | Instagram square | 1080×1080 |
| Stories / reels cover | 1080×1920 | LinkedIn / OG | 1200×630 |
| X landscape | 1600×900 | Wide cover | 1200×800 |
| Portrait 3:4 | 1080×1440 | Instagram landscape | 1080×566 |
| LinkedIn square | 1200×1200 | LinkedIn portrait | 1200×1500 |
| X square | 1200×1200 | Video thumbnail | 1280×720 |
| Pinterest 2:3 | 1000×1500 | LinkedIn banner | 1584×396 |
| X header | 1500×500 | Custom | Width/height set by user |

The profiles are starting dimensions only, not a guarantee of platform acceptance, image crop, safe areas, or current specifications. Always preview on the destination platform; some platforms use a uniform carousel aspect ratio.

## Editorial integrity & safety

- Official terminal/leaf **logo v2** vectors only. Color palette is **immutable**:
  - Light: BG `#F6F8F3`, ink `#16271E`, moss `#286A47`, surface `#FFFFFF`.
  - Dark: BG `#0D1713`, ink `#EDF4ED`, moss `#8DD5A3`, surface `#15231B`.
  - Soft fills, dividers and sparse warm accents follow the supplied Design Kit v2 tokens.
- Typography: Inter/Geist; Newsreader editorial serif; IBM Plex Mono technical labels. No fonts distributed in the ZIP.
- AI-generated metrics, invented customer cases, fake product launches or non-existent GitHub demos must not be represented as real. Check claims and links manually before publishing.
- Images are imported only to the **Visual Case Study** layout. Embedded image data increases project size and may exceed browser storage; back up to JSON.
- Local-first; no remote uploads or auth. Social posting, scheduling, collaboration and CMS sync **are not implemented**. If hosted on a public domain later, add authentication and access controls; Cloudflare Access by itself doesn't eliminate an origin-bypass risk.

## Supported actions

Templates: choose/edit design on current slide. Series: create a coordinated pack (replaces current slides after confirmation if >1) or, from Style, apply a pack's visual system to existing slides. Slides: add, duplicate, reorder and delete (up to 100). Style: formats, custom dimensions, backgrounds, fixed palette variants, guides and brand controls. Publish: caption, tags, source URL, preflight hints. Exports: PNG/JPEG/WebP, slide ZIP, multi-format ZIP, editable JSON. Arrow keys change slide; Ctrl/Cmd+S saves project; Ctrl/Cmd+Z and Ctrl+Y handle editor history when not typing.

## Tests

From the unpacked folder, with Node.js installed:

```sh
node --check studio.js
node tests/render-smoke.cjs
node tests/series-smoke.cjs
```

The smoke suite checks every 40-layout × 16-format × 2-color-mode combination (1,280 Canvas frame invocations) using a mocked drawing context; and checks each of the 12 pack builders, project JSON serialization, and custom dimensions. It **does not** prove pixel-perfect visuals in Chrome/Safari/Firefox. An actual browser QA checklist should cover logo rendering, very long headlines, square/banner crops, image upload, ZIP export, JSON restoration, accessibility, and mobile viewports before release.

## Package structure

```text
index.html, studio.css, studio.js        # Editable source editor
Runtime_Garden_Social_Studio_v2_Standalone.html # All-in-one offline-ready HTML
assets/                                  # Official v2 logos and design tokens
examples/series-*.rgstudio.json         # 12 importable, connected series
examples/v2-series-preview.png          # Illustrative pack overview
examples/                               # Original v1 sample graphics/projects
tests/                                  # Canvas and series smoke tests
docs/                                   # Design brief and official logo notes
```

**Runtime Garden — Where ideas grow into systems.**

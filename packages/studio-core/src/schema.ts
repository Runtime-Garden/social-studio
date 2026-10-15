/**
 * P1: explicit project schema and v1/v2 migrations (blueprint 8.1 item 2).
 *
 * The v2 importer historically validated nothing more than "has a slides
 * array" in `studio.js restoreFrom()` and silently ignored the `format` and
 * `version` markers (P0 audit finding F3). This module makes the contract
 * explicit:
 *
 * - `.rgstudio.json` files carry `format: "runtime-garden-social-studio"` and
 *   `version: 1 | 2`. Files with a PRESENT but foreign marker are rejected;
 *   files with an unsupported version are rejected instead of guessed at.
 * - Versionless payloads remain accepted: the offline editor autosaves raw
 *   app state (`JSON.stringify(app)`) to localStorage with no markers.
 * - `migrateProjectV1ToV2()` documents the exact v1→v2 delta (six v2-only
 *   slide fields + project `seriesPack`). v1 files have always been upgraded
 *   implicitly by overlaying input onto `NEW_SLIDE()` defaults; the
 *   migration makes that delta testable without changing its output.
 *
 * Normalization (the security boundary) is unchanged from the v2 editor:
 * keys are whitelisted against the layout template, strings/numbers clamped,
 * unknown series normalized, and slide uids regenerated (imported uids are
 * not identities — ADR-001).
 */

import { NEW_SLIDE, SAMPLES, SERIES_PACKS, DEFAULTS, clamp, uid } from './registry.js';

export const PROJECT_FORMAT = 'runtime-garden-social-studio';
export const PROJECT_FORMAT_VERSION = 2;

/** Slide shape as the v2 editor and renderer consume it. */
export interface StudioSlideV2 {
  id: string;
  uid: string;
  name: string;
  category: string;
  desc: string;
  title: string;
  subtitle: string;
  kicker: string;
  tag: string;
  detail: string;
  label: string;
  customFooter: string;
  sourceUrl: string;
  date: string;
  caption: string;
  hashtags: string;
  bullets: string;
  code: string;
  format: string;
  theme: string;
  align: string;
  pattern: string;
  backgroundMode: string;
  scale: number;
  numbering: boolean;
  showLogo: boolean;
  showDomain: boolean;
  showTag: boolean;
  showSubtitle: boolean;
  showGuides: boolean;
  image: string | null;
  imageFit: string;
  imagePosition: number;
  series: string;
  seriesLabel: string;
  seriesVariant: string;
  chapterNumber: number;
  customWidth: number;
  customHeight: number;
}

/** Project shape produced by the v2 editor and this schema module. */
export interface StudioProjectV2 {
  name: string;
  seriesPack: string;
  selected: number;
  slides: StudioSlideV2[];
}

/**
 * Fields added in v2 that a genuine v1 slide never carries. Values are the
 * editor defaults (`NEW_SLIDE()` derives them from DEFAULTS).
 */
export const V1_TO_V2_SLIDE_DEFAULTS = {
  series: DEFAULTS.series,
  seriesLabel: DEFAULTS.seriesLabel,
  seriesVariant: DEFAULTS.seriesVariant,
  chapterNumber: DEFAULTS.chapterNumber,
  customWidth: DEFAULTS.customWidth,
  customHeight: DEFAULTS.customHeight,
} as const;

/**
 * Explicit v1→v2 migration: fills the six v2-only slide fields and the
 * project-level `seriesPack` when missing. Present values always win and the
 * input object is never mutated. Shape validation is NOT this function's
 * job — `restoreProject()` normalizes and rejects afterwards.
 */
export function migrateProjectV1ToV2(
  project: Record<string, unknown>,
): Record<string, unknown> {
  const migrated: Record<string, unknown> = { seriesPack: 'none', ...project };
  if (Array.isArray(project.slides)) {
    migrated.slides = project.slides.map((slide) =>
      slide && typeof slide === 'object' && !Array.isArray(slide)
        ? { ...V1_TO_V2_SLIDE_DEFAULTS, ...(slide as Record<string, unknown>) }
        : slide,
    );
  }
  return migrated;
}

/**
 * Version marker handling. `undefined` is the versionless autosave payload
 * (localStorage); any other value must be a supported integer version.
 */
function readVersionMarker(parsed: Record<string, unknown>): 1 | 2 | 'legacy' {
  const version = parsed.version;
  if (version === undefined) return 'legacy';
  if (version === 1) return 1;
  if (version === 2) return 2;
  throw Error(
    `Unsupported project version: ${String(version)}. Supported versions: 1, 2.`,
  );
}

/** Format marker handling: absent is accepted (autosave), foreign is not. */
function assertFormatMarker(parsed: Record<string, unknown>): void {
  const marker = parsed.format;
  if (marker === undefined || marker === PROJECT_FORMAT) return;
  throw Error(
    `Not a Runtime Garden Social Studio project (format marker: "${String(marker).slice(0, 40)}").`,
  );
}

/**
 * Whitelist-normalizes one slide against its layout template. Verbatim port
 * of the v2 editor's `restoreFrom()` slide handling — same clamps, same
 * limits, same error messages.
 */
function normalizeSlide(input: unknown): StudioSlideV2 {
  if (
    !input ||
    typeof input !== 'object' ||
    !SAMPLES.some((t: { id: string }) => t.id === (input as { id?: unknown }).id)
  ) {
    throw Error('Unknown layout in imported project.');
  }
  const source = input as Record<string, unknown>;
  // Boundary cast: SAMPLES layouts carry a literal union type without an
  // index signature; the whitelist loop below is inherently dynamic.
  const clean = NEW_SLIDE(source.id) as Record<string, unknown>;
  for (const k of Object.keys(clean)) {
    if (!Object.hasOwn(source, k)) continue;
    const v = source[k];
    if (typeof clean[k] === 'string' && typeof v === 'string') {
      clean[k] = v.slice(0, k === 'image' ? 6500000 : 15000);
    } else if (typeof clean[k] === 'number' && typeof v === 'number' && Number.isFinite(v)) {
      clean[k] = v;
    } else if (typeof clean[k] === 'boolean' && typeof v === 'boolean') {
      clean[k] = v;
    } else if (
      k === 'image' &&
      (v === null ||
        (typeof v === 'string' &&
          /^data:image\/(png|jpeg|webp);base64,/.test(v) &&
          v.length < 6500000))
    ) {
      clean[k] = v;
    }
  }
  clean.uid = uid();
  clean.scale = clamp(clean.scale as number, 0.7, 1.25);
  clean.customWidth = clamp(Math.round(clean.customWidth as number), 400, 4096);
  clean.customHeight = clamp(Math.round(clean.customHeight as number), 300, 4096);
  if (!SERIES_PACKS.some((p: { id: string }) => p.id === clean.series)) clean.series = 'none';
  clean.imagePosition = clamp(clean.imagePosition as number, 0, 100);
  return clean as unknown as StudioSlideV2;
}

/**
 * Parses and normalizes a `.rgstudio.json` document (or raw autosave text)
 * into editor app state. Throws on invalid, foreign or unsupported input.
 */
export function restoreProject(text: string): StudioProjectV2 {
  const parsed = JSON.parse(text) as Record<string, unknown>;
  if (
    !parsed ||
    !Array.isArray(parsed.slides) ||
    parsed.slides.length < 1 ||
    parsed.slides.length > 100
  ) {
    throw Error('Not a valid Social Studio project.');
  }
  assertFormatMarker(parsed);
  const version = readVersionMarker(parsed);
  const migrated = version === 1 ? migrateProjectV1ToV2(parsed) : parsed;
  const slides = (migrated.slides as unknown[]).map(normalizeSlide);
  return {
    name: String(migrated.name || 'Imported collection').slice(0, 100),
    seriesPack: SERIES_PACKS.some((p: { id: string }) => p.id === migrated.seriesPack)
      ? (migrated.seriesPack as string)
      : 'none',
    selected: clamp(Number(migrated.selected) || 0, 0, slides.length - 1),
    slides,
  };
}

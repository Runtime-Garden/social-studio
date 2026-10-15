/**
 * P1: content-brief-to-studio builder (blueprint section 8.1 item 6).
 *
 * Transforms ONLY a validated ContentBrief (+ existing SAMPLES/SERIES_PACKS
 * choices) into an editable v2 `.rgstudio.json` project. It never emits
 * arbitrary HTML/CSS and never "repairs" an invalid brief: invalid input is
 * rejected with a coded StudioBuilderError.
 *
 * Text policy: every string copied into the project comes from the brief
 * (title/subtitle/tag/source/date/bullets) or from the chosen template's own
 * sample copy (placeholders the editor user is expected to edit). Bullets are
 * populated only from `verified` claims, verbatim, and only on layouts whose
 * template bullets are plain line lists.
 */

import { NEW_SLIDE, SAMPLES, SERIES_PACKS } from './registry.js';
import { PROJECT_FORMAT, PROJECT_FORMAT_VERSION } from './schema.js';

export const SUPPORTED_BRIEF_SCHEMA_VERSION = 1;
export { PROJECT_FORMAT_VERSION };
export const CONFIDENCE_LABELS = ['verified', 'uncertain', 'unsupported'] as const;
export type ConfidenceLabel = (typeof CONFIDENCE_LABELS)[number];

export const CONTENT_BRIEF_LIMITS = {
  topic: 400,
  angle: 400,
  kind: 64,
  sourceIds: 100,
  sourceId: 128,
  audience: 20,
  audienceItem: 64,
  caveats: 20,
  caveat: 400,
  claims: 50,
  claimText: 500,
  evidencePerClaim: 10,
  evidenceUrl: 2048,
  evidenceLocator: 200,
  projectName: 100,
  tag: 40,
  bullets: 6,
} as const;

export class StudioBuilderError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'StudioBuilderError';
    this.code = code;
  }
}

export interface ClaimEvidence {
  url: string;
  locator?: string;
}

export interface ContentBriefClaim {
  id: string;
  text: string;
  evidence: ClaimEvidence[];
  confidence: ConfidenceLabel;
}

export interface ContentBrief {
  schemaVersion: typeof SUPPORTED_BRIEF_SCHEMA_VERSION;
  topic: string;
  kind: string;
  sourceIds: string[];
  primaryUrl: string | null;
  primaryPublishedAt: string | null;
  audience: string[];
  angle: string;
  claims: ContentBriefClaim[];
  caveats: string[];
  suggestedStudioTemplate: string | null;
  suggestedStudioSeries: string | null;
  requiresOwnerReview: boolean;
}

export interface StudioBuilderOptions {
  templateId?: string;
  seriesPack?: string;
}

export interface StudioSlide {
  [key: string]: unknown;
  uid: string;
  id: string;
  title: string;
  subtitle: string;
  tag: string;
  bullets: string;
  sourceUrl: string;
  date: string;
  theme: string;
  pattern: string;
  series: string;
  seriesLabel: string;
  seriesVariant: 'opening' | 'regular' | 'closing';
  chapterNumber: number;
  numbering: boolean;
}

export interface StudioProject {
  format: typeof PROJECT_FORMAT;
  version: typeof PROJECT_FORMAT_VERSION;
  name: string;
  seriesPack: string;
  selected: number;
  slides: StudioSlide[];
  brief: ContentBrief;
}

function fail(code: string, message: string): never {
  throw new StudioBuilderError(code, message);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//.test(value);
}

function briefString(value: unknown, path: string, max: number, allowBlank = false): string {
  if (typeof value !== 'string') fail('brief.field_invalid', `${path} must be a string`);
  if (!allowBlank && value.trim() === '') {
    fail('brief.field_invalid', `${path} must not be blank`);
  }
  if (value.length > max) {
    fail('brief.field_invalid', `${path} must be at most ${max} characters`);
  }
  return value;
}

function stringList(value: unknown, path: string, maxItems: number, maxItem: number): string[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) fail('brief.field_invalid', `${path} must be an array`);
  if (value.length > maxItems) {
    fail('brief.field_invalid', `${path} must contain at most ${maxItems} entries`);
  }
  return value.map((item, i) => briefString(item, `${path}[${i}]`, maxItem));
}

function optionalHttpUrl(value: unknown, path: string): string | null {
  if (value === undefined || value === null) return null;
  const url = briefString(value, path, CONTENT_BRIEF_LIMITS.evidenceUrl);
  if (!isHttpUrl(url)) fail('brief.field_invalid', `${path} must be an http(s) URL`);
  return url;
}

function validateClaims(value: unknown): ContentBriefClaim[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) fail('brief.field_invalid', 'claims must be an array');
  if (value.length > CONTENT_BRIEF_LIMITS.claims) {
    fail('brief.field_invalid', `claims must contain at most ${CONTENT_BRIEF_LIMITS.claims} entries`);
  }
  return value.map((raw, i) => {
    const path = `claims[${i}]`;
    if (!isPlainObject(raw)) fail('brief.claim_invalid', `${path} must be an object`);

    const id = claimString(raw.id, `${path}.id`, CONTENT_BRIEF_LIMITS.sourceId);
    const text = claimString(raw.text, `${path}.text`, CONTENT_BRIEF_LIMITS.claimText);

    if (!Array.isArray(raw.evidence) || raw.evidence.length === 0) {
      fail('brief.claim_invalid', `${path}.evidence must contain at least one source record`);
    }
    if (raw.evidence.length > CONTENT_BRIEF_LIMITS.evidencePerClaim) {
      fail(
        'brief.claim_invalid',
        `${path}.evidence must contain at most ${CONTENT_BRIEF_LIMITS.evidencePerClaim} records`,
      );
    }
    const evidence = raw.evidence.map((entry, j) => {
      const entryPath = `${path}.evidence[${j}]`;
      if (!isPlainObject(entry)) fail('brief.claim_invalid', `${entryPath} must be an object`);
      const url = claimString(entry.url, `${entryPath}.url`, CONTENT_BRIEF_LIMITS.evidenceUrl);
      if (!isHttpUrl(url)) fail('brief.claim_invalid', `${entryPath}.url must be an http(s) URL`);
      const locator =
        entry.locator === undefined || entry.locator === null
          ? undefined
          : claimString(entry.locator, `${entryPath}.locator`, CONTENT_BRIEF_LIMITS.evidenceLocator);
      return locator === undefined ? { url } : { url, locator };
    });

    if (!CONFIDENCE_LABELS.includes(raw.confidence as ConfidenceLabel)) {
      fail(
        'brief.claim_invalid',
        `${path}.confidence must be one of ${CONFIDENCE_LABELS.join(', ')}`,
      );
    }

    return { id, text, evidence, confidence: raw.confidence as ConfidenceLabel };
  });
}

function claimString(value: unknown, path: string, max: number): string {
  if (typeof value !== 'string' || value.trim() === '') {
    fail('brief.claim_invalid', `${path} must be a non-empty string`);
  }
  if ((value as string).length > max) {
    fail('brief.claim_invalid', `${path} must be at most ${max} characters`);
  }
  return value as string;
}

/**
 * Strictly validates an untrusted value against the blueprint's ContentBrief
 * schema (section 7.3, version 1) and returns a normalized deep copy.
 */
export function validateContentBrief(input: unknown): ContentBrief {
  if (!isPlainObject(input)) fail('brief.not_object', 'ContentBrief must be a JSON object');
  if (input.schemaVersion !== SUPPORTED_BRIEF_SCHEMA_VERSION) {
    fail(
      'brief.unsupported_version',
      `ContentBrief schemaVersion must be ${SUPPORTED_BRIEF_SCHEMA_VERSION}`,
    );
  }

  const topic = briefString(input.topic, 'topic', CONTENT_BRIEF_LIMITS.topic);
  const kind = briefString(input.kind, 'kind', CONTENT_BRIEF_LIMITS.kind);
  if (!/^[a-z][a-z0-9_]*$/.test(kind)) {
    fail('brief.field_invalid', 'kind must be lower_snake_case (e.g. external_release)');
  }

  const angle =
    input.angle === undefined || input.angle === null
      ? ''
      : briefString(input.angle, 'angle', CONTENT_BRIEF_LIMITS.angle);

  let primaryPublishedAt: string | null = null;
  if (input.primaryPublishedAt !== undefined && input.primaryPublishedAt !== null) {
    const stamp = briefString(input.primaryPublishedAt, 'primaryPublishedAt', 64);
    if (Number.isNaN(Date.parse(stamp))) {
      fail('brief.field_invalid', 'primaryPublishedAt must be an ISO-8601 timestamp');
    }
    primaryPublishedAt = stamp;
  }

  let suggestedStudioTemplate: string | null = null;
  if (input.suggestedStudioTemplate !== undefined && input.suggestedStudioTemplate !== null) {
    const layoutId = briefString(input.suggestedStudioTemplate, 'suggestedStudioTemplate', 64);
    if (!SAMPLES.some((s: { id: string }) => s.id === layoutId)) {
      fail('brief.template_unknown', `suggestedStudioTemplate "${layoutId}" is not a known layout`);
    }
    suggestedStudioTemplate = layoutId;
  }

  let suggestedStudioSeries: string | null = null;
  if (input.suggestedStudioSeries !== undefined && input.suggestedStudioSeries !== null) {
    const packId = briefString(input.suggestedStudioSeries, 'suggestedStudioSeries', 64);
    if (!SERIES_PACKS.some((p: { id: string }) => p.id === packId)) {
      fail('brief.series_unknown', `suggestedStudioSeries "${packId}" is not a known series pack`);
    }
    suggestedStudioSeries = packId;
  }

  if (typeof input.requiresOwnerReview !== 'boolean') {
    fail('brief.field_invalid', 'requiresOwnerReview must be an explicit boolean');
  }

  return {
    schemaVersion: SUPPORTED_BRIEF_SCHEMA_VERSION,
    topic,
    kind,
    sourceIds: stringList(
      input.sourceIds,
      'sourceIds',
      CONTENT_BRIEF_LIMITS.sourceIds,
      CONTENT_BRIEF_LIMITS.sourceId,
    ),
    primaryUrl: optionalHttpUrl(input.primaryUrl, 'primaryUrl'),
    primaryPublishedAt,
    audience: stringList(
      input.audience,
      'audience',
      CONTENT_BRIEF_LIMITS.audience,
      CONTENT_BRIEF_LIMITS.audienceItem,
    ),
    angle,
    claims: validateClaims(input.claims),
    caveats: stringList(
      input.caveats,
      'caveats',
      CONTENT_BRIEF_LIMITS.caveats,
      CONTENT_BRIEF_LIMITS.caveat,
    ),
    suggestedStudioTemplate,
    suggestedStudioSeries,
    requiresOwnerReview: input.requiresOwnerReview,
  };
}

/** Overlays only brief-derived, provenance-safe fields onto a template slide. */
function applyBriefCopy(slide: StudioSlide, brief: ContentBrief): void {
  slide.title = brief.angle || brief.topic;
  slide.subtitle = brief.angle ? brief.topic : '';
  slide.tag = brief.kind.toUpperCase().replace(/_/g, ' ').slice(0, CONTENT_BRIEF_LIMITS.tag);
  if (brief.primaryUrl) slide.sourceUrl = brief.primaryUrl;
  if (brief.primaryPublishedAt) {
    slide.date = new Date(brief.primaryPublishedAt).toISOString().slice(0, 10);
  }

  const templateBullets = typeof slide.bullets === 'string' ? slide.bullets : '';
  const simpleList = templateBullets !== '' && !/[|;]/.test(templateBullets);
  if (simpleList) {
    const verified = brief.claims
      .filter((claim) => claim.confidence === 'verified')
      .map((claim) => claim.text)
      .slice(0, CONTENT_BRIEF_LIMITS.bullets);
    if (verified.length > 0) slide.bullets = verified.join('\n');
  }
}

function validateOptions(options: unknown): { templateId: string | null; seriesPack: string | null } {
  if (options === undefined || options === null) return { templateId: null, seriesPack: null };
  if (!isPlainObject(options)) fail('options.invalid', 'options must be an object');

  let templateId: string | null = null;
  if (options.templateId !== undefined && options.templateId !== null) {
    if (
      typeof options.templateId !== 'string' ||
      !SAMPLES.some((s: { id: string }) => s.id === options.templateId)
    ) {
      fail('options.template_unknown', `options.templateId "${String(options.templateId)}" is not a known layout`);
    }
    templateId = options.templateId;
  }

  let seriesPack: string | null = null;
  if (options.seriesPack !== undefined && options.seriesPack !== null) {
    if (
      typeof options.seriesPack !== 'string' ||
      !SERIES_PACKS.some((p: { id: string }) => p.id === options.seriesPack)
    ) {
      fail('options.series_unknown', `options.seriesPack "${String(options.seriesPack)}" is not a known series pack`);
    }
    seriesPack = options.seriesPack;
  }

  return { templateId, seriesPack };
}

/**
 * Builds an editable v2 `.rgstudio.json` project from a validated brief.
 * Single-card mode: options.templateId ?? brief.suggestedStudioTemplate ??
 * 'announcement'. Pack mode (options.seriesPack ?? brief.suggestedStudioSeries):
 * one slide per pack layout, styled like `applySeriesPack()` in the editor.
 */
export function buildStudioProject(input: unknown, options?: StudioBuilderOptions): StudioProject {
  const brief = validateContentBrief(input);
  const opts = validateOptions(options);
  const packId = opts.seriesPack ?? brief.suggestedStudioSeries;

  const slides: StudioSlide[] = [];
  let name: string;
  let seriesPack = 'none';

  if (packId) {
    const pack = SERIES_PACKS.find((p: { id: string }) => p.id === packId) as {
      id: string;
      name: string;
      theme: string;
      pattern: string;
      slides: string[];
    };
    pack.slides.forEach((layoutId, i) => {
      const slide = NEW_SLIDE(layoutId) as StudioSlide;
      slide.theme = pack.theme;
      slide.pattern = pack.pattern;
      slide.series = pack.id;
      slide.seriesLabel = pack.name;
      slide.seriesVariant =
        i === 0 ? 'opening' : i === pack.slides.length - 1 ? 'closing' : 'regular';
      slide.chapterNumber = i + 1;
      slide.numbering = true;
      applyBriefCopy(slide, brief);
      slides.push(slide);
    });
    seriesPack = pack.id;
    name = `${pack.name} · ${brief.topic}`;
  } else {
    const templateId = opts.templateId ?? brief.suggestedStudioTemplate ?? 'announcement';
    const slide = NEW_SLIDE(templateId) as StudioSlide;
    applyBriefCopy(slide, brief);
    slides.push(slide);
    name = brief.topic;
  }

  return {
    format: PROJECT_FORMAT,
    version: PROJECT_FORMAT_VERSION,
    name: name.slice(0, CONTENT_BRIEF_LIMITS.projectName),
    seriesPack,
    selected: 0,
    slides,
    brief,
  };
}

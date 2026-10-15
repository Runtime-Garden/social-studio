import { describe, expect, it } from 'vitest';
import { buildStudioProject, validateContentBrief } from './project-builder.js';
import { SAMPLES, SERIES_PACKS } from './registry.js';

/**
 * P1: content-brief-to-studio builder.
 *
 * Contract (blueprint section 8.1 item 6): transform ONLY a validated
 * ContentBrief (+ existing SAMPLES/SERIES_PACKS choices) into an editable
 * .rgstudio.json project. Invalid briefs must be rejected, never "repaired".
 */

const blueprintExample = {
  schemaVersion: 1,
  topic: 'A documented upstream software release',
  kind: 'external_release',
  sourceIds: ['source-123'],
  primaryUrl: 'https://example.org/release-notes',
  primaryPublishedAt: '2026-10-15T08:00:00Z',
  audience: ['software_engineers', 'ai_engineers'],
  angle: 'What changed and why it matters to developers',
  claims: [
    {
      id: 'claim-1',
      text: 'A release has been announced',
      evidence: [{ url: 'https://example.org/release-notes', locator: 'Release headline' }],
      confidence: 'verified',
    },
  ],
  caveats: ['Only describe capabilities documented by the maintainer'],
  suggestedStudioTemplate: 'release',
  suggestedStudioSeries: null,
  requiresOwnerReview: true,
};

function clone<T>(value: T): T {
  return structuredClone(value);
}

function errorFrom(fn: () => unknown): { code?: string; message: string } {
  try {
    fn();
  } catch (error) {
    return error as { code?: string; message: string };
  }
  throw new Error('expected the call to throw, but it returned');
}

function stripUids<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (key, val) => (key === 'uid' ? '<uid>' : val)),
  ) as T;
}

describe('validateContentBrief', () => {
  it('accepts the blueprint example and returns a normalized deep copy', () => {
    const brief = validateContentBrief(blueprintExample);
    expect(brief).toEqual(blueprintExample);
    expect(brief).not.toBe(blueprintExample);
  });

  it('fills defaults for a minimal valid brief', () => {
    const minimal = validateContentBrief({
      schemaVersion: 1,
      topic: 'A topic',
      kind: 'note',
      requiresOwnerReview: true,
    });
    expect(minimal.sourceIds).toEqual([]);
    expect(minimal.audience).toEqual([]);
    expect(minimal.claims).toEqual([]);
    expect(minimal.caveats).toEqual([]);
    expect(minimal.primaryUrl).toBeNull();
    expect(minimal.primaryPublishedAt).toBeNull();
    expect(minimal.suggestedStudioTemplate).toBeNull();
    expect(minimal.suggestedStudioSeries).toBeNull();
  });

  it('does not mutate the caller input, even if frozen', () => {
    const frozen = Object.freeze(blueprintExample);
    expect(() => validateContentBrief(frozen)).not.toThrow();
    expect(blueprintExample.topic).toBe('A documented upstream software release');
  });

  it('rejects non-objects and unknown schema versions', () => {
    expect(errorFrom(() => validateContentBrief('nope')).code).toBe('brief.not_object');
    expect(errorFrom(() => validateContentBrief({ schemaVersion: 2, topic: 'x', kind: 'note', requiresOwnerReview: true })).code).toBe(
      'brief.unsupported_version',
    );
  });

  it('rejects missing, blank and oversized topics with the field path in the message', () => {
    const missing = errorFrom(() =>
      validateContentBrief({ schemaVersion: 1, kind: 'note', requiresOwnerReview: true }),
    );
    expect(missing.code).toBe('brief.field_invalid');
    expect(missing.message).toContain('topic');

    const blank = errorFrom(() =>
      validateContentBrief({ schemaVersion: 1, topic: '   ', kind: 'note', requiresOwnerReview: true }),
    );
    expect(blank.code).toBe('brief.field_invalid');

    const oversized = errorFrom(() =>
      validateContentBrief({ schemaVersion: 1, topic: 'x'.repeat(401), kind: 'note', requiresOwnerReview: true }),
    );
    expect(oversized.code).toBe('brief.field_invalid');
  });

  it('rejects a kind that is not machine-readable snake_case', () => {
    expect(
      errorFrom(() =>
        validateContentBrief({ schemaVersion: 1, topic: 'x', kind: 'External Release!', requiresOwnerReview: true }),
      ).code,
    ).toBe('brief.field_invalid');
  });

  it('rejects claims without evidence', () => {
    const bad = clone(blueprintExample);
    bad.claims[0].evidence = [];
    const error = errorFrom(() => validateContentBrief(bad));
    expect(error.code).toBe('brief.claim_invalid');
    expect(error.message).toContain('claims[0].evidence');
  });

  it('rejects unknown confidence labels', () => {
    const bad = clone(blueprintExample) as { claims: Array<Record<string, unknown>> };
    bad.claims[0]!.confidence = 'pretty_sure';
    const error = errorFrom(() => validateContentBrief(bad));
    expect(error.code).toBe('brief.claim_invalid');
    expect(error.message).toContain('claims[0].confidence');
  });

  it('rejects evidence URLs with non-http(s) schemes', () => {
    const bad = clone(blueprintExample);
    bad.claims[0].evidence[0].url = 'javascript:alert(1)';
    expect(errorFrom(() => validateContentBrief(bad)).code).toBe('brief.claim_invalid');
  });

  it('rejects unknown suggested templates and series packs', () => {
    const badTemplate = clone(blueprintExample);
    badTemplate.suggestedStudioTemplate = 'not-a-layout';
    const templateError = errorFrom(() => validateContentBrief(badTemplate));
    expect(templateError.code).toBe('brief.template_unknown');

    const badSeries = clone(blueprintExample);
    Object.assign(badSeries, { suggestedStudioSeries: 'not-a-pack' });
    const seriesError = errorFrom(() => validateContentBrief(badSeries));
    expect(seriesError.code).toBe('brief.series_unknown');
  });

  it('requires the explicit owner-review flag and a parseable publication date', () => {
    const noFlag = clone(blueprintExample) as Record<string, unknown>;
    delete noFlag.requiresOwnerReview;
    expect(errorFrom(() => validateContentBrief(noFlag)).code).toBe('brief.field_invalid');

    const badDate = clone(blueprintExample);
    badDate.primaryPublishedAt = 'yesterday-ish';
    const dateError = errorFrom(() => validateContentBrief(badDate));
    expect(dateError.code).toBe('brief.field_invalid');
    expect(dateError.message).toContain('primaryPublishedAt');
  });
});

describe('buildStudioProject', () => {
  it('builds a single-card project from the suggested template', () => {
    const project = buildStudioProject(blueprintExample);
    expect(project.format).toBe('runtime-garden-social-studio');
    expect(project.version).toBe(2);
    expect(project.selected).toBe(0);
    expect(project.seriesPack).toBe('none');
    expect(project.slides).toHaveLength(1);

    const slide = project.slides[0]!;
    expect(slide.id).toBe('release');
    expect(slide.title).toBe(blueprintExample.angle);
    expect(slide.subtitle).toBe(blueprintExample.topic);
    expect(slide.tag).toBe('EXTERNAL RELEASE');
    expect(slide.sourceUrl).toBe(blueprintExample.primaryUrl);
    expect(slide.date).toBe('2026-10-15');
    expect(typeof slide.uid).toBe('string');
  });

  it('falls back to the calm announcement layout when no template is suggested', () => {
    const minimal = {
      schemaVersion: 1,
      topic: 'A topic',
      kind: 'note',
      requiresOwnerReview: true,
    };
    const project = buildStudioProject(minimal);
    expect(project.slides).toHaveLength(1);
    expect(project.slides[0]!.id).toBe('announcement');
  });

  it('turns only verified claims into bullets, and only on simple list layouts', () => {
    const mixed = {
      ...clone(blueprintExample),
      claims: [
        ...clone(blueprintExample).claims,
        {
          id: 'claim-2',
          text: 'Faster builds are reported',
          evidence: [{ url: 'https://example.org/bench', locator: 'Table 2' }],
          confidence: 'uncertain',
        },
        {
          id: 'claim-3',
          text: 'Windows support is stable',
          evidence: [{ url: 'https://example.org/win', locator: 'FAQ' }],
          confidence: 'verified',
        },
      ],
    };
    const project = buildStudioProject(mixed);
    expect(project.slides[0]!.bullets).toBe(
      'A release has been announced\nWindows support is stable',
    );

    // 'stat' uses structured '|' bullets; verified claims must not be forced into it.
    const statBrief = clone(blueprintExample);
    statBrief.suggestedStudioTemplate = 'stat';
    const statProject = buildStudioProject(statBrief);
    const statDefault = SAMPLES.find((s) => s.id === 'stat')!.bullets;
    expect(statProject.slides[0]!.bullets).toBe(statDefault);
  });

  it('turns a suggested series pack into the coordinated multi-slide project', () => {
    const brief = clone(blueprintExample);
    Object.assign(brief, { suggestedStudioSeries: 'labbook' });
    const project = buildStudioProject(brief);
    const pack = SERIES_PACKS.find((p) => p.id === 'labbook')!;

    expect(project.seriesPack).toBe('labbook');
    expect(project.slides.map((s) => s.id)).toEqual(pack.slides);
    expect(project.name).toBe(`Lab Notebook · ${brief.topic}`.slice(0, 100));
    for (const [i, slide] of project.slides.entries()) {
      expect(slide.series).toBe('labbook');
      expect(slide.seriesLabel).toBe('Lab Notebook');
      expect(slide.theme).toBe(pack.theme);
      expect(slide.pattern).toBe(pack.pattern);
      expect(slide.chapterNumber).toBe(i + 1);
      expect(slide.numbering).toBe(true);
      expect(slide.seriesVariant).toBe(
        i === 0 ? 'opening' : i === pack.slides.length - 1 ? 'closing' : 'regular',
      );
      expect(slide.title).toBe(brief.angle);
      expect(slide.subtitle).toBe(brief.topic);
    }
  });

  it('lets explicit options override the brief suggestions, and validates them', () => {
    const single = buildStudioProject(blueprintExample, { templateId: 'terminal' });
    expect(single.slides).toHaveLength(1);
    expect(single.slides[0]!.id).toBe('terminal');

    const packed = buildStudioProject(blueprintExample, { seriesPack: 'field' });
    const field = SERIES_PACKS.find((p) => p.id === 'field')!;
    expect(packed.seriesPack).toBe('field');
    expect(packed.slides.map((s) => s.id)).toEqual(field.slides);

    expect(errorFrom(() => buildStudioProject(blueprintExample, { templateId: 'nope' })).code).toBe(
      'options.template_unknown',
    );
    expect(errorFrom(() => buildStudioProject(blueprintExample, { seriesPack: 'nope' })).code).toBe(
      'options.series_unknown',
    );
  });

  it('validates the brief itself before building (no "repair" of invalid input)', () => {
    const bad = clone(blueprintExample);
    bad.topic = '';
    expect(errorFrom(() => buildStudioProject(bad)).code).toBe('brief.field_invalid');
  });

  it('embeds the normalized brief for provenance and stays deterministic apart from uids', () => {
    const first = buildStudioProject(blueprintExample);
    const second = buildStudioProject(blueprintExample);
    expect(first.brief).toEqual(validateContentBrief(blueprintExample));
    expect(stripUids(first)).toEqual(stripUids(second));
    const uids = first.slides.map((s) => s.uid);
    expect(new Set(uids).size).toBe(uids.length);
  });

  it('keeps hostile text as inert data and caps the project name', () => {
    const hostile = clone(blueprintExample);
    hostile.topic = `<script>alert(1)</script> ${'x'.repeat(300)}`;
    const project = buildStudioProject(hostile);
    expect(project.name.length).toBe(100);
    expect(typeof project.slides[0]!.title).toBe('string');
    expect(project.slides[0]!.subtitle.startsWith('<script>')).toBe(true);
  });
});

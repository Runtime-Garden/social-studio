/**
 * P1 evidence tests: explicit project schema + v1→v2 migrations.
 *
 * The historical importer (`studio.js restoreFrom`) implicitly "migrated" v1
 * files by overlaying whitelisted input onto `NEW_SLIDE()` defaults while
 * ignoring the `format`/`version` markers entirely (P0 audit finding F3).
 *
 * These tests pin the deliberate replacement:
 * - `restoreProject()` validates `format`/`version` markers when present,
 *   while still accepting versionless autosave payloads (localStorage).
 * - `migrateProjectV1ToV2()` makes the v1→v2 delta explicit and testable.
 * - Output for real v1/v2 example files stays identical to historical
 *   behavior (uids regenerated, whitelist normalization, clamping).
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  PROJECT_FORMAT,
  PROJECT_FORMAT_VERSION,
  migrateProjectV1ToV2,
  restoreProject,
} from '../../packages/studio-core/src/schema.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

interface RawFile {
  format: string;
  version: number;
  name: string;
  selected: number;
  seriesPack?: string;
  slides: Array<Record<string, unknown>>;
}

function readExample(file: string): { raw: RawFile; text: string } {
  const text = readFileSync(path.join(repoRoot, 'examples', file), 'utf8');
  return { raw: JSON.parse(text) as RawFile, text };
}

describe('schema constants', () => {
  it('exposes the committed project format marker and current version', () => {
    expect(PROJECT_FORMAT).toBe('runtime-garden-social-studio');
    expect(PROJECT_FORMAT_VERSION).toBe(2);
  });
});

describe('migrateProjectV1ToV2 (explicit v1→v2 delta)', () => {
  it('fills the six v2-only slide fields and the project seriesPack', () => {
    const input = {
      name: 'legacy',
      selected: 0,
      slides: [{ id: 'cover' }, { id: 'cover', series: 'system', chapterNumber: 7 }],
    };
    const out = migrateProjectV1ToV2(input) as {
      seriesPack: string;
      slides: Array<Record<string, unknown>>;
    };
    expect(out.seriesPack).toBe('none');
    expect(out.slides[0]).toMatchObject({
      series: 'none',
      seriesVariant: 'regular',
      seriesLabel: '',
      chapterNumber: 1,
      customWidth: 1080,
      customHeight: 1350,
    });
    // Present values win; only missing fields are filled.
    expect(out.slides[1]).toMatchObject({
      series: 'system',
      chapterNumber: 7,
      customWidth: 1080,
    });
  });

  it('does not mutate its input', () => {
    const input = { slides: [{ id: 'cover' }] };
    migrateProjectV1ToV2(input);
    expect(input.slides[0]).not.toHaveProperty('series');
    expect(input).not.toHaveProperty('seriesPack');
  });

  it('leaves non-object slides untouched so normalization can reject them', () => {
    const out = migrateProjectV1ToV2({ slides: [null, 'x', { id: 'cover' }] }) as {
      slides: unknown[];
    };
    expect(out.slides[0]).toBeNull();
    expect(out.slides[1]).toBe('x');
  });
});

describe('restoreProject on the real v1 example (engineering-cycle-carousel)', () => {
  const { raw, text } = readExample('engineering-cycle-carousel.rgstudio.json');

  it('is a genuine v1 file', () => {
    expect(raw.format).toBe(PROJECT_FORMAT);
    expect(raw.version).toBe(1);
  });

  it('imports with the migration defaults applied and identity regenerated', () => {
    const restored = restoreProject(text);
    expect(restored.slides).toHaveLength(raw.slides.length);
    restored.slides.forEach((slide, i) => {
      expect(slide.id).toBe(raw.slides[i]!.id);
      expect(slide.series).toBe('none');
      expect(slide.seriesVariant).toBe('regular');
      expect(slide.seriesLabel).toBe('');
      expect(slide.chapterNumber).toBe(1);
      expect(slide.customWidth).toBe(1080);
      expect(slide.customHeight).toBe(1350);
      // uids are regenerated: imported uids are not identities (ADR-001).
      expect(slide.uid).not.toBe(raw.slides[i]!.uid);
    });
    expect(restored.seriesPack).toBe('none');
    expect(restored.name).toBe(raw.name);
    expect(restored.selected).toBe(raw.selected);
  });

  it('round-trips: re-export as v2 re-imports with stable structure', () => {
    const first = restoreProject(text);
    const again = restoreProject(
      JSON.stringify({
        format: PROJECT_FORMAT,
        version: PROJECT_FORMAT_VERSION,
        ...first,
      }),
    );
    expect(again.slides.map((s) => s.id)).toEqual(first.slides.map((s) => s.id));
    expect(again.seriesPack).toBe(first.seriesPack);
    expect(again.name).toBe(first.name);
  });
});

describe('restoreProject on a real v2 example (series-system)', () => {
  const { raw, text } = readExample('series-system.rgstudio.json');

  it('preserves v2 pack fields exactly', () => {
    expect(raw.version).toBe(2);
    const restored = restoreProject(text);
    expect(restored.slides).toHaveLength(raw.slides.length);
    restored.slides.forEach((slide, i) => {
      expect(slide.id).toBe(raw.slides[i]!.id);
      expect(slide.series).toBe(raw.slides[i]!['series']);
      expect(slide.seriesVariant).toBe(raw.slides[i]!['seriesVariant']);
      expect(slide.chapterNumber).toBe(raw.slides[i]!['chapterNumber']);
    });
    expect(restored.seriesPack).toBe(raw.seriesPack);
  });
});

describe('version and format marker handling', () => {
  const slides = [{ id: 'cover' }];

  it('rejects an unsupported version marker', () => {
    expect(() =>
      restoreProject(JSON.stringify({ format: PROJECT_FORMAT, version: 99, slides })),
    ).toThrow(/Unsupported project version: 99/);
  });

  it('rejects a non-numeric version marker', () => {
    expect(() =>
      restoreProject(JSON.stringify({ format: PROJECT_FORMAT, version: '2', slides })),
    ).toThrow(/Unsupported project version/);
  });

  it('rejects a foreign format marker', () => {
    expect(() =>
      restoreProject(JSON.stringify({ format: 'some-other-tool', version: 2, slides })),
    ).toThrow(/format marker/);
  });

  it('accepts versionless autosave payloads (localStorage shape)', () => {
    const restored = restoreProject(JSON.stringify({ name: 'Auto', selected: 0, slides }));
    expect(restored.name).toBe('Auto');
    expect(restored.slides).toHaveLength(1);
  });

  it('accepts a matching format marker without a version', () => {
    const restored = restoreProject(JSON.stringify({ format: PROJECT_FORMAT, slides }));
    expect(restored.slides).toHaveLength(1);
  });
});

describe('restoreProject keeps the historical validation contract', () => {
  it('rejects non-project JSON, empty slide lists and >100 slides', () => {
    expect(() => restoreProject('"42"')).toThrow(/Not a valid Social Studio project/);
    expect(() => restoreProject('{"hello":"world"}')).toThrow(/Not a valid Social Studio project/);
    expect(() => restoreProject('{"slides":[]}')).toThrow(/Not a valid Social Studio project/);
    const slides = Array.from({ length: 101 }, () => ({ id: 'cover' }));
    expect(() => restoreProject(JSON.stringify({ slides }))).toThrow(
      /Not a valid Social Studio project/,
    );
  });

  it('rejects unknown layouts and clamps values like the v2 editor', () => {
    expect(() => restoreProject('{"slides":[{"id":"__evil__"}]}')).toThrow(/Unknown layout/);
    const restored = restoreProject(
      JSON.stringify({ slides: [{ id: 'cover', customWidth: 999999, customHeight: -5 }] }),
    );
    expect(restored.slides[0]!.customWidth).toBe(4096);
    expect(restored.slides[0]!.customHeight).toBe(300);
  });

  it('never leaks unknown keys into the normalized project', () => {
    const restored = restoreProject(
      JSON.stringify({ slides: [{ id: 'cover', __proto__hack: 'x', script: '<img>' }], evil: 1 }),
    );
    expect(restored).not.toHaveProperty('evil');
    expect(restored.slides[0]).not.toHaveProperty('__proto__hack');
    expect(restored.slides[0]).not.toHaveProperty('script');
  });
});

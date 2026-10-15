/**
 * Evidence tests for the P0 audit item: v1/v2 `.rgstudio.json` compatibility.
 *
 * Loads the real `studio.js` (the v2 offline editor) in a Node VM the same
 * way the existing smoke scripts do, then exercises `restoreFrom()` against
 * the committed example projects and against hostile/malformed inputs.
 */
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as vm from 'node:vm';
import { beforeAll, describe, expect, it } from 'vitest';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

let sandbox: vm.Context;

function loadStudio(): vm.Context {
  const src = readFileSync(path.join(repoRoot, 'studio.js'), 'utf8').replace(
    /start\(\)\.catch\(e=>\{console\.error\(e\);toast\('Studio initialization failed: '\+e\.message\)\}\);\s*$/,
    '',
  );
  const core = readFileSync(
    path.join(repoRoot, 'packages', 'studio-core', 'dist', 'studio-core.js'),
    'utf8',
  );
  const sand = vm.createContext({ structuredClone, console });
  vm.runInContext(core, sand);
  vm.runInContext(src, sand);
  return sand;
}

/** Runs an expression inside the studio VM and returns a plain JSON value. */
function callJson<T>(expression: string): T {
  return JSON.parse(vm.runInContext(`JSON.stringify(${expression})`, sandbox)) as T;
}

function restore(text: string): {
  name: string;
  seriesPack: string;
  selected: number;
  slides: Array<Record<string, unknown>>;
} {
  return callJson(`restoreFrom(${JSON.stringify(text)})`);
}

interface ExampleFile {
  format: string;
  version: number;
  name: string;
  slides: Array<Record<string, unknown>>;
}

beforeAll(() => {
  sandbox = loadStudio();
});

describe('project format contract', () => {
  it('exposes the expected constants from the real script', () => {
    expect(callJson('SAMPLES.length')).toBe(40);
    expect(callJson('FORMATS.length')).toBe(16);
    expect(callJson('SERIES_PACKS.length')).toBe(12);
  });
});

describe('v1 project import (examples/engineering-cycle-carousel.rgstudio.json)', () => {
  const filePath = path.join(repoRoot, 'examples', 'engineering-cycle-carousel.rgstudio.json');
  const raw = JSON.parse(readFileSync(filePath, 'utf8')) as ExampleFile;

  it('is a genuine v1 file with the v2 format marker', () => {
    expect(raw.format).toBe('runtime-garden-social-studio');
    expect(raw.version).toBe(1);
    expect(raw.slides.length).toBeGreaterThan(0);
  });

  it('imports, normalizes and regenerates slide identity', () => {
    const restored = restore(JSON.stringify(raw));
    expect(restored.slides.length).toBe(raw.slides.length);
    for (const [i, slide] of restored.slides.entries()) {
      expect(slide.id).toBe(raw.slides[i]?.id);
      expect(typeof slide.uid).toBe('string');
      expect(String(slide.uid).length).toBeGreaterThan(0);
    }
    // restoreFrom() regenerates uids: imported ids are not source identifiers.
    const changed = restored.slides.some((s, i) => s.uid !== raw.slides[i]?.uid);
    expect(changed).toBe(true);
  });

  it('keeps only whitelisted fields (no arbitrary key injection)', () => {
    const hostile = structuredClone(raw) as ExampleFile & { slides: Array<Record<string, unknown>> };
    hostile.slides[0] = { ...hostile.slides[0], id: 'cover', __proto__hack: 'x', script: '<img onerror=alert(1)>' };
    const restored = restore(JSON.stringify(hostile));
    const first = restored.slides[0]!;
    expect(first).not.toHaveProperty('__proto__hack');
    expect(first).not.toHaveProperty('script');
  });
});

describe('v2 series example projects', () => {
  const exampleFiles = readdirSync(path.join(repoRoot, 'examples')).filter((f) =>
    /^series-.*\.rgstudio\.json$/.test(f),
  );

  it('ships twelve v2 examples matching the twelve packs', () => {
    expect(exampleFiles.length).toBe(12);
    const packIds = callJson<string[]>('SERIES_PACKS.map(p=>p.id)');
    for (const id of packIds) {
      expect(exampleFiles).toContain(`series-${id}.rgstudio.json`);
    }
  });

  it('round-trips every v2 example with stable slide count and order', () => {
    for (const file of exampleFiles) {
      const raw = JSON.parse(
        readFileSync(path.join(repoRoot, 'examples', file), 'utf8'),
      ) as ExampleFile;
      expect(raw.version).toBe(2);
      const restored = restore(JSON.stringify(raw));
      expect(restored.slides.length, file).toBe(raw.slides.length);
      expect(
        restored.slides.map((s) => s.id),
        file,
      ).toEqual(raw.slides.map((s) => s.id));
      // A second serialization round trip must remain stable.
      const again = restore(
        JSON.stringify({ format: 'runtime-garden-social-studio', version: 2, ...restored }),
      );
      expect(again.slides.length, file).toBe(raw.slides.length);
      expect(again.seriesPack, file).toBe(restored.seriesPack);
    }
  });
});

describe('hostile and malformed project inputs', () => {
  it('rejects non-project JSON without slides', () => {
    expect(() => restore('{"hello":"world"}')).toThrow(/Not a valid Social Studio project/);
  });

  it('rejects an empty slide list', () => {
    expect(() => restore('{"slides":[]}')).toThrow(/Not a valid Social Studio project/);
  });

  it('rejects more than 100 slides', () => {
    const slides = Array.from({ length: 101 }, () => ({ id: 'cover' }));
    expect(() => restore(JSON.stringify({ slides }))).toThrow(/Not a valid Social Studio project/);
  });

  it('rejects unknown layout ids', () => {
    expect(() => restore(JSON.stringify({ slides: [{ id: '__evil__' }] }))).toThrow(
      /Unknown layout/,
    );
  });

  it('clamps custom dimensions into the documented range', () => {
    const restored = restore(
      JSON.stringify({
        slides: [{ id: 'cover', format: 'custom', customWidth: 999999, customHeight: -5 }],
      }),
    );
    expect(restored.slides[0]!.customWidth).toBe(4096);
    expect(restored.slides[0]!.customHeight).toBe(300);
  });

  it('caps stored string lengths', () => {
    const restored = restore(
      JSON.stringify({ slides: [{ id: 'cover', caption: 'x'.repeat(20000) }] }),
    );
    expect(String(restored.slides[0]!.caption).length).toBe(15000);
  });

  it('rejects oversized embedded images and non-image data URIs', () => {
    const oversized = restore(
      JSON.stringify({
        slides: [{ id: 'cover', image: `data:image/png;base64,${'A'.repeat(7_000_000)}` }],
      }),
    );
    expect(oversized.slides[0]!.image).toBeNull();

    const wrongType = restore(
      JSON.stringify({ slides: [{ id: 'cover', image: 'data:text/html;base64,PGgxPmhpPC9oMT4=' }] }),
    );
    expect(wrongType.slides[0]!.image).toBeNull();
  });

  it('accepts a small valid image data URI', () => {
    const png1x1 =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    const restored = restore(JSON.stringify({ slides: [{ id: 'cover', image: png1x1 }] }));
    expect(restored.slides[0]!.image).toBe(png1x1);
  });

  it('normalizes an unknown series pack reference to "none"', () => {
    const restored = restore(JSON.stringify({ slides: [{ id: 'cover' }], seriesPack: 'not-a-pack' }));
    expect(restored.seriesPack).toBe('none');
  });
});

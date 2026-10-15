import { describe, expect, it } from 'vitest';
import { clamp, FORMATS, getFormat, NEW_SLIDE, SAMPLES, SERIES_PACKS } from './registry.js';

/**
 * The registry was extracted VERBATIM from studio.js. These tests pin the
 * contracts the offline editor and the future online workspace both rely on;
 * a break here means the extraction (or a later edit) changed behavior.
 */
describe('studio-core registry', () => {
  it('keeps the v2 catalogue counts', () => {
    expect(SAMPLES.length).toBe(40);
    expect(FORMATS.length).toBe(16);
    expect(SERIES_PACKS.length).toBe(12);
  });

  it('has unique format ids and sample ids', () => {
    expect(new Set(FORMATS.map((f) => f.id)).size).toBe(16);
    expect(new Set(SAMPLES.map((s) => s.id)).size).toBe(40);
  });

  it('keeps every series slide pointing at a real layout', () => {
    const sampleIds = new Set(SAMPLES.map((s) => s.id));
    for (const pack of SERIES_PACKS) {
      for (const slideId of pack.slides) {
        expect(sampleIds.has(slideId), `${pack.id} -> ${slideId}`).toBe(true);
      }
    }
  });

  it('resolves presets and falls back to the first format for unknown ids', () => {
    expect(getFormat({ format: 'portrait' } as never)).toMatchObject({ w: 1080, h: 1350 });
    expect(getFormat({ format: 'xHeader' } as never)).toMatchObject({ w: 1500, h: 500 });
    expect(getFormat({ format: 'not-a-format' } as never)).toMatchObject({ w: 1080, h: 1350 });
  });

  it('clamps custom dimensions to the documented ranges', () => {
    expect(getFormat({ format: 'custom', customWidth: 777, customHeight: 555 } as never)).toMatchObject({ w: 777, h: 555 });
    expect(getFormat({ format: 'custom', customWidth: 99999, customHeight: 1 } as never)).toMatchObject({ w: 4096, h: 300 });
    expect(getFormat({ format: 'custom', customWidth: undefined, customHeight: undefined } as never)).toMatchObject({ w: 1080, h: 1350 });
  });

  it('creates fresh slides with identity and defaults, falling back to the first layout', () => {
    const slide = NEW_SLIDE('cover');
    expect(slide.id).toBe('cover');
    expect(slide.theme).toBe('light');
    expect(typeof slide.uid).toBe('string');
    expect(slide.uid.length).toBeGreaterThan(0);
    expect(NEW_SLIDE('not-a-layout').uid).not.toBe(slide.uid);
    expect(NEW_SLIDE('not-a-layout').id).toBe(SAMPLES[0]!.id);
  });

  it('clamps numbers inclusively', () => {
    expect(clamp(5, 1, 3)).toBe(3);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(2, 0, 10)).toBe(2);
  });
});

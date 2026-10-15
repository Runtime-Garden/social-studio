/**
 * P1 golden-image regression: deterministic visual snapshots with readable
 * tolerances, per browser engine.
 *
 * Baselines live in docs/evidence/golden/<fixture>.<engine>.png and are
 * produced by `npm run update:goldens` (chromium + firefox where available).
 * The comparison decodes the committed PNG, re-renders the fixture through
 * the real editor, and asserts per-pixel deltas stay inside the documented
 * tolerances below. A missing baseline is a hard failure, never a skip.
 *
 * Tolerance policy (calibrated on this host, per engine):
 * - channelTolerance: a per-channel difference at or below this still counts
 *   as "the same pixel" (absorbs 8-bit rounding noise).
 * - maxChangedRatio: at most this fraction of pixels may exceed
 *   channelTolerance (catches layout shifts and anything area-wide).
 * - maxChannelDelta: no pixel may differ by more than this on any channel
 *   (catches "small area, huge change" like swapped text or moved elements).
 *
 * Measured reference points:
 * - Chromium: calibration measured exactly 0 noise; a rare second glyph-AA
 *   state was observed later during a full `npm run verify` (289 px = 0.02%,
 *   max delta 57, sparse edges on the headline band) and did not reproduce on
 *   immediate re-run. Same class of phenomenon as firefox; bound 96 keeps a
 *   1.68x margin over the observation while staying far below real content
 *   changes (mutation: delta 224).
 * - Firefox: glyph edges (system fallback fonts, title bands) occasionally
 *   rasterize in a second stable AA state - observed outliers ~1,000px
 *   (0.07% of 1.08M) with max delta 68. Real content changes measure ~1.6%
 *   area / delta 224, far above the loosened firefox bound.
 * - A deliberate one-word title mutation on cover-default: 1.6% area,
 *   delta 224 (caught on both engines).
 */
import { expect, test, type Page } from '@playwright/test';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const FIXTURE_DIR = path.join(repoRoot, 'tests', 'fixtures', 'golden');
const GOLDEN_DIR = path.join(repoRoot, 'docs', 'evidence', 'golden');

interface GoldenTolerance {
  channelTolerance: number;
  maxChangedRatio: number;
  maxChannelDelta: number;
}

const DEFAULT_TOLERANCE: GoldenTolerance = {
  channelTolerance: 8,
  maxChangedRatio: 0.002,
  maxChannelDelta: 16,
};

/** Engine-specific overrides; see tolerance policy above. */
const ENGINE_TOLERANCE_OVERRIDES: Record<string, Partial<GoldenTolerance>> = {
  chromium: { maxChannelDelta: 96 },
  firefox: { maxChannelDelta: 96 },
};

function toleranceFor(engine: string): GoldenTolerance {
  return { ...DEFAULT_TOLERANCE, ...(ENGINE_TOLERANCE_OVERRIDES[engine] ?? {}) };
}

const FIXTURES = readdirSync(FIXTURE_DIR)
  .filter((file) => file.endsWith('.rgstudio.json'))
  .map((file) => ({ id: file.replace(/\.rgstudio\.json$/, ''), path: path.join(FIXTURE_DIR, file) }));

interface GoldenDiff {
  sizeMismatch?: boolean;
  liveSize?: [number, number];
  goldenSize?: [number, number];
  width?: number;
  height?: number;
  totalPixels?: number;
  changedPixels?: number;
  changedRatio?: number;
  maxChannelDelta?: number;
  meanChannelDelta?: number;
  changedBBox?: [number, number, number, number] | null;
}

async function openEditor(page: Page): Promise<void> {
  await page.goto('/index.html');
  await expect(page.locator('#templateGrid .template-card')).toHaveCount(40);
  // Let webfonts settle so glyph rasterization is stable.
  await page.evaluate(() => document.fonts?.ready ?? Promise.resolve());
}

async function renderFixture(page: Page, fixtureJson: string): Promise<void> {
  await page.evaluate((text) => {
    app = restoreFrom(text);
    refresh();
  }, fixtureJson);
  // Slides with images decode asynchronously and trigger their own re-render.
  await page.waitForFunction(() =>
    app.slides.every((s) => !s.image || Boolean(getCachedImage(s.image))),
  );
  await page.evaluate(() => refresh());
}

async function diffAgainstGolden(
  page: Page,
  goldenBase64: string,
  tolerance: GoldenTolerance,
): Promise<GoldenDiff> {
  return page.evaluate(
    async ({ b64, channelTolerance }) => {
      const canvas = document.getElementById('postCanvas') as HTMLCanvasElement;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('no 2d context on #postCanvas');
      const live = ctx.getImageData(0, 0, canvas.width, canvas.height);

      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
      if (bitmap.width !== canvas.width || bitmap.height !== canvas.height) {
        return {
          sizeMismatch: true,
          liveSize: [canvas.width, canvas.height] as [number, number],
          goldenSize: [bitmap.width, bitmap.height] as [number, number],
        };
      }

      const off = document.createElement('canvas');
      off.width = bitmap.width;
      off.height = bitmap.height;
      const octx = off.getContext('2d');
      if (!octx) throw new Error('no 2d context for golden decode');
      octx.drawImage(bitmap, 0, 0);
      const gold = octx.getImageData(0, 0, off.width, off.height);

      const a = live.data;
      const g = gold.data;
      let changedPixels = 0;
      let maxChannelDelta = 0;
      let sumDelta = 0;
      let minX = Number.POSITIVE_INFINITY;
      let minY = Number.POSITIVE_INFINITY;
      let maxX = -1;
      let maxY = -1;
      const width = canvas.width;
      for (let i = 0; i < a.length; i += 4) {
        const d = Math.max(
          Math.abs(a[i]! - g[i]!),
          Math.abs(a[i + 1]! - g[i + 1]!),
          Math.abs(a[i + 2]! - g[i + 2]!),
          Math.abs(a[i + 3]! - g[i + 3]!),
        );
        if (d > channelTolerance) {
          changedPixels += 1;
          const pixel = i / 4;
          const x = pixel % width;
          const y = (pixel - x) / width;
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
        if (d > maxChannelDelta) maxChannelDelta = d;
        sumDelta += d;
      }
      const totalPixels = a.length / 4;
      return {
        width: canvas.width,
        height: canvas.height,
        totalPixels,
        changedPixels,
        changedRatio: changedPixels / totalPixels,
        maxChannelDelta,
        meanChannelDelta: sumDelta / totalPixels,
        changedBBox: changedPixels > 0 ? [minX, minY, maxX, maxY] : null,
      };
    },
    { b64: goldenBase64, channelTolerance: tolerance.channelTolerance },
  );
}

for (const fixture of FIXTURES) {
  test(`golden: ${fixture.id} matches the committed baseline`, async ({ page }, testInfo) => {
    const engine = testInfo.project.name;
    const tolerance = toleranceFor(engine);
    const goldenPath = path.join(GOLDEN_DIR, `${fixture.id}.${engine}.png`);
    if (!existsSync(goldenPath)) {
      throw new Error(
        `Missing golden baseline ${goldenPath}. Regenerate with: npm run update:goldens`,
      );
    }

    await openEditor(page);
    await renderFixture(page, readFileSync(fixture.path, 'utf8'));
    const diff = await diffAgainstGolden(
      page,
      readFileSync(goldenPath).toString('base64'),
      tolerance,
    );

    if (diff.sizeMismatch) {
      throw new Error(
        `Canvas size drifted for ${fixture.id}: live ${JSON.stringify(diff.liveSize)} vs golden ${JSON.stringify(diff.goldenSize)}`,
      );
    }
    const outOfTolerance =
      diff.changedRatio! > tolerance.maxChangedRatio ||
      diff.maxChannelDelta! > tolerance.maxChannelDelta;
    if (outOfTolerance) {
      // Readable failure evidence: attach the live render for inspection.
      const livePng = await page.evaluate(() =>
        (document.getElementById('postCanvas') as HTMLCanvasElement).toDataURL('image/png'),
      );
      await testInfo.attach(`live-${fixture.id}.${engine}.png`, {
        body: Buffer.from(livePng.replace(/^data:image\/png;base64,/, ''), 'base64'),
        contentType: 'image/png',
      });
    }
    expect(diff.width, JSON.stringify(diff)).toBeDefined();
    expect(diff.changedRatio!, JSON.stringify(diff)).toBeLessThanOrEqual(tolerance.maxChangedRatio);
    expect(diff.maxChannelDelta!, JSON.stringify(diff)).toBeLessThanOrEqual(
      tolerance.maxChannelDelta,
    );
  });
}

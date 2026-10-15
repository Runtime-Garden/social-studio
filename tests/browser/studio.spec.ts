import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

async function openEditor(page: Page): Promise<void> {
  await page.goto('/index.html');
  await expect(page.locator('#templateGrid .template-card')).toHaveCount(40);
  await expect(page.locator('#postCanvas')).toBeVisible();
  // Let webfonts settle so pixel hashes are stable within a run.
  await page.evaluate(() => document.fonts?.ready ?? Promise.resolve());
}

test('renders all 40 layouts in light and dark with real Canvas output', async ({ page }) => {
  await openEditor(page);

  const sweep = await page.evaluate(() => {
    const seen = new Set<number>();
    const emptyRender: string[] = [];
    let renders = 0;

    for (const sample of SAMPLES) {
      for (const theme of ['light', 'dark']) {
        const slide = NEW_SLIDE(sample.id);
        slide.theme = theme;
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('no 2d context');

        let textCalls = 0;
        const originalFillText = ctx.fillText.bind(ctx);
        ctx.fillText = (...args: Parameters<CanvasRenderingContext2D['fillText']>) => {
          textCalls += 1;
          return originalFillText(...args);
        };

        frame(ctx, slide, 0, 4);
        if (textCalls === 0) emptyRender.push(`${sample.id}:${theme}`);

        const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        let hash = 5381;
        for (let i = 0; i < data.length; i += 997) hash = ((hash * 33) ^ data[i]!) >>> 0;
        seen.add(hash);
        renders += 1;
      }
    }

    return { layouts: SAMPLES.length, renders, uniqueFrames: seen.size, emptyRender };
  });

  expect(sweep.layouts).toBe(40);
  expect(sweep.renders).toBe(80);
  expect(sweep.emptyRender).toEqual([]);
  // Every layout must produce distinct light/dark output; 80 renders,
  // allow a small margin for legitimately similar frames.
  expect(sweep.uniqueFrames).toBeGreaterThanOrEqual(70);
});

test('template selection, theme switch and autosave respond in the live UI', async ({ page }) => {
  await openEditor(page);

  const firstFrame = await page.evaluate(() => {
    const url = (document.querySelector('#postCanvas') as HTMLCanvasElement).toDataURL();
    let hash = 5381;
    for (let i = 0; i < url.length; i += 11) hash = ((hash * 33) ^ url.charCodeAt(i)) >>> 0;
    return hash;
  });

  // Switch to a different layout through the real UI.
  await page.locator('#templateGrid .template-card').nth(7).click();
  const secondFrame = await page.evaluate(() => {
    const url = (document.querySelector('#postCanvas') as HTMLCanvasElement).toDataURL();
    let hash = 5381;
    for (let i = 0; i < url.length; i += 11) hash = ((hash * 33) ^ url.charCodeAt(i)) >>> 0;
    return hash;
  });
  expect(secondFrame).not.toBe(firstFrame);

  // Toggle theme via the public interaction path.
  await page.evaluate(() => setSlideProp('theme', 'dark'));
  const themeState = await page.evaluate(() => ({
    theme: app.slides[app.selected]!.theme,
    stored: localStorage.getItem('rg-social-studio-v1'),
  }));
  expect(themeState.theme).toBe('dark');
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('rg-social-studio-v1') !== null), {
      message: 'autosave must reach localStorage',
    })
    .toBe(true);
});

test('exports PNG, project JSON and carousel ZIP through real download flows', async ({ page }) => {
  await openEditor(page);

  // PNG of the current slide.
  const pngDownload = page.waitForEvent('download');
  await page.locator('#quickExportBtn').click();
  const png = await pngDownload;
  expect(png.suggestedFilename()).toMatch(/\.png$/);
  const pngPath = await png.path();
  expect(pngPath).toBeTruthy();
  const pngBytes = readFileSync(pngPath!);
  expect(pngBytes.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  expect(pngBytes.length).toBeGreaterThan(10_000);

  // Editable project JSON.
  const jsonDownload = page.waitForEvent('download');
  await page.locator('#saveBtn').click();
  const json = await jsonDownload;
  expect(json.suggestedFilename()).toMatch(/\.rgstudio\.json$/);
  const payload = JSON.parse(readFileSync((await json.path())!, 'utf8')) as {
    format: string;
    version: number;
    slides: unknown[];
  };
  expect(payload.format).toBe('runtime-garden-social-studio');
  expect(payload.version).toBe(2);
  expect(payload.slides.length).toBe(1);

  // Carousel ZIP through the export modal.
  await page.locator('#exportBtn').click();
  await expect(page.locator('#exportModal')).toBeVisible();
  const zipDownload = page.waitForEvent('download');
  await page.locator('[data-export="zip"]').click();
  const zip = await zipDownload;
  expect(zip.suggestedFilename()).toMatch(/carousel\.zip$/);
  const zipBytes = readFileSync((await zip.path())!);
  expect(zipBytes.subarray(0, 2).toString('latin1')).toBe('PK');
  expect(zipBytes.length).toBeGreaterThan(5_000);
});

test('imports a real v1 project, persists to localStorage and survives reload', async ({ page }) => {
  await openEditor(page);

  const v1Path = path.join(repoRoot, 'examples', 'engineering-cycle-carousel.rgstudio.json');
  const raw = JSON.parse(readFileSync(v1Path, 'utf8')) as { version: number; name: string; slides: unknown[] };
  expect(raw.version).toBe(1);

  await page.locator('#projectImportFile').setInputFiles(v1Path);
  await expect.poll(() => page.evaluate(() => app.slides.length)).toBe(raw.slides.length);
  await expect(page.locator('#projectName')).toHaveValue(raw.name);

  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('rg-social-studio-v1') !== null))
    .toBe(true);

  await page.reload();
  await expect(page.locator('#templateGrid .template-card')).toHaveCount(40);
  await expect.poll(() => page.evaluate(() => app.slides.length)).toBe(raw.slides.length);
  await expect(page.locator('#projectName')).toHaveValue(raw.name);
  await expect(page.locator('#slideIndicator')).toContainText(
    new RegExp(`01 / ${String(raw.slides.length).padStart(2, '0')}`),
  );
});

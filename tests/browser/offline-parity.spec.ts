/**
 * Offline-parity coverage added to close the P0 real-browser baseline:
 * 12 series packs through the real UI, all 16 size presets, image upload +
 * crop position, JPEG/WebP export signatures, multi-size bundle ZIP.
 *
 * Expected values are derived by hand from README.md (size table, series
 * table), independently of FORMATS/SERIES_PACKS in studio.js.
 */
import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

/** README size table (id -> [width, height]); 'custom' handled separately. */
const README_FORMAT_SIZES: Record<string, [number, number]> = {
  portrait: [1080, 1350],
  square: [1080, 1080],
  story: [1080, 1920],
  linkedin: [1200, 630],
  landscape: [1600, 900],
  wide: [1200, 800],
  portrait3x4: [1080, 1440],
  igLandscape: [1080, 566],
  linkedinSquare: [1200, 1200],
  linkedinPortrait: [1200, 1500],
  xSquare: [1200, 1200],
  youtube: [1280, 720],
  pinterest: [1000, 1500],
  linkedinBanner: [1584, 396],
  xHeader: [1500, 500],
};

/** README series table (pack id -> frame count). */
const README_SERIES_FRAMES: Record<string, number> = {
  field: 6,
  labbook: 6,
  system: 6,
  open: 6,
  decision: 6,
  build: 6,
  guide: 7,
  research: 6,
  community: 6,
  terminal: 6,
  observatory: 6,
  manifesto: 6,
};

async function openEditor(page: Page): Promise<void> {
  await page.goto('/index.html');
  await expect(page.locator('#templateGrid .template-card')).toHaveCount(40);
}

test('all 12 series packs apply through the UI with the README frame counts', async ({ page }) => {
  await openEditor(page);
  page.on('dialog', (dialog) => void dialog.accept());
  await page.click('button[data-left="series"]');
  await expect(page.locator('.series-card')).toHaveCount(12);

  const packOrder = await page.evaluate(() => SERIES_PACKS.map((p) => p.id));

  for (const [index, id] of packOrder.entries()) {
    // Applying a pack switches the left panel to Slides; reopen Series each time.
    await page.click('button[data-left="series"]');
    await page.locator('.series-card').nth(index).click();
    await expect
      .poll(() => page.evaluate(() => app.slides.length), { message: `pack ${id} slide count` })
      .toBe(README_SERIES_FRAMES[id]);
    const state = await page.evaluate(() => ({
      series: app.slides.map((s) => s.series),
      theme: app.slides.map((s) => s.theme),
      indicator: document.getElementById('slideIndicator')?.textContent ?? '',
    }));
    expect(state.series, id).toEqual(Array(README_SERIES_FRAMES[id]).fill(id));
    expect(new Set(state.theme).size, id).toBe(1);
    expect(state.indicator).toContain(`/ ${String(README_SERIES_FRAMES[id]).padStart(2, '0')}`);
  }
});

test('every size preset renders at its exact README dimensions in a real browser', async ({
  page,
}) => {
  await openEditor(page);
  await expect(page.locator('#quickFormat option')).toHaveCount(16);

  const results = await page.evaluate(
    (ids) =>
      ids.map((id) => {
        const slide = NEW_SLIDE('cover');
        slide.format = id;
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('no 2d context');
        frame(ctx, slide, 0, 1);
        return { id, w: canvas.width, h: canvas.height };
      }),
    Object.keys(README_FORMAT_SIZES),
  );
  for (const { id, w, h } of results) {
    expect([id, w, h]).toEqual([id, ...README_FORMAT_SIZES[id]!]);
  }

  // Custom dimensions are user-clamped to 400–4096 × 300–4096.
  const custom = await page.evaluate(() => {
    const slide = NEW_SLIDE('cover');
    slide.format = 'custom';
    slide.customWidth = 777;
    slide.customHeight = 555;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('no 2d context');
    frame(ctx, slide, 0, 1);
    return { w: canvas.width, h: canvas.height };
  });
  expect(custom).toEqual({ w: 777, h: 555 });
});

test('image upload flows into the Visual Case Study layout and crop position changes output', async ({
  page,
}) => {
  await openEditor(page);

  // Build a gradient PNG in-page so crop position visibly changes pixels.
  const gradient = await page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 60;
    c.height = 200;
    const ctx = c.getContext('2d')!;
    const grad = ctx.createLinearGradient(0, 0, 0, 200);
    grad.addColorStop(0, '#286A47');
    grad.addColorStop(1, '#AD7742');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 60, 200);
    return c.toDataURL('image/png');
  });
  const buffer = Buffer.from(gradient.split(',')[1]!, 'base64');

  await expect(page.locator('#assetGallery .asset-item')).toHaveCount(0);
  await page.locator('#imageUpload').setInputFiles({
    name: 'fixture-gradient.png',
    mimeType: 'image/png',
    buffer,
  });

  await expect
    .poll(() => page.evaluate(() => app.slides[app.selected]?.id))
    .toBe('image');
  await expect
    .poll(() => page.evaluate(() => typeof app.slides[app.selected]?.image))
    .toBe('string');
  await expect(page.locator('#assetGallery .asset-item')).toHaveCount(1);

  const canvasHash = () =>
    page.evaluate(() => {
      const url = (document.querySelector('#postCanvas') as HTMLCanvasElement).toDataURL();
      let hash = 5381;
      for (let i = 0; i < url.length; i += 13) hash = ((hash * 33) ^ url.charCodeAt(i)) >>> 0;
      return hash;
    });

  const atTop = await canvasHash();
  // Crop controls live in the Style inspector tab.
  await page.click('button[data-inspect="style"]');
  const slider = page.locator('#styleInspector input[type="range"][data-prop="imagePosition"]');
  await slider.fill('90');
  await expect.poll(() => page.evaluate(() => app.slides[app.selected]?.imagePosition)).toBe(90);
  const atBottom = await canvasHash();
  expect(atBottom).not.toBe(atTop);

  // Remove action lives in the left Assets panel.
  await page.click('button[data-left="assets"]');
  await page.locator('#removeImageBtn').click();
  await expect.poll(() => page.evaluate(() => app.slides[app.selected]?.image)).toBeNull();
  await expect(page.locator('#assetGallery .asset-item')).toHaveCount(0);
});

test('JPEG and WebP exports download with correct file signatures', async ({ page }) => {
  await openEditor(page);
  await page.locator('#exportBtn').click();
  await expect(page.locator('#exportModal')).toBeVisible();

  const jpegDownload = page.waitForEvent('download');
  await page.locator('[data-export="jpeg"]').click();
  const jpeg = readFileSync((await (await jpegDownload).path())!);
  expect(jpeg.subarray(0, 3)).toEqual(Buffer.from([0xff, 0xd8, 0xff]));
  expect(jpeg.length).toBeGreaterThan(5_000);

  // Exporting closes the modal; reopen it for the WebP export.
  await page.locator('#exportBtn').click();
  await expect(page.locator('#exportModal')).toBeVisible();
  const webpDownload = page.waitForEvent('download');
  await page.locator('[data-export="webp"]').click();
  const webp = readFileSync((await (await webpDownload).path())!);
  expect(webp.subarray(0, 4).toString('latin1')).toBe('RIFF');
  expect(webp.subarray(8, 12).toString('latin1')).toBe('WEBP');
});

test('multi-size bundle export contains one folder per selected size', async ({ page }) => {
  await openEditor(page);
  await page.locator('#exportBtn').click();
  await expect(page.locator('#exportModal')).toBeVisible();

  await page.selectOption('#exportFormats', ['portrait', 'square']);
  const bundleDownload = page.waitForEvent('download');
  await page.locator('[data-export="bundle"]').click();
  const zip = readFileSync((await (await bundleDownload).path())!);
  const names = zip.toString('latin1');
  expect(names).toContain('portrait/');
  expect(names).toContain('square/');
  expect(names).toContain('README.txt');
});

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Decodes width/height straight out of the PNG IHDR chunk. */
function pngDimensions(bytes: Buffer): { width: number; height: number } {
  expect(bytes.subarray(0, 8)).toEqual(PNG_SIGNATURE);
  expect(bytes.subarray(12, 16).toString('latin1')).toBe('IHDR');
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

test('undo and redo restore the headline through keyboard shortcuts and buttons', async ({
  page,
}) => {
  await openEditor(page);
  const original = (await page.evaluate(() => app.slides[0]!.title)) as string;
  const edited = 'Undo/redo verification headline';

  // Edit through the real content inspector; blurring commits one history entry.
  await page.locator('#fld-title').fill(edited);
  await page.locator('#workTitle').click();
  await expect.poll(() => page.evaluate(() => app.slides[0]!.title)).toBe(edited);
  await expect(page.locator('#undoBtn')).toBeEnabled();

  // Ctrl+Z on a non-editable target runs the keyboard shortcut path.
  await page.locator('body').press('Control+z');
  await expect.poll(() => page.evaluate(() => app.slides[0]!.title)).toBe(original);

  // Redo via the toolbar button, undo via the toolbar button again.
  await page.locator('#redoBtn').click();
  await expect.poll(() => page.evaluate(() => app.slides[0]!.title)).toBe(edited);
  await page.locator('#undoBtn').click();
  await expect.poll(() => page.evaluate(() => app.slides[0]!.title)).toBe(original);

  // Ctrl+Y redo path.
  await page.locator('body').press('Control+y');
  await expect.poll(() => page.evaluate(() => app.slides[0]!.title)).toBe(edited);
});

test('maximum-length text renders without errors, warns in preflight and exports', async ({
  page,
}) => {
  await openEditor(page);
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(String(error)));

  const longTitle = 'Scaling engineering systems under maximum load: '.repeat(6).slice(0, 260);
  const longSubtitle =
    'A documented walkthrough of queue backpressure, retry budgets and observability. '.repeat(9).slice(0, 600);

  await page.locator('#fld-title').fill(longTitle);
  await page.locator('#fld-subtitle').fill(longSubtitle);
  await page.locator('#workTitle').click();

  await expect
    .poll(() => page.evaluate(() => String(app.slides[0]!.title).length))
    .toBe(260);
  await expect
    .poll(() => page.evaluate(() => String(app.slides[0]!.subtitle).length))
    .toBe(600);

  // The publish preflight flags the over-length headline for manual review.
  await page.click('button[data-inspect="publish"]');
  await expect(page.locator('#publishInspector .preflight')).toContainText(
    'Very long headline',
  );

  // The canvas still renders and exports at the exact portrait dimensions.
  const download = page.waitForEvent('download');
  await page.locator('#quickExportBtn').click();
  const bytes = readFileSync((await (await download).path())!);
  expect(pngDimensions(bytes)).toEqual({ width: 1080, height: 1350 });
  expect(bytes.length).toBeGreaterThan(10_000);
  expect(pageErrors).toEqual([]);
});

test('custom canvas dimensions export a PNG at exactly those pixel dimensions', async ({
  page,
}) => {
  await openEditor(page);

  // Custom size controls live in the Style inspector.
  await page.click('button[data-inspect="style"]');
  await page.selectOption('#fld-format', 'custom');
  await expect(page.locator('#customDims')).toBeVisible();
  await page.locator('#fld-customWidth').fill('1200');
  await page.locator('#fld-customHeight').fill('630');
  await page.locator('#workTitle').click();

  await expect
    .poll(() =>
      page.evaluate(() => ({
        format: app.slides[0]!.format,
        width: app.slides[0]!.customWidth,
        height: app.slides[0]!.customHeight,
      })),
    )
    .toEqual({ format: 'custom', width: 1200, height: 630 });

  const download = page.waitForEvent('download');
  await page.locator('#quickExportBtn').click();
  const file = await download;
  const bytes = readFileSync((await file.path())!);
  expect(pngDimensions(bytes)).toEqual({ width: 1200, height: 630 });
  expect(file.suggestedFilename()).toMatch(/-01-cover\.png$/);
});

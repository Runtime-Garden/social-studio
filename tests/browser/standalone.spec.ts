import { expect, test } from '@playwright/test';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const standalone = path.join(repoRoot, 'Runtime_Garden_Social_Studio_v2_Standalone.html');

test('standalone editor renders with every network request blocked (offline invariant)', async ({
  browser,
}) => {
  expect(
    existsSync(standalone),
    'Run `npm run build:standalone` first — the offline artifact is missing.',
  ).toBe(true);

  const context = await browser.newContext();
  // Hard offline: abort every request that is not the local file itself.
  await context.route('**/*', (route) => {
    const url = route.request().url();
    if (url.startsWith('file://')) return route.continue();
    return route.abort();
  });

  const page = await context.newPage();
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(String(error)));

  await page.goto(pathToFileURL(standalone).href);
  await expect(page.locator('#templateGrid .template-card')).toHaveCount(40);
  await expect(page.locator('#postCanvas')).toBeVisible();

  // Sample the full-width sweep on eight representative layouts.
  const sweep = await page.evaluate(() => {
    const sampleIds = SAMPLES.slice(0, 8).map((s) => s.id);
    const emptyRender: string[] = [];
    for (const id of sampleIds) {
      const slide = NEW_SLIDE(id);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('no 2d context');
      let textCalls = 0;
      const original = ctx.fillText.bind(ctx);
      ctx.fillText = (...args: Parameters<CanvasRenderingContext2D['fillText']>) => {
        textCalls += 1;
        return original(...args);
      };
      frame(ctx, slide, 0, sampleIds.length);
      if (textCalls === 0) emptyRender.push(id);
    }
    return { sampleIds, emptyRender };
  });

  expect(sweep.sampleIds.length).toBe(8);
  expect(sweep.emptyRender).toEqual([]);
  expect(pageErrors).toEqual([]);

  await page.screenshot({ path: 'test-results/standalone-offline.png' });
  await context.close();
});

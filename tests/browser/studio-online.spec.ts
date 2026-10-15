/**
 * P2 slice 3b: online Studio editor browser coverage (blueprint line 803).
 *
 * The spec starts its own web server (temp file DB, ephemeral port) and
 * drives the real login page and editor page in Chromium: authenticated
 * entry, create/edit/save/reload, immutable history with restore-as-new-
 * revision, explicit online ownership (no localStorage), export downloads
 * and two-tab conflict handling. The offline editor pages are untouched.
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { startServer, type StartedServer } from '../../apps/web/src/server.js';

const ADMIN = { username: 'owner', password: 'online-spec-passphrase' };
const COVER_TITLE = 'Where ideas grow into systems.';
const EDITED_TITLE = 'Online edits land here.';

let server: StartedServer;
let base: string;
let tempDir: string;

test.beforeAll(async () => {
  tempDir = mkdtempSync(path.join(tmpdir(), 'rgstudio-online-spec-'));
  server = await startServer({
    dbPath: path.join(tempDir, 'studio.sqlite'),
    port: 0,
    host: '127.0.0.1',
    adminBootstrap: { ...ADMIN },
  });
  base = server.url;
});

test.afterAll(async () => {
  await server?.close();
  if (tempDir) rmSync(tempDir, { recursive: true, force: true });
});

async function loginUi(page: Page): Promise<void> {
  await page.goto(`${base}/login`);
  await page.fill('#username', ADMIN.username);
  await page.fill('#password', ADMIN.password);
  await page.click('#loginBtn');
  await page.waitForURL(`${base}/studio/`);
}

async function createAndOpenProject(page: Page): Promise<void> {
  await page.click('#newProjectBtn');
  await expect(page.locator('#saveState')).toHaveText('Saved revision 1');
  await expect(page.locator('#studioCanvas')).toBeVisible();
}

async function canvasHasInk(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const canvas = document.querySelector('#studioCanvas') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d')!;
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let colored = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] !== data[i + 1] || data[i + 1] !== data[i + 2]) colored++;
    }
    return colored > 5000;
  });
}

test('signs in through the real login page and rejects wrong credentials', async ({ page }) => {
  await page.goto(`${base}/studio/`);
  await page.waitForURL(`${base}/login`);
  await expect(page.locator('h1')).toHaveText('Social Studio');

  await page.fill('#username', ADMIN.username);
  await page.fill('#password', 'definitely-wrong');
  await page.click('#loginBtn');
  await expect(page.locator('#loginError')).toContainText("didn't match");

  await page.fill('#password', ADMIN.password);
  await page.click('#loginBtn');
  await page.waitForURL(`${base}/studio/`);
  await expect(page.locator('#projectList')).toBeVisible();
});

test('creates, edits, saves, reloads, reviews history and restores a revision', async ({
  page,
}) => {
  await loginUi(page);
  await createAndOpenProject(page);

  await expect(page.locator('[data-key="title"]')).toHaveValue(COVER_TITLE);
  expect(await canvasHasInk(page)).toBe(true);

  await page.fill('[data-key="title"]', EDITED_TITLE);
  await expect(page.locator('#saveState')).toHaveText('Unsaved changes');
  await page.click('#saveBtn');
  await expect(page.locator('#saveState')).toHaveText('Saved revision 2');

  // Online projects are explicit server revisions; the browser stores nothing.
  expect(await page.evaluate(() => window.localStorage.length)).toBe(0);

  await page.reload();
  await page.waitForURL(`${base}/studio/`);
  await expect(page.locator('#projectList li')).toHaveCount(1);
  await page.click('#projectList li');
  await expect(page.locator('#saveState')).toHaveText('Saved revision 2');
  await expect(page.locator('[data-key="title"]')).toHaveValue(EDITED_TITLE);
  expect(await canvasHasInk(page)).toBe(true);

  await page.click('#historyTab');
  await expect(page.locator('#revisionList li')).toHaveCount(2);
  await expect(page.locator('#revisionList li').first()).toContainText('Revision 2');
  await expect(page.locator('#revisionList li').first()).toContainText('current');
  await page
    .locator('#revisionList li', { hasText: 'Revision 1' })
    .getByRole('button', { name: 'Restore as new revision' })
    .click();
  await expect(page.locator('#saveState')).toHaveText('Saved revision 3');

  await page.click('#editTab');
  await expect(page.locator('[data-key="title"]')).toHaveValue(COVER_TITLE);
});

test('exports the current revision as a .rgstudio.json download', async ({ page }) => {
  await loginUi(page);
  await createAndOpenProject(page);

  const download = await Promise.all([
    page.waitForEvent('download'),
    page.click('#exportBtn'),
  ]).then(([dl]) => dl);
  expect(download.suggestedFilename()).toMatch(/\.rgstudio\.json$/);
  const content = await download.createReadStream().then(
    (stream) =>
      new Promise<string>((resolve, reject) => {
        let text = '';
        stream.on('data', (chunk) => (text += chunk));
        stream.on('end', () => resolve(text));
        stream.on('error', reject);
      }),
  );
  const parsed = JSON.parse(content) as { version: number; name: string };
  expect(parsed.version).toBe(2);
  expect(parsed.name).toBe('Untitled project');
});

test('surfaces a stale-writer conflict with a reload action that reconciles', async ({
  browser,
}) => {
  const context = await browser.newContext();
  const first = await context.newPage();
  const second = await context.newPage();

  await loginUi(first);
  await createAndOpenProject(first);

  await second.goto(`${base}/studio/`);
  await second.click('#projectList li');
  await expect(second.locator('#saveState')).toHaveText('Saved revision 1');

  await first.fill('[data-key="title"]', 'Edited in the first tab.');
  await first.click('#saveBtn');
  await expect(first.locator('#saveState')).toHaveText('Saved revision 2');

  await second.fill('[data-key="title"]', 'Edited in the second tab.');
  await second.click('#saveBtn');
  await expect(second.locator('#conflictBanner')).toBeVisible();
  await expect(second.locator('#conflictBanner')).toContainText('revision 2');

  await second.click('#reloadHeadBtn');
  await expect(second.locator('#conflictBanner')).toBeHidden();
  await expect(second.locator('#saveState')).toHaveText('Saved revision 2');
  await expect(second.locator('[data-key="title"]')).toHaveValue('Edited in the first tab.');

  await context.close();
});

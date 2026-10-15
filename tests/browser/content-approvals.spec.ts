/**
 * P2 slice 4: Content Inbox + approval browser journeys (blueprint 804).
 *
 * Own server (temp file DB, ephemeral port) driving the real /content/
 * page in Chromium: inbox with citation links, offline-safe approval of
 * a fixture (every non-local request aborted), edit-after-approval
 * revocation, and the pause control. The API contract lives in
 * tests/integration/web-content.test.ts and web-ops.test.ts.
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import {
  addEvidenceClaim,
  createCluster,
  createContentItem,
  createSource,
  createSourceItem,
  createVariant,
  linkItemToCluster,
} from '../../packages/storage/src/repos/content.js';
import { startServer, type StartedServer } from '../../apps/web/src/server.js';

const ADMIN = { username: 'owner', password: 'content-spec-passphrase' };

let server: StartedServer;
let base: string;
let tempDir: string;

function seedStory(title: string): { contentId: string; variantId: string } {
  const slug = title.toLowerCase();
  const source = createSource(server.db, {
    type: 'manual',
    url: `https://example.com/${slug}`,
    label: title,
  });
  const item = createSourceItem(server.db, {
    sourceId: source.id,
    guid: `guid-${slug}`,
    canonicalUrl: `https://example.com/posts/${slug}`,
    title: `${title} post`,
    summary: `${title} summary`,
  });
  const cluster = createCluster(server.db, { title: `${title} cluster` });
  linkItemToCluster(server.db, cluster.id, item.id, 'member');
  const content = createContentItem(server.db, {
    kind: 'manual',
    title: `${title} story`,
    clusterId: cluster.id,
    sourceItemId: item.id,
  });
  addEvidenceClaim(server.db, {
    contentItemId: content.id,
    claimText: `${title} claim`,
    evidenceUrl: `https://example.com/posts/${slug}#proof`,
    verdict: 'verified',
  });
  const variant = createVariant(server.db, {
    contentItemId: content.id,
    platform: 'linkedin',
    text: `Hello from ${title}`,
  });
  return { contentId: content.id, variantId: variant.id };
}

test.beforeAll(async () => {
  tempDir = mkdtempSync(path.join(tmpdir(), 'rgstudio-content-spec-'));
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
  await page.goto(`${base}/content/`);
  await page.waitForURL((url) => url.pathname === '/login');
  await page.fill('#username', ADMIN.username);
  await page.fill('#password', ADMIN.password);
  await page.click('#loginBtn');
  await page.waitForURL(`${base}/content/`);
}

test('gates /content/ behind a session and canonicalizes /content', async ({ page }) => {
  await page.goto(`${base}/content`);
  await page.waitForURL((url) => url.pathname === '/login');
  await page.fill('#username', ADMIN.username);
  await page.fill('#password', ADMIN.password);
  await page.click('#loginBtn');
  await page.waitForURL(`${base}/content/`);
  await expect(page.locator('#inboxList')).toBeVisible();
});

test('shows the inbox with citation links for one story', async ({ page }) => {
  seedStory('Juniper');
  await loginUi(page);
  await expect(page.locator('#inboxList li')).toContainText('Juniper story');
  await page.click('#inboxList li');
  await expect(page.locator('#storyTitle')).toHaveText('Juniper story');
  const hrefs = await page.locator('#citationList li a').evaluateAll((links) =>
    links.map((a) => (a as HTMLAnchorElement).href),
  );
  expect(hrefs).toContain('https://example.com/posts/juniper');
  expect(hrefs).toContain('https://example.com/posts/juniper#proof');
});

test('approves a fixture with every non-local request aborted', async ({ page }) => {
  seedStory('Quarry');
  await page.route('**/*', async (route) => {
    if (route.request().url().startsWith(base)) await route.continue();
    else await route.abort();
  });
  await loginUi(page);
  await page.click('#inboxList li');
  await page.click('#approveBtn');
  await expect(page.locator('#approvalState')).toContainText('Approved snapshot');
});

test('editing variant text after approval revokes the snapshot', async ({ page }) => {
  seedStory('Lumen');
  await loginUi(page);
  await page.click('#inboxList li');
  await page.click('#approveBtn');
  await expect(page.locator('#approvalState')).toContainText('Approved snapshot');
  await page.fill('#variantText', 'Hello from Lumen, rewritten');
  await page.click('#saveTextBtn');
  await expect(page.locator('#approvalState')).toContainText('stale');
});

test('pause control reports publishing paused', async ({ page }) => {
  await loginUi(page);
  await page.click('#pauseBtn');
  await expect(page.locator('#opsState')).toContainText('Publishing paused');
});

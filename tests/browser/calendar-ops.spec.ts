/**
 * P2 remainder: calendar + ops viewers browser journeys (blueprint 805, 808).
 *
 * Own server (temp file DB, ephemeral port) driving the real /calendar/
 * page in Chromium: gating/canonicalization, scheduled entries on their
 * UTC day with local times, per-channel status turning stale after an
 * edit, real audit/jobs tables, and the pause control. Each journey seeds
 * its own date so the shared server never mixes selections.
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import {
  createContentItem,
  createVariant,
  setVariantSchedule,
} from '../../packages/storage/src/repos/content.js';
import { createJob, createPublication } from '../../packages/storage/src/repos/scheduling.js';
import { startServer, type StartedServer } from '../../apps/web/src/server.js';

const ADMIN = { username: 'owner', password: 'calendar-spec-passphrase' };

let server: StartedServer;
let base: string;
let tempDir: string;

function seedScheduled(date: string, title: string): string {
  const content = createContentItem(server.db, { kind: 'manual', title });
  const variant = createVariant(server.db, {
    contentItemId: content.id,
    platform: 'linkedin',
    text: `Hello for ${title}`,
  });
  setVariantSchedule(server.db, variant.id, `${date}T15:00:00.000Z`);
  createPublication(server.db, {
    variantId: variant.id,
    variantRevision: variant.revision,
    channelId: 'chan-1',
    localKey: `local-${date}`,
  });
  createJob(server.db, {
    kind: 'buffer_submit',
    correlationId: `corr-${date}`,
    runAt: `${date}T15:00:00.000Z`,
    idempotencyKey: `idem-${date}`,
  });
  return variant.id;
}

test.beforeAll(async () => {
  tempDir = mkdtempSync(path.join(tmpdir(), 'rgstudio-calendar-spec-'));
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

async function loginUi(page: Page, month = '2026-11'): Promise<void> {
  await page.goto(`${base}/calendar/?month=${month}`);
  await page.waitForURL((url) => url.pathname === '/login');
  await page.fill('#username', ADMIN.username);
  await page.fill('#password', ADMIN.password);
  await page.click('#loginBtn');
  await page.waitForURL((url) => url.pathname === '/calendar/');
}

test('gates /calendar/ behind a session and canonicalizes /calendar', async ({ page }) => {
  await page.goto(`${base}/calendar`);
  await page.waitForURL((url) => url.pathname === '/login');
  await page.fill('#username', ADMIN.username);
  await page.fill('#password', ADMIN.password);
  await page.click('#loginBtn');
  await page.waitForURL((url) => url.pathname === '/calendar/');
  await expect(page.locator('#dayGrid')).toBeVisible();
});

test('shows the scheduled entry on its UTC day with a local time', async ({ page }) => {
  seedScheduled('2026-11-05', 'Dated story');
  await loginUi(page);
  const day = page.locator('.day[data-date="2026-11-05"]');
  await expect(day).toBeVisible();
  await expect(day).toContainText('Hello for Dated story');
  await expect(day).toContainText('2026-11-05T15:00:00.000Z');
});

test('channel status turns stale after a variant edit', async ({ page }) => {
  const variantId = seedScheduled('2026-11-06', 'Stale story');
  await loginUi(page);
  await page.locator('.day[data-date="2026-11-06"] button').click();
  await expect(page.locator('#channelStatus li')).toContainText('no approval');
  await page.evaluate(async (id: string) => {
    const me = (await (await fetch('/api/v1/auth/me')).json()) as { csrfToken: string };
    const headers = { 'content-type': 'application/json', 'x-csrf-token': me.csrfToken };
    await fetch(`/api/v1/content/variants/${id}/approvals`, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({ decision: 'approved', channelId: 'chan-1' }),
    });
  }, variantId);
  await page.reload();
  await page.waitForURL((url) => url.pathname === '/calendar/');
  await page.locator('.day[data-date="2026-11-06"] button').click();
  await expect(page.locator('#channelStatus li')).toContainText('approval valid');
  await page.evaluate(async (id: string) => {
    const me = (await (await fetch('/api/v1/auth/me')).json()) as { csrfToken: string };
    const headers = { 'content-type': 'application/json', 'x-csrf-token': me.csrfToken };
    await fetch(`/api/v1/content/variants/${id}/text`, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({ text: 'Rewritten after scheduling' }),
    });
  }, variantId);
  await page.reload();
  await page.waitForURL((url) => url.pathname === '/calendar/');
  await page.locator('.day[data-date="2026-11-06"] button').click();
  await expect(page.locator('#channelStatus li')).toContainText('stale');
});

test('audit and jobs tables render real rows and pause works', async ({ page }) => {
  seedScheduled('2026-11-07', 'Ops story');
  await loginUi(page);
  await expect(page.locator('#jobsTable tr').first()).toContainText('buffer_submit');
  await expect(page.locator('#jobsEmpty')).toBeHidden();
  await expect(page.locator('#auditTable tr').first()).toContainText('auth.login_succeeded');
  await page.click('#pauseBtn');
  await expect(page.locator('#opsState')).toContainText('Publishing paused');
});

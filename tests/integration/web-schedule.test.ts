/**
 * P2 remainder: schedule/calendar + publication-status read API over real
 * HTTP (blueprint line 805).
 *
 * Placeholders from real DB state only: calendar groups scheduled variants
 * by day with a timezone fallback, and per-channel status carries live
 * approval validity. Reads require a session; no mutations here.
 */
import { afterEach, describe, expect, it } from 'vitest';
import type { StartedServer } from '../../apps/web/src/server.js';
import { approvalHash } from '../../packages/domain/src/approval.js';
import {
  createContentItem,
  createVariant,
  currentVariantSubject,
  saveApproval,
  setVariantSchedule,
  updateVariantText,
} from '../../packages/storage/src/repos/content.js';
import { createPublication } from '../../packages/storage/src/repos/scheduling.js';
import { createUser } from '../../packages/storage/src/repos/users.js';
import {
  cleanupTempDirs,
  getJson,
  loginOk,
  startTestServer,
  type ErrorBody,
} from './helpers.js';

let active: StartedServer | null = null;

async function started(): Promise<StartedServer> {
  active = await startTestServer();
  return active;
}

afterEach(async () => {
  if (active) {
    await active.close();
    active = null;
  }
  cleanupTempDirs();
});

function seedScheduled(server: StartedServer): string {
  const content = createContentItem(server.db, { kind: 'manual', title: 'Dated story' });
  const variant = createVariant(server.db, {
    contentItemId: content.id,
    platform: 'linkedin',
    text: 'Dated hello',
  });
  setVariantSchedule(server.db, variant.id, '2026-11-05T15:00:00.000Z');
  return variant.id;
}

describe('schedule calendar API', () => {
  it('groups scheduled entries by UTC day with local rendering', async () => {
    const server = await started();
    seedScheduled(server);
    const login = await loginOk(server);

    const body = (await (
      await getJson(
        server,
        '/api/v1/schedule/calendar?from=2026-11-01&to=2026-11-30&tz=America/New_York',
        { cookie: login.cookie },
      )
    ).json()) as {
      days: Array<{ date: string; entries: Array<{ scheduledAtUtc: string; scheduledAtLocal: string }> }>;
      tz: string;
    };
    expect(body.tz).toBe('America/New_York');
    const day = body.days.find((d) => d.date === '2026-11-05');
    expect(day?.entries).toHaveLength(1);
    expect(day?.entries[0]?.scheduledAtUtc).toBe('2026-11-05T15:00:00.000Z');
    expect(typeof day?.entries[0]?.scheduledAtLocal).toBe('string');
  });

  it('falls back to UTC on unknown timezones and rejects bad dates', async () => {
    const server = await started();
    seedScheduled(server);
    const login = await loginOk(server);

    const fallback = await getJson(server, '/api/v1/schedule/calendar?from=2026-11-01&to=2026-11-30&tz=Nope/Zone', {
      cookie: login.cookie,
    });
    expect(fallback.status).toBe(200);
    expect(((await fallback.json()) as { tz: string }).tz).toBe('UTC');

    const bad = await getJson(server, '/api/v1/schedule/calendar?from=not-a-date&to=2026-11-30', {
      cookie: login.cookie,
    });
    expect(bad.status).toBe(400);
    expect(((await bad.json()) as ErrorBody).error.code).toBe('invalid_request');
  });

  it('rejects ranges longer than three months to protect the event loop', async () => {
    const server = await started();
    seedScheduled(server);
    const login = await loginOk(server);

    const huge = await getJson(
      server,
      '/api/v1/schedule/calendar?from=0001-01-01&to=9999-12-31',
      { cookie: login.cookie },
    );
    expect(huge.status).toBe(400);
    expect(((await huge.json()) as ErrorBody).error.code).toBe('invalid_request');
  });

  it('requires a session for schedule reads', async () => {
    const server = await started();
    const anonymous = await getJson(server, '/api/v1/schedule/calendar?from=2026-11-01&to=2026-11-30');
    expect(anonymous.status).toBe(401);
    expect(((await anonymous.json()) as ErrorBody).error.code).toBe('unauthorized');
  });
});

describe('publication status API', () => {
  it('reflects stale_approval after a variant edit', async () => {
    const server = await started();
    const user = createUser(server.db, { username: 'approver', passwordHash: 'scrypt$demo' });
    const content = createContentItem(server.db, { kind: 'manual', title: 'Story one' });
    const variant = createVariant(server.db, {
      contentItemId: content.id,
      platform: 'linkedin',
      text: 'Hello',
    });
    const subject = currentVariantSubject(server.db, variant.id, 'chan-1')!;
    saveApproval(server.db, {
      variantId: variant.id,
      variantRevision: variant.revision,
      channelId: 'chan-1',
      approvalHash: approvalHash(subject),
      approverUserId: user.id,
      decision: 'approved',
    });
    createPublication(server.db, {
      variantId: variant.id,
      variantRevision: variant.revision,
      channelId: 'chan-1',
      localKey: 'local-1',
    });
    const login = await loginOk(server);

    const fresh = (await (
      await getJson(server, `/api/v1/schedule/publications?variantId=${variant.id}`, {
        cookie: login.cookie,
      })
    ).json()) as { channels: Array<{ approvalValid: boolean; variantStatus: string }> };
    expect(fresh.channels[0]?.approvalValid).toBe(true);

    updateVariantText(server.db, variant.id, 'Hello again');
    const stale = (await (
      await getJson(server, `/api/v1/schedule/publications?variantId=${variant.id}`, {
        cookie: login.cookie,
      })
    ).json()) as { channels: Array<{ approvalValid: boolean; variantStatus: string }> };
    expect(stale.channels[0]?.approvalValid).toBe(false);
    expect(stale.channels[0]?.variantStatus).toBe('draft');
  });
});

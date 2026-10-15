/**
 * P2 slice 4: content inbox + transition API over real HTTP (blueprint 804).
 *
 * Pins the read contract the Content Inbox UI depends on: paginated
 * listing, single-item fetch with citation joins (sources + evidence
 * claims), and guarded editorial transitions with audit trail.
 */
import { afterEach, describe, expect, it } from 'vitest';
import type { StartedServer } from '../../apps/web/src/server.js';
import { listAuditEvents } from '../../packages/storage/src/repos/audit.js';
import {
  addEvidenceClaim,
  createCluster,
  createContentItem,
  createSource,
  createSourceItem,
  linkItemToCluster,
} from '../../packages/storage/src/repos/content.js';
import {
  cleanupTempDirs,
  getJson,
  loginOk,
  postJson,
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

function seedInbox(server: StartedServer, titles: string[]): string[] {
  return titles.map((title) => {
    const source = createSource(server.db, {
      type: 'manual',
      url: `https://example.com/${title.toLowerCase()}`,
      label: title,
    });
    const item = createSourceItem(server.db, {
      sourceId: source.id,
      guid: `guid-${title}`,
      canonicalUrl: `https://example.com/posts/${title.toLowerCase()}`,
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
      evidenceUrl: `https://example.com/posts/${title.toLowerCase()}#proof`,
      verdict: 'verified',
    });
    return content.id;
  });
}

describe('content inbox API', () => {
  it('lists seeded inbox items with pagination and totals', async () => {
    const server = await started();
    seedInbox(server, ['Alpha', 'Bravo', 'Charlie']);
    const login = await loginOk(server);

    const page = (await (
      await getJson(server, '/api/v1/content/items?limit=2', { cookie: login.cookie })
    ).json()) as { items: Array<{ title: string }>; total: number; limit: number };
    expect(page.items).toHaveLength(2);
    expect(page.total).toBe(3);
    expect(page.limit).toBe(2);
  });

  it('fetches one item with sources and claims carrying citation URLs', async () => {
    const server = await started();
    const [id] = seedInbox(server, ['Alpha']);
    const login = await loginOk(server);

    const body = (await (
      await getJson(server, `/api/v1/content/items/${id}`, { cookie: login.cookie })
    ).json()) as {
      item: { title: string };
      sources: Array<{ canonicalUrl: string }>;
      claims: Array<{ evidenceUrl: string; verdict: string }>;
    };
    expect(body.item.title).toBe('Alpha story');
    expect(body.sources.map((s) => s.canonicalUrl)).toContain('https://example.com/posts/alpha');
    expect(body.claims[0]?.evidenceUrl).toBe('https://example.com/posts/alpha#proof');
    expect(body.claims[0]?.verdict).toBe('verified');
  });

  it('requires a session for reads', async () => {
    const server = await started();
    seedInbox(server, ['Alpha']);
    const anonymous = await getJson(server, '/api/v1/content/items');
    expect(anonymous.status).toBe(401);
    expect(((await anonymous.json()) as ErrorBody).error.code).toBe('unauthorized');
  });

  it('transitions with audit and rejects invalid transitions without CSRF bypass', async () => {
    const server = await started();
    const [id] = seedInbox(server, ['Alpha']);
    const login = await loginOk(server);
    const headers = { cookie: login.cookie, 'x-csrf-token': login.csrfToken };

    const moved = await postJson(server, `/api/v1/content/items/${id}/transition`, { to: 'researched' }, headers);
    expect(moved.status).toBe(200);
    expect(((await moved.json()) as { item: { editorialState: string } }).item.editorialState).toBe(
      'researched',
    );
    expect(
      listAuditEvents(server.db).some(
        (e) => e.action === 'content.transition' && e.objectId === id,
      ),
    ).toBe(true);

    const bad = await postJson(
      server,
      `/api/v1/content/items/${id}/transition`,
      { to: 'approved' },
      headers,
    );
    expect(bad.status).toBe(400);
    expect(((await bad.json()) as ErrorBody).error.code).toBe('invalid_content_transition');

    const noCsrf = await postJson(
      server,
      `/api/v1/content/items/${id}/transition`,
      { to: 'verified' },
      { cookie: login.cookie },
    );
    expect(noCsrf.status).toBe(403);
    expect(((await noCsrf.json()) as ErrorBody).error.code).toBe('csrf_invalid');
  });
});

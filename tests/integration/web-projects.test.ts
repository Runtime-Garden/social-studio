/**
 * P2 slice 3: projects + immutable revisions API over real HTTP (blueprint 11).
 *
 * Pins the contract the online editor depends on: auth + CSRF on mutating
 * routes, v1/v2 import through the shared schema pipeline, normalized
 * storage, optimistic revision control with a reconcilable 409, immutable
 * history, pagination, export downloads and no partial writes on invalid
 * input.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import type { StartedServer } from '../../apps/web/src/server.js';
import { listAuditEvents } from '../../packages/storage/src/repos/audit.js';
import {
  cleanupTempDirs,
  getJson,
  loginOk,
  postJson,
  startTestServer,
  type ErrorBody,
} from './helpers.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const V2_EXAMPLE = JSON.parse(
  readFileSync(path.join(repoRoot, 'examples', 'series-field.rgstudio.json'), 'utf8'),
) as Record<string, unknown>;
const V2_SLIDE_COUNT = (V2_EXAMPLE.slides as unknown[]).length;

const V1_PROJECT = {
  format: 'runtime-garden-social-studio',
  version: 1,
  name: 'Legacy v1 project',
  slides: [{ id: 'cover', title: 'Legacy cover' }],
};

interface ProjectView {
  id: string;
  name: string;
  latestRevision: number;
  createdAt: string;
  updatedAt: string;
}
interface RevisionSummary {
  id: string;
  revision: number;
  schemaVersion: number;
  editorVersion: string;
  revisionSha: string;
  createdAt: string;
}
interface RevisionView extends RevisionSummary {
  project: Record<string, unknown>;
}
interface CreateBody {
  project: ProjectView;
  revision: RevisionSummary;
}
interface GetBody {
  project: ProjectView;
  revision: RevisionView;
}
interface ListBody {
  projects: ProjectView[];
  total: number;
  limit: number;
  offset: number;
}
interface ConflictBody {
  error: { code: string; message: string };
  currentRevision: number;
}

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

async function createProject(
  server: StartedServer,
  cookie: string,
  csrf: string,
  project: unknown,
): Promise<{ res: Response; body: CreateBody }> {
  const res = await postJson(server, '/api/v1/projects', { project }, { cookie, 'x-csrf-token': csrf });
  return { res, body: (await res.json()) as CreateBody };
}

describe('projects API auth and CSRF', () => {
  it('requires a session for reads and a CSRF token for writes', async () => {
    const server = await started();

    const anonymous = await getJson(server, '/api/v1/projects');
    expect(anonymous.status).toBe(401);
    expect(((await anonymous.json()) as ErrorBody).error.code).toBe('unauthorized');

    const login = await loginOk(server);
    const noCsrf = await postJson(
      server,
      '/api/v1/projects',
      { project: V1_PROJECT },
      { cookie: login.cookie },
    );
    expect(noCsrf.status).toBe(403);
    expect(((await noCsrf.json()) as ErrorBody).error.code).toBe('csrf_invalid');

    const created = await createProject(server, login.cookie, login.csrfToken, V1_PROJECT);
    expect(created.res.status).toBe(201);
  });
});

describe('project import (create)', () => {
  it('creates from a real v2 example with normalized storage and audit trail', async () => {
    const server = await started();
    const login = await loginOk(server);

    const { res, body } = await createProject(server, login.cookie, login.csrfToken, V2_EXAMPLE);
    expect(res.status).toBe(201);
    expect(body.project.name).toBe('Field Notes · Runtime Garden');
    expect(body.project.latestRevision).toBe(1);
    expect(body.revision.revision).toBe(1);
    expect(body.revision.schemaVersion).toBe(2);
    expect(body.revision.editorVersion).toBe('v3-online');
    expect(body.revision.revisionSha).toMatch(/^[0-9a-f]{64}$/);

    const got = await getJson(server, `/api/v1/projects/${body.project.id}`, {
      cookie: login.cookie,
    });
    expect(got.status).toBe(200);
    const stored = (await got.json()) as GetBody;
    expect(stored.revision.project.version).toBe(2);
    expect(stored.revision.project.name).toBe('Field Notes · Runtime Garden');
    expect((stored.revision.project.slides as unknown[]).length).toBe(V2_SLIDE_COUNT);

    const audit = listAuditEvents(server.db);
    expect(audit.some((e) => e.action === 'project.create' && e.objectId === body.project.id)).toBe(
      true,
    );
  });

  it('migrates a v1 project up to v2 through the shared schema pipeline', async () => {
    const server = await started();
    const login = await loginOk(server);

    const { res, body } = await createProject(server, login.cookie, login.csrfToken, V1_PROJECT);
    expect(res.status).toBe(201);
    expect(body.project.name).toBe('Legacy v1 project');

    const got = await getJson(server, `/api/v1/projects/${body.project.id}`, {
      cookie: login.cookie,
    });
    const stored = (await got.json()) as GetBody;
    expect(stored.revision.project.version).toBe(2);
    expect(stored.revision.project.seriesPack).toBe('none');
    const slide = (stored.revision.project.slides as Array<Record<string, unknown>>)[0]!;
    expect(slide.id).toBe('cover');
    expect(slide.seriesVariant).toBe('regular');
  });

  it('rejects invalid projects with no partial writes', async () => {
    const server = await started();
    const login = await loginOk(server);
    const headers = { cookie: login.cookie, 'x-csrf-token': login.csrfToken };

    const notObject = await postJson(server, '/api/v1/projects', { project: 42 }, headers);
    expect(notObject.status).toBe(400);
    expect(((await notObject.json()) as ErrorBody).error.code).toBe('invalid_project');

    const unknownLayout = await postJson(
      server,
      '/api/v1/projects',
      { project: { name: 'Bad', slides: [{ id: 'not-a-layout' }] } },
      headers,
    );
    expect(unknownLayout.status).toBe(400);
    const unknownBody = (await unknownLayout.json()) as ErrorBody;
    expect(unknownBody.error.code).toBe('invalid_project');
    expect(unknownBody.error.message).toMatch(/unknown layout/i);

    const list = await getJson(server, '/api/v1/projects', { cookie: login.cookie });
    expect(((await list.json()) as ListBody).total).toBe(0);
  });
});

describe('revisions with optimistic control', () => {
  it('appends revisions, syncs the name, rejects stale writers and keeps history', async () => {
    const server = await started();
    const login = await loginOk(server);
    const headers = { cookie: login.cookie, 'x-csrf-token': login.csrfToken };

    const created = await createProject(server, login.cookie, login.csrfToken, V2_EXAMPLE);
    const id = created.body.project.id;

    const edited = { ...V2_EXAMPLE, name: 'Renamed during edit' };
    const saved = await postJson(
      server,
      `/api/v1/projects/${id}/revisions`,
      { expectedRevision: 1, project: edited },
      headers,
    );
    expect(saved.status).toBe(201);
    expect(((await saved.json()) as { revision: RevisionSummary }).revision.revision).toBe(2);

    const head = (await (
      await getJson(server, `/api/v1/projects/${id}`, { cookie: login.cookie })
    ).json()) as GetBody;
    expect(head.project.name).toBe('Renamed during edit');
    expect(head.revision.revision).toBe(2);

    const stale = await postJson(
      server,
      `/api/v1/projects/${id}/revisions`,
      { expectedRevision: 1, project: V2_EXAMPLE },
      headers,
    );
    expect(stale.status).toBe(409);
    const conflict = (await stale.json()) as ConflictBody;
    expect(conflict.error.code).toBe('revision_conflict');
    expect(conflict.currentRevision).toBe(2);

    const history = (await (
      await getJson(server, `/api/v1/projects/${id}/revisions`, { cookie: login.cookie })
    ).json()) as { revisions: RevisionSummary[]; total: number };
    expect(history.revisions.map((r) => r.revision)).toEqual([2, 1]);
    expect(history.total).toBe(2);

    const original = (await (
      await getJson(server, `/api/v1/projects/${id}/revisions/1`, { cookie: login.cookie })
    ).json()) as { revision: RevisionView };
    expect(original.revision.project.name).toBe('Field Notes · Runtime Garden');

    const paged = (await (
      await getJson(server, `/api/v1/projects/${id}/revisions?limit=1`, { cookie: login.cookie })
    ).json()) as { revisions: RevisionSummary[]; total: number; limit: number };
    expect(paged.revisions).toHaveLength(1);
    expect(paged.total).toBe(2);
    expect(paged.limit).toBe(1);

    const audit = listAuditEvents(server.db);
    expect(
      audit.some((e) => e.action === 'project.revision_saved' && e.objectId === id && e.revision === '2'),
    ).toBe(true);
  });
});

describe('project listing', () => {
  it('lists with pagination, totals and strict query validation', async () => {
    const server = await started();
    const login = await loginOk(server);
    for (const name of ['Alpha', 'Bravo', 'Charlie']) {
      const { res } = await createProject(server, login.cookie, login.csrfToken, {
        ...V1_PROJECT,
        name,
      });
      expect(res.status).toBe(201);
    }

    const page1 = (await (
      await getJson(server, '/api/v1/projects?limit=2', { cookie: login.cookie })
    ).json()) as ListBody;
    expect(page1.projects.map((p) => p.name)).toEqual(['Charlie', 'Bravo']);
    expect(page1.total).toBe(3);
    expect(page1.limit).toBe(2);

    const page2 = (await (
      await getJson(server, '/api/v1/projects?limit=2&offset=2', { cookie: login.cookie })
    ).json()) as ListBody;
    expect(page2.projects.map((p) => p.name)).toEqual(['Alpha']);

    for (const query of ['limit=0', 'limit=101', 'limit=abc', 'offset=-1']) {
      const bad = await getJson(server, `/api/v1/projects?${query}`, { cookie: login.cookie });
      expect(bad.status, query).toBe(400);
      expect(((await bad.json()) as ErrorBody).error.code, query).toBe('invalid_request');
    }
  });
});

describe('export', () => {
  it('downloads the current revision as a .rgstudio.json attachment', async () => {
    const server = await started();
    const login = await loginOk(server);
    const created = await createProject(server, login.cookie, login.csrfToken, V2_EXAMPLE);

    const res = await getJson(server, `/api/v1/projects/${created.body.project.id}/export`, {
      cookie: login.cookie,
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/json');
    const disposition = res.headers.get('content-disposition') ?? '';
    expect(disposition).toContain('attachment');
    expect(disposition).toMatch(/\.rgstudio\.json"/);

    const text = await res.text();
    const parsed = JSON.parse(text) as Record<string, unknown>;
    expect(parsed.version).toBe(2);
    expect(parsed.name).toBe('Field Notes · Runtime Garden');
  });
});

describe('unknown identifiers', () => {
  it('returns typed 404s for missing projects and revisions', async () => {
    const server = await started();
    const login = await loginOk(server);
    const headers = { cookie: login.cookie, 'x-csrf-token': login.csrfToken };

    const paths = [
      '/api/v1/projects/missing-project',
      '/api/v1/projects/missing-project/revisions',
      '/api/v1/projects/missing-project/export',
    ];
    for (const url of paths) {
      const res = await getJson(server, url, { cookie: login.cookie });
      expect(res.status, url).toBe(404);
      expect(((await res.json()) as ErrorBody).error.code, url).toBe('project_not_found');
    }

    const missingSave = await postJson(
      server,
      '/api/v1/projects/missing-project/revisions',
      { expectedRevision: 1, project: V1_PROJECT },
      headers,
    );
    expect(missingSave.status).toBe(404);

    const created = await createProject(server, login.cookie, login.csrfToken, V1_PROJECT);
    const noSuchRevision = await getJson(
      server,
      `/api/v1/projects/${created.body.project.id}/revisions/99`,
      { cookie: login.cookie },
    );
    expect(noSuchRevision.status).toBe(404);
    expect(((await noSuchRevision.json()) as ErrorBody).error.code).toBe('revision_not_found');
  });
});

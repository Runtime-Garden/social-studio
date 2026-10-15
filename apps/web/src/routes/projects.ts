/**
 * P2 slice 3: projects + revisions API (blueprint 11 `/projects`).
 *
 * Content contract: the project JSON is validated and normalized through the
 * same shared schema pipeline the offline editor uses (`restoreProject`), so
 * v1 imports migrate up to v2 before storage and nothing foreign is stored.
 * The row name is a denormalized copy of the JSON `name` (single source of
 * truth stays in the revision content). Every mutating route requires a
 * session and the session-bound CSRF token; every write appends an audit
 * event. History is immutable: revisions are append-only, stale writers get
 * a reconcilable 409 carrying the current head.
 */
import { Router, type Request, type Response } from 'express';
import type { StudioDatabase } from '../../../../packages/storage/src/db.js';
import { appendAuditEvent } from '../../../../packages/storage/src/repos/audit.js';
import {
  OptimisticConcurrencyError,
  countProjects,
  countRevisions,
  createProject,
  getProject,
  getRevision,
  listProjects,
  listRevisions,
  saveRevision,
  type ProjectRevisionRow,
  type ProjectRow,
} from '../../../../packages/storage/src/repos/projects.js';
import {
  PROJECT_FORMAT,
  PROJECT_FORMAT_VERSION,
  restoreProject,
  type StudioProjectV2,
} from '../../../../packages/studio-core/src/schema.js';
import { getAuth, requireAuth, requireCsrf } from '../middleware/session.js';

const EDITOR_VERSION = 'v3-online';

/**
 * Canonical stored form: the schema-normalized content plus the v2 format
 * markers, matching what the offline editor exports. `restoreProject` omits
 * the markers when normalizing, so they are stamped back on for storage.
 */
function canonicalProjectJson(project: StudioProjectV2): string {
  return JSON.stringify({
    format: PROJECT_FORMAT,
    version: PROJECT_FORMAT_VERSION,
    ...project,
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function projectView(project: ProjectRow): Record<string, unknown> {
  return {
    id: project.id,
    name: project.name,
    latestRevision: project.latestRevision,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  };
}

function revisionSummary(revision: ProjectRevisionRow): Record<string, unknown> {
  return {
    id: revision.id,
    revision: revision.revision,
    schemaVersion: revision.schemaVersion,
    editorVersion: revision.editorVersion,
    revisionSha: revision.revisionSha,
    createdAt: revision.createdAt,
  };
}

function revisionView(revision: ProjectRevisionRow): Record<string, unknown> {
  return { ...revisionSummary(revision), project: JSON.parse(revision.projectJson) };
}

interface Page {
  limit: number;
  offset: number;
}

/** Strict pagination: integers only, limit 1..100, safe offset; null when invalid. */
function parsePagination(req: Request, defaultLimit: number): Page | null {
  const read = (raw: unknown, fallback: number): number | null => {
    if (raw === undefined) return fallback;
    if (typeof raw !== 'string' || !/^\d+$/.test(raw)) return null;
    const value = Number(raw);
    return Number.isSafeInteger(value) ? value : null;
  };
  const limit = read(req.query.limit, defaultLimit);
  const offset = read(req.query.offset, 0);
  if (limit === null || limit < 1 || limit > 100) return null;
  if (offset === null) return null;
  return { limit, offset };
}

function invalidPagination(res: Response): void {
  res.status(400).json({
    error: {
      code: 'invalid_request',
      message: 'limit must be an integer between 1 and 100; offset a non-negative integer',
    },
  });
}

function projectNotFound(res: Response): void {
  res.status(404).json({ error: { code: 'project_not_found', message: 'No such project' } });
}

function invalidProject(res: Response, message: string): void {
  res.status(400).json({ error: { code: 'invalid_project', message } });
}

/** Parses `body.project` through the shared schema; returns null after answering 400. */
function readProject(res: Response, body: unknown): { project: StudioProjectV2 } | null {
  const project = isRecord(body) ? body.project : undefined;
  if (!isRecord(project)) {
    invalidProject(res, 'project must be a JSON object');
    return null;
  }
  try {
    return { project: restoreProject(JSON.stringify(project)) };
  } catch (error) {
    invalidProject(res, error instanceof Error ? error.message : 'Invalid project');
    return null;
  }
}

function exportFilename(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return `${slug || 'project'}.rgstudio.json`;
}

/** Express 5 route params can type as string[]; only the plain string form is valid here. */
function stringParam(req: Request, name: string): string {
  const value = req.params[name];
  return typeof value === 'string' ? value : '';
}

export function createProjectsRouter({ db }: { db: StudioDatabase }): Router {
  const router = Router();
  router.use(requireAuth);

  router.get('/', (req, res) => {
    const page = parsePagination(req, 20);
    if (!page) {
      invalidPagination(res);
      return;
    }
    res.status(200).json({
      projects: listProjects(db, page).map(projectView),
      total: countProjects(db),
      limit: page.limit,
      offset: page.offset,
    });
  });

  router.post('/', requireCsrf, (req, res) => {
    const auth = getAuth(req)!;
    const parsed = readProject(res, req.body);
    if (!parsed) return;

    const created = createProject(db, {
      name: parsed.project.name,
      projectJson: canonicalProjectJson(parsed.project),
      editorVersion: EDITOR_VERSION,
    });
    appendAuditEvent(db, {
      actor: auth.user.username,
      action: 'project.create',
      objectType: 'studio_project',
      objectId: created.project.id,
    });
    res.status(201).json({
      project: projectView(created.project),
      revision: revisionSummary(created.revision),
    });
  });

  router.get('/:id', (req, res) => {
    const found = getProject(db, stringParam(req, 'id'));
    if (!found) {
      projectNotFound(res);
      return;
    }
    res.status(200).json({
      project: projectView(found.project),
      revision: revisionView(found.revision),
    });
  });

  router.post('/:id/revisions', requireCsrf, (req, res) => {
    const auth = getAuth(req)!;
    const id = stringParam(req, 'id');
    if (!getProject(db, id)) {
      projectNotFound(res);
      return;
    }
    const body = req.body as unknown;
    const expectedRevision = isRecord(body) ? body.expectedRevision : undefined;
    if (
      typeof expectedRevision !== 'number' ||
      !Number.isInteger(expectedRevision) ||
      expectedRevision < 1
    ) {
      res.status(400).json({
        error: { code: 'invalid_request', message: 'expectedRevision must be an integer >= 1' },
      });
      return;
    }
    const parsed = readProject(res, body);
    if (!parsed) return;

    let revision: ProjectRevisionRow;
    try {
      revision = saveRevision(db, id, {
        expectedRevision,
        projectJson: canonicalProjectJson(parsed.project),
        name: parsed.project.name,
        editorVersion: EDITOR_VERSION,
      });
    } catch (error) {
      if (error instanceof OptimisticConcurrencyError) {
        const head = getProject(db, id);
        res.status(409).json({
          error: { code: 'revision_conflict', message: error.message },
          currentRevision: head?.project.latestRevision ?? null,
        });
        return;
      }
      throw error;
    }
    appendAuditEvent(db, {
      actor: auth.user.username,
      action: 'project.revision_saved',
      objectType: 'studio_project',
      objectId: id,
      revision: String(revision.revision),
    });
    res.status(201).json({ revision: revisionSummary(revision) });
  });

  router.get('/:id/revisions', (req, res) => {
    const id = stringParam(req, 'id');
    if (!getProject(db, id)) {
      projectNotFound(res);
      return;
    }
    const page = parsePagination(req, 50);
    if (!page) {
      invalidPagination(res);
      return;
    }
    res.status(200).json({
      revisions: listRevisions(db, id, page).map(revisionSummary),
      total: countRevisions(db, id),
      limit: page.limit,
      offset: page.offset,
    });
  });

  router.get('/:id/revisions/:n', (req, res) => {
    const id = stringParam(req, 'id');
    if (!getProject(db, id)) {
      projectNotFound(res);
      return;
    }
    const n = Number(stringParam(req, 'n'));
    const revision = Number.isInteger(n) && n >= 1 ? getRevision(db, id, n) : null;
    if (!revision) {
      res.status(404).json({ error: { code: 'revision_not_found', message: 'No such revision' } });
      return;
    }
    res.status(200).json({ revision: revisionView(revision) });
  });

  router.get('/:id/export', (req, res) => {
    const found = getProject(db, stringParam(req, 'id'));
    if (!found) {
      projectNotFound(res);
      return;
    }
    res.set('content-disposition', `attachment; filename="${exportFilename(found.project.name)}"`);
    res.type('application/json');
    res.status(200).send(found.revision.projectJson);
  });

  return router;
}

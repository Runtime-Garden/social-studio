/**
 * P2: studio projects + immutable revisions with optimistic concurrency.
 *
 * The online editor saves explicit revisions; a stale writer (expected
 * revision no longer the head) is rejected with OptimisticConcurrencyError
 * and leaves no partial state behind. Revisions are append-only history.
 */
import { newId, sha256Hex } from '../ids.js';
import type { StudioDatabase } from '../db.js';

export class OptimisticConcurrencyError extends Error {
  readonly code = 'revision_conflict';
  constructor(projectId: string, expectedRevision: number, actualRevision: number) {
    super(
      `Project ${projectId} changed concurrently: expected revision ${expectedRevision}, head is ${actualRevision}.`,
    );
    this.name = 'OptimisticConcurrencyError';
  }
}

export interface ProjectRow {
  id: string;
  name: string;
  latestRevision: number;
  currentRevisionId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectRevisionRow {
  id: string;
  projectId: string;
  revision: number;
  projectJson: string;
  schemaVersion: number;
  editorVersion: string;
  revisionSha: string;
  createdAt: string;
}

const mapProject = (row: {
  id: string;
  name: string;
  latest_revision: number;
  current_revision_id: string | null;
  created_at: string;
  updated_at: string;
}): ProjectRow => ({
  id: row.id,
  name: row.name,
  latestRevision: row.latest_revision,
  currentRevisionId: row.current_revision_id,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapRevision = (row: {
  id: string;
  project_id: string;
  revision: number;
  project_json: string;
  schema_version: number;
  editor_version: string;
  revision_sha: string;
  created_at: string;
}): ProjectRevisionRow => ({
  id: row.id,
  projectId: row.project_id,
  revision: row.revision,
  projectJson: row.project_json,
  schemaVersion: row.schema_version,
  editorVersion: row.editor_version,
  revisionSha: row.revision_sha,
  createdAt: row.created_at,
});

export interface CreateProjectInput {
  name: string;
  projectJson: string;
  schemaVersion?: number;
  editorVersion?: string;
  now?: number;
}

export function createProject(
  db: StudioDatabase,
  input: CreateProjectInput,
): { project: ProjectRow; revision: ProjectRevisionRow } {
  const now = new Date(input.now ?? Date.now()).toISOString();
  const projectId = newId();
  const revisionId = newId();
  db.exec('BEGIN');
  try {
    db.prepare(
      `INSERT INTO studio_projects (id, name, latest_revision, current_revision_id, created_at, updated_at)
       VALUES (?, ?, 1, ?, ?, ?)`,
    ).run(projectId, input.name, revisionId, now, now);
    db.prepare(
      `INSERT INTO project_revisions
         (id, project_id, revision, project_json, schema_version, editor_version, revision_sha, created_at)
       VALUES (?, ?, 1, ?, ?, ?, ?, ?)`,
    ).run(
      revisionId,
      projectId,
      input.projectJson,
      input.schemaVersion ?? 2,
      input.editorVersion ?? 'v2-offline',
      sha256Hex(input.projectJson),
      now,
    );
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
  return {
    project: {
      id: projectId,
      name: input.name,
      latestRevision: 1,
      currentRevisionId: revisionId,
      createdAt: now,
      updatedAt: now,
    },
    revision: {
      id: revisionId,
      projectId,
      revision: 1,
      projectJson: input.projectJson,
      schemaVersion: input.schemaVersion ?? 2,
      editorVersion: input.editorVersion ?? 'v2-offline',
      revisionSha: sha256Hex(input.projectJson),
      createdAt: now,
    },
  };
}

export interface SaveRevisionInput {
  expectedRevision: number;
  projectJson: string;
  schemaVersion?: number;
  editorVersion?: string;
  now?: number;
}

export function saveRevision(
  db: StudioDatabase,
  projectId: string,
  input: SaveRevisionInput,
): ProjectRevisionRow {
  const now = new Date(input.now ?? Date.now()).toISOString();
  db.exec('BEGIN');
  try {
    const head = db
      .prepare('SELECT latest_revision FROM studio_projects WHERE id = ?')
      .get(projectId) as { latest_revision: number } | undefined;
    if (!head) throw new Error(`Unknown project: ${projectId}`);
    if (head.latest_revision !== input.expectedRevision) {
      throw new OptimisticConcurrencyError(projectId, input.expectedRevision, head.latest_revision);
    }
    const revision = head.latest_revision + 1;
    const revisionId = newId();
    db.prepare(
      `INSERT INTO project_revisions
         (id, project_id, revision, project_json, schema_version, editor_version, revision_sha, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      revisionId,
      projectId,
      revision,
      input.projectJson,
      input.schemaVersion ?? 2,
      input.editorVersion ?? 'v2-offline',
      sha256Hex(input.projectJson),
      now,
    );
    db.prepare(
      'UPDATE studio_projects SET latest_revision = ?, current_revision_id = ?, updated_at = ? WHERE id = ?',
    ).run(revision, revisionId, now, projectId);
    db.exec('COMMIT');
    return {
      id: revisionId,
      projectId,
      revision,
      projectJson: input.projectJson,
      schemaVersion: input.schemaVersion ?? 2,
      editorVersion: input.editorVersion ?? 'v2-offline',
      revisionSha: sha256Hex(input.projectJson),
      createdAt: now,
    };
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

export function getProject(
  db: StudioDatabase,
  projectId: string,
): { project: ProjectRow; revision: ProjectRevisionRow } | null {
  const project = db.prepare('SELECT * FROM studio_projects WHERE id = ?').get(projectId) as
    | Parameters<typeof mapProject>[0]
    | undefined;
  if (!project) return null;
  const revision = db
    .prepare('SELECT * FROM project_revisions WHERE project_id = ? ORDER BY revision DESC LIMIT 1')
    .get(projectId) as Parameters<typeof mapRevision>[0] | undefined;
  if (!revision) return null;
  return { project: mapProject(project), revision: mapRevision(revision) };
}

export function listRevisions(
  db: StudioDatabase,
  projectId: string,
  { limit = 50, offset = 0 }: { limit?: number; offset?: number } = {},
): ProjectRevisionRow[] {
  const rows = db
    .prepare(
      'SELECT * FROM project_revisions WHERE project_id = ? ORDER BY revision DESC LIMIT ? OFFSET ?',
    )
    .all(projectId, limit, offset) as Array<Parameters<typeof mapRevision>[0]>;
  return rows.map(mapRevision);
}

/**
 * P2: append-only audit trail.
 *
 * Never store secrets or raw article bodies here; store actor, action,
 * object identity/revision, decision reason and correlation id (blueprint 9).
 */
import { newId } from '../ids.js';
import type { StudioDatabase } from '../db.js';

export interface AuditEventRow {
  id: string;
  actor: string;
  action: string;
  objectType: string;
  objectId: string | null;
  revision: string | null;
  reason: string | null;
  correlationId: string | null;
  createdAt: string;
}

export interface AppendAuditEventInput {
  actor: string;
  action: string;
  objectType: string;
  objectId?: string;
  revision?: string;
  reason?: string;
  correlationId?: string;
  now?: number;
}

export function appendAuditEvent(
  db: StudioDatabase,
  input: AppendAuditEventInput,
): AuditEventRow {
  const row: AuditEventRow = {
    id: newId(),
    actor: input.actor,
    action: input.action,
    objectType: input.objectType,
    objectId: input.objectId ?? null,
    revision: input.revision ?? null,
    reason: input.reason ?? null,
    correlationId: input.correlationId ?? null,
    createdAt: new Date(input.now ?? Date.now()).toISOString(),
  };
  db.prepare(
    `INSERT INTO audit_events (id, actor, action, object_type, object_id, revision, reason, correlation_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    row.id,
    row.actor,
    row.action,
    row.objectType,
    row.objectId,
    row.revision,
    row.reason,
    row.correlationId,
    row.createdAt,
  );
  return row;
}

export function listAuditEvents(
  db: StudioDatabase,
  { limit = 50, offset = 0 }: { limit?: number; offset?: number } = {},
): AuditEventRow[] {
  const rows = db
    .prepare('SELECT * FROM audit_events ORDER BY created_at DESC, rowid DESC LIMIT ? OFFSET ?')
    .all(limit, offset) as Array<{
    id: string;
    actor: string;
    action: string;
    object_type: string;
    object_id: string | null;
    revision: string | null;
    reason: string | null;
    correlation_id: string | null;
    created_at: string;
  }>;
  return rows.map((row) => ({
    id: row.id,
    actor: row.actor,
    action: row.action,
    objectType: row.object_type,
    objectId: row.object_id,
    revision: row.revision,
    reason: row.reason,
    correlationId: row.correlation_id,
    createdAt: row.created_at,
  }));
}

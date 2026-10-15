/**
 * P2 remainder: jobs + publications repositories (blueprint lines 805, 808).
 *
 * Durable job lease semantics (claim only from queued or expired lease;
 * double-claim returns null) and publication status with live approval
 * validity derived from current variant state.
 */
import { newId } from '../ids.js';
import type { StudioDatabase } from '../db.js';
import {
  currentVariantSubject,
  getVariant,
  verifyVariantApproval,
} from './content.js';

function nowIso(now?: number): string {
  return new Date(now ?? Date.now()).toISOString();
}

export interface JobRow {
  id: string;
  kind: string;
  state: string;
}

export function createJob(
  db: StudioDatabase,
  input: {
    kind: string;
    correlationId: string;
    runAt: string;
    payloadJson?: string;
    idempotencyKey: string;
    now?: number;
  },
): JobRow {
  const id = newId();
  const stamp = nowIso(input.now);
  db.prepare(
    `INSERT INTO jobs (id, kind, correlation_id, state, run_at, attempts, payload_json, idempotency_key, created_at, updated_at)
     VALUES (?, ?, ?, 'queued', ?, 0, ?, ?, ?, ?)`,
  ).run(
    id,
    input.kind,
    input.correlationId,
    input.runAt,
    input.payloadJson ?? '{}',
    input.idempotencyKey,
    stamp,
    stamp,
  );
  return { id, kind: input.kind, state: 'queued' };
}

/**
 * Claims a job for a worker. Returns null when another live lease holds
 * it (only `queued` rows or rows whose lease expired are claimable).
 */
export function leaseJob(
  db: StudioDatabase,
  id: string,
  { owner, leaseMs, now }: { owner: string; leaseMs: number; now?: number },
): { id: string; state: string } | null {
  const stamp = nowIso(now);
  const row = db
    .prepare('SELECT state, lease_expires_at AS leaseExpiresAt FROM jobs WHERE id = ?')
    .get(id) as { state: string; leaseExpiresAt: string | null } | undefined;
  if (!row) return null;
  const expired = row.leaseExpiresAt !== null && row.leaseExpiresAt <= stamp;
  if (row.state !== 'queued' && !expired) return null;
  db.prepare(
    `UPDATE jobs SET state = 'leased', lease_owner = ?, lease_expires_at = ?,
      attempts = attempts + 1, updated_at = ? WHERE id = ?`,
  ).run(owner, new Date((now ?? Date.now()) + leaseMs).toISOString(), stamp, id);
  return { id, state: 'leased' };
}

export function completeJob(
  db: StudioDatabase,
  id: string,
  { state, error, now }: { state: 'succeeded' | 'failed' | 'cancelled'; error?: string; now?: number },
): void {
  db.prepare('UPDATE jobs SET state = ?, last_error = ?, updated_at = ? WHERE id = ?').run(
    state,
    error ?? null,
    nowIso(now),
    id,
  );
}

export function listJobs(
  db: StudioDatabase,
  { limit = 20, offset = 0, state }: { limit?: number; offset?: number; state?: string } = {},
): { jobs: JobRow[]; total: number } {
  const where = state ? 'WHERE state = ?' : '';
  const args = state ? [state, limit, offset] : [limit, offset];
  const rows = db
    .prepare(
      `SELECT id, kind, state FROM jobs ${where}
       ORDER BY created_at DESC, rowid DESC LIMIT ? OFFSET ?`,
    )
    .all(...args) as Array<{ id: string; kind: string; state: string }>;
  const countRow = (
    state
      ? db.prepare('SELECT COUNT(*) AS n FROM jobs WHERE state = ?').get(state)
      : db.prepare('SELECT COUNT(*) AS n FROM jobs').get()
  ) as { n: number };
  return { jobs: rows.map((r) => ({ id: r.id, kind: r.kind, state: r.state })), total: countRow.n };
}

export function createPublication(
  db: StudioDatabase,
  input: {
    variantId: string;
    variantRevision: number;
    channelId: string;
    localKey: string;
    now?: number;
  },
): { id: string; submissionState: string } {
  const id = newId();
  const stamp = nowIso(input.now);
  db.prepare(
    `INSERT INTO publications (id, variant_id, variant_revision, channel_id, local_key, submission_state, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'not_submitted', ?, ?)`,
  ).run(id, input.variantId, input.variantRevision, input.channelId, input.localKey, stamp, stamp);
  return { id, submissionState: 'not_submitted' };
}

export interface PublicationStatus {
  channelId: string;
  submissionState: string;
  bufferState: string | null;
  variantStatus: string;
  approvalValid: boolean;
}

/** Per-channel status for one variant, with approval validity from live state. */
export function getPublicationStatus(
  db: StudioDatabase,
  variantId: string,
): PublicationStatus[] {
  const variant = getVariant(db, variantId);
  if (!variant) return [];
  const rows = db
    .prepare(
      `SELECT channel_id AS channelId, submission_state AS submissionState, buffer_state AS bufferState
       FROM publications WHERE variant_id = ?`,
    )
    .all(variantId) as Array<{ channelId: string; submissionState: string; bufferState: string | null }>;
  return rows.map((row) => {
    const subject = currentVariantSubject(db, variantId, row.channelId);
    return {
      channelId: row.channelId,
      submissionState: row.submissionState,
      bufferState: row.bufferState,
      variantStatus: variant.status,
      approvalValid: subject ? verifyVariantApproval(db, variantId, subject) : false,
    };
  });
}

export interface ScheduledEntry {
  variantId: string;
  channelId: string | null;
  scheduledAt: string;
  status: string;
}

/** Variants with a schedule inside [from, to] (ISO UTC bounds). */
export function listScheduled(
  db: StudioDatabase,
  { from, to }: { from: string; to: string },
): ScheduledEntry[] {
  const rows = db
    .prepare(
      `SELECT pv.id AS variantId, NULL AS channelId, pv.scheduled_at AS scheduledAt, pv.status AS status
       FROM platform_variants pv
       WHERE pv.scheduled_at IS NOT NULL AND pv.scheduled_at >= ? AND pv.scheduled_at <= ?
       ORDER BY pv.scheduled_at ASC`,
    )
    .all(from, to) as unknown as ScheduledEntry[];
  return rows;
}

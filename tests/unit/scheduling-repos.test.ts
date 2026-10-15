/**
 * P2 remainder: jobs + publications repositories (blueprint lines 805, 808).
 *
 * Durable job lease semantics and publication status with live approval
 * validity, over the migration-0001 tables.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it } from 'vitest';
import { openDatabase, type StudioDatabase } from '../../packages/storage/src/db.js';
import { applyMigrations } from '../../packages/storage/src/migrate.js';
import { approvalHash } from '../../packages/domain/src/approval.js';
import {
  createContentItem,
  createVariant,
  currentVariantSubject,
  saveApproval,
  setVariantSchedule,
  updateVariantText,
} from '../../packages/storage/src/repos/content.js';
import { createUser } from '../../packages/storage/src/repos/users.js';
import {
  completeJob,
  createJob,
  createPublication,
  getPublicationStatus,
  leaseJob,
  listJobs,
  listScheduled,
} from '../../packages/storage/src/repos/scheduling.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const MIGRATIONS_DIR = path.join(repoRoot, 'migrations');

let db: StudioDatabase;

beforeEach(() => {
  db = openDatabase({ path: ':memory:' });
  applyMigrations(db, MIGRATIONS_DIR);
});

describe('jobs with leases', () => {
  it('creates, leases once and completes a job', () => {
    const job = createJob(db, {
      kind: 'buffer_submit',
      correlationId: 'corr-1',
      runAt: new Date(Date.now() + 60_000).toISOString(),
      idempotencyKey: 'idem-1',
    });
    expect(job.state).toBe('queued');
    const leased = leaseJob(db, job.id, { owner: 'worker-1', leaseMs: 60_000 });
    expect(leased?.state).toBe('leased');
    expect(leaseJob(db, job.id, { owner: 'worker-2', leaseMs: 60_000 })).toBeNull();
    completeJob(db, job.id, { state: 'succeeded' });
    expect(listJobs(db, {}).jobs[0]?.state).toBe('succeeded');
  });

  it('re-leases an expired lease', () => {
    const job = createJob(db, {
      kind: 'buffer_submit',
      correlationId: 'corr-1',
      runAt: new Date().toISOString(),
      idempotencyKey: 'idem-1',
    });
    leaseJob(db, job.id, { owner: 'worker-1', leaseMs: -1 });
    const reLeased = leaseJob(db, job.id, { owner: 'worker-2', leaseMs: 60_000 });
    expect(reLeased?.state).toBe('leased');
  });
});

describe('publications with live approval validity', () => {
  function seedApproved() {
    const user = createUser(db, { username: 'owner', passwordHash: 'scrypt$demo' });
    const content = createContentItem(db, { kind: 'manual', title: 'Story one' });
    const variant = createVariant(db, {
      contentItemId: content.id,
      platform: 'linkedin',
      text: 'Hello',
    });
    const subject = currentVariantSubject(db, variant.id, 'chan-1')!;
    saveApproval(db, {
      variantId: variant.id,
      variantRevision: variant.revision,
      channelId: 'chan-1',
      approvalHash: approvalHash(subject),
      approverUserId: user.id,
      decision: 'approved',
    });
    createPublication(db, {
      variantId: variant.id,
      variantRevision: variant.revision,
      channelId: 'chan-1',
      localKey: 'local-1',
    });
    return variant.id;
  }

  it('reports approvalValid true, then false after a variant edit', () => {
    const variantId = seedApproved();
    expect(getPublicationStatus(db, variantId)[0]?.approvalValid).toBe(true);
    expect(getPublicationStatus(db, variantId)[0]?.hasApproval).toBe(true);
    updateVariantText(db, variantId, 'Hello again');
    const status = getPublicationStatus(db, variantId)[0];
    expect(status?.approvalValid).toBe(false);
    expect(status?.hasApproval).toBe(true);
    expect(status?.submissionState).toBe('not_submitted');
  });

  it('lists scheduled variants in range and excludes unscheduled ones', () => {
    const variantId = seedApproved();
    setVariantSchedule(db, variantId, '2026-11-05T10:00:00.000Z');
    const content = createContentItem(db, { kind: 'manual', title: 'Story two' });
    createVariant(db, { contentItemId: content.id, platform: 'x', text: 'Unscheduled' });
    const rows = listScheduled(db, { from: '2026-11-01T00:00:00.000Z', to: '2026-11-30T00:00:00.000Z' });
    expect(rows.map((r) => r.variantId)).toContain(variantId);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.status).toBe('draft');
  });
});

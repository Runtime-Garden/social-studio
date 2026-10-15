/**
 * P2: storage repositories and the safe defaults.
 *
 * Covers the P2 DoD-critical repositories: users, sessions (hashed opaque
 * tokens), studio projects with optimistic revision control, audit events,
 * and policy settings where publishing/autonomy stay OFF unless explicitly
 * enabled (blueprint 10.4 + P2 checklist).
 */
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it } from 'vitest';
import { openDatabase, type StudioDatabase } from '../../packages/storage/src/db.js';
import { applyMigrations } from '../../packages/storage/src/migrate.js';
import {
  createUser,
  countUsers,
  findUserById,
  findUserByUsername,
} from '../../packages/storage/src/repos/users.js';
import {
  createSession,
  findActiveSession,
  revokeSession,
} from '../../packages/storage/src/repos/sessions.js';
import {
  OptimisticConcurrencyError,
  createProject,
  getProject,
  listRevisions,
  saveRevision,
} from '../../packages/storage/src/repos/projects.js';
import { appendAuditEvent, listAuditEvents } from '../../packages/storage/src/repos/audit.js';
import { getPolicy, setPolicyValue } from '../../packages/storage/src/repos/policy.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const MIGRATIONS_DIR = path.join(repoRoot, 'migrations');

let db: StudioDatabase;

beforeEach(() => {
  db = openDatabase({ path: ':memory:' });
  applyMigrations(db, MIGRATIONS_DIR);
});

describe('users', () => {
  it('creates and finds the single admin without echoing secrets', () => {
    const user = createUser(db, { username: 'owner', passwordHash: 'scrypt$demo' });
    expect(user.id).toMatch(/^[0-9a-f]{32}$/);
    expect(countUsers(db)).toBe(1);
    expect(findUserByUsername(db, 'owner')?.passwordHash).toBe('scrypt$demo');
    expect(findUserByUsername(db, 'nobody')).toBeUndefined();
  });

  it('enforces unique usernames', () => {
    createUser(db, { username: 'owner', passwordHash: 'a' });
    expect(() => createUser(db, { username: 'owner', passwordHash: 'b' })).toThrow(/UNIQUE/i);
  });

  it('finds users by id and exposes the disabled marker', () => {
    const user = createUser(db, { username: 'owner', passwordHash: 'h' });
    expect(findUserById(db, user.id)?.username).toBe('owner');
    expect(findUserById(db, 'missing')).toBeUndefined();

    db.prepare('UPDATE users SET disabled_at = ? WHERE id = ?').run(
      '2026-10-15T00:00:00.000Z',
      user.id,
    );
    expect(findUserById(db, user.id)?.disabledAt).toBe('2026-10-15T00:00:00.000Z');
  });
});

describe('sessions', () => {
  it('stores only a hash of the opaque token and validates it', () => {
    const user = createUser(db, { username: 'owner', passwordHash: 'x' });
    const { token } = createSession(db, user.id, { now: 1_000_000, ttlMs: 60_000 });
    expect(token).toMatch(/^[A-Za-z0-9_-]{40,}$/);

    const stored = db.prepare('SELECT id FROM sessions').all() as Array<{ id: string }>;
    expect(stored).toHaveLength(1);
    expect(stored[0]!.id).not.toBe(token);
    expect(stored[0]!.id).toBe(createHash('sha256').update(token).digest('hex'));

    const session = findActiveSession(db, token, { now: 1_030_000 });
    expect(session?.userId).toBe(user.id);
  });

  it('rejects expired and revoked sessions', () => {
    const user = createUser(db, { username: 'owner', passwordHash: 'x' });
    const { token } = createSession(db, user.id, { now: 1_000_000, ttlMs: 60_000 });
    expect(findActiveSession(db, token, { now: 1_060_001 })).toBeNull();

    const second = createSession(db, user.id, { now: 2_000_000, ttlMs: 60_000 });
    expect(revokeSession(db, second.token, { now: 2_000_100 })).toBe(true);
    expect(findActiveSession(db, second.token, { now: 2_000_200 })).toBeNull();
    expect(revokeSession(db, 'not-a-token', { now: 2_000_300 })).toBe(false);
  });

  it('issues a session-bound CSRF token stored with the session', () => {
    const user = createUser(db, { username: 'owner', passwordHash: 'x' });
    const { token, csrfToken } = createSession(db, user.id, { now: 1_000_000, ttlMs: 60_000 });
    expect(csrfToken).toMatch(/^[A-Za-z0-9_-]{40,}$/);
    expect(csrfToken).not.toBe(token);

    const row = db.prepare('SELECT csrf_token FROM sessions').get() as { csrf_token: string };
    expect(row.csrf_token).toBe(csrfToken);

    expect(findActiveSession(db, token, { now: 1_030_000 })?.csrfToken).toBe(csrfToken);
  });

  it('updates last activity when a session is used', () => {
    const user = createUser(db, { username: 'owner', passwordHash: 'x' });
    const { token } = createSession(db, user.id, { now: 1_000_000, ttlMs: 60_000 });
    findActiveSession(db, token, { now: 1_010_000 });
    const row = db.prepare('SELECT last_seen_at FROM sessions').get() as { last_seen_at: string };
    expect(row.last_seen_at).toBe(new Date(1_010_000).toISOString());
  });
});

describe('studio projects with optimistic revision control', () => {
  const projectJson = (title: string) =>
    JSON.stringify({
      format: 'runtime-garden-social-studio',
      version: 2,
      name: 'Seeded project',
      seriesPack: 'none',
      selected: 0,
      slides: [{ id: 'cover', title }],
    });

  it('creates a project with revision 1 and a content hash', () => {
    const created = createProject(db, {
      name: 'First project',
      projectJson: projectJson('Hello'),
      now: 1_000_000,
    });
    expect(created.project.latestRevision).toBe(1);
    expect(created.revision.revision).toBe(1);
    expect(created.revision.revisionSha).toMatch(/^[0-9a-f]{64}$/);
    expect(getProject(db, created.project.id)?.revision.projectJson).toContain('Hello');
  });

  it('appends revisions under optimistic concurrency', () => {
    const created = createProject(db, {
      name: 'P',
      projectJson: projectJson('v1'),
      now: 1_000_000,
    });
    const second = saveRevision(db, created.project.id, {
      expectedRevision: 1,
      projectJson: projectJson('v2'),
      now: 2_000_000,
    });
    expect(second.revision).toBe(2);
    expect(getProject(db, created.project.id)?.project.latestRevision).toBe(2);
    expect(listRevisions(db, created.project.id).map((r) => r.revision)).toEqual([2, 1]);
  });

  it('rejects stale writers with OptimisticConcurrencyError', () => {
    const created = createProject(db, {
      name: 'P',
      projectJson: projectJson('v1'),
      now: 1_000_000,
    });
    saveRevision(db, created.project.id, { expectedRevision: 1, projectJson: projectJson('v2') });
    expect(() =>
      saveRevision(db, created.project.id, {
        expectedRevision: 1,
        projectJson: projectJson('stale'),
      }),
    ).toThrow(OptimisticConcurrencyError);
    // The rejected write left no revision behind.
    expect(listRevisions(db, created.project.id).map((r) => r.revision)).toEqual([2, 1]);
  });

  it('revisions are immutable history: earlier content is preserved', () => {
    const created = createProject(db, {
      name: 'P',
      projectJson: projectJson('original'),
      now: 1_000_000,
    });
    saveRevision(db, created.project.id, {
      expectedRevision: 1,
      projectJson: projectJson('edited'),
    });
    const revisions = listRevisions(db, created.project.id);
    expect(revisions[0]!.projectJson).toContain('edited');
    expect(revisions[1]!.projectJson).toContain('original');
  });
});

describe('audit events', () => {
  it('appends and lists newest-first with actor/action/object', () => {
    appendAuditEvent(db, {
      actor: 'user:owner',
      action: 'project.create',
      objectType: 'studio_project',
      objectId: 'p1',
      correlationId: 'corr-1',
      now: 1_000_000,
    });
    appendAuditEvent(db, {
      actor: 'user:owner',
      action: 'approval.approve',
      objectType: 'approval',
      objectId: 'a1',
      revision: '3',
      reason: 'reviewed exact snapshot',
      now: 2_000_000,
    });
    const events = listAuditEvents(db, { limit: 10 });
    expect(events.map((e) => e.action)).toEqual(['approval.approve', 'project.create']);
    expect(events[0]!.objectId).toBe('a1');
    expect(events[0]!.revision).toBe('3');
    expect(events[1]!.correlationId).toBe('corr-1');
  });
});

describe('policy settings: safe defaults', () => {
  it('keeps publishing and autonomy disabled until explicitly enabled', () => {
    const policy = getPolicy(db);
    expect(policy.publishing_enabled).toBe(false);
    expect(policy.autonomy_enabled).toBe(false);
    expect(policy.approval_required).toBe(true);
    expect(policy.trusted_sources_only).toBe(true);
    expect(policy.max_auto_posts_per_channel_per_day).toBe(1);
    expect(policy.min_hours_between_posts_per_channel).toBe(6);
    expect(policy.block_unsupported_or_unverified_claims).toBe(true);
    expect(policy.block_unverified_numeric_benchmarks).toBe(true);
    expect(policy.block_security_incident_auto_posts).toBe(true);
    expect(policy.block_external_breaking_news_auto_posts).toBe(true);
    expect(policy.block_new_product_launch_claims_without_review).toBe(true);
    expect(policy.block_missing_primary_source).toBe(true);
    expect(policy.stop_after_consecutive_provider_failures).toBe(3);
    expect(policy.pause_when_usage_budget_exceeded).toBe(true);
    expect(policy.prohibit_notification_only_auto_schedule).toBe(true);
  });

  it('persists explicit overrides and rejects unknown keys', () => {
    setPolicyValue(db, 'publishing_enabled', true, { now: 1_000_000 });
    expect(getPolicy(db).publishing_enabled).toBe(true);
    expect(() => setPolicyValue(db, 'not_a_policy', true)).toThrow(/unknown policy key/i);
  });
});

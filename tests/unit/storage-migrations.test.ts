/**
 * P2: SQLite foundation (blueprint 9 / 9.1).
 *
 * Verifies the migration runner and the minimum domain contract: every
 * table exists, migrations are idempotent, foreign keys + CHECK + UNIQUE
 * constraints are actually enforced, and file databases run in WAL mode
 * with a busy timeout.
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { openDatabase } from '../../packages/storage/src/db.js';
import { applyMigrations } from '../../packages/storage/src/migrate.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const MIGRATIONS_DIR = path.join(repoRoot, 'migrations');

/** The minimum domain contract from blueprint section 9. */
const EXPECTED_TABLES = [
  'agent_runs',
  'agent_steps',
  'approvals',
  'assets',
  'audit_events',
  'connected_channels',
  'content_items',
  'evidence_claims',
  'job_attempts',
  'jobs',
  'platform_variants',
  'policy_settings',
  'project_revisions',
  'publications',
  'schema_migrations',
  'sessions',
  'source_items',
  'sources',
  'story_clusters',
  'story_sources',
  'studio_projects',
  'system_alerts',
  'usage_ledger',
  'users',
  'variant_assets',
];

const tempDirs: string[] = [];
afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('migration runner', () => {
  it('applies the initial migration to a fresh database and records it', () => {
    const db = openDatabase({ path: ':memory:' });
    const applied = applyMigrations(db, MIGRATIONS_DIR);
    expect(applied).toEqual(['0001_init']);

    const rows = db
      .prepare('SELECT version, name FROM schema_migrations ORDER BY version')
      .all() as Array<{ version: number; name: string }>;
    expect(rows).toEqual([{ version: 1, name: '0001_init' }]);

    const tables = (
      db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
        .all() as Array<{ name: string }>
    )
      .map((row) => row.name)
      .sort();
    expect(tables).toEqual([...EXPECTED_TABLES].sort());
  });

  it('is idempotent: a second run applies nothing', () => {
    const db = openDatabase({ path: ':memory:' });
    applyMigrations(db, MIGRATIONS_DIR);
    expect(applyMigrations(db, MIGRATIONS_DIR)).toEqual([]);
  });
});

describe('integrity invariants', () => {
  function freshDb() {
    const db = openDatabase({ path: ':memory:' });
    applyMigrations(db, MIGRATIONS_DIR);
    return db;
  }

  it('enforces foreign keys', () => {
    const db = freshDb();
    expect(() =>
      db
        .prepare(
          `INSERT INTO platform_variants (id, content_item_id, platform, revision, text, status, created_at, updated_at)
           VALUES ('v1', 'missing-content', 'x', 1, '', 'draft', 'now', 'now')`,
        )
        .run(),
    ).toThrow(/FOREIGN KEY/i);
  });

  it('enforces CHECK constraints on states', () => {
    const db = freshDb();
    db.prepare(
      `INSERT INTO content_items (id, kind, title, editorial_state, created_at, updated_at)
       VALUES ('c1', 'news', 't', 'discovered', 'now', 'now')`,
    ).run();
    expect(() =>
      db
        .prepare(
          `INSERT INTO platform_variants (id, content_item_id, platform, revision, text, status, created_at, updated_at)
           VALUES ('v1', 'c1', 'x', 1, '', 'totally_published', 'now', 'now')`,
        )
        .run(),
    ).toThrow(/CHECK/i);
    expect(() =>
      db
        .prepare(
          `INSERT INTO jobs (id, kind, correlation_id, state, run_at, payload_json, idempotency_key, created_at, updated_at)
           VALUES ('j1', 'poll', 'corr', 'sleeping', 'now', '{}', 'idem-1', 'now', 'now')`,
        )
        .run(),
    ).toThrow(/CHECK/i);
  });

  it('enforces uniqueness: canonical source identity and job idempotency keys', () => {
    const db = freshDb();
    db.prepare(
      `INSERT INTO sources (id, type, url, label, poll_interval_seconds, created_at, updated_at)
       VALUES ('s1', 'rss', 'https://example.org/feed.xml', '', 3600, 'now', 'now')`,
    ).run();
    db.prepare(
      `INSERT INTO source_items (id, source_id, guid, canonical_url, fetched_at, created_at)
       VALUES ('i1', 's1', 'guid-1', 'https://example.org/post-1', 'now', 'now')`,
    ).run();
    expect(() =>
      db
        .prepare(
          `INSERT INTO source_items (id, source_id, guid, canonical_url, fetched_at, created_at)
           VALUES ('i2', 's1', 'guid-2', 'https://example.org/post-1', 'now', 'now')`,
        )
        .run(),
    ).toThrow(/UNIQUE/i);

    const jobSql = `INSERT INTO jobs (id, kind, correlation_id, state, run_at, payload_json, idempotency_key, created_at, updated_at)
       VALUES (?, 'poll', 'corr', 'queued', 'now', '{}', ?, 'now', 'now')`;
    db.prepare(jobSql).run('j1', 'same-key');
    expect(() => db.prepare(jobSql).run('j2', 'same-key')).toThrow(/UNIQUE/i);
  });
});

describe('file databases', () => {
  it('uses WAL mode, a busy timeout and foreign key enforcement', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'rgstudio-db-'));
    tempDirs.push(dir);
    const db = openDatabase({ path: path.join(dir, 'studio.sqlite') });
    applyMigrations(db, MIGRATIONS_DIR);
    expect((db.prepare('PRAGMA journal_mode').get() as { journal_mode: string }).journal_mode).toBe(
      'wal',
    );
    expect(
      (db.prepare('PRAGMA foreign_keys').get() as { foreign_keys: number }).foreign_keys,
    ).toBe(1);
    expect(
      (db.prepare('PRAGMA busy_timeout').get() as { timeout: number }).timeout,
    ).toBeGreaterThanOrEqual(5000);
  });
});

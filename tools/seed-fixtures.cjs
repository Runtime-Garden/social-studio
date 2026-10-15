#!/usr/bin/env node
/**
 * P2 remainder: local dev seed fixtures (blueprint line 807).
 *
 * Standalone Node CJS script (no build step, mirrors tools/*.cjs) that
 * inserts the minimum demo content straight through the repository layer:
 * one source + story + scheduled/approved variant, one Studio project.
 * Idempotent: stable synthetic ids plus ON CONFLICT-verified inserts mean
 * a second run changes nothing.
 *
 * Usage: node tools/seed-fixtures.cjs [dbPath]
 * Env:   RG_ADMIN_USERNAME / RG_ADMIN_PASSWORD create the admin if absent
 *        (mirrors startServer's bootstrap rule for an empty table).
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const nodeCrypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');
const { createHash } = require('node:crypto');

const ROOT = path.resolve(__dirname, '..');
const MIGRATIONS = path.join(ROOT, 'migrations');
const dbPath = process.argv[2] || process.env.RG_DB_PATH || path.join(ROOT, 'data', 'studio.sqlite');
const SOURCE_URL = 'https://runtimegarden.example/engineering-notes';
const CANONICAL_URL = 'https://runtimegarden.example/engineering-notes/seed-post';
const SCHEDULED_AT = '2026-11-05T15:00:00.000Z';

function stableId(prefix, key) {
  return prefix + createHash('sha256').update(key).digest('hex').slice(0, 26);
}

function nowIso(offsetDays = 0) {
  return new Date(Date.now() + offsetDays * 86_400_000).toISOString();
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function migrate(db) {
  // Must match packages/storage/src/migrate.ts exactly (same table columns,
  // same recorded names) so the app's own applyMigrations() sees our work
  // and never re-applies 0001.
  db.exec(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
       version INTEGER PRIMARY KEY,
       name TEXT NOT NULL,
       applied_at TEXT NOT NULL
     )`,
  );
  const applied = new Set(
    (db.prepare('SELECT name FROM schema_migrations').all()).map((row) => row.name),
  );
  const files = fs
    .readdirSync(MIGRATIONS)
    .filter((name) => /^(\d{4})_.+\.sql$/.test(name))
    .sort();
  for (const name of files) {
    const recorded = name.replace(/\.sql$/, '');
    if (applied.has(recorded)) continue;
    const version = Number(name.slice(0, 4));
    db.exec(fs.readFileSync(path.join(MIGRATIONS, name), 'utf8'));
    db.prepare('INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)').run(
      version,
      recorded,
      nowIso(),
    );
  }
}

function seed(db) {
  const adminUsername = process.env.RG_ADMIN_USERNAME || 'owner';
  // Same self-describing format as apps/web/src/auth/passwords.ts so the
  // server's verifyPassword accepts the seeded admin.
  const adminSalt = nodeCrypto.randomBytes(16);
  const adminHash =
    `scrypt$16384$8$1$${adminSalt.toString('base64url')}$` +
    nodeCrypto
      .scryptSync(process.env.RG_ADMIN_PASSWORD || 'seed-passphrase', adminSalt, 64, {
        N: 16384,
        r: 8,
        p: 1,
      })
      .toString('base64url');

  // Admin only when the user table is empty (never reset an existing db).
  const userCount = db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
  let userId;
  if (userCount === 0) {
    userId = stableId('u', adminUsername);
    db.prepare(
      `INSERT INTO users (id, username, password_hash, role, created_at, updated_at)
       VALUES (?, ?, ?, 'admin', ?, ?)`,
    ).run(userId, adminUsername, adminHash, nowIso(), nowIso());
  } else {
    userId = db.prepare('SELECT id FROM users LIMIT 1').get().id;
  }

  // Source + item (UNIQUE (type,url) and UNIQUE canonical_url make re-runs no-ops).
  const sourceId = stableId('s', SOURCE_URL);
  const existingSource = db.prepare('SELECT id FROM sources WHERE url = ?').get(SOURCE_URL);
  const source = existingSource?.id ?? sourceId;
  if (!existingSource) {
    db.prepare(
      `INSERT INTO sources (id, type, url, label, enabled, created_at, updated_at)
       VALUES (?, 'manual', ?, 'Runtime Garden engineering notes', 1, ?, ?)`,
    ).run(source, SOURCE_URL, nowIso(), nowIso());
  }

  const itemId = stableId('i', CANONICAL_URL);
  const existingItem = db.prepare('SELECT id FROM source_items WHERE canonical_url = ?').get(CANONICAL_URL);
  if (!existingItem) {
    db.prepare(
      `INSERT INTO source_items (id, source_id, guid, canonical_url, title, summary, fetched_at, created_at, trust_state)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'trusted')`,
    ).run(
      itemId,
      source,
      'seed-guid-1',
      CANONICAL_URL,
      'Seed story: systems grow from small experiments',
      'Demo fixture for the local dev stack; no outbound calls.',
      nowIso(),
      nowIso(),
    );
  }

  const clusterId = stableId('c', 'seed-cluster-1');
  if (!db.prepare('SELECT id FROM story_clusters WHERE id = ?').get(clusterId)) {
    db.prepare(
      `INSERT INTO story_clusters (id, title, editorial_state, note, created_at, updated_at)
       VALUES (?, 'Seed cluster', 'promoted', 'Seeded fixture', ?, ?)`,
    ).run(clusterId, nowIso(), nowIso());
  }

  const contentId = stableId('ct', 'seed-story-1');
  const existingContent = db.prepare('SELECT id FROM content_items WHERE id = ?').get(contentId);
  if (!existingContent) {
    db.prepare(
      `INSERT INTO content_items (id, kind, title, cluster_id, source_item_id, editorial_state, author, created_at, updated_at)
       VALUES (?, 'original_work', 'Seed story: systems grow', ?, ?, 'verified', 'agent', ?, ?)`,
    ).run(contentId, clusterId, existingItem ? existingItem.id : itemId, nowIso(), nowIso());
  } else {
    db.prepare('UPDATE content_items SET editorial_state = ?, updated_at = ? WHERE id = ?').run(
      'verified',
      nowIso(),
      contentId,
    );
  }

  // Evidence claim with a stable id.
  const claimId = stableId('ec', 'seed-claim-1');
  if (!db.prepare('SELECT id FROM evidence_claims WHERE id = ?').get(claimId)) {
    db.prepare(
      `INSERT INTO evidence_claims (id, cluster_id, content_item_id, claim_text, evidence_url, verdict, verified_at, created_at)
       VALUES (?, ?, ?, ?, ?, 'verified', ?, ?)`,
    ).run(
      claimId,
      clusterId,
      contentId,
      'Small experiments compound into maintainable systems.',
      CANONICAL_URL + '#claim-1',
      nowIso(),
      nowIso(),
    );
  }

  // Approved, scheduled LinkedIn variant.
  const variantId = stableId('v', 'seed-variant-1');
  const existingVariant = db.prepare('SELECT id, revision FROM platform_variants WHERE id = ?').get(variantId);
  if (!existingVariant) {
    db.prepare(
      `INSERT INTO platform_variants (id, content_item_id, platform, revision, text, status, scheduled_at, created_at, updated_at)
       VALUES (?, ?, 'linkedin', 1, ?, 'approved_snapshot', ?, ?, ?)`,
    ).run(
      variantId,
      contentId,
      'Systems grow from small, documented experiments.',
      SCHEDULED_AT,
      nowIso(),
      nowIso(),
    );
  } else {
    db.prepare(
      `UPDATE platform_variants SET text = ?, status = 'approved_snapshot', scheduled_at = ?, updated_at = ? WHERE id = ?`,
    ).run(
      'Systems grow from small, documented experiments.',
      SCHEDULED_AT,
      nowIso(),
      variantId,
    );
  }

  const approvalId = stableId('a', 'seed-approval-1');
  if (!db.prepare('SELECT id FROM approvals WHERE id = ?').get(approvalId)) {
    db.prepare(
      `INSERT INTO approvals (id, variant_id, variant_revision, channel_id, approval_hash, approver_user_id, decision, decided_at)
       VALUES (?, ?, 1, 'seed-channel', ?, ?, 'approved', ?)`,
    ).run(approvalId, variantId, seedApprovalHash(db, variantId, contentId), userId, nowIso());
  }

  const publicationId = stableId('p', 'seed-publication-1');
  if (!db.prepare('SELECT id FROM publications WHERE id = ?').get(publicationId)) {
    db.prepare(
      `INSERT INTO publications (id, variant_id, variant_revision, channel_id, local_key, submission_state, created_at, updated_at)
       VALUES (?, ?, 1, 'seed-channel', ?, 'not_submitted', ?, ?)`,
    ).run(publicationId, variantId, 'seed-local-key-1', nowIso(), nowIso());
  }

  // A queued job to make the ops viewer non-empty.
  const jobId = stableId('j', 'seed-job-1');
  if (!db.prepare('SELECT id FROM jobs WHERE id = ?').get(jobId)) {
    db.prepare(
      `INSERT INTO jobs (id, kind, correlation_id, state, run_at, attempts, payload_json, idempotency_key, created_at, updated_at)
       VALUES (?, 'render_check', 'seed-corr-1', 'queued', ?, 0, '{"source":"seed"}', 'seed-idem-1', ?, ?)`,
    ).run(jobId, SCHEDULED_AT, nowIso(), nowIso());
  }

  // One online Studio project + revision 1.
  const projectJson = JSON.stringify({
    format: 'runtime-garden-social-studio',
    version: 2,
    name: 'Seed project',
    seriesPack: 'none',
    selected: 0,
    slides: [
      {
        id: 'cover',
        uid: 'seedcover',
        name: 'Editorial Cover',
        category: 'editorial',
        desc: 'The signature story opener',
        kicker: 'FIELD NOTES / 001',
        title: 'Where ideas grow into systems.',
        subtitle: 'A small, documented experiment.',
        tag: 'ENGINEERING NOTES',
        detail: 'Build. Experiment. Share.',
        bullets: 'Idea\nPrototype\nTest\nDocument',
        code: '',
        label: 'FIELD JOURNAL',
        customFooter: '',
        sourceUrl: CANONICAL_URL,
        date: '',
        caption: '',
        hashtags: '#RuntimeGarden #SoftwareEngineering',
        format: 'portrait',
        theme: 'light',
        align: 'left',
        pattern: 'dots',
        backgroundMode: 'default',
        scale: 1,
        numbering: false,
        showLogo: true,
        showDomain: true,
        showTag: true,
        showSubtitle: true,
        showGuides: false,
        image: null,
        imageFit: 'cover',
        imagePosition: 50,
        series: 'none',
        seriesLabel: '',
        seriesVariant: 'regular',
        chapterNumber: 1,
        customWidth: 1080,
        customHeight: 1350,
      },
    ],
  });
  const projectId = stableId('sp', 'seed-project-1');
  const existingProject = db.prepare('SELECT id FROM studio_projects WHERE id = ?').get(projectId);
  if (!existingProject) {
    const revisionId = stableId('pr', 'seed-project-1-revision-1');
    db.prepare(
      `INSERT INTO studio_projects (id, name, latest_revision, current_revision_id, created_at, updated_at)
       VALUES (?, 'Seed project', 1, ?, ?, ?)`,
    ).run(projectId, revisionId, nowIso(), nowIso());
    db.prepare(
      `INSERT INTO project_revisions (id, project_id, revision, project_json, schema_version, editor_version, revision_sha, created_at)
       VALUES (?, ?, 1, ?, 2, 'v3-seed', ?, ?)`,
    ).run(revisionId, projectId, projectJson, sha256Hex(projectJson), nowIso());
  }
}

/**
 * Canonical approval hash identical to packages/domain/src/approval.ts
 * (recursively key-sorted JSON, sha256) over the seeded subject, so the
 * seeded fixture reports approvalValid=true instead of looking stale.
 */
function seedApprovalHash(db, variantId, contentItemId) {
  const variant = db
    .prepare('SELECT revision, text, scheduled_at AS scheduledAt FROM platform_variants WHERE id = ?')
    .get(variantId);
  const sourceIds = db
    .prepare(
      `SELECT si.id AS id FROM source_items si
       WHERE si.id = (SELECT source_item_id FROM content_items WHERE id = ?)
          OR si.id IN (SELECT source_item_id FROM story_sources
                       WHERE cluster_id = (SELECT cluster_id FROM content_items WHERE id = ?))`,
    )
    .all(contentItemId, contentItemId)
    .map((row) => row.id)
    .filter(Boolean);
  const subject = {
    channel_id: 'seed-channel',
    format_metadata: {},
    ordered_asset_hashes: [],
    policy_version: 'p2-slice-4',
    source_ids: sourceIds.sort(),
    target_publish_at_utc: variant.scheduledAt,
    text: variant.text,
    variant_id: variantId,
    variant_revision: variant.revision,
  };
  return createHash('sha256').update(JSON.stringify(subject)).digest('hex');
}

function sha256Hex(text) {
  return createHash('sha256').update(text).digest('hex');
}

function main() {
  if (dbPath !== ':memory:') {
    fs.mkdirSync(path.dirname(path.resolve(dbPath)), { recursive: true });
  }
  const db = new DatabaseSync(dbPath === ':memory:' ? ':memory:' : path.resolve(dbPath));
  try {
    db.exec('PRAGMA foreign_keys = ON');
    db.exec('PRAGMA busy_timeout = 5000');
    db.exec('BEGIN');
    try {
      migrate(db);
      seed(db);
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
    db.exec('COMMIT');
    const counts = {      users: db.prepare('SELECT COUNT(*) AS n FROM users').get().n,
      stories: db.prepare('SELECT COUNT(*) AS n FROM content_items').get().n,
      variants: db.prepare('SELECT COUNT(*) AS n FROM platform_variants').get().n,
      projects: db.prepare('SELECT COUNT(*) AS n FROM studio_projects').get().n,
    };
    console.log(
      `Seeded ${dbPath}: ${counts.users} users, ${counts.stories} stories, ${counts.variants} variants, ${counts.projects} projects`,
    );
    assert(counts.stories > 0 && counts.projects > 0, 'seed verification failed');
  } finally {
    db.close();
  }
}

main();

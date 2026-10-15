/**
 * P2 slice 4: content read repositories (blueprint line 804).
 *
 * Sources → items → clusters → content items with citation joins
 * (sources + evidence claims), guarded editorial transitions via the
 * domain state machine, and platform variants with revision bumps.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it } from 'vitest';
import { openDatabase, type StudioDatabase } from '../../packages/storage/src/db.js';
import { applyMigrations } from '../../packages/storage/src/migrate.js';
import { approvalHash } from '../../packages/domain/src/approval.js';
import { createUser } from '../../packages/storage/src/repos/users.js';
import {
  addEvidenceClaim,
  createCluster,
  createContentItem,
  createSource,
  createSourceItem,
  createVariant,
  getContentItem,
  getVariant,
  latestApprovalForVariant,
  linkItemToCluster,
  listContentItems,
  saveApproval,
  transitionContentItem,
  updateVariantText,
  verifyVariantApproval,
} from '../../packages/storage/src/repos/content.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const MIGRATIONS_DIR = path.join(repoRoot, 'migrations');

let db: StudioDatabase;

beforeEach(() => {
  db = openDatabase({ path: ':memory:' });
  applyMigrations(db, MIGRATIONS_DIR);
});

describe('content inbox repositories', () => {
  it('creates source → item → cluster → content item with discovered state', () => {
    const source = createSource(db, {
      type: 'manual',
      url: 'https://example.com/feed',
      label: 'Example',
    });
    expect(source.id).toMatch(/^[0-9a-f]{32}$/);
    const item = createSourceItem(db, {
      sourceId: source.id,
      guid: 'guid-1',
      canonicalUrl: 'https://example.com/posts/1',
      title: 'First post',
      summary: 'Summary',
    });
    const cluster = createCluster(db, { title: 'Cluster one' });
    expect(cluster.editorialState).toBe('new');
    linkItemToCluster(db, cluster.id, item.id, 'member');
    const content = createContentItem(db, {
      kind: 'manual',
      title: 'Story one',
      clusterId: cluster.id,
      sourceItemId: item.id,
    });
    expect(content.editorialState).toBe('discovered');
  });

  it('returns sources + claims with citation URLs for one item', () => {
    const source = createSource(db, {
      type: 'manual',
      url: 'https://example.com/feed',
      label: 'Example',
    });
    const item = createSourceItem(db, {
      sourceId: source.id,
      guid: 'guid-1',
      canonicalUrl: 'https://example.com/posts/1',
      title: 'First post',
      summary: 'Summary',
    });
    const cluster = createCluster(db, { title: 'Cluster one' });
    linkItemToCluster(db, cluster.id, item.id, 'member');
    const content = createContentItem(db, {
      kind: 'manual',
      title: 'Story one',
      clusterId: cluster.id,
      sourceItemId: item.id,
    });
    addEvidenceClaim(db, {
      contentItemId: content.id,
      claimText: 'Ships real evidence',
      evidenceUrl: 'https://example.com/posts/1#proof',
      verdict: 'verified',
    });
    const full = getContentItem(db, content.id);
    expect(full?.sources.map((s) => s.canonicalUrl)).toContain('https://example.com/posts/1');
    expect(full?.claims[0]?.evidenceUrl).toBe('https://example.com/posts/1#proof');
    expect(full?.claims[0]?.verdict).toBe('verified');
    expect(listContentItems(db, {}).total).toBe(1);
  });

  it('guards transitions through the domain state machine', () => {
    const content = createContentItem(db, { kind: 'manual', title: 'Story one' });
    const moved = transitionContentItem(db, content.id, 'researched', { actor: 'owner' });
    expect(moved.editorialState).toBe('researched');
    expect(() => transitionContentItem(db, content.id, 'approved', { actor: 'owner' })).toThrow(
      'invalid_content_transition',
    );
  });

  it('bumps variant revision and resets status to draft on text edit', () => {
    const content = createContentItem(db, { kind: 'manual', title: 'Story one' });
    const variant = createVariant(db, {
      contentItemId: content.id,
      platform: 'linkedin',
      text: 'Hello',
    });
    expect(variant.revision).toBe(1);
    expect(variant.status).toBe('draft');
    const edited = updateVariantText(db, variant.id, 'Hello again');
    expect(edited.revision).toBe(2);
    expect(edited.status).toBe('draft');
    expect(getVariant(db, variant.id)?.text).toBe('Hello again');
  });
});

describe('variant approval binding', () => {
  it('verifies a saved approval against the identical subject', () => {
    const user = createUser(db, { username: 'owner', passwordHash: 'scrypt$demo' });
    const content = createContentItem(db, { kind: 'manual', title: 'Story one' });
    const variant = createVariant(db, {
      contentItemId: content.id,
      platform: 'linkedin',
      text: 'Hello',
    });
    const subject = {
      variantId: variant.id,
      variantRevision: variant.revision,
      channelId: 'chan-1',
      text: 'Hello',
      sourceIds: [],
      orderedAssetHashes: [],
      targetPublishAtUtc: null,
      formatMetadata: {},
      policyVersion: 'p2-slice-4',
    };
    const hash = approvalHash(subject);
    saveApproval(db, {
      variantId: variant.id,
      variantRevision: variant.revision,
      channelId: 'chan-1',
      approvalHash: hash,
      approverUserId: user.id,
      decision: 'approved',
    });
    expect(latestApprovalForVariant(db, variant.id)?.decision).toBe('approved');
    expect(verifyVariantApproval(db, variant.id, subject)).toBe(true);
  });

  it('fails verification after the approved text changes', () => {
    const user = createUser(db, { username: 'owner', passwordHash: 'scrypt$demo' });
    const content = createContentItem(db, { kind: 'manual', title: 'Story one' });
    const variant = createVariant(db, {
      contentItemId: content.id,
      platform: 'linkedin',
      text: 'Hello',
    });
    const subject = {
      variantId: variant.id,
      variantRevision: variant.revision,
      channelId: 'chan-1',
      text: 'Hello',
      sourceIds: [],
      orderedAssetHashes: [],
      targetPublishAtUtc: null,
      formatMetadata: {},
      policyVersion: 'p2-slice-4',
    };
    saveApproval(db, {
      variantId: variant.id,
      variantRevision: variant.revision,
      channelId: 'chan-1',
      approvalHash: approvalHash(subject),
      approverUserId: user.id,
      decision: 'approved',
    });
    updateVariantText(db, variant.id, 'Hello again');
    const edited = getVariant(db, variant.id)!;
    expect(
      verifyVariantApproval(db, variant.id, { ...subject, text: 'Hello again' }),
    ).toBe(false);
    expect(edited.revision).toBe(2);
  });
});

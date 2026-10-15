/**
 * P2: approval proof (blueprint 10.3).
 *
 * Approval binds to a canonical JSON serialization hashed with SHA-256.
 * Any edit changes the hash and therefore revokes the approval. These tests
 * pin: determinism, key-order independence, set-vs-sequence semantics and
 * sensitivity of every field.
 */
import { describe, expect, it } from 'vitest';
import {
  approvalHash,
  canonicalApprovalPayload,
  verifyApproval,
  type ApprovalSubject,
} from '../../packages/domain/src/approval.js';

const subject = () => ({
  variantId: 'var-1',
  variantRevision: 3,
  channelId: 'buf-channel-x',
  text: 'Runtime Garden ships an evidence-first workflow.',
  sourceIds: ['src-b', 'src-a'],
  orderedAssetHashes: ['sha256:aaa', 'sha256:bbb'],
  targetPublishAtUtc: '2026-10-20T09:00:00.000Z',
  formatMetadata: { format: 'portrait', width: 1080, height: 1350 },
  policyVersion: 'policy-2026-10-15',
});

describe('canonical approval payload', () => {
  it('is byte-stable across key insertion order', () => {
    const reordered = {
      policyVersion: 'policy-2026-10-15',
      formatMetadata: { height: 1350, width: 1080, format: 'portrait' },
      targetPublishAtUtc: '2026-10-20T09:00:00.000Z',
      orderedAssetHashes: ['sha256:aaa', 'sha256:bbb'],
      sourceIds: ['src-b', 'src-a'],
      text: 'Runtime Garden ships an evidence-first workflow.',
      channelId: 'buf-channel-x',
      variantRevision: 3,
      variantId: 'var-1',
    };
    expect(canonicalApprovalPayload(reordered)).toBe(canonicalApprovalPayload(subject()));
  });

  it('treats source ids as an unordered set but asset hashes as a sequence', () => {
    const base = subject();
    const sortedSources = { ...base, sourceIds: ['src-a', 'src-b'] };
    expect(approvalHash(sortedSources)).toBe(approvalHash(base));

    const swappedAssets = { ...base, orderedAssetHashes: ['sha256:bbb', 'sha256:aaa'] };
    expect(approvalHash(swappedAssets)).not.toBe(approvalHash(base));
  });
});

describe('approval hash sensitivity (change revokes approval)', () => {
  it('changes when any bound field changes', () => {
    const base = approvalHash(subject());
    const mutations: Array<Partial<ApprovalSubject>> = [
      { variantId: 'var-2' },
      { variantRevision: 4 },
      { channelId: 'buf-channel-linkedin' },
      { text: 'Runtime Garden ships an evidence-first workflow. ' },
      { sourceIds: ['src-a'] },
      { orderedAssetHashes: ['sha256:aaa', 'sha256:ccc'] },
      { targetPublishAtUtc: '2026-10-21T09:00:00.000Z' },
      { targetPublishAtUtc: null },
      { formatMetadata: { format: 'square', width: 1080, height: 1080 } },
      { policyVersion: 'policy-2026-10-16' },
    ];
    for (const mutation of mutations) {
      const changed = approvalHash({ ...subject(), ...mutation });
      expect(changed, JSON.stringify(mutation)).not.toBe(base);
    }
  });

  it('verifyApproval accepts the exact subject and rejects any drift', () => {
    const base = subject();
    const hash = approvalHash(base);
    expect(verifyApproval(hash, base)).toBe(true);
    expect(verifyApproval(hash, { ...base, text: `${base.text} Edited` })).toBe(false);
    expect(verifyApproval('not-a-real-hash', base)).toBe(false);
  });
});

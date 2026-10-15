/**
 * P2: approval proof (blueprint 10.3).
 *
 * An approval binds to the exact variant revision, channel, text, source ids,
 * ordered media hashes, schedule and policy version — hashed with SHA-256
 * over a canonical JSON serialization. Any later edit changes the hash and
 * therefore revokes the approval. Approvals are per channel: an approval for
 * channel A never authorizes channel B.
 */
import { createHash, timingSafeEqual } from 'node:crypto';

export interface ApprovalSubject {
  variantId: string;
  variantRevision: number;
  channelId: string;
  text: string;
  sourceIds: string[];
  orderedAssetHashes: string[];
  targetPublishAtUtc: string | null;
  formatMetadata: Record<string, unknown>;
  policyVersion: string;
}

/** Recursively sorts object keys so serialization is insertion-order stable. */
function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([key, entry]) => [key, canonicalize(entry)] as const);
    return Object.fromEntries(entries);
  }
  return value;
}

/**
 * Canonical payload:
 * - `sourceIds` are a set (sorted); `orderedAssetHashes` are a sequence.
 * - `formatMetadata` keys are sorted recursively.
 * - Timestamps are the exact UTC ISO strings that were approved.
 */
export function canonicalApprovalPayload(subject: ApprovalSubject): string {
  return JSON.stringify(
    canonicalize({
      variant_id: subject.variantId,
      variant_revision: subject.variantRevision,
      channel_id: subject.channelId,
      text: subject.text,
      source_ids: [...subject.sourceIds].sort(),
      ordered_asset_hashes: [...subject.orderedAssetHashes],
      target_publish_at_utc: subject.targetPublishAtUtc,
      format_metadata: subject.formatMetadata ?? {},
      policy_version: subject.policyVersion,
    }),
  );
}

export function approvalHash(subject: ApprovalSubject): string {
  return createHash('sha256').update(canonicalApprovalPayload(subject)).digest('hex');
}

/** True only when the stored hash still binds the exact same subject. */
export function verifyApproval(hash: string, subject: ApprovalSubject): boolean {
  const expected = approvalHash(subject);
  if (hash.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(hash, 'utf8'), Buffer.from(expected, 'utf8'));
}

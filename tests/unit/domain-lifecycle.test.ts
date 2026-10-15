/**
 * P2: workflow state machines (blueprint section 10).
 *
 * These tests pin the *product contract* for content editorial states and
 * per-channel publication states. The transition tables are deliberately
 * explicit: every allowed edge is asserted, every dishonest shortcut
 * (e.g. `submitting -> buffer_sent`) is asserted impossible.
 */
import { describe, expect, it } from 'vitest';
import {
  CONTENT_BRANCH_STATES,
  CONTENT_STATES,
  CONTENT_TRANSITIONS,
  PUBLICATION_STATES,
  canTransitionContent,
  canTransitionPublication,
} from '../../packages/domain/src/lifecycle.js';

describe('content editorial lifecycle (10.1)', () => {
  it('pins the main published sequence', () => {
    const main = [
      ['discovered', 'researched'],
      ['researched', 'verified'],
      ['verified', 'drafted'],
      ['drafted', 'in_review'],
      ['in_review', 'approved'],
      ['approved', 'scheduled'],
      ['scheduled', 'archived'],
    ] as const;
    for (const [from, to] of main) {
      expect(canTransitionContent(from, to), `${from} -> ${to}`).toBe(true);
    }
    expect(CONTENT_STATES).toEqual([
      'discovered',
      'researched',
      'verified',
      'drafted',
      'in_review',
      'approved',
      'scheduled',
      'archived',
    ]);
  });

  it('pins the branch states and their documented transitions', () => {
    expect(CONTENT_BRANCH_STATES).toEqual([
      'rejected',
      'needs_evidence',
      'revision_requested',
      'cancelled',
    ]);
    const branches = [
      ['in_review', 'rejected'],
      ['in_review', 'revision_requested'],
      ['revision_requested', 'drafted'],
      ['researched', 'needs_evidence'],
      ['needs_evidence', 'researched'],
      ['discovered', 'cancelled'],
      ['approved', 'cancelled'],
      ['rejected', 'archived'],
    ] as const;
    for (const [from, to] of branches) {
      expect(canTransitionContent(from, to), `${from} -> ${to}`).toBe(true);
    }
  });

  it('rejects skipped, reversed and out-of-terminal transitions', () => {
    const illegal = [
      ['discovered', 'approved'],
      ['discovered', 'drafted'],
      ['approved', 'drafted'],
      ['archived', 'discovered'],
      ['rejected', 'approved'],
      ['rejected', 'cancelled'],
      ['cancelled', 'discovered'],
      ['verified', 'in_review'],
    ] as const;
    for (const [from, to] of illegal) {
      expect(canTransitionContent(from, to), `${from} -> ${to}`).toBe(false);
    }
  });

  it('never transitions from or to an unknown state', () => {
    expect(canTransitionContent('discovered', 'published')).toBe(false);
    expect(canTransitionContent('bogus', 'researched')).toBe(false);
    expect(Object.keys(CONTENT_TRANSITIONS)).toEqual([...CONTENT_STATES, ...CONTENT_BRANCH_STATES]);
  });
});

describe('per-channel publication lifecycle (10.2)', () => {
  it('pins the honest submission sequence', () => {
    const main = [
      ['draft', 'policy_checked'],
      ['policy_checked', 'approved_snapshot'],
      ['approved_snapshot', 'ready_to_submit'],
      ['ready_to_submit', 'submitting'],
      ['submitting', 'submitted_to_buffer'],
      ['submitted_to_buffer', 'buffer_scheduled'],
      ['buffer_scheduled', 'buffer_sent'],
    ] as const;
    for (const [from, to] of main) {
      expect(canTransitionPublication(from, to), `${from} -> ${to}`).toBe(true);
    }
  });

  it('forbids claiming remote delivery straight from submitting', () => {
    // buffer_sent is only available after the remote state was observed.
    expect(canTransitionPublication('submitting', 'buffer_sent')).toBe(false);
    expect(canTransitionPublication('ready_to_submit', 'buffer_sent')).toBe(false);
    expect(canTransitionPublication('submitted_to_buffer', 'buffer_sent')).toBe(false);
  });

  it('supports the documented branches', () => {
    const branches = [
      ['draft', 'blocked'],
      ['draft', 'notification_only'],
      ['draft', 'cancelled'],
      ['policy_checked', 'blocked'],
      ['approved_snapshot', 'stale_approval'],
      ['stale_approval', 'draft'],
      ['submitting', 'submission_uncertain'],
      ['submitting', 'provider_error'],
      ['submission_uncertain', 'buffer_scheduled'],
      ['submission_uncertain', 'buffer_sent'],
      ['provider_error', 'ready_to_submit'],
      ['provider_error', 'needs_reconnect'],
      ['needs_reconnect', 'ready_to_submit'],
      ['blocked', 'draft'],
      ['notification_only', 'cancelled'],
    ] as const;
    for (const [from, to] of branches) {
      expect(canTransitionPublication(from, to), `${from} -> ${to}`).toBe(true);
    }
  });

  it('treats buffer_sent as terminal and rejects unknown states', () => {
    for (const state of PUBLICATION_STATES) {
      expect(canTransitionPublication('buffer_sent', state)).toBe(false);
    }
    expect(canTransitionPublication('published', 'buffer_sent')).toBe(false);
  });
});

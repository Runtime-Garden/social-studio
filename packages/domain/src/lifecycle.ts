/**
 * P2: explicit workflow state machines (blueprint section 10).
 *
 * Two deliberately separate contracts:
 * - The CONTENT lifecycle is editorial (the story), not a publishing status.
 * - The PUBLICATION lifecycle is per channel and never claims remote facts
 *   it has not observed: `buffer_sent` is reachable only through
 *   `buffer_scheduled` after a remote readback, never straight from
 *   `submitting`. Unknown results go to `submission_uncertain` for
 *   reconciliation instead of blind retries.
 */

export const CONTENT_STATES = [
  'discovered',
  'researched',
  'verified',
  'drafted',
  'in_review',
  'approved',
  'scheduled',
  'archived',
] as const;
export type ContentState = (typeof CONTENT_STATES)[number];

export const CONTENT_BRANCH_STATES = [
  'rejected',
  'needs_evidence',
  'revision_requested',
  'cancelled',
] as const;
export type ContentBranchState = (typeof CONTENT_BRANCH_STATES)[number];

export type AnyContentState = ContentState | ContentBranchState;

export const CONTENT_TRANSITIONS: Record<AnyContentState, readonly AnyContentState[]> = {
  discovered: ['researched', 'cancelled'],
  researched: ['verified', 'needs_evidence', 'cancelled'],
  verified: ['drafted', 'cancelled'],
  drafted: ['in_review', 'cancelled'],
  in_review: ['approved', 'rejected', 'revision_requested', 'cancelled'],
  approved: ['scheduled', 'cancelled'],
  scheduled: ['archived', 'cancelled'],
  archived: [],
  rejected: ['archived'],
  needs_evidence: ['researched', 'cancelled'],
  revision_requested: ['drafted', 'cancelled'],
  cancelled: [],
};

export function canTransitionContent(from: string, to: string): boolean {
  const allowed = (CONTENT_TRANSITIONS as Record<string, readonly string[] | undefined>)[from];
  return Array.isArray(allowed) && allowed.includes(to);
}

export const PUBLICATION_STATES = [
  'draft',
  'policy_checked',
  'approved_snapshot',
  'ready_to_submit',
  'submitting',
  'submitted_to_buffer',
  'buffer_scheduled',
  'buffer_sent',
  'blocked',
  'notification_only',
  'submission_uncertain',
  'provider_error',
  'cancelled',
  'stale_approval',
  'needs_reconnect',
] as const;
export type PublicationState = (typeof PUBLICATION_STATES)[number];

export const PUBLICATION_TRANSITIONS: Record<PublicationState, readonly PublicationState[]> = {
  draft: ['policy_checked', 'blocked', 'notification_only', 'cancelled'],
  policy_checked: ['approved_snapshot', 'blocked', 'cancelled'],
  approved_snapshot: ['ready_to_submit', 'stale_approval', 'cancelled'],
  ready_to_submit: ['submitting', 'cancelled'],
  submitting: ['submitted_to_buffer', 'submission_uncertain', 'provider_error'],
  submitted_to_buffer: ['buffer_scheduled', 'submission_uncertain', 'provider_error'],
  buffer_scheduled: ['buffer_sent', 'provider_error', 'cancelled'],
  buffer_sent: [],
  blocked: ['draft', 'cancelled'],
  notification_only: ['cancelled'],
  submission_uncertain: [
    'submitted_to_buffer',
    'buffer_scheduled',
    'buffer_sent',
    'provider_error',
    'cancelled',
  ],
  provider_error: ['ready_to_submit', 'needs_reconnect', 'cancelled'],
  cancelled: [],
  stale_approval: ['draft'],
  needs_reconnect: ['ready_to_submit', 'cancelled'],
};

export function canTransitionPublication(from: string, to: string): boolean {
  const allowed = (PUBLICATION_TRANSITIONS as Record<string, readonly string[] | undefined>)[from];
  return Array.isArray(allowed) && allowed.includes(to);
}

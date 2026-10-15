/**
 * P2 slice 4: content inbox + editorial transitions API (blueprint 804).
 *
 * Read contract for the Content Inbox UI: paginated listing, single-item
 * fetch with citation joins, and guarded transitions through the domain
 * state machine. Session on reads, session + CSRF on writes, audit on
 * every successful transition.
 */
import { Router, type Request, type Response } from 'express';
import type { StudioDatabase } from '../../../../packages/storage/src/db.js';
import { appendAuditEvent } from '../../../../packages/storage/src/repos/audit.js';
import {
  getContentItem,
  getVariant,
  latestApprovalForVariant,
  listContentItems,
  listVariantsForContent,
  saveApproval,
  setVariantStatus,
  sourceIdsForContent,
  transitionContentItem,
  updateVariantText,
  verifyVariantApproval,
} from '../../../../packages/storage/src/repos/content.js';
import {
  approvalHash,
  type ApprovalSubject,
} from '../../../../packages/domain/src/approval.js';
import { getPolicy } from '../../../../packages/storage/src/repos/policy.js';
import { getAuth, requireAuth, requireCsrf } from '../middleware/session.js';

interface Page {
  limit: number;
  offset: number;
}

function parsePagination(req: Request, defaultLimit: number): Page | null {
  const read = (raw: unknown, fallback: number): number | null => {
    if (raw === undefined) return fallback;
    if (typeof raw !== 'string' || !/^\d+$/.test(raw)) return null;
    const value = Number(raw);
    return Number.isSafeInteger(value) ? value : null;
  };
  const limit = read(req.query.limit, defaultLimit);
  const offset = read(req.query.offset, 0);
  if (limit === null || limit < 1 || limit > 100) return null;
  if (offset === null) return null;
  return { limit, offset };
}

/** Express 5 route params can type as string[]; only the plain string form is valid here. */
function stringParam(req: Request, name: string): string {
  const value = req.params[name];
  return typeof value === 'string' ? value : '';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function createContentRouter({ db }: { db: StudioDatabase }): Router {
  const router = Router();
  router.use(requireAuth);

  router.get('/items', (req, res) => {
    const page = parsePagination(req, 20);
    if (!page) {
      res.status(400).json({
        error: {
          code: 'invalid_request',
          message: 'limit must be an integer between 1 and 100; offset a non-negative integer',
        },
      });
      return;
    }
    const state = typeof req.query.state === 'string' ? req.query.state : undefined;
    const { items, total } = listContentItems(db, { ...page, state });
    res.status(200).json({ items, total, limit: page.limit, offset: page.offset });
  });

  router.get('/items/:id', (req, res) => {
    const found = getContentItem(db, stringParam(req, 'id'));
    if (!found) {
      res.status(404).json({ error: { code: 'content_not_found', message: 'No such story' } });
      return;
    }
    res.status(200).json(found);
  });

  router.get('/items/:id/variants', (req, res) => {
    const found = getContentItem(db, stringParam(req, 'id'));
    if (!found) {
      res.status(404).json({ error: { code: 'content_not_found', message: 'No such story' } });
      return;
    }
    res.status(200).json({
      variants: listVariantsForContent(db, found.item.id).map((v) => ({
        id: v.id,
        platform: v.platform,
        revision: v.revision,
        text: v.text,
        status: v.status,
      })),
    });
  });

  router.post('/items/:id/transition', requireCsrf, (req, res) => {
    const auth = getAuth(req)!;
    const id = stringParam(req, 'id');
    const to = isRecord(req.body) && typeof req.body.to === 'string' ? req.body.to : '';
    if (to === '') {
      res.status(400).json({
        error: { code: 'invalid_request', message: 'to must be a target editorial state' },
      });
      return;
    }
    try {
      const item = transitionContentItem(db, id, to, { actor: auth.user.username });
      appendAuditEvent(db, {
        actor: auth.user.username,
        action: 'content.transition',
        objectType: 'content_item',
        objectId: id,
        revision: to,
      });
      res.status(200).json({ item });
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (message === 'content_not_found') {
        res.status(404).json({ error: { code: 'content_not_found', message: 'No such story' } });
        return;
      }
      if (message.startsWith('invalid_content_transition')) {
        res.status(400).json({
          error: { code: 'invalid_content_transition', message },
        });
        return;
      }
      throw error;
    }
  });

  router.post('/variants/:id/text', requireCsrf, (req, res) => {
    const auth = getAuth(req)!;
    const id = stringParam(req, 'id');
    const before = getVariant(db, id);
    if (!before) {
      res.status(404).json({ error: { code: 'variant_not_found', message: 'No such variant' } });
      return;
    }
    const text = isRecord(req.body) && typeof req.body.text === 'string' ? req.body.text : '';
    if (text === '') {
      res.status(400).json({
        error: { code: 'invalid_request', message: 'text must be a non-empty string' },
      });
      return;
    }
    const edited = updateVariantText(db, id, text);
    appendAuditEvent(db, {
      actor: auth.user.username,
      action: 'variant.edited',
      objectType: 'platform_variant',
      objectId: id,
      revision: String(edited.revision),
    });
    // Edit-after-approval revokes: a previously-valid approved snapshot no
    // longer binds the new revision.
    const prior = latestApprovalForVariant(db, id);
    let status = edited.status;
    const preEditSubject =
      prior && prior.decision === 'approved' && prior.variantRevision === before.revision
        ? subjectFor(db, id, prior.channelId, before)
        : null;
    if (prior && preEditSubject && verifyVariantApproval(db, id, preEditSubject)) {
      setVariantStatus(db, id, 'stale_approval');
      status = 'stale_approval';
      appendAuditEvent(db, {
        actor: auth.user.username,
        action: 'approval.revoked',
        objectType: 'platform_variant',
        objectId: id,
        revision: String(edited.revision),
        reason: 'variant text changed after approval',
      });
    }
    res.status(200).json({ variant: { ...edited, status } });
  });

  router.post('/variants/:id/approvals', requireCsrf, (req, res) => {
    const auth = getAuth(req)!;
    const id = stringParam(req, 'id');
    const variant = getVariant(db, id);
    if (!variant) {
      res.status(404).json({ error: { code: 'variant_not_found', message: 'No such variant' } });
      return;
    }
    const body = isRecord(req.body) ? req.body : {};
    const decision =
      body.decision === 'approved' || body.decision === 'rejected' || body.decision === 'returned'
        ? body.decision
        : '';
    const channelId = typeof body.channelId === 'string' && body.channelId !== '' ? body.channelId : '';
    if (decision === '' || channelId === '') {
      res.status(400).json({
        error: {
          code: 'invalid_request',
          message: 'decision must be approved|rejected|returned and channelId non-empty',
        },
      });
      return;
    }
    const subject = subjectFor(db, id, channelId);
    if (!subject) {
      res.status(404).json({ error: { code: 'variant_not_found', message: 'No such variant' } });
      return;
    }
    const hash = approvalHash(subject);
    const approval = saveApproval(db, {
      variantId: id,
      variantRevision: variant.revision,
      channelId,
      approvalHash: hash,
      approverUserId: auth.user.id,
      decision,
    });
    if (decision === 'approved') setVariantStatus(db, id, 'approved_snapshot');
    appendAuditEvent(db, {
      actor: auth.user.username,
      action: `variant.${decision}`,
      objectType: 'platform_variant',
      objectId: id,
      revision: String(variant.revision),
    });
    res.status(201).json({ approval: publicApproval(approval) });
  });

  router.get('/variants/:id/approvals/latest', (req, res) => {
    const id = stringParam(req, 'id');
    if (!getVariant(db, id)) {
      res.status(404).json({ error: { code: 'variant_not_found', message: 'No such variant' } });
      return;
    }
    const latest = latestApprovalForVariant(db, id);
    if (!latest) {
      res.status(404).json({ error: { code: 'no_approval', message: 'No approval recorded' } });
      return;
    }
    const subject = subjectFor(db, id, latest.channelId);
    const valid = subject ? verifyVariantApproval(db, id, subject) : false;
    res.status(200).json({ approval: publicApproval(latest), valid });
  });

  router.post('/variants/:id/submit', requireCsrf, (req, res) => {
    const id = stringParam(req, 'id');
    if (!getVariant(db, id)) {
      res.status(404).json({ error: { code: 'variant_not_found', message: 'No such variant' } });
      return;
    }
    if (getPolicy(db).publishing_enabled !== true) {
      res.status(409).json({
        error: {
          code: 'publishing_disabled',
          message: 'Outbound publication is disabled by policy',
        },
      });
      return;
    }
    res.status(501).json({
      error: { code: 'not_implemented', message: 'Buffer submission arrives in P3' },
    });
  });

  return router;
}

/** Snapshot policy version pinned for slice-4 fixture approvals. */
const APPROVAL_POLICY_VERSION = 'p2-slice-4';

function publicApproval(approval: {
  id: string;
  variantRevision: number;
  channelId: string;
  decision: string;
}): Record<string, unknown> {
  return {
    id: approval.id,
    variantRevision: approval.variantRevision,
    channelId: approval.channelId,
    decision: approval.decision,
  };
}

/**
 * Reconstructs the approval subject from current DB state so `latest`
 * validity reflects live reality: same derivation as approval time means
 * any text/revision drift fails verification.
 */
function subjectFor(
  db: StudioDatabase,
  variantId: string,
  channelId: string,
  override?: { text: string; revision: number; scheduledAt: string | null; contentItemId: string },
): ApprovalSubject | null {
  const variant = override ?? getVariant(db, variantId);
  if (!variant) return null;
  return {
    variantId,
    variantRevision: variant.revision,
    channelId,
    text: variant.text,
    sourceIds: sourceIdsForContent(db, variant.contentItemId),
    orderedAssetHashes: [],
    targetPublishAtUtc: variant.scheduledAt,
    formatMetadata: {},
    policyVersion: APPROVAL_POLICY_VERSION,
  };
}

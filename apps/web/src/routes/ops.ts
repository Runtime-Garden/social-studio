/**
 * P2 slice 4: ops API — policy gate, audit/jobs viewers, pause controls
 * (blueprint lines 806, 808).
 *
 * Publishing and autonomy default OFF and stay OFF in this slice: pause is
 * idempotent, resume provably refuses (`publishing_disabled_by_default`).
 * Reads need a session; writes need session + CSRF and append audit events.
 */
import { Router, type Request, type Response } from 'express';
import type { StudioDatabase } from '../../../../packages/storage/src/db.js';
import {
  appendAuditEvent,
  countAuditEvents,
  listAuditEvents,
} from '../../../../packages/storage/src/repos/audit.js';
import {
  getPolicy,
  setPolicyValue,
} from '../../../../packages/storage/src/repos/policy.js';
import {
  isPolicyKey,
  isValidPolicyValue,
} from '../../../../packages/domain/src/policy.js';
import { getAuth, requireAuth, requireCsrf } from '../middleware/session.js';

/** Express 5 route params can type as string[]; only the plain string form is valid here. */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parsePagination(req: Request, defaultLimit: number): { limit: number; offset: number } | null {
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

export function createOpsRouter({ db }: { db: StudioDatabase }): Router {
  const router = Router();
  router.use(requireAuth);

  router.get('/policy', (_req, res) => {
    res.status(200).json({ policy: getPolicy(db) });
  });

  router.post('/policy', requireCsrf, (req, res) => {
    const auth = getAuth(req)!;
    const body = isRecord(req.body) ? req.body : {};
    const key = typeof body.key === 'string' ? body.key : '';
    if (!isPolicyKey(key)) {
      res.status(400).json({
        error: { code: 'unknown_policy_key', message: `Unknown policy key: ${key}` },
      });
      return;
    }
    if (!isValidPolicyValue(key, body.value)) {
      res.status(400).json({
        error: { code: 'invalid_request', message: `Invalid value type for policy key ${key}` },
      });
      return;
    }
    setPolicyValue(db, key, body.value);
    appendAuditEvent(db, {
      actor: auth.user.username,
      action: 'policy.updated',
      objectType: 'policy',
      objectId: key,
    });
    res.status(200).json({ policy: getPolicy(db) });
  });

  router.post('/pause', requireCsrf, (req, res) => {
    const auth = getAuth(req)!;
    const body = isRecord(req.body) ? req.body : {};
    setPolicyValue(db, 'publishing_enabled', false);
    appendAuditEvent(db, {
      actor: auth.user.username,
      action: 'publishing.paused',
      objectType: 'policy',
      objectId: 'publishing_enabled',
      reason: typeof body.reason === 'string' ? body.reason : undefined,
    });
    res.status(200).json({ policy: getPolicy(db) });
  });

  router.post('/resume', requireCsrf, (_req, res) => {
    res.status(409).json({
      error: {
        code: 'publishing_disabled_by_default',
        message: 'Publishing stays disabled by default; the explicit re-authed enable flow arrives in a later slice',
      },
    });
  });

  router.get('/audit', (req, res) => {
    const page = parsePagination(req, 50);
    if (!page) {
      res.status(400).json({
        error: {
          code: 'invalid_request',
          message: 'limit must be an integer between 1 and 100; offset a non-negative integer',
        },
      });
      return;
    }
    res.status(200).json({
      events: listAuditEvents(db, page),
      total: countAuditEvents(db),
      limit: page.limit,
      offset: page.offset,
    });
  });

  router.get('/jobs', (req, res) => {
    const page = parsePagination(req, 50);
    if (!page) {
      res.status(400).json({
        error: {
          code: 'invalid_request',
          message: 'limit must be an integer between 1 and 100; offset a non-negative integer',
        },
      });
      return;
    }
    const jobs = db
      .prepare(
        `SELECT id, kind, state, run_at, attempts, last_error, created_at, updated_at
         FROM jobs ORDER BY created_at DESC, rowid DESC LIMIT ? OFFSET ?`,
      )
      .all(page.limit, page.offset);
    const { n } = db.prepare('SELECT COUNT(*) AS n FROM jobs').get() as { n: number };
    res.status(200).json({ jobs, total: n, limit: page.limit, offset: page.offset });
  });

  return router;
}

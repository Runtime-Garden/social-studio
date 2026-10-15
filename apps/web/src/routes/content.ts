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
  listContentItems,
  transitionContentItem,
} from '../../../../packages/storage/src/repos/content.js';
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

  return router;
}

/**
 * P2 remainder: schedule/calendar + publication-status read API
 * (blueprint line 805).
 *
 * Placeholders from real DB state only — no scheduling mutations, no
 * submission path. Reads require a session. Unknown timezones fall back
 * to UTC; malformed dates are 400s.
 */
import { Router, type Request, type Response } from 'express';
import type { StudioDatabase } from '../../../../packages/storage/src/db.js';
import {
  getPublicationStatus,
  listScheduled,
} from '../../../../packages/storage/src/repos/scheduling.js';
import { requireAuth } from '../middleware/session.js';

const DAY = /^\d{4}-\d{2}-\d{2}$/;

function resolveTimeZone(raw: unknown): string {
  if (typeof raw !== 'string' || raw === '') return 'UTC';
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: raw }).format(new Date(0));
    return raw;
  } catch {
    return 'UTC';
  }
}

function dayKey(isoUtc: string): string {
  return isoUtc.slice(0, 10);
}

export function createScheduleRouter({ db }: { db: StudioDatabase }): Router {
  const router = Router();
  router.use(requireAuth);

  router.get('/calendar', (req, res) => {
    const from = typeof req.query.from === 'string' ? req.query.from : '';
    const to = typeof req.query.to === 'string' ? req.query.to : '';
    if (!DAY.test(from) || !DAY.test(to) || from > to) {
      res.status(400).json({
        error: { code: 'invalid_request', message: 'from/to must be YYYY-MM-DD with from <= to' },
      });
      return;
    }
    const tz = resolveTimeZone(req.query.tz);
    const local = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      dateStyle: 'medium',
      timeStyle: 'short',
    });
    const entries = listScheduled(db, {
      from: `${from}T00:00:00.000Z`,
      to: `${to}T23:59:59.999Z`,
    });
    const byDay = new Map<string, Array<Record<string, unknown>>>();
    for (const entry of entries) {
      const list = byDay.get(dayKey(entry.scheduledAt)) ?? [];
      list.push({
        variantId: entry.variantId,
        channelId: entry.channelId,
        scheduledAtUtc: entry.scheduledAt,
        scheduledAtLocal: local.format(new Date(entry.scheduledAt)),
        status: entry.status,
        text: entry.text,
      });
      byDay.set(dayKey(entry.scheduledAt), list);
    }
    const days: Array<{ date: string; entries: Array<Record<string, unknown>> }> = [];
    for (let cursor = from; cursor <= to; cursor = nextDay(cursor)) {
      days.push({ date: cursor, entries: byDay.get(cursor) ?? [] });
    }
    res.status(200).json({ days, tz, from, to });
  });

  router.get('/publications', (req, res) => {
    const variantId = typeof req.query.variantId === 'string' ? req.query.variantId : '';
    if (variantId === '') {
      res.status(400).json({
        error: { code: 'invalid_request', message: 'variantId is required' },
      });
      return;
    }
    res.status(200).json({ channels: getPublicationStatus(db, variantId) });
  });

  return router;
}

function nextDay(isoDate: string): string {
  const next = new Date(`${isoDate}T00:00:00.000Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString().slice(0, 10);
}

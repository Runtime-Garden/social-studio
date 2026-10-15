/**
 * P2 slice 2: health endpoints (blueprint 11: liveness vs real readiness).
 *
 * `/health/live` never touches dependencies; `/health/ready` proves the
 * database answers and the migrations ran. No secrets in either response.
 */
import { Router } from 'express';
import type { StudioDatabase } from '../../../../packages/storage/src/db.js';

export function createHealthRouter({ db }: { db: StudioDatabase }): Router {
  const router = Router();

  router.get('/live', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  router.get('/ready', (_req, res) => {
    try {
      const row = db.prepare('SELECT COUNT(*) AS n FROM schema_migrations').get() as {
        n: number;
      };
      res.status(200).json({ status: 'ready', migrations: row.n });
    } catch {
      res.status(503).json({
        status: 'unavailable',
        error: { code: 'not_ready', message: 'Database not ready' },
      });
    }
  });

  return router;
}

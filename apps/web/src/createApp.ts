/**
 * P2 slice 2: Express app assembly.
 *
 * One JSON error shape everywhere: `{ error: { code, message } }`. The JSON
 * body cap is 64kb; malformed and oversized bodies map to stable codes.
 * Middleware order matters: security headers, body parsing, session
 * resolution, routes, 404, error handler last. Slice 3b adds the app shell:
 * page routes (login/studio gating), the web app's own static files and the
 * shared /assets bundle (Design Kit files + built studio-core).
 */
import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import type { StudioDatabase } from '../../../packages/storage/src/db.js';
import type { WebConfig } from './config.js';
import { securityHeaders } from './middleware/security.js';
import { sessionMiddleware } from './middleware/session.js';
import { createAuthRouter } from './routes/auth.js';
import { createContentRouter } from './routes/content.js';
import { createHealthRouter } from './routes/health.js';
import { createOpsRouter } from './routes/ops.js';
import { createScheduleRouter } from './routes/schedule.js';
import { createAssetRouter, createPagesRouter } from './routes/pages.js';
import { createProjectsRouter } from './routes/projects.js';

export interface CreateAppOptions {
  db: StudioDatabase;
  config: WebConfig;
}

export function createApp({ db, config }: CreateAppOptions): Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(securityHeaders);
  app.use(express.json({ limit: '64kb' }));
  app.use(sessionMiddleware(db));

  app.use('/health', createHealthRouter({ db }));
  app.use('/api/v1/auth', createAuthRouter({ db, config }));
  app.use('/api/v1/projects', createProjectsRouter({ db }));
  app.use('/api/v1/content', createContentRouter({ db }));
  app.use('/api/v1/ops', createOpsRouter({ db }));
  app.use('/api/v1/schedule', createScheduleRouter({ db }));

  app.use(createPagesRouter(config));
  app.use(express.static(config.staticDir, { index: false }));
  app.use('/assets', createAssetRouter(config));

  app.use((req: Request, res: Response) => {
    res
      .status(404)
      .json({ error: { code: 'not_found', message: `No route for ${req.method} ${req.path}` } });
  });

  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const err = error as { type?: string; status?: number; statusCode?: number } | null;
    const status = err?.status ?? err?.statusCode;
    if (err?.type === 'entity.too.large' || status === 413) {
      res.status(413).json({
        error: { code: 'payload_too_large', message: 'Request body exceeds the 64kb limit' },
      });
      return;
    }
    if (err?.type === 'entity.parse.failed' || status === 400) {
      res
        .status(400)
        .json({ error: { code: 'malformed_json', message: 'Request body is not valid JSON' } });
      return;
    }
    console.error('[rgstudio-web] unhandled error', error);
    res.status(500).json({ error: { code: 'internal', message: 'Internal server error' } });
  });

  return app;
}

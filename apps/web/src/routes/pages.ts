/**
 * P2 slice 3b: page routes and shared asset routes.
 *
 * The app shell pages are delivered to any visitor (they contain no data);
 * the editor page itself is gated server-side on a live session and bounces
 * to /login without one. Assets are the Design Kit v2 files plus the built
 * studio-core bundle — the same shared code the offline editor runs.
 */
import express, { Router, type Response } from 'express';
import path from 'node:path';
import type { WebConfig } from '../config.js';
import { getAuth } from '../middleware/session.js';

export function createPagesRouter(config: WebConfig): Router {
  const router = Router();
  const sendPage = (res: Response, file: string): void => {
    res.sendFile(path.join(config.staticDir, file));
  };

  router.get('/', (_req, res) => {
    res.redirect('/studio/');
  });

  router.get('/login', (req, res) => {
    if (getAuth(req)) {
      res.redirect('/studio/');
      return;
    }
    sendPage(res, 'login.html');
  });

  // Express 5: '/studio' also matches '/studio/' and first match wins, so a
  // separate '/studio/' route would be unreachable (and a '/studio' redirect
  // would loop). One handler covers both and canonicalizes the URL.
  router.get(['/studio', '/studio/'], (req, res) => {
    if (!getAuth(req)) {
      res.redirect('/login');
      return;
    }
    if (req.path === '/studio') {
      res.redirect('/studio/');
      return;
    }
    sendPage(res, 'studio.html');
  });

  return router;
}

export function createAssetRouter(config: WebConfig): Router {
  const router = Router();
  router.get('/studio-core.js', (_req, res) => {
    res.type('application/javascript');
    res.sendFile(config.studioCoreFile);
  });
  router.use(express.static(config.assetsDir, { index: false }));
  return router;
}

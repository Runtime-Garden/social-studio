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

  // Same Express-5 canonicalization shape as /studio (see above).
  // The bounce preserves the full path+query (?month=) via originalUrl so
  // sign-in returns to the viewed month; login.js guards it same-origin.
  router.get(['/calendar', '/calendar/'], (req, res) => {
    if (!getAuth(req)) {
      res.redirect(`/login?next=${encodeURIComponent(req.originalUrl)}`);
      return;
    }
    if (req.path === '/calendar') {
      res.redirect('/calendar/');
      return;
    }
    sendPage(res, 'calendar.html');
  });
  // The bounce carries ?next= so the sign-in page can return here; the
  // /studio/ bounce stays a bare /login because /studio/ is already the
  // default post-login target (pinned by web-pages tests).
  router.get(['/content', '/content/'], (req, res) => {
    if (!getAuth(req)) {
      res.redirect('/login?next=/content/');
      return;
    }
    if (req.path === '/content') {
      res.redirect('/content/');
      return;
    }
    sendPage(res, 'content.html');
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

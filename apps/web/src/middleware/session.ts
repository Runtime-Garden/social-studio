/**
 * P2 slice 2: session resolution, authorization and CSRF guards (blueprint 11).
 *
 * The session cookie is opaque; the database stores only its SHA-256. Disabled
 * users are treated as unauthenticated even while holding a live session.
 * Mutating routes must echo the session-bound CSRF token in `x-csrf-token`;
 * comparison is constant-time and cross-session tokens are rejected because
 * the expected value comes from the session row itself.
 */
import { timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { StudioDatabase } from '../../../../packages/storage/src/db.js';
import {
  findActiveSession,
  type ActiveSession,
} from '../../../../packages/storage/src/repos/sessions.js';
import { findUserById, type UserRow } from '../../../../packages/storage/src/repos/users.js';
import { SESSION_COOKIE } from '../config.js';

export interface AuthContext {
  session: ActiveSession;
  user: UserRow;
}

export interface AuthedRequest extends Request {
  auth?: AuthContext;
}

export function getAuth(req: Request): AuthContext | undefined {
  return (req as AuthedRequest).auth;
}

function readCookie(header: string | undefined, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(/;\s*/)) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    if (part.slice(0, eq) === name) return part.slice(eq + 1);
  }
  return null;
}

function constantTimeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && a.length > 0 && timingSafeEqual(a, b);
}

export function sessionMiddleware(db: StudioDatabase): RequestHandler {
  return (req, _res, next) => {
    const token = readCookie(req.headers.cookie, SESSION_COOKIE);
    if (token !== null) {
      const session = findActiveSession(db, token);
      if (session) {
        const user = findUserById(db, session.userId);
        if (user && user.disabledAt === null) {
          (req as AuthedRequest).auth = { session, user };
        }
      }
    }
    next();
  };
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!getAuth(req)) {
    res.status(401).json({ error: { code: 'unauthorized', message: 'Authentication required' } });
    return;
  }
  next();
}

export function requireCsrf(req: Request, res: Response, next: NextFunction): void {
  const auth = getAuth(req);
  if (!auth) {
    res.status(401).json({ error: { code: 'unauthorized', message: 'Authentication required' } });
    return;
  }
  const provided = req.get('x-csrf-token') ?? '';
  if (!constantTimeEqual(provided, auth.session.csrfToken)) {
    res
      .status(403)
      .json({ error: { code: 'csrf_invalid', message: 'Missing or invalid CSRF token' } });
    return;
  }
  next();
}

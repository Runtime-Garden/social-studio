/**
 * P2 slice 2: authentication routes (blueprint 11 `/auth/*`).
 *
 * Uniform failure semantics: wrong password, unknown user and disabled
 * account all yield the same 401 body after a real scrypt verification
 * (unknown users are verified against a throwaway hash so response timing
 * does not reveal whether the username exists). Successful and failed
 * logins and logouts append audit events; passwords and tokens never do.
 */
import { randomBytes } from 'node:crypto';
import { Router, type CookieOptions } from 'express';
import type { StudioDatabase } from '../../../../packages/storage/src/db.js';
import { appendAuditEvent } from '../../../../packages/storage/src/repos/audit.js';
import {
  createSession,
  revokeSessionById,
} from '../../../../packages/storage/src/repos/sessions.js';
import { findUserByUsername, type UserRow } from '../../../../packages/storage/src/repos/users.js';
import { hashPassword, verifyPassword } from '../auth/passwords.js';
import { createLoginRateLimiter } from '../auth/rateLimit.js';
import { SESSION_COOKIE, type WebConfig } from '../config.js';
import { getAuth, requireAuth, requireCsrf } from '../middleware/session.js';

let dummyHash: string | undefined;
function getDummyHash(): string {
  dummyHash ??= hashPassword(randomBytes(16).toString('hex'));
  return dummyHash;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function publicUser(user: UserRow): { id: string; username: string; role: string } {
  return { id: user.id, username: user.username, role: user.role };
}

function sessionCookieOptions(config: WebConfig): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'strict',
    path: '/',
    maxAge: config.sessionTtlMs,
    secure: config.secureCookies,
  };
}

export interface AuthRouterOptions {
  db: StudioDatabase;
  config: WebConfig;
}

export function createAuthRouter({ db, config }: AuthRouterOptions): Router {
  const router = Router();
  const limiter = createLoginRateLimiter(config.loginRateLimit);

  router.post('/login', (req, res) => {
    const body: unknown = req.body;
    const username =
      isRecord(body) && typeof body.username === 'string' ? body.username.trim() : '';
    const password = isRecord(body) && typeof body.password === 'string' ? body.password : '';
    if (username === '' || password === '') {
      res
        .status(400)
        .json({ error: { code: 'invalid_request', message: 'username and password are required' } });
      return;
    }

    const key = `${req.socket.remoteAddress ?? 'unknown'}|${username.toLowerCase()}`;
    const verdict = limiter.check(key);
    if (!verdict.allowed) {
      res.set('retry-after', String(Math.max(1, Math.ceil(verdict.retryAfterMs / 1000))));
      res.status(429).json({
        error: { code: 'rate_limited', message: 'Too many login attempts; try again later' },
      });
      return;
    }

    const user = findUserByUsername(db, username);
    const verified = verifyPassword(password, user?.passwordHash ?? getDummyHash());
    if (!user || user.disabledAt !== null || !verified) {
      limiter.recordFailure(key);
      appendAuditEvent(db, {
        actor: user?.username ?? 'anonymous',
        action: 'auth.login_failed',
        objectType: 'user',
        objectId: user?.id,
        reason: 'invalid_credentials',
      });
      res
        .status(401)
        .json({ error: { code: 'invalid_credentials', message: 'Invalid username or password' } });
      return;
    }

    limiter.reset(key);
    const session = createSession(db, user.id, { ttlMs: config.sessionTtlMs });
    appendAuditEvent(db, {
      actor: user.username,
      action: 'auth.login_succeeded',
      objectType: 'user',
      objectId: user.id,
    });
    res.cookie(SESSION_COOKIE, session.token, sessionCookieOptions(config));
    res.status(200).json({
      user: publicUser(user),
      csrfToken: session.csrfToken,
      expiresAt: session.expiresAt,
    });
  });

  router.get('/me', requireAuth, (req, res) => {
    const auth = getAuth(req)!;
    res.status(200).json({
      user: publicUser(auth.user),
      csrfToken: auth.session.csrfToken,
      expiresAt: auth.session.expiresAt,
    });
  });

  router.post('/logout', requireAuth, requireCsrf, (req, res) => {
    const auth = getAuth(req)!;
    revokeSessionById(db, auth.session.id);
    appendAuditEvent(db, {
      actor: auth.user.username,
      action: 'auth.logout',
      objectType: 'user',
      objectId: auth.user.id,
    });
    res.clearCookie(SESSION_COOKIE, sessionCookieOptions(config));
    res.status(204).end();
  });

  return router;
}

/**
 * P2 slice 2: real-HTTP integration tests for the web skeleton (blueprint 11).
 *
 * Every case drives the actual Express app over an ephemeral localhost port
 * backed by a real (in-memory or temp-file) SQLite database: secure admin
 * bootstrap, login/logout/me lifecycle, session-bound CSRF, login rate
 * limiting, cookie attributes, security headers, error format, health
 * endpoints and restart persistence. No mocks: HTTP client is global fetch.
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { WebConfig } from '../../apps/web/src/config.js';
import { startServer, type StartedServer } from '../../apps/web/src/server.js';
import { listAuditEvents } from '../../packages/storage/src/repos/audit.js';

const ADMIN = { username: 'owner', password: 'test-admin-passphrase' };
const DEFAULT_TTL_MS = 12 * 60 * 60 * 1000;

interface ErrorBody {
  error: { code: string; message: string };
}
interface UserBody {
  id: string;
  username: string;
  role: string;
}
interface LoginBody {
  user: UserBody;
  csrfToken: string;
  expiresAt: string;
}

let active: StartedServer | null = null;
const tempDirs: string[] = [];

async function start(overrides: Partial<WebConfig> = {}): Promise<StartedServer> {
  active = await startServer({ dbPath: ':memory:', port: 0, adminBootstrap: { ...ADMIN }, ...overrides });
  return active;
}

afterEach(async () => {
  if (active) {
    await active.close();
    active = null;
  }
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function setCookies(res: Response): string[] {
  return res.headers.getSetCookie();
}

function cookiePair(res: Response, name = 'rg_session'): string {
  const found = setCookies(res).find((cookie) => cookie.startsWith(`${name}=`));
  if (!found) throw new Error(`missing ${name} cookie; got: ${setCookies(res).join(' | ')}`);
  return found.split(';')[0]!;
}

function rawCookie(res: Response, name = 'rg_session'): string {
  const found = setCookies(res).find((cookie) => cookie.startsWith(`${name}=`));
  if (!found) throw new Error(`missing ${name} cookie; got: ${setCookies(res).join(' | ')}`);
  return found;
}

function loginAttempt(
  server: StartedServer,
  credentials: { username: string; password: string } = ADMIN,
): Promise<Response> {
  return fetch(`${server.url}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(credentials),
  });
}

async function loginOk(
  server: StartedServer,
  credentials: { username: string; password: string } = ADMIN,
): Promise<{ cookie: string; csrfToken: string; body: LoginBody; res: Response }> {
  const res = await loginAttempt(server, credentials);
  expect(res.status).toBe(200);
  const body = (await res.json()) as LoginBody;
  return { cookie: cookiePair(res), csrfToken: body.csrfToken, body, res };
}

describe('auth lifecycle', () => {
  it('bootstraps the admin and completes login/me/logout with audit trail', async () => {
    const server = await start();

    const live = await fetch(`${server.url}/health/live`);
    expect(live.status).toBe(200);
    expect(await live.json()).toEqual({ status: 'ok' });

    const login = await loginOk(server);
    expect(login.body.user.username).toBe('owner');
    expect(login.body.user.role).toBe('admin');
    expect(login.body.csrfToken).toMatch(/^[A-Za-z0-9_-]{40,}$/);
    expect(login.body.csrfToken).not.toBe(login.cookie.split('=')[1]);
    const expiresAt = Date.parse(login.body.expiresAt);
    expect(expiresAt).toBeGreaterThan(Date.now());
    expect(expiresAt).toBeLessThanOrEqual(Date.now() + DEFAULT_TTL_MS + 10_000);

    const cookie = rawCookie(login.res);
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Strict');
    expect(cookie).toContain('Path=/');
    expect(cookie).toMatch(/Max-Age=43200/);
    expect(cookie).not.toContain('Secure');

    const me = await fetch(`${server.url}/api/v1/auth/me`, {
      headers: { cookie: login.cookie },
    });
    expect(me.status).toBe(200);
    const meBody = (await me.json()) as LoginBody;
    expect(meBody.user.username).toBe('owner');
    expect(meBody.csrfToken).toBe(login.csrfToken);
    expect(meBody.expiresAt).toBe(login.body.expiresAt);

    const logout = await fetch(`${server.url}/api/v1/auth/logout`, {
      method: 'POST',
      headers: { cookie: login.cookie, 'x-csrf-token': login.csrfToken },
    });
    expect(logout.status).toBe(204);
    const cleared = rawCookie(logout);
    expect(cleared.startsWith('rg_session=;')).toBe(true);
    expect(cleared).toContain('Expires=Thu, 01 Jan 1970');

    const after = await fetch(`${server.url}/api/v1/auth/me`, {
      headers: { cookie: login.cookie },
    });
    expect(after.status).toBe(401);
    expect(((await after.json()) as ErrorBody).error.code).toBe('unauthorized');

    const actions = listAuditEvents(server.db).map((event) => event.action);
    expect(actions).toContain('auth.login_succeeded');
    expect(actions).toContain('auth.logout');
  });

  it('answers wrong passwords, unknown users and disabled accounts uniformly', async () => {
    const server = await start();

    const wrong = await loginAttempt(server, { username: 'owner', password: 'not-it' });
    expect(wrong.status).toBe(401);
    const wrongBody = (await wrong.json()) as ErrorBody;
    expect(wrongBody.error.code).toBe('invalid_credentials');

    const unknown = await loginAttempt(server, { username: 'ghost', password: 'not-it' });
    expect(unknown.status).toBe(401);
    const unknownBody = (await unknown.json()) as ErrorBody;
    expect(unknownBody).toEqual(wrongBody);

    const login = await loginOk(server);
    server.db
      .prepare('UPDATE users SET disabled_at = ? WHERE username = ?')
      .run(new Date().toISOString(), 'owner');

    const disabledLogin = await loginAttempt(server);
    expect(disabledLogin.status).toBe(401);
    expect(((await disabledLogin.json()) as ErrorBody).error.code).toBe('invalid_credentials');

    const disabledSession = await fetch(`${server.url}/api/v1/auth/me`, {
      headers: { cookie: login.cookie },
    });
    expect(disabledSession.status).toBe(401);

    const failures = listAuditEvents(server.db).filter(
      (event) => event.action === 'auth.login_failed',
    );
    expect(failures).toHaveLength(3);
    expect(failures.every((event) => event.reason === 'invalid_credentials')).toBe(true);
  });

  it('rejects expired sessions', async () => {
    const server = await start();
    const login = await loginOk(server);

    server.db.prepare('UPDATE sessions SET expires_at = ?').run(
      new Date(Date.now() - 1000).toISOString(),
    );

    const me = await fetch(`${server.url}/api/v1/auth/me`, {
      headers: { cookie: login.cookie },
    });
    expect(me.status).toBe(401);
  });
});

describe('CSRF protection', () => {
  it('requires the session-bound token for mutating routes', async () => {
    const server = await start();
    const first = await loginOk(server);
    const second = await loginOk(server);
    expect(second.csrfToken).not.toBe(first.csrfToken);

    const logout = (cookie: string, csrf?: string) =>
      fetch(`${server.url}/api/v1/auth/logout`, {
        method: 'POST',
        headers: csrf ? { cookie, 'x-csrf-token': csrf } : { cookie },
      });

    const missing = await logout(first.cookie);
    expect(missing.status).toBe(403);
    expect(((await missing.json()) as ErrorBody).error.code).toBe('csrf_invalid');

    const wrong = await logout(first.cookie, 'not-the-token');
    expect(wrong.status).toBe(403);

    const crossSession = await logout(first.cookie, second.csrfToken);
    expect(crossSession.status).toBe(403);

    const stillAlive = await fetch(`${server.url}/api/v1/auth/me`, {
      headers: { cookie: first.cookie },
    });
    expect(stillAlive.status).toBe(200);

    const accepted = await logout(first.cookie, first.csrfToken);
    expect(accepted.status).toBe(204);

    const revoked = await fetch(`${server.url}/api/v1/auth/me`, {
      headers: { cookie: first.cookie },
    });
    expect(revoked.status).toBe(401);
    const other = await fetch(`${server.url}/api/v1/auth/me`, {
      headers: { cookie: second.cookie },
    });
    expect(other.status).toBe(200);
  });
});

describe('login rate limiting', () => {
  it('locks a client out after the limit and unlocks when the window elapses', async () => {
    const server = await start({ loginRateLimit: { maxAttempts: 2, windowMs: 250 } });

    for (let i = 0; i < 2; i++) {
      expect((await loginAttempt(server, { username: 'owner', password: 'nope' })).status).toBe(
        401,
      );
    }

    const blocked = await loginAttempt(server);
    expect(blocked.status).toBe(429);
    expect(((await blocked.json()) as ErrorBody).error.code).toBe('rate_limited');
    expect(Number(blocked.headers.get('retry-after'))).toBeGreaterThanOrEqual(1);

    await new Promise((resolve) => setTimeout(resolve, 320));

    const unlocked = await loginAttempt(server);
    expect(unlocked.status).toBe(200);
  });

  it('resets the counter after a successful login', async () => {
    const server = await start({ loginRateLimit: { maxAttempts: 3, windowMs: 60_000 } });

    for (let i = 0; i < 2; i++) {
      expect((await loginAttempt(server, { username: 'owner', password: 'nope' })).status).toBe(
        401,
      );
    }
    expect((await loginAttempt(server)).status).toBe(200);

    for (let i = 0; i < 3; i++) {
      expect((await loginAttempt(server, { username: 'owner', password: 'nope' })).status).toBe(
        401,
      );
    }
    // Would already be 429 here if the success had not reset the window.
    expect((await loginAttempt(server, { username: 'owner', password: 'nope' })).status).toBe(429);
  });
});

describe('request hygiene and errors', () => {
  it('sets security headers, hides the framework and returns uniform JSON errors', async () => {
    const server = await start();

    const live = await fetch(`${server.url}/health/live`);
    expect(live.headers.get('x-content-type-options')).toBe('nosniff');
    expect(live.headers.get('x-frame-options')).toBe('DENY');
    expect(live.headers.get('referrer-policy')).toBe('no-referrer');
    expect(live.headers.get('content-security-policy')).toContain("default-src 'self'");
    expect(live.headers.get('x-powered-by')).toBeNull();

    const missing = await fetch(`${server.url}/api/v1/does-not-exist`);
    expect(missing.status).toBe(404);
    expect(((await missing.json()) as ErrorBody).error.code).toBe('not_found');

    const malformed = await fetch(`${server.url}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{not json',
    });
    expect(malformed.status).toBe(400);
    expect(((await malformed.json()) as ErrorBody).error.code).toBe('malformed_json');

    const oversized = await fetch(`${server.url}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'owner', password: 'x'.repeat(70_000) }),
    });
    expect(oversized.status).toBe(413);
    expect(((await oversized.json()) as ErrorBody).error.code).toBe('payload_too_large');

    const invalid = await fetch(`${server.url}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'owner' }),
    });
    expect(invalid.status).toBe(400);
    expect(((await invalid.json()) as ErrorBody).error.code).toBe('invalid_request');
  });
});

describe('health readiness', () => {
  it('reports readiness from real database state and degrades when it is gone', async () => {
    const server = await start();

    const ready = await fetch(`${server.url}/health/ready`);
    expect(ready.status).toBe(200);
    expect(await ready.json()).toEqual({ status: 'ready', migrations: 2 });

    server.db.close();

    const degraded = await fetch(`${server.url}/health/ready`);
    expect(degraded.status).toBe(503);
    const body = (await degraded.json()) as { status: string } & ErrorBody;
    expect(body.status).toBe('unavailable');
    expect(body.error.code).toBe('not_ready');
  });
});

describe('bootstrap and persistence', () => {
  it('refuses to start a fresh database without admin bootstrap credentials', async () => {
    await expect(startServer({ dbPath: ':memory:', port: 0 })).rejects.toThrow(
      /admin bootstrap/i,
    );
  });

  it('skips bootstrap when users exist and preserves sessions across restarts', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'rgstudio-web-'));
    tempDirs.push(dir);
    const dbPath = path.join(dir, 'studio.sqlite');

    const first = await startServer({
      dbPath,
      port: 0,
      adminBootstrap: { username: 'owner', password: 'first-passphrase' },
    });
    active = first;
    const login = await loginOk(first, { username: 'owner', password: 'first-passphrase' });
    await first.close();

    const second = await startServer({
      dbPath,
      port: 0,
      adminBootstrap: { username: 'owner', password: 'second-passphrase' },
    });
    active = second;

    // Old password still works: the second bootstrap was correctly skipped.
    expect((await loginAttempt(second, { username: 'owner', password: 'first-passphrase' })).status).toBe(
      200,
    );
    expect((await loginAttempt(second, { username: 'owner', password: 'second-passphrase' })).status).toBe(
      401,
    );

    // The session created before the restart is still valid after it.
    const me = await fetch(`${second.url}/api/v1/auth/me`, { headers: { cookie: login.cookie } });
    expect(me.status).toBe(200);
    expect(((await me.json()) as LoginBody).user.username).toBe('owner');
  });
});

/**
 * Shared helpers for the real-HTTP integration suites (test-only code).
 *
 * Servers run on ephemeral ports with in-memory databases unless a test
 * overrides them; each suite owns its `active` server handle and closes it
 * in afterEach. No mocks: the client is global fetch against 127.0.0.1.
 */
import { rmSync } from 'node:fs';
import { expect } from 'vitest';
import { startServer, type StartedServer } from '../../apps/web/src/server.js';
import type { WebConfig } from '../../apps/web/src/config.js';

export const ADMIN = { username: 'owner', password: 'test-admin-passphrase' };

export interface ErrorBody {
  error: { code: string; message: string };
}

export interface UserBody {
  id: string;
  username: string;
  role: string;
}

export interface LoginBody {
  user: UserBody;
  csrfToken: string;
  expiresAt: string;
}

const tempDirs: string[] = [];

export function registerTempDir(dir: string): void {
  tempDirs.push(dir);
}

export function cleanupTempDirs(): void {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
}

export function startTestServer(overrides: Partial<WebConfig> = {}): Promise<StartedServer> {
  return startServer({ dbPath: ':memory:', port: 0, adminBootstrap: { ...ADMIN }, ...overrides });
}

export function setCookies(res: Response): string[] {
  return res.headers.getSetCookie();
}

export function cookiePair(res: Response, name = 'rg_session'): string {
  const found = setCookies(res).find((cookie) => cookie.startsWith(`${name}=`));
  if (!found) throw new Error(`missing ${name} cookie; got: ${setCookies(res).join(' | ')}`);
  return found.split(';')[0]!;
}

export function rawCookie(res: Response, name = 'rg_session'): string {
  const found = setCookies(res).find((cookie) => cookie.startsWith(`${name}=`));
  if (!found) throw new Error(`missing ${name} cookie; got: ${setCookies(res).join(' | ')}`);
  return found;
}

export function loginAttempt(
  server: StartedServer,
  credentials: { username: string; password: string } = ADMIN,
): Promise<Response> {
  return fetch(`${server.url}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(credentials),
  });
}

export async function loginOk(
  server: StartedServer,
  credentials: { username: string; password: string } = ADMIN,
): Promise<{ cookie: string; csrfToken: string; body: LoginBody; res: Response }> {
  const res = await loginAttempt(server, credentials);
  expect(res.status).toBe(200);
  const body = (await res.json()) as LoginBody;
  return { cookie: cookiePair(res), csrfToken: body.csrfToken, body, res };
}

export function getJson(
  server: StartedServer,
  path: string,
  headers: Record<string, string> = {},
): Promise<Response> {
  return fetch(`${server.url}${path}`, { headers });
}

export function postJson(
  server: StartedServer,
  path: string,
  body: unknown,
  headers: Record<string, string> = {},
): Promise<Response> {
  return fetch(`${server.url}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

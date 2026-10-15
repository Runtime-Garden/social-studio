/**
 * P2: sessions repository.
 *
 * The cookie carries an opaque token; only its SHA-256 hash is stored, so a
 * database leak does not yield usable session material. Expiry and revocation
 * are checked on every lookup. Each session also carries a CSRF token that
 * mutating browser routes must echo (blueprint 11); the CSRF token never
 * appears in cookies.
 */
import { randomBytes } from 'node:crypto';
import { sha256Hex } from '../ids.js';
import type { StudioDatabase } from '../db.js';

export interface CreateSessionOptions {
  ttlMs?: number;
  now?: number;
}

export interface CreatedSession {
  token: string;
  csrfToken: string;
  expiresAt: string;
}

/** Opaque session token: 32 random bytes, base64url (~43 chars). */
export function createSession(
  db: StudioDatabase,
  userId: string,
  { ttlMs = 12 * 60 * 60 * 1000, now = Date.now() }: CreateSessionOptions = {},
): CreatedSession {
  const token = randomBytes(32).toString('base64url');
  const csrfToken = randomBytes(32).toString('base64url');
  const createdAt = new Date(now).toISOString();
  const expiresAt = new Date(now + ttlMs).toISOString();
  db.prepare(
    `INSERT INTO sessions (id, user_id, created_at, expires_at, last_seen_at, csrf_token)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(sha256Hex(token), userId, createdAt, expiresAt, createdAt, csrfToken);
  return { token, csrfToken, expiresAt };
}

export interface ActiveSession {
  id: string;
  userId: string;
  expiresAt: string;
  csrfToken: string;
}

/** Returns the active session and touches last activity; null when invalid. */
export function findActiveSession(
  db: StudioDatabase,
  token: string,
  { now = Date.now() }: { now?: number } = {},
): ActiveSession | null {
  if (!token) return null;
  const id = sha256Hex(token);
  const row = db
    .prepare('SELECT id, user_id, expires_at, revoked_at, csrf_token FROM sessions WHERE id = ?')
    .get(id) as
    | {
        id: string;
        user_id: string;
        expires_at: string;
        revoked_at: string | null;
        csrf_token: string;
      }
    | undefined;
  if (!row || row.revoked_at !== null) return null;
  if (Date.parse(row.expires_at) <= now) return null;
  db.prepare('UPDATE sessions SET last_seen_at = ? WHERE id = ?').run(
    new Date(now).toISOString(),
    id,
  );
  return {
    id,
    userId: row.user_id,
    expiresAt: row.expires_at,
    csrfToken: row.csrf_token,
  };
}

export function revokeSession(
  db: StudioDatabase,
  token: string,
  { now = Date.now() }: { now?: number } = {},
): boolean {
  if (!token) return false;
  return revokeSessionById(db, sha256Hex(token), { now });
}

/** Revocation by stored session id, used when only the hashed identity is in hand. */
export function revokeSessionById(
  db: StudioDatabase,
  id: string,
  { now = Date.now() }: { now?: number } = {},
): boolean {
  if (!id) return false;
  const result = db
    .prepare('UPDATE sessions SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL')
    .run(new Date(now).toISOString(), id);
  return result.changes > 0;
}

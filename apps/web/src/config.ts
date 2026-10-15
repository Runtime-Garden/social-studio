/**
 * P2 slice 2: web configuration (blueprint 11/13).
 *
 * Secure-by-default rules: cookies are always Secure in production (the
 * environment cannot downgrade that), bootstrap credentials must arrive as a
 * complete pair or not at all, and invalid values fail loudly at startup.
 * Non-secret operational values may come from the environment; secrets come
 * only from the deployment environment, never from committed files.
 */
import { fileURLToPath } from 'node:url';

export const SESSION_COOKIE = 'rg_session';

export interface WebConfig {
  /** SQLite database path (file on the persistent volume, or ':memory:' in tests). */
  dbPath: string;
  /** Listen host; loopback by default, the compose network address in Docker. */
  host: string;
  /** Listen port; 0 selects an ephemeral port. */
  port: number;
  /** Secure cookie flag; forced true in production. */
  secureCookies: boolean;
  sessionTtlMs: number;
  loginRateLimit: { maxAttempts: number; windowMs: number };
  /** Present only when RG_ADMIN_USERNAME + RG_ADMIN_PASSWORD are set; first start only. */
  adminBootstrap?: { username: string; password: string };
  /** Directory containing NNNN_name.sql migrations. */
  migrationsDir: string;
}

// Resolves to <repo>/migrations from both apps/web/src (tests/dev) and
// apps/web/dist (bundled), because both sit two directories under the app root.
const DEFAULT_MIGRATIONS_DIR = fileURLToPath(new URL('../../../migrations', import.meta.url));

const DEFAULT_SESSION_TTL_MS = 12 * 60 * 60 * 1000;

function parseFlag(value: string | undefined): boolean {
  if (value === undefined) return false;
  const normalized = value.toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes';
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): WebConfig {
  const username = env.RG_ADMIN_USERNAME?.trim();
  const password = env.RG_ADMIN_PASSWORD;
  if ((username === undefined || username === '') !== (password === undefined || password === '')) {
    throw new Error('RG_ADMIN_USERNAME and RG_ADMIN_PASSWORD must be set together');
  }

  const port = env.RG_PORT === undefined ? 8787 : Number(env.RG_PORT);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error(`RG_PORT must be an integer between 0 and 65535, got "${env.RG_PORT}"`);
  }

  const sessionTtlMs =
    env.RG_SESSION_TTL_MS === undefined ? DEFAULT_SESSION_TTL_MS : Number(env.RG_SESSION_TTL_MS);
  if (!Number.isFinite(sessionTtlMs) || sessionTtlMs <= 0) {
    throw new Error(`RG_SESSION_TTL_MS must be a positive number, got "${env.RG_SESSION_TTL_MS}"`);
  }

  const production = env.NODE_ENV === 'production';
  return {
    dbPath: env.RG_DB_PATH ?? 'data/studio.sqlite',
    host: env.RG_HOST ?? '127.0.0.1',
    port,
    secureCookies: production ? true : parseFlag(env.RG_SECURE_COOKIES),
    sessionTtlMs,
    loginRateLimit: { maxAttempts: 5, windowMs: 15 * 60 * 1000 },
    adminBootstrap:
      username !== undefined && username !== '' && password !== undefined && password !== ''
        ? { username, password }
        : undefined,
    migrationsDir: env.RG_MIGRATIONS_DIR ?? DEFAULT_MIGRATIONS_DIR,
  };
}

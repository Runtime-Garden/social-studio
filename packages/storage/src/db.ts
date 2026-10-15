/**
 * P2: SQLite connection factory (blueprint 9.1).
 *
 * Uses the Node.js built-in `node:sqlite` driver — no native build steps,
 * no network database. Invariants enforced here: foreign keys ON, a busy
 * timeout for WAL contention, and WAL journaling for file databases.
 */
import { DatabaseSync } from 'node:sqlite';

export type StudioDatabase = DatabaseSync;

export interface OpenDatabaseOptions {
  /** ':memory:' for tests, or a file path on the persistent volume. */
  path: string;
  busyTimeoutMs?: number;
}

export function openDatabase({ path, busyTimeoutMs = 5000 }: OpenDatabaseOptions): StudioDatabase {
  const db = new DatabaseSync(path);
  db.exec('PRAGMA foreign_keys = ON');
  db.exec(`PRAGMA busy_timeout = ${Math.max(1000, Math.floor(busyTimeoutMs))}`);
  if (path !== ':memory:') db.exec('PRAGMA journal_mode = WAL');
  return db;
}

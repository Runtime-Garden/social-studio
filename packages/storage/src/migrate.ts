/**
 * P2: forward-only SQL migration runner.
 *
 * Migration files live in the repository-root `migrations/` directory and are
 * named `NNNN_name.sql`. Each is applied inside a transaction and recorded in
 * `schema_migrations`; already-applied files are never re-run. Backups before
 * schema changes belong to the deployment scripts, not to this runner.
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { StudioDatabase } from './db.js';

const MIGRATION_FILE = /^(\d{4})_.+\.sql$/;

export function applyMigrations(db: StudioDatabase, migrationsDir: string): string[] {
  db.exec(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
       version INTEGER PRIMARY KEY,
       name TEXT NOT NULL,
       applied_at TEXT NOT NULL
     )`,
  );
  const appliedNames = new Set(
    (db.prepare('SELECT name FROM schema_migrations').all() as Array<{ name: string }>).map(
      (row) => row.name,
    ),
  );
  const files = readdirSync(migrationsDir)
    .filter((file) => MIGRATION_FILE.test(file))
    .sort();
  const ran: string[] = [];
  for (const file of files) {
    const name = file.replace(/\.sql$/, '');
    if (appliedNames.has(name)) continue;
    const version = Number(file.slice(0, 4));
    const sql = readFileSync(path.join(migrationsDir, file), 'utf8');
    db.exec('BEGIN');
    try {
      db.exec(sql);
      db.prepare('INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)').run(
        version,
        name,
        new Date().toISOString(),
      );
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
    ran.push(name);
  }
  return ran;
}

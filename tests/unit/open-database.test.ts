/**
 * P2: openDatabase invariants including first-run directory creation.
 *
 * The documented default RG_DB_PATH=data/studio.sqlite must work on a first
 * run when data/ does not exist yet — the server opens the database before
 * any script has created the directory.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { openDatabase, type StudioDatabase } from '../../packages/storage/src/db.js';

const tempDirs: string[] = [];

function makeTempDir(prefix: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

afterAll(() => {
  for (const dir of tempDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

describe('openDatabase', () => {
  it('creates the parent directory of a file path on a first run', () => {
    const dir = makeTempDir('rgstudio-db-');
    const nested = path.join(dir, 'data', 'studio.sqlite');
    const db: StudioDatabase = openDatabase({ path: nested });
    try {
      expect(fs.existsSync(path.dirname(nested))).toBe(true);
      expect(fs.existsSync(nested)).toBe(true);
      db.exec('CREATE TABLE probe (id TEXT)');
      db.prepare('INSERT INTO probe VALUES (?)').run('1');
      expect((db.prepare('SELECT COUNT(*) AS n FROM probe').get() as { n: number }).n).toBe(1);
    } finally {
      db.close();
    }
  });

  it('keeps foreign keys on and file pragmas healthy', () => {
    const dir = makeTempDir('rgstudio-db-');
    const file = path.join(dir, 'studio.sqlite');
    const db = openDatabase({ path: file });
    try {
      const fk = db.prepare('PRAGMA foreign_keys').get() as { foreign_keys: number };
      expect(fk.foreign_keys).toBe(1);
      expect(path.dirname(file)).toBeTruthy();
    } finally {
      db.close();
    }
  });
});

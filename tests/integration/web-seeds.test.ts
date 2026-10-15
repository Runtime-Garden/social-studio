/**
 * P2 remainder: Compose dev stack + seed fixtures (blueprint line 807).
 *
 * The seed script must be idempotent (UNIQUE-key guards) and produce data
 * visible through the real API: an inbox story, a scheduled variant and a
 * Studio project. Servers boot on ephemeral ports.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { afterAll, afterEach, expect, it } from 'vitest';
import { startTestServer } from './helpers.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SEED = path.join(repoRoot, 'tools', 'seed-fixtures.cjs');
const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rgstudio-seed-'));
  tempDirs.push(dir);
  return dir;
}

let active: Awaited<ReturnType<typeof startTestServer>> | null = null;

afterEach(async () => {
  await active?.close();
  active = null;
});

afterAll(() => {
  for (const dir of tempDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

it('seeds story/variant/project fixtures and a second run adds nothing', () => {
  const dir = makeTempDir();
  const dbPath = path.join(dir, 'studio.sqlite');

  execFileSync(process.execPath, [SEED, dbPath], { cwd: repoRoot, stdio: 'pipe' });
  const countRows = () => {
    const db = new DatabaseSync(dbPath);
    try {
      const count = (table: string) =>
        (db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;
      return JSON.stringify({
        stories: count('content_items'),
        variants: count('platform_variants'),
        projects: count('studio_projects'),
        approvals: count('approvals'),
        jobs: count('jobs'),
      });
    } finally {
      db.close();
    }
  };
  const afterFirst = countRows();
  execFileSync(process.execPath, [SEED, dbPath], { cwd: repoRoot, stdio: 'pipe' });
  expect(countRows()).toBe(afterFirst);
});

it('makes seeded fixtures visible through the real API', async () => {
  const dir = makeTempDir();
  const dbPath = path.join(dir, 'studio.sqlite');
  execFileSync(process.execPath, [SEED, dbPath], { cwd: repoRoot, stdio: 'pipe' });

  active = await startTestServer({ dbPath });
  // The seed already created the admin from RG_ADMIN_* defaults; log in.
  const loginRes = await fetch(`${active.url}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'owner', password: 'seed-passphrase' }),
  });
  const cookie = loginRes.headers.getSetCookie()[0]!.split(';')[0]!;

  const items = await (
    await fetch(`${active.url}/api/v1/content/items?limit=10`, {
      headers: { cookie },
    })
  ).json() as { items: Array<{ title: string }> };
  expect(items.items.length).toBeGreaterThanOrEqual(1);
  expect(items.items.some((i) => i.title.includes('Seed'))).toBe(true);

  const projects = await (
    await fetch(`${active.url}/api/v1/projects?limit=10`, { headers: { cookie } })
  ).json() as { projects: Array<{ name: string }>; total: number };
  expect(projects.total).toBeGreaterThanOrEqual(1);
  expect(projects.projects.some((p) => p.name.includes('Seed'))).toBe(true);

  const calendar = await (
    await fetch(`${active.url}/api/v1/schedule/calendar?from=2026-11-01&to=2026-11-30&tz=UTC`, {
      headers: { cookie },
    })
  ).json() as { days: Array<{ entries: unknown[] }> };
  const scheduled = calendar.days.reduce((n, day) => n + day.entries.length, 0);
  expect(scheduled).toBeGreaterThanOrEqual(1);
});

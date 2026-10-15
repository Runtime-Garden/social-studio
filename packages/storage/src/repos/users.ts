/** P2: users repository (single-admin organization). */
import { newId } from '../ids.js';
import type { StudioDatabase } from '../db.js';

export interface UserRow {
  id: string;
  username: string;
  passwordHash: string;
  role: 'admin';
  disabledAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface RawUser {
  id: string;
  username: string;
  password_hash: string;
  role: 'admin';
  disabled_at: string | null;
  created_at: string;
  updated_at: string;
}

const map = (row: RawUser): UserRow => ({
  id: row.id,
  username: row.username,
  passwordHash: row.password_hash,
  role: row.role,
  disabledAt: row.disabled_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export interface CreateUserInput {
  username: string;
  /** Already-hashed credential (scrypt by the auth layer); never a raw password. */
  passwordHash: string;
  now?: number;
}

export function createUser(db: StudioDatabase, input: CreateUserInput): UserRow {
  const now = new Date(input.now ?? Date.now()).toISOString();
  const id = newId();
  db.prepare(
    `INSERT INTO users (id, username, password_hash, role, created_at, updated_at)
     VALUES (?, ?, ?, 'admin', ?, ?)`,
  ).run(id, input.username, input.passwordHash, now, now);
  return {
    id,
    username: input.username,
    passwordHash: input.passwordHash,
    role: 'admin',
    disabledAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

export function findUserByUsername(db: StudioDatabase, username: string): UserRow | undefined {
  const row = db
    .prepare('SELECT * FROM users WHERE username = ?')
    .get(username) as RawUser | undefined;
  return row ? map(row) : undefined;
}

export function countUsers(db: StudioDatabase): number {
  const row = db.prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number };
  return row.n;
}

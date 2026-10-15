/**
 * P2 slice 2: password hashing for the web app (blueprint 11/16: strong hash).
 *
 * scrypt is the "appropriate supported equivalent" of Argon2id available in
 * Node's standard library without native dependencies. Stored format is a
 * self-describing string so parameters can be raised later without a schema
 * change. Tests pin: random salt per hash, correct/wrong verification, and
 * graceful rejection of malformed stored values (never a throw, never a
 * false accept).
 */
import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from '../../apps/web/src/auth/passwords.js';

describe('password hashing', () => {
  it('emits a self-describing scrypt hash with a unique salt per call', () => {
    const first = hashPassword('correct horse battery staple');
    const second = hashPassword('correct horse battery staple');
    expect(first).toMatch(/^scrypt\$\d+\$\d+\$\d+\$[A-Za-z0-9_-]{16,}\$[A-Za-z0-9_-]{16,}$/);
    expect(first).not.toBe(second);
  });

  it('verifies the correct password and rejects wrong or empty passwords', () => {
    const stored = hashPassword('s3cret-passphrase');
    expect(verifyPassword('s3cret-passphrase', stored)).toBe(true);
    expect(verifyPassword('s3cret-passphras', stored)).toBe(false);
    expect(verifyPassword('S3cret-passphrase', stored)).toBe(false);
    expect(verifyPassword('', stored)).toBe(false);
  });

  it('rejects malformed or foreign stored hashes without throwing', () => {
    expect(verifyPassword('x', '')).toBe(false);
    expect(verifyPassword('x', 'not-a-hash')).toBe(false);
    expect(verifyPassword('x', 'scrypt$16384$8$1$only-four-fields')).toBe(false);
    expect(verifyPassword('x', 'bcrypt$16384$8$1$c2FsdA$aGFzaA')).toBe(false);
    // Valid shape but not base64url payloads.
    expect(verifyPassword('x', 'scrypt$16384$8$1$!!!$???')).toBe(false);
  });
});

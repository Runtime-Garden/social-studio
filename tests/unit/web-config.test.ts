/**
 * P2 slice 2: web config boundaries (blueprint 11/13).
 *
 * Secure-by-default posture: cookies become Secure in production no matter
 * what the environment says, bootstrap credentials must be complete or
 * absent, and invalid ports fail loudly at startup instead of half-working.
 */
import { describe, expect, it } from 'vitest';
import { loadConfig } from '../../apps/web/src/config.js';

describe('loadConfig', () => {
  it('defaults to a loopback development config with insecure cookies', () => {
    const config = loadConfig({});
    expect(config.dbPath).toBe('data/studio.sqlite');
    expect(config.host).toBe('127.0.0.1');
    expect(config.port).toBe(8787);
    expect(config.secureCookies).toBe(false);
    expect(config.sessionTtlMs).toBe(12 * 60 * 60 * 1000);
    expect(config.loginRateLimit).toEqual({ maxAttempts: 5, windowMs: 15 * 60 * 1000 });
    expect(config.adminBootstrap).toBeUndefined();
  });

  it('reads explicit environment overrides', () => {
    const config = loadConfig({
      RG_DB_PATH: '/srv/studio.sqlite',
      RG_HOST: '0.0.0.0',
      RG_PORT: '9090',
      RG_SESSION_TTL_MS: '60000',
      RG_SECURE_COOKIES: '1',
      RG_ADMIN_USERNAME: 'owner',
      RG_ADMIN_PASSWORD: 'boot-passphrase',
    });
    expect(config.dbPath).toBe('/srv/studio.sqlite');
    expect(config.host).toBe('0.0.0.0');
    expect(config.port).toBe(9090);
    expect(config.sessionTtlMs).toBe(60000);
    expect(config.secureCookies).toBe(true);
    expect(config.adminBootstrap).toEqual({ username: 'owner', password: 'boot-passphrase' });
  });

  it('forces Secure cookies in production even when the environment asks otherwise', () => {
    expect(loadConfig({ NODE_ENV: 'production' }).secureCookies).toBe(true);
    expect(loadConfig({ NODE_ENV: 'production', RG_SECURE_COOKIES: '0' }).secureCookies).toBe(true);
  });

  it('rejects half-set bootstrap credentials and invalid ports', () => {
    expect(() => loadConfig({ RG_ADMIN_USERNAME: 'owner' })).toThrow(/together/i);
    expect(() => loadConfig({ RG_ADMIN_PASSWORD: 'secret' })).toThrow(/together/i);
    expect(() => loadConfig({ RG_PORT: 'nope' })).toThrow(/port/i);
    expect(() => loadConfig({ RG_PORT: '70000' })).toThrow(/port/i);
    expect(() => loadConfig({ RG_PORT: '-1' })).toThrow(/port/i);
  });
});

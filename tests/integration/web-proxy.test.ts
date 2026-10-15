/**
 * P2: reverse-proxy client identity for the login rate limiter.
 *
 * Behind Nginx Proxy Manager every request arrives from the Docker bridge
 * gateway, so keying the limiter on the socket address makes one client's
 * failures lock out everyone. With `trust proxy` set (explicitly opted
 * into per deployment), the limiter keys on the real client address.
 */
import { afterEach, describe, expect, it } from 'vitest';
import type { StartedServer } from '../../apps/web/src/server.js';
import { cleanupTempDirs, startTestServer } from './helpers.js';

let active: StartedServer | null = null;

afterEach(async () => {
  await active?.close();
  active = null;
  cleanupTempDirs();
});

async function attempt(
  server: StartedServer,
  clientIp: string,
): Promise<Response> {
  return fetch(`${server.url}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': clientIp },
    body: JSON.stringify({ username: 'owner', password: 'not-the-password' }),
  });
}

describe('login rate limiting behind a reverse proxy', () => {
  it('keeps clients isolated by their forwarded address when trust proxy is on', async () => {
    const server = await startTestServer({ trustProxyHops: 1 });
    active = server;

    // Burn the 5-attempt window for one client identity.
    for (let i = 0; i < 5; i++) {
      expect((await attempt(server, '203.0.113.10')).status).toBe(401);
    }
    expect((await attempt(server, '203.0.113.10')).status).toBe(429);

    // A different client behind the same proxy must not be locked out.
    expect((await attempt(server, '203.0.113.99')).status).toBe(401);
  });

  it('ignores spoofed forwarded addresses when trust proxy is off', async () => {
    const server = await startTestServer();
    active = server;

    for (let i = 0; i < 5; i++) {
      expect((await attempt(server, '203.0.113.10')).status).toBe(401);
    }
    // Without trusting the proxy the socket address keys the limiter: the
    // same host is locked out regardless of the claimed forwarded address.
    expect((await attempt(server, '203.0.113.99')).status).toBe(429);
  });
});

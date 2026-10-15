/**
 * P2 slice 3b: app shell integration coverage (blueprint 12).
 *
 * Real HTTP against the pages/asset routers: the editor page is gated
 * server-side on a live session, '/studio' canonicalizes to '/studio/'
 * (Express 5 pattern matching makes a naive redirect pair loop), the login
 * page bounces authenticated visitors, and the Design Kit / studio-core
 * assets are served with the right content types. The browser journeys live
 * in tests/browser/studio-online.spec.ts.
 */
import { afterEach, afterAll, describe, expect, it } from 'vitest';
import type { StartedServer } from '../../apps/web/src/server.js';
import { ADMIN, cleanupTempDirs, loginOk, startTestServer } from './helpers.js';

let active: StartedServer | null = null;

afterEach(async () => {
  await active?.close();
  active = null;
});

afterAll(() => {
  cleanupTempDirs();
});

describe('app shell pages', () => {
  it('redirects the root to the studio and gates it behind a session', async () => {
    const server = await startTestServer();
    active = server;

    const root = await fetch(`${server.url}/`, { redirect: 'manual' });
    expect(root.status).toBe(302);
    expect(root.headers.get('location')).toBe('/studio/');

    const bounced = await fetch(`${server.url}/studio/`, { redirect: 'manual' });
    expect(bounced.status).toBe(302);
    expect(bounced.headers.get('location')).toBe('/login');

    const fresh = await fetch(`${server.url}/studio/`);
    expect(fresh.status).toBe(200);
    expect(fresh.headers.get('content-type')).toContain('text/html');
    expect(await fresh.text()).toContain('id="loginBtn"');
  });

  it('bounces authenticated visitors from /login and canonicalizes /studio', async () => {
    const server = await startTestServer();
    active = server;
    const { cookie } = await loginOk(server, ADMIN);

    const login = await fetch(`${server.url}/login`, {
      headers: { cookie },
      redirect: 'manual',
    });
    expect(login.status).toBe(302);
    expect(login.headers.get('location')).toBe('/studio/');

    const bare = await fetch(`${server.url}/studio`, {
      headers: { cookie },
      redirect: 'manual',
    });
    expect(bare.status).toBe(302);
    expect(bare.headers.get('location')).toBe('/studio/');

    const page = await fetch(`${server.url}/studio/`, { headers: { cookie } });
    expect(page.status).toBe(200);
    expect(page.headers.get('content-type')).toContain('text/html');
    const html = await page.text();
    expect(html).toContain('id="studioCanvas"');
    expect(html).toContain('id="newProjectBtn"');
  });

  it('gates /content/ behind a session and canonicalizes /content', async () => {
    const server = await startTestServer();
    active = server;
    const { cookie } = await loginOk(server, ADMIN);

    const bounced = await fetch(`${server.url}/content/`, { redirect: 'manual' });
    expect(bounced.status).toBe(302);
    expect(bounced.headers.get('location')).toBe('/login?next=/content/');

    const bare = await fetch(`${server.url}/content`, {
      headers: { cookie },
      redirect: 'manual',
    });
    expect(bare.status).toBe(302);
    expect(bare.headers.get('location')).toBe('/content/');

    const page = await fetch(`${server.url}/content/`, { headers: { cookie } });
    expect(page.status).toBe(200);
    const html = await page.text();
    expect(html).toContain('id="inboxList"');
    expect(html).toContain('id="approveBtn"');
  });

  it('gates /calendar/ behind a session, preserves the month and canonicalizes', async () => {
    const server = await startTestServer();
    active = server;
    const { cookie } = await loginOk(server, ADMIN);

    const bounced = await fetch(`${server.url}/calendar/?month=2026-11`, { redirect: 'manual' });
    expect(bounced.status).toBe(302);
    expect(bounced.headers.get('location')).toBe('/login?next=%2Fcalendar%2F%3Fmonth%3D2026-11');

    const bare = await fetch(`${server.url}/calendar`, {
      headers: { cookie },
      redirect: 'manual',
    });
    expect(bare.status).toBe(302);
    expect(bare.headers.get('location')).toBe('/calendar/');

    const page = await fetch(`${server.url}/calendar/`, { headers: { cookie } });
    expect(page.status).toBe(200);
    const html = await page.text();
    expect(html).toContain('id="dayGrid"');
    expect(html).toContain('id="channelStatus"');
  });
});

describe('app shell assets', () => {
  it('serves static app files, the shared studio-core bundle and Design Kit assets', async () => {
    const server = await startTestServer();
    active = server;

    const css = await fetch(`${server.url}/studio-online.css`);
    expect(css.status).toBe(200);
    expect(css.headers.get('content-type')).toContain('text/css');

    const editor = await fetch(`${server.url}/studio-online.js`);
    expect(editor.status).toBe(200);
    expect(editor.headers.get('content-type')).toContain('javascript');

    const login = await fetch(`${server.url}/login.js`);
    expect(login.status).toBe(200);
    expect(login.headers.get('content-type')).toContain('javascript');

    const core = await fetch(`${server.url}/assets/studio-core.js`);
    expect(core.status).toBe(200);
    expect(core.headers.get('content-type')).toContain('javascript');
    const coreBody = await core.text();
    expect(coreBody).toContain('RGStudioCore');
    expect(coreBody).toContain('configureRenderer');

    const brand = await fetch(`${server.url}/assets/brand-embedded.js`);
    expect(brand.status).toBe(200);
    expect(await brand.text()).toContain('RG_OFFICIAL_LOGOS');

    const mark = await fetch(`${server.url}/assets/runtime-garden-mark.svg`);
    expect(mark.status).toBe(200);
    expect(mark.headers.get('content-type')).toContain('image/svg+xml');
  });
});

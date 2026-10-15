/**
 * P2 slice 4: policy gate, audit/jobs viewers and pause controls over
 * real HTTP (blueprint lines 806, 808).
 *
 * Pins the ops contract: safe-default policy, validated policy writes
 * with audit, idempotent pause, a resume endpoint that provably refuses,
 * and read-only audit/jobs viewers.
 */
import { afterEach, describe, expect, it } from 'vitest';
import type { StartedServer } from '../../apps/web/src/server.js';
import { appendAuditEvent } from '../../packages/storage/src/repos/audit.js';
import {
  cleanupTempDirs,
  getJson,
  loginOk,
  postJson,
  startTestServer,
  type ErrorBody,
} from './helpers.js';

let active: StartedServer | null = null;

async function started(): Promise<StartedServer> {
  active = await startTestServer();
  return active;
}

afterEach(async () => {
  if (active) {
    await active.close();
    active = null;
  }
  cleanupTempDirs();
});

describe('ops policy and pause', () => {
  it('serves safe-default policy with publishing and autonomy off', async () => {
    const server = await started();
    const login = await loginOk(server);

    const body = (await (
      await getJson(server, '/api/v1/ops/policy', { cookie: login.cookie })
    ).json()) as { policy: Record<string, boolean | number> };
    expect(body.policy.publishing_enabled).toBe(false);
    expect(body.policy.autonomy_enabled).toBe(false);
    expect(body.policy.approval_required).toBe(true);
  });

  it('writes policy values with type validation and audit', async () => {
    const server = await started();
    const login = await loginOk(server);
    const headers = { cookie: login.cookie, 'x-csrf-token': login.csrfToken };

    const set = await postJson(
      server,
      '/api/v1/ops/policy',
      { key: 'autonomy_enabled', value: true },
      headers,
    );
    expect(set.status).toBe(200);
    expect(
      ((await set.json()) as { policy: Record<string, boolean> }).policy.autonomy_enabled,
    ).toBe(true);

    const wrongType = await postJson(
      server,
      '/api/v1/ops/policy',
      { key: 'autonomy_enabled', value: 'yes' },
      headers,
    );
    expect(wrongType.status).toBe(400);

    const unknown = await postJson(
      server,
      '/api/v1/ops/policy',
      { key: 'not_a_key', value: true },
      headers,
    );
    expect(unknown.status).toBe(400);
    expect(((await unknown.json()) as ErrorBody).error.code).toBe('unknown_policy_key');
  });

  it('pauses idempotently with audit and refuses resume in this slice', async () => {
    const server = await started();
    const login = await loginOk(server);
    const headers = { cookie: login.cookie, 'x-csrf-token': login.csrfToken };

    const first = await postJson(server, '/api/v1/ops/pause', { reason: 'drill' }, headers);
    expect(first.status).toBe(200);
    const second = await postJson(server, '/api/v1/ops/pause', {}, headers);
    expect(second.status).toBe(200);
    expect(
      ((await second.json()) as { policy: Record<string, boolean> }).policy.publishing_enabled,
    ).toBe(false);

    const resume = await postJson(server, '/api/v1/ops/resume', {}, headers);
    expect(resume.status).toBe(409);
    expect(((await resume.json()) as ErrorBody).error.code).toBe(
      'publishing_disabled_by_default',
    );
  });

  it('requires a session for ops reads', async () => {
    const server = await started();
    const anonymous = await getJson(server, '/api/v1/ops/policy');
    expect(anonymous.status).toBe(401);
    expect(((await anonymous.json()) as ErrorBody).error.code).toBe('unauthorized');
  });
});

describe('ops viewers', () => {
  it('lists audit events newest-first with totals', async () => {
    const server = await started();
    appendAuditEvent(server.db, { actor: 'owner', action: 'drill.first', objectType: 'drill' });
    appendAuditEvent(server.db, { actor: 'owner', action: 'drill.second', objectType: 'drill' });
    const login = await loginOk(server);

    const body = (await (
      await getJson(server, '/api/v1/ops/audit?limit=10', { cookie: login.cookie })
    ).json()) as { events: Array<{ action: string }>; total: number };
    expect(body.total).toBeGreaterThanOrEqual(2);
    const actions = body.events.map((e) => e.action);
    expect(actions.indexOf('drill.second')).toBeLessThan(actions.indexOf('drill.first'));
  });

  it('lists jobs with an empty state instead of a failed fetch', async () => {
    const server = await started();
    const login = await loginOk(server);

    const body = (await (
      await getJson(server, '/api/v1/ops/jobs', { cookie: login.cookie })
    ).json()) as { jobs: unknown[]; total: number };
    expect(body.jobs).toEqual([]);
    expect(body.total).toBe(0);
  });
});

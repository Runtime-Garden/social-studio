/**
 * P2: policy settings repository.
 *
 * Reads merge stored overrides over the domain defaults; unknown keys and
 * type-mismatched values are rejected. `publishing_enabled` and
 * `autonomy_enabled` default to false and only change through an explicit
 * admin action (audited at the API layer).
 */
import {
  DEFAULT_POLICY,
  isPolicyKey,
  isValidPolicyValue,
  type PolicyKey,
  type PolicySettings,
} from '../../../domain/src/policy.js';
import type { StudioDatabase } from '../db.js';

export function getPolicy(db: StudioDatabase): PolicySettings {
  const policy: PolicySettings = { ...DEFAULT_POLICY };
  const rows = db.prepare('SELECT key, value_json FROM policy_settings').all() as Array<{
    key: string;
    value_json: string;
  }>;
  for (const row of rows) {
    if (!isPolicyKey(row.key)) continue; // defensive: ignore unknown stored keys
    const value: unknown = JSON.parse(row.value_json);
    if (isValidPolicyValue(row.key, value)) {
      (policy as Record<PolicyKey, unknown>)[row.key] = value;
    }
  }
  return policy;
}

export function setPolicyValue(
  db: StudioDatabase,
  key: string,
  value: unknown,
  { now = Date.now() }: { now?: number } = {},
): void {
  if (!isPolicyKey(key)) throw new Error(`unknown policy key: ${key}`);
  if (!isValidPolicyValue(key, value)) {
    throw new Error(`invalid value type for policy key ${key}`);
  }
  db.prepare(
    `INSERT INTO policy_settings (key, value_json, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at`,
  ).run(key, JSON.stringify(value), new Date(now).toISOString());
}

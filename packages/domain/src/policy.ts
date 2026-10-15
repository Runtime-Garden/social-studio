/**
 * P2: policy settings schema (blueprint 10.4 + P2 checklist).
 *
 * These are product defaults, not platform quotas. Publishing and autonomy
 * are hard OFF until an admin explicitly enables them (which requires
 * re-authentication + an audit event at the API layer).
 */

export const DEFAULT_POLICY = {
  /** Master switch for any outbound Buffer submission. */
  publishing_enabled: false,
  /** Master switch for scheduled/automatic content creation. */
  autonomy_enabled: false,
  approval_required: true,
  trusted_sources_only: true,
  max_auto_posts_per_channel_per_day: 1,
  min_hours_between_posts_per_channel: 6,
  block_unsupported_or_unverified_claims: true,
  block_unverified_numeric_benchmarks: true,
  block_security_incident_auto_posts: true,
  block_external_breaking_news_auto_posts: true,
  block_new_product_launch_claims_without_review: true,
  block_missing_primary_source: true,
  stop_after_consecutive_provider_failures: 3,
  pause_when_usage_budget_exceeded: true,
  prohibit_notification_only_auto_schedule: true,
} as const;

export type PolicyKey = keyof typeof DEFAULT_POLICY;
export type PolicyValue = boolean | number;
export type PolicySettings = { [K in PolicyKey]: PolicyValue };

export const POLICY_KEYS = Object.keys(DEFAULT_POLICY) as PolicyKey[];

export function isPolicyKey(value: string): value is PolicyKey {
  return Object.hasOwn(DEFAULT_POLICY, value);
}

/** Validates that a value matches the default's primitive type. */
export function isValidPolicyValue(key: PolicyKey, value: unknown): value is PolicyValue {
  const expected = typeof DEFAULT_POLICY[key];
  return typeof value === expected;
}

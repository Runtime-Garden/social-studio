-- 0001_init: minimum durable domain contract (blueprint section 9).
--
-- Conventions: TEXT ids (32-hex), ISO-8601 UTC timestamps, JSON stored as
-- TEXT and validated at the API boundary, CHECK constraints for every state
-- machine value, UNIQUE constraints for identity + idempotency keys.

CREATE TABLE users (
  id            TEXT PRIMARY KEY,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin')),
  disabled_at   TEXT,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

CREATE TABLE sessions (
  id           TEXT PRIMARY KEY,            -- sha256 hex of the opaque cookie token
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at   TEXT NOT NULL,
  expires_at   TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  revoked_at   TEXT
);
CREATE INDEX sessions_user_idx ON sessions(user_id);

CREATE TABLE sources (
  id                    TEXT PRIMARY KEY,
  type                  TEXT NOT NULL CHECK (type IN ('rss','atom','github_release','manual','rg_internal')),
  url                   TEXT NOT NULL,
  label                 TEXT NOT NULL DEFAULT '',
  enabled               INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0,1)),
  etag                  TEXT,
  last_modified         TEXT,
  poll_interval_seconds INTEGER NOT NULL DEFAULT 3600,
  last_error            TEXT,
  created_at            TEXT NOT NULL,
  updated_at            TEXT NOT NULL,
  UNIQUE (type, url)
);

CREATE TABLE source_items (
  id            TEXT PRIMARY KEY,
  source_id     TEXT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  guid          TEXT NOT NULL,
  canonical_url TEXT NOT NULL UNIQUE,
  title         TEXT NOT NULL DEFAULT '',
  summary       TEXT NOT NULL DEFAULT '',
  body_hash     TEXT,
  published_at  TEXT,
  fetched_at    TEXT NOT NULL,
  created_at    TEXT NOT NULL,
  trust_state   TEXT NOT NULL DEFAULT 'unverified' CHECK (trust_state IN ('unverified','trusted','quarantined')),
  UNIQUE (source_id, guid)
);
CREATE INDEX source_items_source_idx ON source_items(source_id);

CREATE TABLE story_clusters (
  id              TEXT PRIMARY KEY,
  title           TEXT NOT NULL DEFAULT '',
  editorial_state TEXT NOT NULL DEFAULT 'new' CHECK (editorial_state IN ('new','clustered','dismissed','promoted')),
  note            TEXT NOT NULL DEFAULT '',
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);

CREATE TABLE story_sources (
  cluster_id      TEXT NOT NULL REFERENCES story_clusters(id) ON DELETE CASCADE,
  source_item_id  TEXT NOT NULL REFERENCES source_items(id) ON DELETE CASCADE,
  dedupe_decision TEXT NOT NULL DEFAULT 'member' CHECK (dedupe_decision IN ('primary','member','duplicate')),
  PRIMARY KEY (cluster_id, source_item_id)
);

CREATE TABLE content_items (
  id                   TEXT PRIMARY KEY,
  kind                 TEXT NOT NULL CHECK (kind IN ('original_work','external_report','news','announcement','manual')),
  title                TEXT NOT NULL DEFAULT '',
  cluster_id           TEXT REFERENCES story_clusters(id) ON DELETE SET NULL,
  source_item_id       TEXT REFERENCES source_items(id) ON DELETE SET NULL,
  editorial_state      TEXT NOT NULL DEFAULT 'discovered'
                       CHECK (editorial_state IN ('discovered','researched','verified','drafted','in_review','approved','scheduled','archived','rejected','needs_evidence','revision_requested','cancelled')),
  brief_json           TEXT,
  brief_schema_version INTEGER,
  rank                 REAL,
  author               TEXT NOT NULL DEFAULT 'agent',
  created_at           TEXT NOT NULL,
  updated_at           TEXT NOT NULL
);
CREATE INDEX content_items_state_idx ON content_items(editorial_state);

CREATE TABLE evidence_claims (
  id              TEXT PRIMARY KEY,
  cluster_id      TEXT REFERENCES story_clusters(id) ON DELETE SET NULL,
  content_item_id TEXT REFERENCES content_items(id) ON DELETE SET NULL,
  claim_text      TEXT NOT NULL,
  evidence_url    TEXT NOT NULL,
  locator         TEXT NOT NULL DEFAULT '',
  verdict         TEXT NOT NULL CHECK (verdict IN ('verified','uncertain','unsupported')),
  verified_at     TEXT,
  created_at      TEXT NOT NULL
);
CREATE INDEX evidence_claims_content_idx ON evidence_claims(content_item_id);

CREATE TABLE agent_runs (
  id                      TEXT PRIMARY KEY,
  workflow_version        TEXT NOT NULL,
  stage                   TEXT NOT NULL,
  status                  TEXT NOT NULL CHECK (status IN ('running','succeeded','failed','cancelled')),
  model                   TEXT,
  provider                TEXT,
  prompt_template_version TEXT,
  tokens_in               INTEGER NOT NULL DEFAULT 0,
  tokens_out              INTEGER NOT NULL DEFAULT 0,
  cost_usd                REAL NOT NULL DEFAULT 0,
  error_code              TEXT,
  trace_ref               TEXT,
  created_at              TEXT NOT NULL,
  updated_at              TEXT NOT NULL
);

CREATE TABLE agent_steps (
  id         TEXT PRIMARY KEY,
  run_id     TEXT NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
  stage      TEXT NOT NULL,
  status     TEXT NOT NULL CHECK (status IN ('running','succeeded','failed','cancelled')),
  detail     TEXT,
  started_at TEXT NOT NULL,
  ended_at   TEXT
);
CREATE INDEX agent_steps_run_idx ON agent_steps(run_id);

CREATE TABLE studio_projects (
  id                  TEXT PRIMARY KEY,
  name                TEXT NOT NULL,
  latest_revision     INTEGER NOT NULL DEFAULT 0,
  current_revision_id TEXT,
  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL
);

CREATE TABLE project_revisions (
  id             TEXT PRIMARY KEY,
  project_id     TEXT NOT NULL REFERENCES studio_projects(id) ON DELETE CASCADE,
  revision       INTEGER NOT NULL,
  project_json   TEXT NOT NULL,
  schema_version INTEGER NOT NULL,
  editor_version TEXT NOT NULL DEFAULT 'v2-offline',
  revision_sha   TEXT NOT NULL,
  created_at     TEXT NOT NULL,
  UNIQUE (project_id, revision)
);

CREATE TABLE platform_variants (
  id              TEXT PRIMARY KEY,
  content_item_id TEXT NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  platform        TEXT NOT NULL CHECK (platform IN ('x','linkedin','instagram','facebook')),
  channel_id      TEXT,
  revision        INTEGER NOT NULL,
  text            TEXT NOT NULL DEFAULT '',
  status          TEXT NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft','policy_checked','approved_snapshot','ready_to_submit','submitting','submitted_to_buffer','buffer_scheduled','buffer_sent','blocked','notification_only','submission_uncertain','provider_error','cancelled','stale_approval','needs_reconnect')),
  scheduled_at    TEXT,
  render_set_json TEXT,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL,
  UNIQUE (content_item_id, platform, revision)
);
CREATE INDEX platform_variants_content_idx ON platform_variants(content_item_id);

CREATE TABLE assets (
  id         TEXT PRIMARY KEY,
  file_ref   TEXT NOT NULL UNIQUE,
  public_url TEXT,
  sha256     TEXT NOT NULL,
  mime       TEXT NOT NULL,
  width      INTEGER,
  height     INTEGER,
  bytes      INTEGER NOT NULL,
  state      TEXT NOT NULL DEFAULT 'private' CHECK (state IN ('private','approved','published','retired')),
  retention  TEXT NOT NULL DEFAULT 'default',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE variant_assets (
  variant_id    TEXT NOT NULL REFERENCES platform_variants(id) ON DELETE CASCADE,
  revision      INTEGER NOT NULL,
  asset_id      TEXT NOT NULL REFERENCES assets(id) ON DELETE RESTRICT,
  sort_order    INTEGER NOT NULL,
  asset_sha256  TEXT NOT NULL,
  PRIMARY KEY (variant_id, revision, sort_order)
);

CREATE TABLE approvals (
  id                TEXT PRIMARY KEY,
  variant_id        TEXT NOT NULL REFERENCES platform_variants(id) ON DELETE CASCADE,
  variant_revision  INTEGER NOT NULL,
  channel_id        TEXT NOT NULL,
  approval_hash     TEXT NOT NULL,
  approver_user_id  TEXT NOT NULL REFERENCES users(id),
  decision          TEXT NOT NULL CHECK (decision IN ('approved','rejected','returned')),
  decided_at        TEXT NOT NULL
);
CREATE INDEX approvals_variant_idx ON approvals(variant_id, variant_revision);

CREATE TABLE connected_channels (
  id             TEXT PRIMARY KEY,   -- Buffer channel id
  service        TEXT NOT NULL CHECK (service IN ('x','linkedin','instagram','facebook')),
  label          TEXT NOT NULL DEFAULT '',
  account_type   TEXT NOT NULL DEFAULT 'unknown',
  flags_json     TEXT NOT NULL DEFAULT '{}',
  last_synced_at TEXT,
  enabled        INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0,1)),
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL
);

CREATE TABLE jobs (
  id               TEXT PRIMARY KEY,
  kind             TEXT NOT NULL,
  correlation_id   TEXT NOT NULL,
  state            TEXT NOT NULL DEFAULT 'queued' CHECK (state IN ('queued','leased','succeeded','failed','quarantined','cancelled')),
  run_at           TEXT NOT NULL,
  lease_owner      TEXT,
  lease_expires_at TEXT,
  attempts         INTEGER NOT NULL DEFAULT 0,
  payload_json     TEXT NOT NULL DEFAULT '{}',
  last_error       TEXT,
  idempotency_key  TEXT NOT NULL UNIQUE,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL
);
CREATE INDEX jobs_due_idx ON jobs(state, run_at);

CREATE TABLE job_attempts (
  id                  TEXT PRIMARY KEY,
  job_id              TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  attempt             INTEGER NOT NULL,
  snapshot_hash       TEXT,
  started_at          TEXT NOT NULL,
  ended_at            TEXT,
  provider_correlation TEXT,
  failure_class       TEXT,
  UNIQUE (job_id, attempt)
);

CREATE TABLE publications (
  id               TEXT PRIMARY KEY,
  variant_id       TEXT NOT NULL REFERENCES platform_variants(id),
  variant_revision INTEGER NOT NULL,
  channel_id       TEXT NOT NULL,
  local_key        TEXT NOT NULL UNIQUE,
  buffer_post_id   TEXT,
  submission_state TEXT NOT NULL DEFAULT 'not_submitted'
                   CHECK (submission_state IN ('not_submitted','submitted','submission_uncertain','provider_error','cancelled')),
  buffer_state     TEXT,
  sent_at          TEXT,
  last_checked_at  TEXT,
  remote_drift     TEXT,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL
);
CREATE INDEX publications_variant_idx ON publications(variant_id);

CREATE TABLE audit_events (
  id             TEXT PRIMARY KEY,
  actor          TEXT NOT NULL,
  action         TEXT NOT NULL,
  object_type    TEXT NOT NULL,
  object_id      TEXT,
  revision       TEXT,
  reason         TEXT,
  correlation_id TEXT,
  created_at     TEXT NOT NULL
);
CREATE INDEX audit_events_created_idx ON audit_events(created_at);

CREATE TABLE policy_settings (
  key        TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE usage_ledger (
  id         TEXT PRIMARY KEY,
  period     TEXT NOT NULL,        -- e.g. '2026-10'
  provider   TEXT NOT NULL,
  kind       TEXT NOT NULL,        -- 'llm_tokens' | 'buffer_calls' | 'renderer' | 'storage'
  quantity   REAL NOT NULL DEFAULT 0,
  cost_usd   REAL NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  UNIQUE (period, provider, kind)
);

CREATE TABLE system_alerts (
  id              TEXT PRIMARY KEY,
  severity        TEXT NOT NULL CHECK (severity IN ('info','warning','critical')),
  type            TEXT NOT NULL,
  active          INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  context_pointer TEXT,
  delivery_status TEXT NOT NULL DEFAULT 'pending',
  created_at      TEXT NOT NULL,
  resolved_at     TEXT
);

/**
 * P2 slice 4: content inbox repositories (blueprint line 804).
 *
 * DB-focused helpers over the migration-0001 tables: sources, source
 * items, story clusters, content items, evidence claims and platform
 * variants. Editorial transitions are validated through the domain state
 * machine (`canTransitionContent`); approval binding lives in Task 3.
 */
import { canTransitionContent } from '../../../domain/src/lifecycle.js';
import { newId } from '../ids.js';
import type { StudioDatabase } from '../db.js';

function nowIso(now?: number): string {
  return new Date(now ?? Date.now()).toISOString();
}

export interface SourceRow {
  id: string;
  type: string;
  url: string;
  label: string;
}

export function createSource(
  db: StudioDatabase,
  input: { type: string; url: string; label?: string; now?: number },
): SourceRow {
  const row: SourceRow = {
    id: newId(),
    type: input.type,
    url: input.url,
    label: input.label ?? '',
  };
  const stamp = nowIso(input.now);
  db.prepare(
    `INSERT INTO sources (id, type, url, label, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(row.id, row.type, row.url, row.label, stamp, stamp);
  return row;
}

export function createSourceItem(
  db: StudioDatabase,
  input: {
    sourceId: string;
    guid: string;
    canonicalUrl: string;
    title?: string;
    summary?: string;
    now?: number;
  },
): { id: string; sourceId: string; guid: string; canonicalUrl: string } {
  const id = newId();
  const stamp = nowIso(input.now);
  db.prepare(
    `INSERT INTO source_items (id, source_id, guid, canonical_url, title, summary, fetched_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    input.sourceId,
    input.guid,
    input.canonicalUrl,
    input.title ?? '',
    input.summary ?? '',
    stamp,
    stamp,
  );
  return { id, sourceId: input.sourceId, guid: input.guid, canonicalUrl: input.canonicalUrl };
}

export function createCluster(
  db: StudioDatabase,
  input: { title?: string; now?: number },
): { id: string; title: string; editorialState: string } {
  const id = newId();
  const stamp = nowIso(input.now);
  db.prepare(
    `INSERT INTO story_clusters (id, title, editorial_state, created_at, updated_at)
     VALUES (?, ?, 'new', ?, ?)`,
  ).run(id, input.title ?? '', stamp, stamp);
  return { id, title: input.title ?? '', editorialState: 'new' };
}

export function linkItemToCluster(
  db: StudioDatabase,
  clusterId: string,
  itemId: string,
  decision = 'member',
): void {
  db.prepare(
    `INSERT INTO story_sources (cluster_id, source_item_id, dedupe_decision)
     VALUES (?, ?, ?)`,
  ).run(clusterId, itemId, decision);
}

export interface ContentItemRow {
  id: string;
  title: string;
  kind: string;
  editorialState: string;
}

export function createContentItem(
  db: StudioDatabase,
  input: { kind: string; title?: string; clusterId?: string; sourceItemId?: string; now?: number },
): ContentItemRow {
  const id = newId();
  const stamp = nowIso(input.now);
  db.prepare(
    `INSERT INTO content_items (id, kind, title, cluster_id, source_item_id, editorial_state, author, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'discovered', 'agent', ?, ?)`,
  ).run(
    id,
    input.kind,
    input.title ?? '',
    input.clusterId ?? null,
    input.sourceItemId ?? null,
    stamp,
    stamp,
  );
  return { id, title: input.title ?? '', kind: input.kind, editorialState: 'discovered' };
}

export function addEvidenceClaim(
  db: StudioDatabase,
  input: {
    contentItemId?: string;
    clusterId?: string;
    claimText: string;
    evidenceUrl: string;
    verdict: string;
    now?: number;
  },
): { id: string } {
  const id = newId();
  db.prepare(
    `INSERT INTO evidence_claims (id, cluster_id, content_item_id, claim_text, evidence_url, verdict, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    input.clusterId ?? null,
    input.contentItemId ?? null,
    input.claimText,
    input.evidenceUrl,
    input.verdict,
    nowIso(input.now),
  );
  return { id };
}

export function listContentItems(
  db: StudioDatabase,
  { limit = 20, offset = 0, state }: { limit?: number; offset?: number; state?: string } = {},
): { items: ContentItemRow[]; total: number } {
  const where = state ? 'WHERE editorial_state = ?' : '';
  const args = state ? [state, limit, offset] : [limit, offset];
  const rows = db
    .prepare(
      `SELECT id, kind, title, editorial_state FROM content_items
       ${where} ORDER BY updated_at DESC, rowid DESC LIMIT ? OFFSET ?`,
    )
    .all(...args) as Array<{ id: string; kind: string; title: string; editorial_state: string }>;
  const countRow = (
    state
      ? db.prepare('SELECT COUNT(*) AS n FROM content_items WHERE editorial_state = ?').get(state)
      : db.prepare('SELECT COUNT(*) AS n FROM content_items').get()
  ) as { n: number };
  return {
    items: rows.map((r) => ({
      id: r.id,
      title: r.title,
      kind: r.kind,
      editorialState: r.editorial_state,
    })),
    total: countRow.n,
  };
}

export function getContentItem(
  db: StudioDatabase,
  id: string,
): {
  item: ContentItemRow;
  sources: Array<{ title: string; canonicalUrl: string }>;
  claims: Array<{ claimText: string; evidenceUrl: string; verdict: string }>;
} | null {
  const row = db
    .prepare('SELECT id, kind, title, editorial_state FROM content_items WHERE id = ?')
    .get(id) as { id: string; kind: string; title: string; editorial_state: string } | undefined;
  if (!row) return null;
  const sources = db
    .prepare(
      `SELECT si.title AS title, si.canonical_url AS canonicalUrl
       FROM source_items si
       LEFT JOIN story_sources ss ON ss.source_item_id = si.id
       WHERE si.id = (SELECT source_item_id FROM content_items WHERE id = ?)
          OR ss.cluster_id = (SELECT cluster_id FROM content_items WHERE id = ?)`,
    )
    .all(id, id) as Array<{ title: string; canonicalUrl: string }>;
  const claims = db
    .prepare(
      `SELECT claim_text AS claimText, evidence_url AS evidenceUrl, verdict FROM evidence_claims
       WHERE content_item_id = ? OR cluster_id = (SELECT cluster_id FROM content_items WHERE id = ?)`,
    )
    .all(id, id) as Array<{ claimText: string; evidenceUrl: string; verdict: string }>;
  return {
    item: { id: row.id, title: row.title, kind: row.kind, editorialState: row.editorial_state },
    sources,
    claims,
  };
}

export function transitionContentItem(
  db: StudioDatabase,
  id: string,
  to: string,
  { actor: _actor, now }: { actor: string; now?: number } = { actor: 'system' },
): { id: string; editorialState: string } {
  const row = db
    .prepare('SELECT editorial_state FROM content_items WHERE id = ?')
    .get(id) as { editorial_state: string } | undefined;
  if (!row) throw new Error('content_not_found');
  if (!canTransitionContent(row.editorial_state, to)) {
    throw new Error(`invalid_content_transition: ${row.editorial_state} -> ${to}`);
  }
  db.prepare('UPDATE content_items SET editorial_state = ?, updated_at = ? WHERE id = ?').run(
    to,
    nowIso(now),
    id,
  );
  return { id, editorialState: to };
}

export interface VariantRow {
  id: string;
  contentItemId: string;
  platform: string;
  revision: number;
  text: string;
  status: string;
}

const mapVariant = (row: {
  id: string;
  content_item_id: string;
  platform: string;
  revision: number;
  text: string;
  status: string;
}): VariantRow => ({
  id: row.id,
  contentItemId: row.content_item_id,
  platform: row.platform,
  revision: row.revision,
  text: row.text,
  status: row.status,
});

export function createVariant(
  db: StudioDatabase,
  input: { contentItemId: string; platform: string; text?: string; now?: number },
): VariantRow {
  const id = newId();
  const stamp = nowIso(input.now);
  db.prepare(
    `INSERT INTO platform_variants (id, content_item_id, platform, revision, text, status, created_at, updated_at)
     VALUES (?, ?, ?, 1, ?, 'draft', ?, ?)`,
  ).run(id, input.contentItemId, input.platform, input.text ?? '', stamp, stamp);
  return {
    id,
    contentItemId: input.contentItemId,
    platform: input.platform,
    revision: 1,
    text: input.text ?? '',
    status: 'draft',
  };
}

export function getVariant(db: StudioDatabase, id: string): VariantRow | null {
  const row = db.prepare('SELECT * FROM platform_variants WHERE id = ?').get(id) as
    | Parameters<typeof mapVariant>[0]
    | undefined;
  return row ? mapVariant(row) : null;
}

export function updateVariantText(
  db: StudioDatabase,
  id: string,
  text: string,
  { now }: { now?: number } = {},
): { id: string; revision: number; status: string } {
  const current = getVariant(db, id);
  if (!current) throw new Error('variant_not_found');
  const revision = current.revision + 1;
  db.prepare(
    `UPDATE platform_variants
     SET text = ?, revision = ?, status = 'draft', updated_at = ? WHERE id = ?`,
  ).run(text, revision, nowIso(now), id);
  return { id, revision, status: 'draft' };
}

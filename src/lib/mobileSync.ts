/**
 * Offline-first sync engine for the native Android client (issue #1008).
 *
 * The Android app (Kotlin) keeps a local Room cache of invoices and pushes
 * queued mutations when connectivity returns. This module is the server-side
 * contract it syncs against: a cursor-based delta feed plus an idempotent
 * mutation queue endpoint. It is transport-agnostic and pure so it can be
 * unit-tested and reused by the web client's offline mode.
 */

export type SyncMutationKind = "invoice.create" | "invoice.update" | "invoice.delete";

export interface SyncMutation {
  /** Client-generated idempotency key (UUID). Replays must be no-ops. */
  id: string;
  kind: SyncMutationKind;
  invoiceId: string;
  /** Client wall-clock time in unix ms, used for last-write-wins. */
  updatedAt: number;
  payload?: Record<string, unknown>;
}

export interface SyncRecord {
  invoiceId: string;
  updatedAt: number;
  deleted: boolean;
  payload?: Record<string, unknown>;
}

export interface SyncDelta {
  records: SyncRecord[];
  /** Opaque cursor to pass on the next pull; null when fully caught up. */
  nextCursor: string | null;
  serverTime: number;
}

export interface SyncApplyResult {
  applied: string[];
  /** Mutations rejected because a newer server record already exists. */
  conflicts: string[];
  /** Mutations skipped because their id was already applied. */
  duplicates: string[];
  cursor: string;
}

const MAX_BATCH = 100;

/** Encode/decode the opaque cursor as `<updatedAt>:<invoiceId>`. */
export function encodeCursor(record: SyncRecord | null): string | null {
  if (!record) return null;
  return `${record.updatedAt}:${record.invoiceId}`;
}

export function decodeCursor(cursor: string | null | undefined): { updatedAt: number; invoiceId: string } | null {
  if (!cursor) return null;
  const sep = cursor.indexOf(":");
  if (sep <= 0) return null;
  const updatedAt = Number(cursor.slice(0, sep));
  const invoiceId = cursor.slice(sep + 1);
  if (!Number.isFinite(updatedAt) || !invoiceId) return null;
  return { updatedAt, invoiceId };
}

function compareRecords(a: SyncRecord, b: SyncRecord): number {
  if (a.updatedAt !== b.updatedAt) return a.updatedAt - b.updatedAt;
  return a.invoiceId < b.invoiceId ? -1 : a.invoiceId > b.invoiceId ? 1 : 0;
}

/**
 * Returns records changed strictly after `cursor`, ordered by (updatedAt,
 * invoiceId) so paging is stable even when many records share a timestamp.
 */
export function pullDelta(
  records: SyncRecord[],
  cursor: string | null | undefined,
  limit = MAX_BATCH,
): SyncDelta {
  const after = decodeCursor(cursor);
  const bounded = Math.min(Math.max(1, limit), MAX_BATCH);
  const sorted = [...records].sort(compareRecords);
  const filtered = after
    ? sorted.filter((r) => compareRecords(r, { ...after, deleted: false }) > 0)
    : sorted;
  const page = filtered.slice(0, bounded);
  const hasMore = filtered.length > page.length;
  return {
    records: page,
    nextCursor: hasMore ? encodeCursor(page[page.length - 1]) : null,
    serverTime: Date.now(),
  };
}

/**
 * Applies a batch of client mutations with last-write-wins semantics.
 * Mutations are idempotent by `id`; stale ones (older than the server record)
 * are reported as conflicts and not applied.
 */
export function applyMutations(
  current: SyncRecord[],
  mutations: SyncMutation[],
  appliedIds: Set<string> = new Set(),
): { records: SyncRecord[]; result: SyncApplyResult } {
  const byId = new Map(current.map((r) => [r.invoiceId, r]));
  const applied: string[] = [];
  const conflicts: string[] = [];
  const duplicates: string[] = [];

  for (const mutation of mutations.slice(0, MAX_BATCH)) {
    if (appliedIds.has(mutation.id)) {
      duplicates.push(mutation.id);
      continue;
    }
    const existing = byId.get(mutation.invoiceId);
    if (existing && existing.updatedAt > mutation.updatedAt) {
      conflicts.push(mutation.id);
      continue;
    }
    byId.set(mutation.invoiceId, {
      invoiceId: mutation.invoiceId,
      updatedAt: mutation.updatedAt,
      deleted: mutation.kind === "invoice.delete",
      payload: mutation.kind === "invoice.delete" ? undefined : mutation.payload,
    });
    appliedIds.add(mutation.id);
    applied.push(mutation.id);
  }

  const records = [...byId.values()].sort(compareRecords);
  return {
    records,
    result: {
      applied,
      conflicts,
      duplicates,
      cursor: encodeCursor(records[records.length - 1] ?? null) ?? "",
    },
  };
}

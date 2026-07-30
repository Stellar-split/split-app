/**
 * Server-only invoice fetching, shared by the RSC invoice list page and
 * `/api/invoices`. Runs the same scan/filter logic either as a direct
 * function call from a Server Component (no HTTP round trip) or from the
 * route handler (for the client-side infinite-scroll dashboard).
 */
import { splitClient } from "@/lib/stellar";
import type { Invoice } from "@stellar-split/sdk";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

export interface FetchInvoicesOptions {
  cursor?: string | null;
  limit?: number;
  /** Case-insensitive prefix match against title/memo. */
  q?: string;
}

export interface FetchInvoicesResult {
  invoices: Invoice[];
  nextCursor: string | null;
}

/**
 * Scans invoice ids starting after `cursor`, returning up to `limit`
 * invoices owned by (created by or a recipient of) `publicKey`.
 */
export async function fetchInvoicesForAddress(
  publicKey: string,
  { cursor, limit: limitParam, q: qParam }: FetchInvoicesOptions = {}
): Promise<FetchInvoicesResult> {
  const limit = Math.min(Math.max(1, limitParam ?? DEFAULT_PAGE_SIZE), MAX_PAGE_SIZE);
  const q = (qParam ?? "").trim().toLowerCase();
  const startId = cursor ? parseInt(cursor, 10) + 1 : 1;

  const results: Invoice[] = [];

  for (let id = startId; results.length < limit; id++) {
    if (id > startId + limit * 10) break;

    try {
      const inv = await splitClient.getInvoice(String(id));
      const mine =
        inv.creator === publicKey || inv.recipients.some((r) => r.address === publicKey);

      if (mine) {
        if (q) {
          const memo = (inv as { memo?: string }).memo;
          const matchesQuery =
            (inv.title || "").toLowerCase().startsWith(q) || (memo || "").toLowerCase().startsWith(q);
          if (matchesQuery) results.push(inv);
        } else {
          results.push(inv);
        }
      }
    } catch {
      // splitClient throws when the invoice id does not exist — end of list.
      return { invoices: results, nextCursor: null };
    }
  }

  const nextCursor = results.length === limit ? String(results[results.length - 1].id) : null;
  return { invoices: results, nextCursor };
}

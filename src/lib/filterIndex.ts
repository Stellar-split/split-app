/**
 * Local implementation of compileFilter + FilterIndex pending @stellar-split/sdk issue #7.
 * API mirrors the proposed SDK surface so the import can be swapped once the SDK ships.
 */

import type { Invoice } from '@stellar-split/sdk';

export interface FilterCriteria {
  statuses?: string[];
  token?: string;
  fundedMin?: bigint;
  fundedMax?: bigint;
  deadlineFrom?: number; // unix timestamp
  deadlineTo?: number;   // unix timestamp
  creator?: string;
  recipient?: string;
}

export type CompiledFilter = Readonly<FilterCriteria>;

export function compileFilter(criteria: FilterCriteria): CompiledFilter {
  return Object.freeze({ ...criteria });
}

export class FilterIndex {
  static queryIndex(invoices: Invoice[], filter: CompiledFilter): Invoice[] {
    const hasConstraints = Object.keys(filter).some((k) => {
      const v = (filter as Record<string, unknown>)[k];
      return Array.isArray(v) ? v.length > 0 : v !== undefined;
    });
    if (!hasConstraints) return invoices;

    return invoices.filter((inv) => {
      if (filter.statuses?.length && !filter.statuses.includes(inv.status)) return false;

      if (filter.token) {
        const invToken: string = (inv as Record<string, unknown>).token as string ?? 'USDC';
        if (invToken.toLowerCase() !== filter.token.toLowerCase()) return false;
      }

      if (filter.fundedMin !== undefined && inv.funded < filter.fundedMin) return false;
      if (filter.fundedMax !== undefined && inv.funded > filter.fundedMax) return false;

      if (filter.deadlineFrom !== undefined && inv.deadline < filter.deadlineFrom) return false;
      if (filter.deadlineTo !== undefined && inv.deadline > filter.deadlineTo) return false;

      if (filter.creator && inv.creator.toLowerCase() !== filter.creator.toLowerCase()) return false;

      if (filter.recipient) {
        const match = inv.recipients.some(
          (r) => r.address.toLowerCase() === filter.recipient!.toLowerCase(),
        );
        if (!match) return false;
      }

      return true;
    });
  }
}

// ── URL serialisation ──────────────────────────────────────────────────────────

function tsToDateStr(ts: number): string {
  return new Date(ts * 1000).toISOString().slice(0, 10);
}

function dateStrToTs(date: string): number {
  return Math.floor(new Date(date).getTime() / 1000);
}

export function toURLParams(criteria: FilterCriteria): URLSearchParams {
  const p = new URLSearchParams();
  if (criteria.statuses?.length) p.set('status', criteria.statuses.join(','));
  if (criteria.token) p.set('token', criteria.token);
  if (criteria.fundedMin !== undefined) p.set('fundedMin', String(criteria.fundedMin));
  if (criteria.fundedMax !== undefined) p.set('fundedMax', String(criteria.fundedMax));
  if (criteria.deadlineFrom !== undefined) p.set('deadlineFrom', tsToDateStr(criteria.deadlineFrom));
  if (criteria.deadlineTo !== undefined) p.set('deadlineTo', tsToDateStr(criteria.deadlineTo));
  if (criteria.creator) p.set('creator', criteria.creator);
  if (criteria.recipient) p.set('recipient', criteria.recipient);
  return p;
}

export function fromURLParams(params: Pick<URLSearchParams, 'get'>): FilterCriteria {
  const c: FilterCriteria = {};

  const status = params.get('status');
  if (status) c.statuses = status.split(',').filter(Boolean);

  const token = params.get('token');
  if (token) c.token = token;

  const fundedMin = params.get('fundedMin');
  if (fundedMin) c.fundedMin = BigInt(fundedMin);

  const fundedMax = params.get('fundedMax');
  if (fundedMax) c.fundedMax = BigInt(fundedMax);

  const deadlineFrom = params.get('deadlineFrom');
  if (deadlineFrom) c.deadlineFrom = dateStrToTs(deadlineFrom);

  const deadlineTo = params.get('deadlineTo');
  if (deadlineTo) c.deadlineTo = dateStrToTs(deadlineTo);

  const creator = params.get('creator');
  if (creator) c.creator = creator;

  const recipient = params.get('recipient');
  if (recipient) c.recipient = recipient;

  return c;
}

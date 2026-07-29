/**
 * Natural language query parser for invoice search.
 * Parses freeform queries into structured filter parameters.
 */

export interface ParsedFilter {
  amountGte?: number;
  amountLte?: number;
  asset?: string;
  status?: 'pending' | 'paid' | 'overdue' | 'draft';
  dueDateFrom?: Date;
  dueDateTo?: Date;
  recipientKeyword?: string;
  titleKeyword?: string;
}

export interface FilterToken {
  type:
    | 'amount_range'
    | 'amount_min'
    | 'amount_max'
    | 'status'
    | 'date_range'
    | 'date_min'
    | 'date_max'
    | 'asset'
    | 'keyword';
  label: string;
  value: string;
}

/**
 * Parse relative date strings into dates
 */
function parseRelativeDate(
  dateStr: string
): { from: Date; to: Date } | null {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const normalized = dateStr.toLowerCase().trim();

  // Yesterday
  if (normalized === 'yesterday') {
    const end = new Date(yesterday);
    end.setHours(23, 59, 59, 999);
    return { from: yesterday, to: end };
  }

  // Today
  if (normalized === 'today') {
    const end = new Date(today);
    end.setHours(23, 59, 59, 999);
    return { from: today, to: end };
  }

  // Tomorrow
  if (normalized === 'tomorrow') {
    const end = new Date(tomorrow);
    end.setHours(23, 59, 59, 999);
    return { from: tomorrow, to: end };
  }

  // This week (Monday to Sunday)
  if (normalized === 'this week') {
    const from = new Date(today);
    const dayOfWeek = from.getDay();
    from.setDate(from.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    const to = new Date(from);
    to.setDate(to.getDate() + 6);
    to.setHours(23, 59, 59, 999);
    return { from, to };
  }

  // Last week
  if (normalized === 'last week') {
    const from = new Date(today);
    const dayOfWeek = from.getDay();
    from.setDate(from.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1) - 7);
    const to = new Date(from);
    to.setDate(to.getDate() + 6);
    to.setHours(23, 59, 59, 999);
    return { from, to };
  }

  // This month
  if (normalized === 'this month') {
    const from = new Date(today.getFullYear(), today.getMonth(), 1);
    const to = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    to.setHours(23, 59, 59, 999);
    return { from, to };
  }

  // Last month
  if (normalized === 'last month') {
    const from = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const to = new Date(today.getFullYear(), today.getMonth(), 0);
    to.setHours(23, 59, 59, 999);
    return { from, to };
  }

  // Past N days
  const pastDaysMatch = normalized.match(/past\s+(\d+)\s+days?/);
  if (pastDaysMatch) {
    const days = parseInt(pastDaysMatch[1], 10);
    const from = new Date(today);
    from.setDate(from.getDate() - days);
    const to = new Date(today);
    to.setHours(23, 59, 59, 999);
    return { from, to };
  }

  return null;
}

/**
 * Parse amount from string like "100", "100 XLM", "100xlm"
 */
function parseAmount(str: string): number | null {
  const match = str.match(/(\d+(?:\.\d+)?)/);
  if (!match) return null;
  return parseFloat(match[1]);
}

/**
 * Parse status keywords
 */
function parseStatus(keyword: string): ParsedFilter['status'] | null {
  const normalized = keyword.toLowerCase().trim();
  const statusMap: Record<string, ParsedFilter['status']> = {
    unpaid: 'pending',
    pending: 'pending',
    paid: 'paid',
    overdue: 'overdue',
    draft: 'draft',
    cancelled: 'paid', // Map cancelled to paid for filtering
  };
  return statusMap[normalized] || null;
}

/**
 * Parse asset name
 */
function parseAsset(keyword: string): string | null {
  const normalized = keyword.toUpperCase().trim();
  const validAssets = ['XLM', 'USDC', 'EURC', 'ETH', 'USDT'];
  return validAssets.includes(normalized) ? normalized : null;
}

/**
 * Main parser function
 */
export function parseNaturalLanguageQuery(
  query: string
): { filters: ParsedFilter; tokens: FilterToken[] } {
  const tokens: FilterToken[] = [];
  const filters: ParsedFilter = {};
  let remainingQuery = query;

  // Amount range: "between 200 and 400"
  const betweenMatch = remainingQuery.match(
    /between\s+(\d+(?:\.\d+)?)\s+(?:and|to)\s+(\d+(?:\.\d+)?)\s*(?:xlm)?/i
  );
  if (betweenMatch) {
    const min = parseFloat(betweenMatch[1]);
    const max = parseFloat(betweenMatch[2]);
    filters.amountGte = Math.min(min, max);
    filters.amountLte = Math.max(min, max);
    tokens.push({
      type: 'amount_range',
      label: `Amount between ${min} and ${max} XLM`,
      value: `${min}-${max}`,
    });
    remainingQuery = remainingQuery.replace(betweenMatch[0], '');
  }

  // Amount minimum: "over X", "more than X", "at least X"
  const amountMinMatch = remainingQuery.match(
    /(?:over|more\s+than|at\s+least)\s+(\d+(?:\.\d+)?)\s*(?:xlm)?/i
  );
  if (amountMinMatch) {
    const amount = parseFloat(amountMinMatch[1]);
    filters.amountGte = amount;
    tokens.push({
      type: 'amount_min',
      label: `Amount ≥ ${amount} XLM`,
      value: String(amount),
    });
    remainingQuery = remainingQuery.replace(amountMinMatch[0], '');
  }

  // Amount maximum: "under X", "less than X", "below X"
  const amountMaxMatch = remainingQuery.match(
    /(?:under|less\s+than|below)\s+(\d+(?:\.\d+)?)\s*(?:xlm)?/i
  );
  if (amountMaxMatch) {
    const amount = parseFloat(amountMaxMatch[1]);
    filters.amountLte = amount;
    tokens.push({
      type: 'amount_max',
      label: `Amount ≤ ${amount} XLM`,
      value: String(amount),
    });
    remainingQuery = remainingQuery.replace(amountMaxMatch[0], '');
  }

  // Status keywords
  const statusKeywords = ['unpaid', 'pending', 'paid', 'overdue', 'draft', 'cancelled'];
  for (const keyword of statusKeywords) {
    const regex = new RegExp(`\\b${keyword}\\b`, 'i');
    if (regex.test(remainingQuery)) {
      const status = parseStatus(keyword);
      if (status) {
        filters.status = status;
        tokens.push({
          type: 'status',
          label: `Status: ${status}`,
          value: status,
        });
      }
      remainingQuery = remainingQuery.replace(regex, '');
      break;
    }
  }

  // Relative date ranges
  const datePatterns = [
    'past \\d+ days?',
    'last month',
    'last week',
    'this month',
    'this week',
    'today',
    'yesterday',
    'tomorrow',
  ];
  for (const pattern of datePatterns) {
    const regex = new RegExp(pattern, 'i');
    const match = remainingQuery.match(regex);
    if (match) {
      const dateRange = parseRelativeDate(match[0]);
      if (dateRange) {
        filters.dueDateFrom = dateRange.from;
        filters.dueDateTo = dateRange.to;
        tokens.push({
          type: 'date_range',
          label: `Date: ${match[0]}`,
          value: match[0],
        });
      }
      remainingQuery = remainingQuery.replace(regex, '');
      break;
    }
  }

  // Asset name: "XLM", "USDC", etc.
  const assetMatch = remainingQuery.match(/\b(xlm|usdc|eurc|eth|usdt)\b/i);
  if (assetMatch) {
    const asset = parseAsset(assetMatch[1]);
    if (asset) {
      filters.asset = asset;
      tokens.push({
        type: 'asset',
        label: `Asset: ${asset}`,
        value: asset,
      });
    }
    remainingQuery = remainingQuery.replace(assetMatch[0], '');
  }

  // Remaining text as keyword fallback
  const keyword = remainingQuery.trim();
  if (keyword.length > 0) {
    filters.titleKeyword = keyword;
    tokens.push({
      type: 'keyword',
      label: `Keyword: ${keyword}`,
      value: keyword,
    });
  }

  return { filters, tokens };
}

/**
 * Apply parsed filters to invoice array
 */
export function applyParsedFilters<T extends { amount?: number; status?: string; title?: string; recipients?: Array<{ address: string }> }>(
  items: T[],
  filters: ParsedFilter
): T[] {
  return items.filter((item) => {
    if (filters.amountGte !== undefined && (item.amount || 0) < filters.amountGte) {
      return false;
    }
    if (filters.amountLte !== undefined && (item.amount || 0) > filters.amountLte) {
      return false;
    }
    if (filters.status && item.status !== filters.status) {
      return false;
    }
    if (filters.titleKeyword) {
      const title = (item.title || '').toLowerCase();
      const recipientAddrs = (item.recipients || []).map((r) => r.address.toLowerCase()).join(' ');
      const searchText = title + ' ' + recipientAddrs;
      if (!searchText.includes(filters.titleKeyword.toLowerCase())) {
        return false;
      }
    }
    return true;
  });
}

export type InvoiceLinkType = 'dependency' | 'conditional';

export interface InvoiceLink {
  id: string;
  fromInvoiceId: string;
  toInvoiceId: string;
  type: InvoiceLinkType;
  /** For conditional links: the linked invoice is only required when this predicate holds. */
  condition?: (context: LinkContext) => boolean;
  createdAt: string;
}

export interface LinkContext {
  invoiceStatus?: Record<string, string>;
  [key: string]: unknown;
}

export interface LinkValidationResult {
  valid: boolean;
  errors: string[];
}

export interface LinkAnalytics {
  totalLinks: number;
  byType: Record<InvoiceLinkType, number>;
  orphanedInvoiceIds: string[];
  circularLinkIds: string[];
  dependencyCounts: Record<string, number>;
}

let linkCounter = 0;

function nextLinkId(): string {
  linkCounter += 1;
  return `link_${Date.now()}_${linkCounter}`;
}

/**
 * Create a link between two invoices. Throws on self-links or duplicate links.
 */
export function createLink(
  fromInvoiceId: string,
  toInvoiceId: string,
  type: InvoiceLinkType,
  condition?: (context: LinkContext) => boolean,
): InvoiceLink {
  if (fromInvoiceId === toInvoiceId) {
    throw new Error('An invoice cannot be linked to itself');
  }
  if (type === 'conditional' && typeof condition !== 'function') {
    throw new Error('Conditional links require a condition predicate');
  }
  return {
    id: nextLinkId(),
    fromInvoiceId,
    toInvoiceId,
    type,
    condition,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Validate a set of links: no self-links, no duplicates, no dangling references.
 */
export function validateLinks(
  links: InvoiceLink[],
  knownInvoiceIds: string[],
): LinkValidationResult {
  const errors: string[] = [];
  const known = new Set(knownInvoiceIds);
  const seen = new Set<string>();

  for (const link of links) {
    if (link.fromInvoiceId === link.toInvoiceId) {
      errors.push(`Link ${link.id} references the same invoice on both ends`);
    }
    if (!known.has(link.fromInvoiceId)) {
      errors.push(`Link ${link.id} has unknown source invoice ${link.fromInvoiceId}`);
    }
    if (!known.has(link.toInvoiceId)) {
      errors.push(`Link ${link.id} has unknown target invoice ${link.toInvoiceId}`);
    }
    const key = `${link.fromInvoiceId}->${link.toInvoiceId}:${link.type}`;
    if (seen.has(key)) {
      errors.push(`Duplicate ${link.type} link from ${link.fromInvoiceId} to ${link.toInvoiceId}`);
    }
    seen.add(key);
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Detect circular dependencies among dependency links using DFS.
 * Returns the ids of links that participate in a cycle.
 */
export function detectCircularDependencies(links: InvoiceLink[]): string[] {
  const adjacency = new Map<string, InvoiceLink[]>();
  for (const link of links) {
    if (link.type !== 'dependency') continue;
    const list = adjacency.get(link.fromInvoiceId) ?? [];
    list.push(link);
    adjacency.set(link.fromInvoiceId, list);
  }

  const circular = new Set<string>();
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const stack: InvoiceLink[] = [];

  function visit(node: string): void {
    if (visiting.has(node)) {
      const cycleStart = stack.findIndex((l) => l.fromInvoiceId === node);
      for (const link of stack.slice(cycleStart)) {
        circular.add(link.id);
      }
      return;
    }
    if (visited.has(node)) return;
    visiting.add(node);
    for (const link of adjacency.get(node) ?? []) {
      stack.push(link);
      visit(link.toInvoiceId);
      stack.pop();
    }
    visiting.delete(node);
    visited.add(node);
  }

  for (const node of adjacency.keys()) {
    visit(node);
  }

  return Array.from(circular);
}

/**
 * Resolve the ordered list of invoices that must be settled before the given invoice.
 * Conditional links are only followed when their predicate holds for the context.
 * Throws if a circular dependency is detected.
 */
export function resolveDependencies(
  invoiceId: string,
  links: InvoiceLink[],
  context: LinkContext = {},
): string[] {
  const circular = detectCircularDependencies(links);
  if (circular.length > 0) {
    throw new Error(`Circular dependency detected: ${circular.join(', ')}`);
  }

  const resolved: string[] = [];
  const seen = new Set<string>();

  function walk(current: string): void {
    for (const link of links) {
      if (link.fromInvoiceId !== current) continue;
      if (link.type === 'conditional' && link.condition && !link.condition(context)) {
        continue;
      }
      if (seen.has(link.toInvoiceId)) continue;
      seen.add(link.toInvoiceId);
      walk(link.toInvoiceId);
      resolved.push(link.toInvoiceId);
    }
  }

  walk(invoiceId);
  return resolved;
}

/**
 * Compute analytics over the current link graph.
 */
export function computeLinkAnalytics(
  links: InvoiceLink[],
  knownInvoiceIds: string[],
): LinkAnalytics {
  const byType: Record<InvoiceLinkType, number> = { dependency: 0, conditional: 0 };
  const dependencyCounts: Record<string, number> = {};
  const linked = new Set<string>();

  for (const link of links) {
    byType[link.type] += 1;
    linked.add(link.fromInvoiceId);
    linked.add(link.toInvoiceId);
    dependencyCounts[link.toInvoiceId] = (dependencyCounts[link.toInvoiceId] ?? 0) + 1;
  }

  const orphanedInvoiceIds = knownInvoiceIds.filter((id) => !linked.has(id));

  return {
    totalLinks: links.length,
    byType,
    orphanedInvoiceIds,
    circularLinkIds: detectCircularDependencies(links),
    dependencyCounts,
  };
}

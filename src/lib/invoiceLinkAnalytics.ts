export type InvoiceLinkType = 'dependency' | 'conditional';

export interface InvoiceLink {
  id: string;
  sourceInvoiceId: string;
  targetInvoiceId: string;
  type: InvoiceLinkType;
  /** For conditional links: the condition that must hold for the link to activate. */
  condition?: string;
  createdAt: string;
}

export interface LinkValidationResult {
  valid: boolean;
  errors: string[];
}

export interface CircularDependencyResult {
  hasCycle: boolean;
  cycle: string[];
}

export interface DependencyResolutionResult {
  /** Invoice ids in the order they must be processed (dependencies first). */
  order: string[];
  /** Invoice ids that could not be resolved due to cycles. */
  unresolved: string[];
}

export interface LinkAnalytics {
  totalLinks: number;
  byType: Record<InvoiceLinkType, number>;
  /** Number of links pointing to each invoice. */
  inboundCounts: Record<string, number>;
  /** Number of links originating from each invoice. */
  outboundCounts: Record<string, number>;
  /** Invoices that participate in no links at all. */
  orphanedInvoices: string[];
}

const LINK_TYPES: InvoiceLinkType[] = ['dependency', 'conditional'];

/**
 * Validate a set of invoice links: no self-links, no duplicate links, and all
 * referenced invoices must exist in the provided invoice id set.
 */
export function validateLinks(
  links: InvoiceLink[],
  invoiceIds: string[],
): LinkValidationResult {
  const errors: string[] = [];
  const known = new Set(invoiceIds);
  const seen = new Set<string>();

  for (const link of links) {
    if (link.sourceInvoiceId === link.targetInvoiceId) {
      errors.push(`Invoice ${link.sourceInvoiceId} cannot link to itself`);
    }
    if (!known.has(link.sourceInvoiceId)) {
      errors.push(`Unknown source invoice: ${link.sourceInvoiceId}`);
    }
    if (!known.has(link.targetInvoiceId)) {
      errors.push(`Unknown target invoice: ${link.targetInvoiceId}`);
    }
    if (!LINK_TYPES.includes(link.type)) {
      errors.push(`Invalid link type: ${link.type}`);
    }
    if (link.type === 'conditional' && !link.condition) {
      errors.push(`Conditional link ${link.id} requires a condition`);
    }
    const key = `${link.sourceInvoiceId}->${link.targetInvoiceId}:${link.type}`;
    if (seen.has(key)) {
      errors.push(`Duplicate link: ${key}`);
    }
    seen.add(key);
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Detect a circular dependency among dependency links using depth-first search.
 * Returns the first cycle found, if any.
 */
export function detectCircularDependency(
  links: InvoiceLink[],
): CircularDependencyResult {
  const graph = new Map<string, string[]>();
  for (const link of links) {
    if (link.type !== 'dependency') continue;
    const edges = graph.get(link.sourceInvoiceId) ?? [];
    edges.push(link.targetInvoiceId);
    graph.set(link.sourceInvoiceId, edges);
  }

  const visited = new Set<string>();
  const stack = new Set<string>();
  const path: string[] = [];

  const visit = (node: string): string[] | null => {
    if (stack.has(node)) {
      const start = path.indexOf(node);
      return path.slice(start).concat(node);
    }
    if (visited.has(node)) return null;
    visited.add(node);
    stack.add(node);
    path.push(node);
    for (const next of graph.get(node) ?? []) {
      const cycle = visit(next);
      if (cycle) return cycle;
    }
    stack.delete(node);
    path.pop();
    return null;
  };

  for (const node of graph.keys()) {
    const cycle = visit(node);
    if (cycle) return { hasCycle: true, cycle };
  }
  return { hasCycle: false, cycle: [] };
}

/**
 * Resolve dependency order (topological sort) for dependency links. Invoices
 * involved in cycles are reported as unresolved rather than silently dropped.
 */
export function resolveDependencies(
  links: InvoiceLink[],
  invoiceIds: string[],
): DependencyResolutionResult {
  const deps = new Map<string, Set<string>>();
  for (const id of invoiceIds) deps.set(id, new Set());
  for (const link of links) {
    if (link.type !== 'dependency') continue;
    if (!deps.has(link.sourceInvoiceId)) deps.set(link.sourceInvoiceId, new Set());
    deps.get(link.sourceInvoiceId)!.add(link.targetInvoiceId);
  }

  const order: string[] = [];
  const resolved = new Set<string>();
  const visiting = new Set<string>();
  const unresolved = new Set<string>();

  const visit = (node: string): boolean => {
    if (resolved.has(node)) return true;
    if (visiting.has(node)) {
      unresolved.add(node);
      return false;
    }
    visiting.add(node);
    let ok = true;
    for (const dep of deps.get(node) ?? []) {
      if (!visit(dep)) ok = false;
    }
    visiting.delete(node);
    if (ok) {
      resolved.add(node);
      order.push(node);
    } else {
      unresolved.add(node);
    }
    return ok;
  };

  for (const id of deps.keys()) visit(id);

  return { order, unresolved: Array.from(unresolved) };
}

/**
 * Compute analytics over the current set of links, including orphan detection.
 */
export function computeLinkAnalytics(
  links: InvoiceLink[],
  invoiceIds: string[],
): LinkAnalytics {
  const byType: Record<InvoiceLinkType, number> = { dependency: 0, conditional: 0 };
  const inboundCounts: Record<string, number> = {};
  const outboundCounts: Record<string, number> = {};
  const linked = new Set<string>();

  for (const id of invoiceIds) {
    inboundCounts[id] = 0;
    outboundCounts[id] = 0;
  }

  for (const link of links) {
    byType[link.type] = (byType[link.type] ?? 0) + 1;
    outboundCounts[link.sourceInvoiceId] = (outboundCounts[link.sourceInvoiceId] ?? 0) + 1;
    inboundCounts[link.targetInvoiceId] = (inboundCounts[link.targetInvoiceId] ?? 0) + 1;
    linked.add(link.sourceInvoiceId);
    linked.add(link.targetInvoiceId);
  }

  const orphanedInvoices = invoiceIds.filter((id) => !linked.has(id));

  return {
    totalLinks: links.length,
    byType,
    inboundCounts,
    outboundCounts,
    orphanedInvoices,
  };
}

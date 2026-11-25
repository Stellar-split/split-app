export type InvoiceLinkType = 'dependency' | 'conditional';

export interface InvoiceLink {
  id: string;
  sourceInvoiceId: string;
  targetInvoiceId: string;
  type: InvoiceLinkType;
  /** For conditional links: the condition that must hold for the link to be active. */
  condition?: string;
  createdAt?: string;
}

export interface LinkValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface LinkAnalytics {
  totalLinks: number;
  byType: Record<InvoiceLinkType, number>;
  /** Invoices that participate in at least one link. */
  linkedInvoiceIds: string[];
  /** Invoices referenced by links but not present in the known invoice set. */
  orphanedInvoiceIds: string[];
  /** Cycles detected in the dependency graph (each cycle is a list of invoice ids). */
  circularDependencies: string[][];
}

const LINK_TYPES: InvoiceLinkType[] = ['dependency', 'conditional'];

/**
 * Validate a single link's shape and self-references.
 */
export function validateLink(link: InvoiceLink): LinkValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!link.id) {
    errors.push('Link id is required.');
  }
  if (!link.sourceInvoiceId) {
    errors.push('Source invoice id is required.');
  }
  if (!link.targetInvoiceId) {
    errors.push('Target invoice id is required.');
  }
  if (link.sourceInvoiceId && link.sourceInvoiceId === link.targetInvoiceId) {
    errors.push('An invoice cannot link to itself.');
  }
  if (!LINK_TYPES.includes(link.type)) {
    errors.push(`Unsupported link type: ${String(link.type)}.`);
  }
  if (link.type === 'conditional' && !link.condition) {
    warnings.push('Conditional link has no condition; it will always be active.');
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Validate a collection of links, including duplicate detection and
 * orphaned invoice references.
 */
export function validateLinks(
  links: InvoiceLink[],
  knownInvoiceIds: string[] = [],
): LinkValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const seen = new Set<string>();

  for (const link of links) {
    const result = validateLink(link);
    errors.push(...result.errors);
    warnings.push(...result.warnings);

    const key = `${link.sourceInvoiceId}->${link.targetInvoiceId}:${link.type}`;
    if (seen.has(key)) {
      errors.push(`Duplicate link detected: ${key}.`);
    }
    seen.add(key);
  }

  if (knownInvoiceIds.length > 0) {
    const known = new Set(knownInvoiceIds);
    for (const link of links) {
      if (link.sourceInvoiceId && !known.has(link.sourceInvoiceId)) {
        warnings.push(`Source invoice ${link.sourceInvoiceId} is not a known invoice.`);
      }
      if (link.targetInvoiceId && !known.has(link.targetInvoiceId)) {
        warnings.push(`Target invoice ${link.targetInvoiceId} is not a known invoice.`);
      }
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Build an adjacency map of dependency links (source depends on target).
 */
function buildDependencyGraph(links: InvoiceLink[]): Map<string, string[]> {
  const graph = new Map<string, string[]>();
  for (const link of links) {
    if (link.type !== 'dependency') continue;
    const edges = graph.get(link.sourceInvoiceId) ?? [];
    edges.push(link.targetInvoiceId);
    graph.set(link.sourceInvoiceId, edges);
  }
  return graph;
}

/**
 * Detect circular dependencies in the dependency graph using DFS.
 * Returns each detected cycle as an ordered list of invoice ids.
 */
export function detectCircularDependencies(links: InvoiceLink[]): string[][] {
  const graph = buildDependencyGraph(links);
  const cycles: string[][] = [];
  const visited = new Set<string>();
  const stack: string[] = [];
  const inStack = new Set<string>();

  const visit = (node: string): void => {
    if (inStack.has(node)) {
      const start = stack.indexOf(node);
      if (start !== -1) {
        cycles.push([...stack.slice(start), node]);
      }
      return;
    }
    if (visited.has(node)) return;

    visited.add(node);
    inStack.add(node);
    stack.push(node);

    for (const next of graph.get(node) ?? []) {
      visit(next);
    }

    stack.pop();
    inStack.delete(node);
  };

  for (const node of graph.keys()) {
    visit(node);
  }

  return cycles;
}

/**
 * Resolve the ordered list of invoices that must be processed before the
 * given invoice, based on dependency links. Throws if a cycle is detected.
 */
export function resolveDependencies(
  invoiceId: string,
  links: InvoiceLink[],
): string[] {
  const cycles = detectCircularDependencies(links);
  if (cycles.length > 0) {
    throw new Error(
      `Circular dependency detected: ${cycles.map((c) => c.join(' -> ')).join('; ')}`,
    );
  }

  const graph = buildDependencyGraph(links);
  const resolved: string[] = [];
  const seen = new Set<string>();

  const walk = (node: string): void => {
    for (const dep of graph.get(node) ?? []) {
      if (seen.has(dep)) continue;
      seen.add(dep);
      walk(dep);
      resolved.push(dep);
    }
  };

  walk(invoiceId);
  return resolved;
}

/**
 * Determine whether a conditional link is currently active.
 */
export function isConditionalLinkActive(
  link: InvoiceLink,
  evaluate: (condition: string) => boolean,
): boolean {
  if (link.type !== 'conditional') return true;
  if (!link.condition) return true;
  return evaluate(link.condition);
}

/**
 * Compute analytics over the provided links and known invoices.
 */
export function computeLinkAnalytics(
  links: InvoiceLink[],
  knownInvoiceIds: string[] = [],
): LinkAnalytics {
  const byType: Record<InvoiceLinkType, number> = { dependency: 0, conditional: 0 };
  const linked = new Set<string>();
  const referenced = new Set<string>();

  for (const link of links) {
    if (link.type in byType) {
      byType[link.type] += 1;
    }
    if (link.sourceInvoiceId) linked.add(link.sourceInvoiceId);
    if (link.targetInvoiceId) linked.add(link.targetInvoiceId);
    if (link.sourceInvoiceId) referenced.add(link.sourceInvoiceId);
    if (link.targetInvoiceId) referenced.add(link.targetInvoiceId);
  }

  const known = new Set(knownInvoiceIds);
  const orphanedInvoiceIds =
    knownInvoiceIds.length > 0
      ? [...referenced].filter((id) => !known.has(id))
      : [];

  return {
    totalLinks: links.length,
    byType,
    linkedInvoiceIds: [...linked],
    orphanedInvoiceIds,
    circularDependencies: detectCircularDependencies(links),
  };
}

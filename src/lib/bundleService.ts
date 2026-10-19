import { PaymentAggregator } from './paymentAggregator';

export type BundleStatus = 'draft' | 'collecting' | 'completed' | 'cancelled';

export type BundleItemStatus = 'pending' | 'paid' | 'failed' | 'cancelled';

export interface Invoice {
  id: string;
  creatorId: string;
  amount: number;
  currency: string;
  status: string;
  dueDate?: string | Date;
  payerId?: string;
}

export interface BundleItem {
  invoiceId: string;
  amount: number;
  currency: string;
  status: BundleItemStatus;
  addedAt: string;
  paidAt?: string;
}

export interface Bundle {
  id: string;
  creatorId: string;
  name?: string;
  description?: string;
  status: BundleStatus;
  currency: string;
  items: BundleItem[];
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  cancelledAt?: string;
  metadata?: Record<string, unknown>;
}

export interface BundleSummary {
  bundleId: string;
  status: BundleStatus;
  currency: string;
  itemCount: number;
  paidCount: number;
  pendingCount: number;
  failedCount: number;
  cancelledCount: number;
  totalAmount: number;
  paidAmount: number;
  outstandingAmount: number;
  completionRate: number;
}

export interface BundleAnalytics {
  bundleId: string;
  status: BundleStatus;
  currency: string;
  itemCount: number;
  totalAmount: number;
  paidAmount: number;
  outstandingAmount: number;
  completionRate: number;
  itemStatusCounts: Record<BundleItemStatus, number>;
  averageItemAmount: number;
  createdAt: string;
  completedAt?: string;
  durationMs?: number;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export interface CreateBundleInput {
  creatorId: string;
  name?: string;
  description?: string;
  invoiceIds: string[];
  metadata?: Record<string, unknown>;
}

export interface BundleServiceOptions {
  generateId?: () => string;
  now?: () => Date;
}

const VALID_TRANSITIONS: Record<BundleStatus, BundleStatus[]> = {
  draft: ['collecting', 'cancelled'],
  collecting: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

const ITEM_STATUS_TRANSITIONS: Record<BundleItemStatus, BundleItemStatus[]> = {
  pending: ['paid', 'failed', 'cancelled'],
  paid: [],
  failed: ['pending', 'cancelled'],
  cancelled: [],
};

function defaultGenerateId(): string {
  return `bundle_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export class BundleService {
  private bundles: Map<string, Bundle> = new Map();
  private generateId: () => string;
  private now: () => Date;

  constructor(options: BundleServiceOptions = {}) {
    this.generateId = options.generateId ?? defaultGenerateId;
    this.now = options.now ?? (() => new Date());
  }

  /**
   * Validate that the given invoices can be bundled together.
   * Checks eligibility, duplicates, and currency consistency.
   */
  validateBundle(invoices: Invoice[], creatorId: string): ValidationResult {
    const errors: string[] = [];

    if (!creatorId) {
      errors.push('creatorId is required');
    }

    if (!invoices || invoices.length === 0) {
      errors.push('At least one invoice is required to create a bundle');
      return { valid: false, errors };
    }

    const seenIds = new Set<string>();
    const currencies = new Set<string>();

    for (const invoice of invoices) {
      if (!invoice || !invoice.id) {
        errors.push('Invoice is missing an id');
        continue;
      }

      if (seenIds.has(invoice.id)) {
        errors.push(`Duplicate invoice in bundle: ${invoice.id}`);
      }
      seenIds.add(invoice.id);

      if (invoice.creatorId !== creatorId) {
        errors.push(`Invoice ${invoice.id} does not belong to creator ${creatorId}`);
      }

      if (typeof invoice.amount !== 'number' || Number.isNaN(invoice.amount) || invoice.amount <= 0) {
        errors.push(`Invoice ${invoice.id} has an invalid amount`);
      }

      if (!invoice.currency) {
        errors.push(`Invoice ${invoice.id} is missing a currency`);
      } else {
        currencies.add(invoice.currency);
      }

      if (invoice.status === 'paid') {
        errors.push(`Invoice ${invoice.id} is already paid and cannot be bundled`);
      }

      if (invoice.status === 'cancelled') {
        errors.push(`Invoice ${invoice.id} is cancelled and cannot be bundled`);
      }
    }

    if (currencies.size > 1) {
      errors.push(
        `All invoices in a bundle must share the same currency; found: ${Array.from(currencies).join(', ')}`,
      );
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Create a new bundle from the given invoices.
   * Throws if validation fails.
   */
  createBundle(input: CreateBundleInput, invoices: Invoice[]): Bundle {
    const validation = this.validateBundle(invoices, input.creatorId);
    if (!validation.valid) {
      throw new Error(`Cannot create bundle: ${validation.errors.join('; ')}`);
    }

    const timestamp = this.now().toISOString();
    const currency = invoices[0].currency;

    const items: BundleItem[] = invoices.map((invoice) => ({
      invoiceId: invoice.id,
      amount: invoice.amount,
      currency: invoice.currency,
      status: 'pending',
      addedAt: timestamp,
    }));

    const bundle: Bundle = {
      id: this.generateId(),
      creatorId: input.creatorId,
      name: input.name,
      description: input.description,
      status: 'draft',
      currency,
      items,
      createdAt: timestamp,
      updatedAt: timestamp,
      metadata: input.metadata,
    };

    this.bundles.set(bundle.id, bundle);
    return this.cloneBundle(bundle);
  }

  getBundle(bundleId: string): Bundle | undefined {
    const bundle = this.bundles.get(bundleId);
    return bundle ? this.cloneBundle(bundle) : undefined;
  }

  listBundles(creatorId?: string): Bundle[] {
    const all = Array.from(this.bundles.values());
    const filtered = creatorId ? all.filter((b) => b.creatorId === creatorId) : all;
    return filtered.map((b) => this.cloneBundle(b));
  }

  /**
   * Add invoices to an existing bundle. Only allowed while in draft status.
   */
  addInvoices(bundleId: string, invoices: Invoice[]): Bundle {
    const bundle = this.requireBundle(bundleId);

    if (bundle.status !== 'draft') {
      throw new Error(`Cannot add invoices to bundle in status: ${bundle.status}`);
    }

    const existingIds = new Set(bundle.items.map((i) => i.invoiceId));
    const combined = invoices.filter((inv) => !existingIds.has(inv.id));

    if (combined.length === 0) {
      throw new Error('No new invoices to add to bundle');
    }

    const validation = this.validateBundle(invoices, bundle.creatorId);
    if (!validation.valid) {
      throw new Error(`Cannot add invoices: ${validation.errors.join('; ')}`);
    }

    if (invoices[0].currency !== bundle.currency) {
      throw new Error(
        `Currency mismatch: bundle uses ${bundle.currency}, invoices use ${invoices[0].currency}`,
      );
    }

    const timestamp = this.now().toISOString();
    for (const invoice of combined) {
      bundle.items.push({
        invoiceId: invoice.id,
        amount: invoice.amount,
        currency: invoice.currency,
        status: 'pending',
        addedAt: timestamp,
      });
    }

    bundle.updatedAt = timestamp;
    return this.cloneBundle(bundle);
  }

  /**
   * Remove an invoice from a bundle. Only allowed while in draft status.
   */
  removeInvoice(bundleId: string, invoiceId: string): Bundle {
    const bundle = this.requireBundle(bundleId);

    if (bundle.status !== 'draft') {
      throw new Error(`Cannot remove invoices from bundle in status: ${bundle.status}`);
    }

    const index = bundle.items.findIndex((i) => i.invoiceId === invoiceId);
    if (index === -1) {
      throw new Error(`Invoice ${invoiceId} is not part of bundle ${bundleId}`);
    }

    bundle.items.splice(index, 1);
    bundle.updatedAt = this.now().toISOString();
    return this.cloneBundle(bundle);
  }

  /**
   * Transition a bundle to a new status, enforcing valid transitions.
   */
  transitionStatus(bundleId: string, nextStatus: BundleStatus): Bundle {
    const bundle = this.requireBundle(bundleId);

    if (bundle.status === nextStatus) {
      return this.cloneBundle(bundle);
    }

    const allowed = VALID_TRANSITIONS[bundle.status];
    if (!allowed.includes(nextStatus)) {
      throw new Error(`Invalid bundle status transition: ${bundle.status} -> ${nextStatus}`);
    }

    if (nextStatus === 'collecting' && bundle.items.length === 0) {
      throw new Error('Cannot start collecting on an empty bundle');
    }

    if (nextStatus === 'completed') {
      const unpaid = bundle.items.filter((i) => i.status !== 'paid');
      if (unpaid.length > 0) {
        throw new Error(
          `Cannot complete bundle: ${unpaid.length} item(s) are not paid`,
        );
      }
    }

    const timestamp = this.now().toISOString();
    bundle.status = nextStatus;
    bundle.updatedAt = timestamp;

    if (nextStatus === 'completed') {
      bundle.completedAt = timestamp;
    } else if (nextStatus === 'cancelled') {
      bundle.cancelledAt = timestamp;
      for (const item of bundle.items) {
        if (item.status === 'pending' || item.status === 'failed') {
          item.status = 'cancelled';
        }
      }
    }

    return this.cloneBundle(bundle);
  }

  /**
   * Update the status of an individual item within a bundle.
   */
  updateItemStatus(
    bundleId: string,
    invoiceId: string,
    nextStatus: BundleItemStatus,
  ): Bundle {
    const bundle = this.requireBundle(bundleId);

    if (bundle.status === 'cancelled') {
      throw new Error('Cannot update items on a cancelled bundle');
    }

    if (bundle.status === 'completed') {
      throw new Error('Cannot update items on a completed bundle');
    }

    const item = bundle.items.find((i) => i.invoiceId === invoiceId);
    if (!item) {
      throw new Error(`Invoice ${invoiceId} is not part of bundle ${bundleId}`);
    }

    if (item.status === nextStatus) {
      return this.cloneBundle(bundle);
    }

    const allowed = ITEM_STATUS_TRANSITIONS[item.status];
    if (!allowed.includes(nextStatus)) {
      throw new Error(
        `Invalid item status transition for ${invoiceId}: ${item.status} -> ${nextStatus}`,
      );
    }

    const timestamp = this.now().toISOString();
    item.status = nextStatus;
    if (nextStatus === 'paid') {
      item.paidAt = timestamp;
    }
    bundle.updatedAt = timestamp;

    return this.cloneBundle(bundle);
  }

  /**
   * Compute a summary of the bundle, including totals and completion rate.
   */
  getSummary(bundleId: string): BundleSummary {
    const bundle = this.requireBundle(bundleId);

    const itemStatusCounts: Record<BundleItemStatus, number> = {
      pending: 0,
      paid: 0,
      failed: 0,
      cancelled: 0,
    };

    let totalAmount = 0;
    let paidAmount = 0;

    for (const item of bundle.items) {
      itemStatusCounts[item.status] += 1;
      totalAmount += item.amount;
      if (item.status === 'paid') {
        paidAmount += item.amount;
      }
    }

    const outstandingAmount = totalAmount - paidAmount;
    const completionRate =
      bundle.items.length === 0 ? 0 : itemStatusCounts.paid / bundle.items.length;

    return {
      bundleId: bundle.id,
      status: bundle.status,
      currency: bundle.currency,
      itemCount: bundle.items.length,
      paidCount: itemStatusCounts.paid,
      pendingCount: itemStatusCounts.pending,
      failedCount: itemStatusCounts.failed,
      cancelledCount: itemStatusCounts.cancelled,
      totalAmount: roundCurrency(totalAmount),
      paidAmount: roundCurrency(paidAmount),
      outstandingAmount: roundCurrency(outstandingAmount),
      completionRate,
    };
  }

  /**
   * Compute analytics for a bundle.
   */
  getAnalytics(bundleId: string): BundleAnalytics {
    const bundle = this.requireBundle(bundleId);
    const summary = this.getSummary(bundleId);

    const itemStatusCounts: Record<BundleItemStatus, number> = {
      pending: 0,
      paid: 0,
      failed: 0,
      cancelled: 0,
    };

    for (const item of bundle.items) {
      itemStatusCounts[item.status] += 1;
    }

    const averageItemAmount =
      bundle.items.length === 0
        ? 0
        : roundCurrency(summary.totalAmount / bundle.items.length);

    let durationMs: number | undefined;
    if (bundle.completedAt) {
      durationMs =
        new Date(bundle.completedAt).getTime() - new Date(bundle.createdAt).getTime();
    }

    return {
      bundleId: bundle.id,
      status: bundle.status,
      currency: bundle.currency,
      itemCount: bundle.items.length,
      totalAmount: summary.totalAmount,
      paidAmount: summary.paidAmount,
      outstandingAmount: summary.outstandingAmount,
      completionRate: summary.completionRate,
      itemStatusCounts,
      averageItemAmount,
      createdAt: bundle.createdAt,
      completedAt: bundle.completedAt,
      durationMs,
    };
  }

  /**
   * Aggregate analytics across multiple bundles for a creator.
   */
  getCreatorAnalytics(creatorId: string): {
    bundleCount: number;
    totalAmount: number;
    paidAmount: number;
    outstandingAmount: number;
    completionRate: number;
    statusCounts: Record<BundleStatus, number>;
  } {
    const bundles = Array.from(this.bundles.values()).filter(
      (b) => b.creatorId === creatorId,
    );

    const statusCounts: Record<BundleStatus, number> = {
      draft: 0,
      collecting: 0,
      completed: 0,
      cancelled: 0,
    };

    let totalAmount = 0;
    let paidAmount = 0;
    let totalItems = 0;
    let paidItems = 0;

    for (const bundle of bundles) {
      statusCounts[bundle.status] += 1;
      for (const item of bundle.items) {
        totalAmount += item.amount;
        totalItems += 1;
        if (item.status === 'paid') {
          paidAmount += item.amount;
          paidItems += 1;
        }
      }
    }

    return {
      bundleCount: bundles.length,
      totalAmount: roundCurrency(totalAmount),
      paidAmount: roundCurrency(paidAmount),
      outstandingAmount: roundCurrency(totalAmount - paidAmount),
      completionRate: totalItems === 0 ? 0 : paidItems / totalItems,
      statusCounts,
    };
  }

  /**
   * Compute the unified payment total for a bundle using PaymentAggregator.
   * Useful for unified payment collection.
   */
  computeUnifiedPaymentTotal(bundleId: string): number {
    const bundle = this.requireBundle(bundleId);
    const aggregator = new PaymentAggregator();
    for (const item of bundle.items) {
      if (item.status === 'pending' || item.status === 'failed') {
        aggregator.add({ amount: item.amount, currency: item.currency });
      }
    }
    return roundCurrency(aggregator.total());
  }

  private requireBundle(bundleId: string): Bundle {
    const bundle = this.bundles.get(bundleId);
    if (!bundle) {
      throw new Error(`Bundle not found: ${bundleId}`);
    }
    return bundle;
  }

  private cloneBundle(bundle: Bundle): Bundle {
    return {
      ...bundle,
      items: bundle.items.map((item) => ({ ...item })),
      metadata: bundle.metadata ? { ...bundle.metadata } : undefined,
    };
  }
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}
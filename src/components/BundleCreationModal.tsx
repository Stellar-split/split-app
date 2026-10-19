import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bundle,
  BundleService,
  Invoice,
  InvoiceStatus,
  PaymentOptions,
} from '../services/bundleService';

export interface BundleCreationModalProps {
  isOpen: boolean;
  creatorId: string;
  invoices: Invoice[];
  bundleService: BundleService;
  onClose: () => void;
  onBundleCreated?: (bundle: Bundle) => void;
  onOpenUnifiedPayment?: (bundle: Bundle, options: PaymentOptions) => void;
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
}

const ELIGIBLE_STATUSES: InvoiceStatus[] = [
  InvoiceStatus.SENT,
  InvoiceStatus.OVERDUE,
  InvoiceStatus.PARTIALLY_PAID,
];

const formatCurrency = (amount: number, currency: string): string => {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
};

const BundleCreationModal: React.FC<BundleCreationModalProps> = ({
  isOpen,
  creatorId,
  invoices,
  bundleService,
  onClose,
  onBundleCreated,
  onOpenUnifiedPayment,
}) => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bundleName, setBundleName] = useState<string>('');
  const [paymentOptions, setPaymentOptions] = useState<PaymentOptions>({
    allowPartialPayment: false,
    dueDate: undefined,
    currency: undefined,
  });
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [touched, setTouched] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      setSelectedIds(new Set());
      setBundleName('');
      setPaymentOptions({
        allowPartialPayment: false,
        dueDate: undefined,
        currency: undefined,
      });
      setSubmitting(false);
      setSubmitError(null);
      setTouched(false);
    }
  }, [isOpen]);

  const eligibleInvoices = useMemo(
    () => invoices.filter((inv) => ELIGIBLE_STATUSES.includes(inv.status)),
    [invoices],
  );

  const selectedInvoices = useMemo(
    () => eligibleInvoices.filter((inv) => selectedIds.has(inv.id)),
    [eligibleInvoices, selectedIds],
  );

  const toggleInvoice = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setSelectedIds((prev) => {
      if (prev.size === eligibleInvoices.length) {
        return new Set();
      }
      return new Set(eligibleInvoices.map((inv) => inv.id));
    });
  }, [eligibleInvoices]);

  const currencies = useMemo(() => {
    const set = new Set(selectedInvoices.map((inv) => inv.currency));
    return Array.from(set);
  }, [selectedInvoices]);

  const validation: ValidationResult = useMemo(() => {
    const errors: string[] = [];
    if (selectedInvoices.length === 0) {
      errors.push('Select at least one invoice to bundle.');
    }
    if (selectedInvoices.length === 1) {
      errors.push('A bundle must contain at least two invoices.');
    }
    if (currencies.length > 1) {
      errors.push(
        `All invoices in a bundle must share the same currency (found: ${currencies.join(', ')}).`,
      );
    }
    const duplicateIds = new Set<string>();
    const seen = new Set<string>();
    for (const inv of selectedInvoices) {
      if (seen.has(inv.id)) {
        duplicateIds.add(inv.id);
      }
      seen.add(inv.id);
    }
    if (duplicateIds.size > 0) {
      errors.push('Duplicate invoices detected in selection.');
    }
    if (bundleName.trim().length > 100) {
      errors.push('Bundle name must be 100 characters or fewer.');
    }
    return { valid: errors.length === 0, errors };
  }, [selectedInvoices, currencies, bundleName]);

  const totals = useMemo(() => {
    const currency = currencies.length === 1 ? currencies[0] : '';
    const totalAmount = selectedInvoices.reduce(
      (sum, inv) => sum + (inv.amountDue ?? inv.amount),
      0,
    );
    const totalPaid = selectedInvoices.reduce(
      (sum, inv) => sum + (inv.amountPaid ?? 0),
      0,
    );
    return {
      currency,
      totalAmount,
      totalPaid,
      balanceDue: totalAmount - totalPaid,
      count: selectedInvoices.length,
    };
  }, [selectedInvoices, currencies]);

  const handleConfirm = useCallback(async () => {
    setTouched(true);
    if (!validation.valid || submitting) {
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const resolvedCurrency = currencies[0];
      const options: PaymentOptions = {
        ...paymentOptions,
        currency: paymentOptions.currency ?? resolvedCurrency,
      };
      const bundle = await bundleService.createBundle({
        creatorId,
        name: bundleName.trim() || undefined,
        invoiceIds: selectedInvoices.map((inv) => inv.id),
        paymentOptions: options,
      });
      onBundleCreated?.(bundle);
      onOpenUnifiedPayment?.(bundle, options);
      onClose();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to create bundle.';
      setSubmitError(message);
    } finally {
      setSubmitting(false);
    }
  }, [
    validation.valid,
    submitting,
    currencies,
    paymentOptions,
    bundleService,
    creatorId,
    bundleName,
    selectedInvoices,
    onBundleCreated,
    onOpenUnifiedPayment,
    onClose,
  ]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget && !submitting) {
        onClose();
      }
    },
    [onClose, submitting],
  );

  if (!isOpen) {
    return null;
  }

  const showErrors = touched && !validation.valid;

  return (
    <div
      className="bundle-modal-backdrop"
      role="presentation"
      onClick={handleBackdropClick}
    >
      <div
        className="bundle-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="bundle-modal-title"
      >
        <header className="bundle-modal__header">
          <h2 id="bundle-modal-title">Create Invoice Bundle</h2>
          <button
            type="button"
            className="bundle-modal__close"
            aria-label="Close"
            onClick={onClose}
            disabled={submitting}
          >
            &times;
          </button>
        </header>

        <div className="bundle-modal__body">
          <section className="bundle-modal__section">
            <label htmlFor="bundle-name" className="bundle-modal__label">
              Bundle name (optional)
            </label>
            <input
              id="bundle-name"
              type="text"
              className="bundle-modal__input"
              value={bundleName}
              maxLength={120}
              placeholder="e.g. Q3 Retainer Invoices"
              onChange={(e) => setBundleName(e.target.value)}
              disabled={submitting}
            />
          </section>

          <section className="bundle-modal__section">
            <div className="bundle-modal__section-header">
              <h3>Select invoices</h3>
              {eligibleInvoices.length > 0 && (
                <button
                  type="button"
                  className="bundle-modal__link"
                  onClick={toggleAll}
                  disabled={submitting}
                >
                  {selectedIds.size === eligibleInvoices.length
                    ? 'Clear all'
                    : 'Select all'}
                </button>
              )}
            </div>

            {eligibleInvoices.length === 0 ? (
              <p className="bundle-modal__empty">
                No eligible invoices available to bundle.
              </p>
            ) : (
              <ul className="bundle-modal__invoice-list">
                {eligibleInvoices.map((inv) => {
                  const checked = selectedIds.has(inv.id);
                  return (
                    <li
                      key={inv.id}
                      className={`bundle-modal__invoice-item${
                        checked ? ' bundle-modal__invoice-item--selected' : ''
                      }`}
                    >
                      <label className="bundle-modal__invoice-label">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleInvoice(inv.id)}
                          disabled={submitting}
                        />
                        <span className="bundle-modal__invoice-info">
                          <span className="bundle-modal__invoice-number">
                            {inv.number}
                          </span>
                          <span className="bundle-modal__invoice-client">
                            {inv.clientName}
                          </span>
                        </span>
                        <span className="bundle-modal__invoice-amount">
                          {formatCurrency(
                            inv.amountDue ?? inv.amount,
                            inv.currency,
                          )}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="bundle-modal__section">
            <h3>Payment options</h3>
            <label className="bundle-modal__checkbox-label">
              <input
                type="checkbox"
                checked={paymentOptions.allowPartialPayment}
                onChange={(e) =>
                  setPaymentOptions((prev) => ({
                    ...prev,
                    allowPartialPayment: e.target.checked,
                  }))
                }
                disabled={submitting}
              />
              Allow partial payment
            </label>
            <label className="bundle-modal__label" htmlFor="bundle-due-date">
              Due date (optional)
            </label>
            <input
              id="bundle-due-date"
              type="date"
              className="bundle-modal__input"
              value={paymentOptions.dueDate ?? ''}
              onChange={(e) =>
                setPaymentOptions((prev) => ({
                  ...prev,
                  dueDate: e.target.value || undefined,
                }))
              }
              disabled={submitting}
            />
          </section>

          <section className="bundle-modal__section bundle-modal__summary">
            <h3>Bundle summary</h3>
            {selectedInvoices.length === 0 ? (
              <p className="bundle-modal__empty">
                Select invoices to preview the bundle.
              </p>
            ) : (
              <>
                <ul className="bundle-modal__summary-list">
                  {selectedInvoices.map((inv) => (
                    <li key={inv.id} className="bundle-modal__summary-item">
                      <span>{inv.number}</span>
                      <span>
                        {formatCurrency(
                          inv.amountDue ?? inv.amount,
                          inv.currency,
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
                <dl className="bundle-modal__totals">
                  <div>
                    <dt>Invoices</dt>
                    <dd>{totals.count}</dd>
                  </div>
                  <div>
                    <dt>Total amount</dt>
                    <dd>
                      {formatCurrency(totals.totalAmount, totals.currency)}
                    </dd>
                  </div>
                  <div>
                    <dt>Already paid</dt>
                    <dd>{formatCurrency(totals.totalPaid, totals.currency)}</dd>
                  </div>
                  <div className="bundle-modal__totals-balance">
                    <dt>Balance due</dt>
                    <dd>
                      {formatCurrency(totals.balanceDue, totals.currency)}
                    </dd>
                  </div>
                </dl>
              </>
            )}
          </section>

          {showErrors && (
            <div className="bundle-modal__errors" role="alert">
              <ul>
                {validation.errors.map((err) => (
                  <li key={err}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          {submitError && (
            <div className="bundle-modal__errors" role="alert">
              {submitError}
            </div>
          )}
        </div>

        <footer className="bundle-modal__footer">
          <button
            type="button"
            className="bundle-modal__button bundle-modal__button--secondary"
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="bundle-modal__button bundle-modal__button--primary"
            onClick={handleConfirm}
            disabled={submitting || !validation.valid}
          >
            {submitting ? 'Creating bundle…' : 'Create bundle & collect payment'}
          </button>
        </footer>
      </div>
    </div>
  );
};

export default BundleCreationModal;
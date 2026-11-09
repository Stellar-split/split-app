import React, { useEffect, useMemo, useRef, useState } from 'react';
import FocusTrap from './FocusTrap';

export type SubscriptionFrequency = 'weekly' | 'biweekly' | 'monthly';

export interface SubscriptionRecipient {
  id: string;
  name: string;
  amount: number;
}

export interface SubscriptionChanges {
  frequency: SubscriptionFrequency;
  intervalDays: number;
  recipients: SubscriptionRecipient[];
}

export interface SubscriptionModifyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (changes: SubscriptionChanges) => Promise<void> | void;
  initialFrequency?: SubscriptionFrequency;
  initialIntervalDays?: number;
  initialRecipients?: SubscriptionRecipient[];
  title?: string;
  submitLabel?: string;
}

const FREQUENCY_OPTIONS: { value: SubscriptionFrequency; label: string }[] = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Bi-weekly' },
  { value: 'monthly', label: 'Monthly' },
];

const DEFAULT_INTERVAL_DAYS: Record<SubscriptionFrequency, number> = {
  weekly: 7,
  biweekly: 14,
  monthly: 30,
};

const MIN_INTERVAL_DAYS = 1;
const MAX_INTERVAL_DAYS = 365;
const MIN_AMOUNT = 0.01;
const MAX_AMOUNT = 1_000_000;

interface FormErrors {
  frequency?: string;
  intervalDays?: string;
  recipients?: string;
  recipientAmounts?: Record<string, string>;
  submit?: string;
}

function validate(
  frequency: SubscriptionFrequency,
  intervalDays: number,
  recipients: SubscriptionRecipient[]
): FormErrors {
  const errors: FormErrors = {};

  if (!FREQUENCY_OPTIONS.some((opt) => opt.value === frequency)) {
    errors.frequency = 'Please select a valid frequency.';
  }

  if (!Number.isFinite(intervalDays) || !Number.isInteger(intervalDays)) {
    errors.intervalDays = 'Interval must be a whole number of days.';
  } else if (intervalDays < MIN_INTERVAL_DAYS || intervalDays > MAX_INTERVAL_DAYS) {
    errors.intervalDays = `Interval must be between ${MIN_INTERVAL_DAYS} and ${MAX_INTERVAL_DAYS} days.`;
  }

  if (recipients.length === 0) {
    errors.recipients = 'At least one recipient is required.';
  }

  const recipientAmounts: Record<string, string> = {};
  for (const recipient of recipients) {
    if (!Number.isFinite(recipient.amount)) {
      recipientAmounts[recipient.id] = 'Amount must be a number.';
    } else if (recipient.amount < MIN_AMOUNT) {
      recipientAmounts[recipient.id] = `Amount must be at least ${MIN_AMOUNT}.`;
    } else if (recipient.amount > MAX_AMOUNT) {
      recipientAmounts[recipient.id] = `Amount must be at most ${MAX_AMOUNT}.`;
    }
  }
  if (Object.keys(recipientAmounts).length > 0) {
    errors.recipientAmounts = recipientAmounts;
  }

  return errors;
}

function hasErrors(errors: FormErrors): boolean {
  return Boolean(
    errors.frequency ||
      errors.intervalDays ||
      errors.recipients ||
      (errors.recipientAmounts && Object.keys(errors.recipientAmounts).length > 0)
  );
}

const SubscriptionModifyModal: React.FC<SubscriptionModifyModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  initialFrequency = 'monthly',
  initialIntervalDays,
  initialRecipients = [],
  title = 'Modify Subscription',
  submitLabel = 'Save Changes',
}) => {
  const [frequency, setFrequency] = useState<SubscriptionFrequency>(initialFrequency);
  const [intervalDays, setIntervalDays] = useState<number>(
    initialIntervalDays ?? DEFAULT_INTERVAL_DAYS[initialFrequency]
  );
  const [recipients, setRecipients] = useState<SubscriptionRecipient[]>(initialRecipients);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [touched, setTouched] = useState(false);

  const intervalInputRef = useRef<HTMLInputElement>(null);
  const firstFieldRef = useRef<HTMLSelectElement>(null);

  // Reset form state whenever the modal is (re)opened.
  useEffect(() => {
    if (isOpen) {
      setFrequency(initialFrequency);
      setIntervalDays(initialIntervalDays ?? DEFAULT_INTERVAL_DAYS[initialFrequency]);
      setRecipients(initialRecipients);
      setErrors({});
      setIsSubmitting(false);
      setTouched(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Focus the first field when opened.
  useEffect(() => {
    if (isOpen) {
      const timer = window.setTimeout(() => {
        firstFieldRef.current?.focus();
      }, 0);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [isOpen]);

  const validationErrors = useMemo(
    () => validate(frequency, intervalDays, recipients),
    [frequency, intervalDays, recipients]
  );

  const handleFrequencyChange = (next: SubscriptionFrequency) => {
    setFrequency(next);
    // Auto-adjust interval to the default for the chosen frequency.
    setIntervalDays(DEFAULT_INTERVAL_DAYS[next]);
    setTouched(true);
  };

  const handleIntervalChange = (raw: string) => {
    const parsed = raw === '' ? NaN : Number(raw);
    setIntervalDays(parsed);
    setTouched(true);
  };

  const handleAmountChange = (id: string, raw: string) => {
    const parsed = raw === '' ? NaN : Number(raw);
    setRecipients((prev) =>
      prev.map((recipient) =>
        recipient.id === id ? { ...recipient, amount: parsed } : recipient
      )
    );
    setTouched(true);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setTouched(true);

    const currentErrors = validate(frequency, intervalDays, recipients);
    if (hasErrors(currentErrors)) {
      setErrors(currentErrors);
      return;
    }

    setErrors({});
    setIsSubmitting(true);
    try {
      await onConfirm({
        frequency,
        intervalDays,
        recipients: recipients.map((recipient) => ({
          ...recipient,
          amount: Number(recipient.amount),
        })),
      });
      setIsSubmitting(false);
    } catch (err) {
      const message =
        err instanceof Error && err.message
          ? err.message
          : 'Something went wrong while saving changes. Please try again.';
      setErrors((prev) => ({ ...prev, submit: message }));
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (isSubmitting) {
      return;
    }
    onClose();
  };

  if (!isOpen) {
    return null;
  }

  const showErrors = touched;
  const displayErrors: FormErrors = showErrors ? { ...validationErrors, ...errors } : errors;

  return (
    <FocusTrap active={isOpen} onClose={handleClose}>
      <div
        className="subscription-modify-modal__overlay"
        role="presentation"
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            handleClose();
          }
        }}
      >
        <div
          className="subscription-modify-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="subscription-modify-modal-title"
        >
          <header className="subscription-modify-modal__header">
            <h2 id="subscription-modify-modal-title" className="subscription-modify-modal__title">
              {title}
            </h2>
            <button
              type="button"
              className="subscription-modify-modal__close"
              onClick={handleClose}
              aria-label="Close"
              disabled={isSubmitting}
            >
              &times;
            </button>
          </header>

          <form className="subscription-modify-modal__form" onSubmit={handleSubmit} noValidate>
            <div className="subscription-modify-modal__field">
              <label htmlFor="subscription-frequency" className="subscription-modify-modal__label">
                Billing frequency
              </label>
              <select
                id="subscription-frequency"
                ref={firstFieldRef}
                className="subscription-modify-modal__select"
                value={frequency}
                onChange={(event) =>
                  handleFrequencyChange(event.target.value as SubscriptionFrequency)
                }
                disabled={isSubmitting}
                aria-invalid={Boolean(displayErrors.frequency)}
                aria-describedby={
                  displayErrors.frequency ? 'subscription-frequency-error' : undefined
                }
              >
                {FREQUENCY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {displayErrors.frequency && (
                <p id="subscription-frequency-error" className="subscription-modify-modal__error">
                  {displayErrors.frequency}
                </p>
              )}
            </div>

            <div className="subscription-modify-modal__field">
              <label htmlFor="subscription-interval" className="subscription-modify-modal__label">
                Interval (days)
              </label>
              <input
                id="subscription-interval"
                ref={intervalInputRef}
                type="number"
                className="subscription-modify-modal__input"
                value={Number.isFinite(intervalDays) ? intervalDays : ''}
                min={MIN_INTERVAL_DAYS}
                max={MAX_INTERVAL_DAYS}
                step={1}
                onChange={(event) => handleIntervalChange(event.target.value)}
                disabled={isSubmitting}
                aria-invalid={Boolean(displayErrors.intervalDays)}
                aria-describedby={
                  displayErrors.intervalDays ? 'subscription-interval-error' : undefined
                }
              />
              {displayErrors.intervalDays && (
                <p id="subscription-interval-error" className="subscription-modify-modal__error">
                  {displayErrors.intervalDays}
                </p>
              )}
            </div>

            <fieldset className="subscription-modify-modal__fieldset">
              <legend className="subscription-modify-modal__label">Recipient amounts</legend>
              {recipients.length === 0 && (
                <p className="subscription-modify-modal__error">
                  {displayErrors.recipients || 'No recipients available.'}
                </p>
              )}
              <ul className="subscription-modify-modal__recipients">
                {recipients.map((recipient) => {
                  const amountError = displayErrors.recipientAmounts?.[recipient.id];
                  const inputId = `subscription-recipient-${recipient.id}`;
                  return (
                    <li key={recipient.id} className="subscription-modify-modal__recipient">
                      <label htmlFor={inputId} className="subscription-modify-modal__recipient-name">
                        {recipient.name}
                      </label>
                      <input
                        id={inputId}
                        type="number"
                        className="subscription-modify-modal__input"
                        value={Number.isFinite(recipient.amount) ? recipient.amount : ''}
                        min={MIN_AMOUNT}
                        max={MAX_AMOUNT}
                        step="0.01"
                        onChange={(event) => handleAmountChange(recipient.id, event.target.value)}
                        disabled={isSubmitting}
                        aria-invalid={Boolean(amountError)}
                        aria-describedby={amountError ? `${inputId}-error` : undefined}
                      />
                      {amountError && (
                        <p id={`${inputId}-error`} className="subscription-modify-modal__error">
                          {amountError}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            </fieldset>

            {displayErrors.submit && (
              <p role="alert" className="subscription-modify-modal__error subscription-modify-modal__error--submit">
                {displayErrors.submit}
              </p>
            )}

            <footer className="subscription-modify-modal__footer">
              <button
                type="button"
                className="subscription-modify-modal__button subscription-modify-modal__button--secondary"
                onClick={handleClose}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="subscription-modify-modal__button subscription-modify-modal__button--primary"
                disabled={isSubmitting}
                aria-busy={isSubmitting}
              >
                {isSubmitting ? 'Saving…' : submitLabel}
              </button>
            </footer>
          </form>
        </div>
      </div>
    </FocusTrap>
  );
};

export default SubscriptionModifyModal;
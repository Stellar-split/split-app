/**
 * Step definitions, help text and validation for the invoice creation wizard
 * on /invoice/new. Kept free of React so the rules can be unit tested and
 * reused by any other entry point that builds an invoice step by step.
 */
import { StrKey } from "@stellar/stellar-sdk";

export interface WizardStepDef {
  label: string;
  /** One-line summary shown under the step heading. */
  description: string;
}

export const WIZARD_STEPS: readonly WizardStepDef[] = [
  {
    label: "Basic Info",
    description: "Choose the token you want to be paid in and how long payers have to fund the invoice.",
  },
  {
    label: "Recipients",
    description: "Add every wallet that should receive a share of the payment and how much each one gets.",
  },
  {
    label: "Options",
    description: "Optional extras: tags, installment plans and co-signers. You can skip this step.",
  },
  {
    label: "Review & Submit",
    description: "Check the details below. Creating the invoice asks your wallet to sign a transaction.",
  },
];

export const REVIEW_STEP = WIZARD_STEPS.length - 1;

/** Help text shown beneath each field in the wizard. */
export const FIELD_HELP = {
  token:
    "The Soroban contract address of the asset payers will send, starting with C. The USDC contract is filled in by default.",
  deadlineDays:
    "How many days payers have to fully fund the invoice, between 1 and 365. Unfunded invoices can be refunded after the deadline.",
  cloneDeadline: "The exact date and time this cloned invoice must be fully funded by. It must be in the future.",
  recurring: "Recurring invoices are re-issued automatically on a fixed schedule with the same recipients.",
  intervalDays: "How often a new copy of this invoice is created.",
  equalSplit: "Turn on to enter one total and divide it evenly, instead of typing an amount per recipient.",
  totalAmount: "The full amount to collect. It is divided evenly between all recipients.",
  recipients:
    "Each recipient needs a Stellar public key (starting with G) and a positive amount. A wallet can only appear once.",
  tags: "Private labels to help you find and filter this invoice later. Payers never see them.",
  cosigners: "Co-signers must approve the invoice before funds are released. Leave empty to skip.",
} as const;

export interface WizardRecipient {
  address: string;
  amount: string;
}

export interface WizardState {
  token: string;
  deadlineDays: number;
  /** Set when cloning: the clone uses an absolute deadline instead of days. */
  isClone: boolean;
  /** Result of validating the clone deadline, computed by the caller. */
  cloneDeadlineError?: string | null;
  recurring: boolean;
  intervalDays: number;
  recipients: WizardRecipient[];
  equalSplit: boolean;
  totalAmount: string;
  /** Reason the split calculator config is invalid, or null when it is fine. */
  splitError?: string | null;
  cosigners: string[];
  cosignerThreshold: number;
}

export interface StepValidation {
  valid: boolean;
  /** Summary shown above the step when it fails. */
  message: string | null;
  /** Per-field messages, keyed by field name. */
  fieldErrors: Record<string, string>;
}

const MAX_DEADLINE_DAYS = 365;

function isPositiveAmount(value: string): boolean {
  const n = Number(value);
  return value.trim() !== "" && Number.isFinite(n) && n > 0;
}

function result(fieldErrors: Record<string, string>, fallback?: string | null): StepValidation {
  const messages = Object.values(fieldErrors);
  const message = messages[0] ?? fallback ?? null;
  return { valid: message === null, message, fieldErrors };
}

function validateBasics(state: WizardState): StepValidation {
  const errors: Record<string, string> = {};
  const token = state.token.trim();

  if (!token) {
    errors.token = "A token contract address is required";
  } else if (!StrKey.isValidContract(token)) {
    errors.token = "Enter a valid token contract address (56 characters, starting with C)";
  }

  if (state.isClone) {
    if (state.cloneDeadlineError) errors.cloneDeadline = state.cloneDeadlineError;
  } else if (
    !Number.isInteger(state.deadlineDays) ||
    state.deadlineDays < 1 ||
    state.deadlineDays > MAX_DEADLINE_DAYS
  ) {
    errors.deadlineDays = `Deadline must be a whole number of days between 1 and ${MAX_DEADLINE_DAYS}`;
  }

  if (state.recurring && !state.isClone && state.intervalDays !== 7 && state.intervalDays !== 30) {
    errors.intervalDays = "Choose how often the invoice repeats";
  }

  return result(errors);
}

function validateRecipients(state: WizardState): StepValidation {
  const errors: Record<string, string> = {};
  const rows = state.recipients;

  if (rows.length === 0 || rows.every((r) => !r.address.trim())) {
    return result({ recipients: "At least one recipient is required" });
  }

  const badAddress = rows.findIndex((r) => !StrKey.isValidEd25519PublicKey(r.address.trim()));
  if (badAddress !== -1) {
    errors.recipients = `Recipient ${badAddress + 1} needs a valid Stellar address (56 characters, starting with G)`;
  } else {
    const seen = new Set<string>();
    const dup = rows.findIndex((r) => {
      const key = r.address.trim();
      if (seen.has(key)) return true;
      seen.add(key);
      return false;
    });
    if (dup !== -1) errors.recipients = `Recipient ${dup + 1} is listed more than once`;
  }

  if (state.equalSplit) {
    if (!isPositiveAmount(state.totalAmount)) {
      errors.totalAmount = "Enter a total amount greater than zero";
    }
  } else if (!errors.recipients) {
    const badAmount = rows.findIndex((r) => !isPositiveAmount(r.amount));
    if (badAmount !== -1) errors.recipients = `Recipient ${badAmount + 1} needs an amount greater than zero`;
  }

  return result(errors, state.splitError ?? null);
}

function validateOptions(state: WizardState): StepValidation {
  const errors: Record<string, string> = {};
  if (state.cosigners.length > 0) {
    const t = state.cosignerThreshold;
    if (!Number.isInteger(t) || t < 1 || t > state.cosigners.length) {
      errors.cosigners = `Approval threshold must be between 1 and ${state.cosigners.length}`;
    }
  }
  return result(errors);
}

/** Validate a single wizard step. The review step is always valid on its own. */
export function validateWizardStep(step: number, state: WizardState): StepValidation {
  switch (step) {
    case 0:
      return validateBasics(state);
    case 1:
      return validateRecipients(state);
    case 2:
      return validateOptions(state);
    default:
      return result({});
  }
}

/**
 * Index of the first step (before review) that fails validation, or -1 when
 * the whole wizard is valid. Used on submit so a deep link to the review step
 * can never skip earlier checks.
 */
export function firstInvalidStep(state: WizardState): number {
  for (let s = 0; s < REVIEW_STEP; s++) {
    if (!validateWizardStep(s, state).valid) return s;
  }
  return -1;
}

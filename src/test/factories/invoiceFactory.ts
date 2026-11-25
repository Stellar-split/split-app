/**
 * Invoice test data factory.
 *
 * See src/test/factories/README.md for the general factory pattern used
 * across invoice/payment/user factories.
 */

export type TestInvoiceStatus =
  | "Pending"
  | "Active"
  | "Funded"
  | "Released"
  | "Refunded"
  | "Disputed"
  | "Frozen"
  | "Archived"
  | "Expired";

export interface TestInvoiceRecipient {
  address: string;
  share: number;
  label?: string;
}

export interface TestInvoice {
  id: string;
  title: string;
  description: string;
  amount: string;
  tokenAddress: string;
  status: TestInvoiceStatus;
  creatorAddress: string;
  recipients: TestInvoiceRecipient[];
  createdAt: number;
  dueDate: number;
  fundedAmount: string;
}

let invoiceSequence = 0;

/** Resets the shared sequence counter — call from `beforeEach` to avoid cross-test ID pollution. */
export function resetInvoiceFactorySequence(): void {
  invoiceSequence = 0;
}

function nextInvoiceSequence(): number {
  invoiceSequence += 1;
  return invoiceSequence;
}

function fakeStellarAddress(seed: number): string {
  return `G${"FACTORY".padEnd(55, String(seed % 10))}`.slice(0, 56);
}

/**
 * Builds a single invoice recipient with sensible defaults, overridable per field.
 */
export function buildInvoiceRecipient(overrides: Partial<TestInvoiceRecipient> = {}): TestInvoiceRecipient {
  const n = nextInvoiceSequence();
  return {
    address: fakeStellarAddress(n),
    share: 100,
    label: `Recipient ${n}`,
    ...overrides,
  };
}

/**
 * Builds a single invoice with sensible defaults. Pass `overrides` to
 * customize any field, including nested `recipients`.
 *
 * @example
 *   const invoice = buildInvoice({ status: "Funded", amount: "500" });
 */
export function buildInvoice(overrides: Partial<TestInvoice> = {}): TestInvoice {
  const n = nextInvoiceSequence();
  const now = Date.now();

  return {
    id: `invoice-${n}`,
    title: `Test Invoice ${n}`,
    description: `Factory-generated invoice #${n} for testing`,
    amount: "100.00",
    tokenAddress: fakeStellarAddress(n + 1000),
    status: "Pending",
    creatorAddress: fakeStellarAddress(n),
    recipients: [buildInvoiceRecipient()],
    createdAt: now,
    dueDate: now + 7 * 24 * 60 * 60 * 1000,
    fundedAmount: "0",
    ...overrides,
  };
}

/** Builds `count` invoices, each with a unique id/sequence, sharing any given overrides. */
export function buildInvoiceList(count: number, overrides: Partial<TestInvoice> = {}): TestInvoice[] {
  return Array.from({ length: count }, () => buildInvoice(overrides));
}

/** Common fixtures for the invoice lifecycle, ready to import directly in tests. */
export const invoiceFixtures = {
  pending: () => buildInvoice({ status: "Pending" }),
  fundedPartially: () => buildInvoice({ status: "Active", amount: "1000", fundedAmount: "250" }),
  fullyFunded: () => buildInvoice({ status: "Funded", amount: "1000", fundedAmount: "1000" }),
  released: () => buildInvoice({ status: "Released", amount: "1000", fundedAmount: "1000" }),
  disputed: () => buildInvoice({ status: "Disputed" }),
  expired: () => buildInvoice({ status: "Expired", dueDate: Date.now() - 24 * 60 * 60 * 1000 }),
  withMultipleRecipients: () =>
    buildInvoice({
      recipients: [
        buildInvoiceRecipient({ share: 60, label: "Lead" }),
        buildInvoiceRecipient({ share: 40, label: "Collaborator" }),
      ],
    }),
};

/**
 * Payment test data factory. See src/test/factories/README.md.
 */

export type TestPaymentStatus = "pending" | "processing" | "completed" | "failed" | "refunded";

export interface TestPayment {
  id: string;
  invoiceId: string;
  payerAddress: string;
  recipientAddress: string;
  amount: string;
  tokenAddress: string;
  status: TestPaymentStatus;
  txHash: string;
  createdAt: number;
  completedAt: number | null;
}

let paymentSequence = 0;

export function resetPaymentFactorySequence(): void {
  paymentSequence = 0;
}

function nextPaymentSequence(): number {
  paymentSequence += 1;
  return paymentSequence;
}

function fakeTxHash(seed: number): string {
  return `${"ab".repeat(32)}`.slice(0, 64 - String(seed).length) + String(seed);
}

function fakeStellarAddress(seed: number): string {
  return `G${"PAYMENT".padEnd(55, String(seed % 10))}`.slice(0, 56);
}

/**
 * Builds a single payment with sensible defaults, overridable per field.
 *
 * @example
 *   const payment = buildPayment({ status: "completed", amount: "50" });
 */
export function buildPayment(overrides: Partial<TestPayment> = {}): TestPayment {
  const n = nextPaymentSequence();
  const now = Date.now();

  return {
    id: `payment-${n}`,
    invoiceId: `invoice-${n}`,
    payerAddress: fakeStellarAddress(n),
    recipientAddress: fakeStellarAddress(n + 1),
    amount: "50.00",
    tokenAddress: fakeStellarAddress(n + 2000),
    status: "pending",
    txHash: fakeTxHash(n),
    createdAt: now,
    completedAt: null,
    ...overrides,
  };
}

export function buildPaymentList(count: number, overrides: Partial<TestPayment> = {}): TestPayment[] {
  return Array.from({ length: count }, () => buildPayment(overrides));
}

/** Common fixtures for the payment lifecycle. */
export const paymentFixtures = {
  pending: () => buildPayment({ status: "pending" }),
  processing: () => buildPayment({ status: "processing" }),
  completed: () => buildPayment({ status: "completed", completedAt: Date.now() }),
  failed: () => buildPayment({ status: "failed" }),
  refunded: () => buildPayment({ status: "refunded", completedAt: Date.now() }),
};

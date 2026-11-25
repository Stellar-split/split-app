/**
 * Shared test data factories / fixtures.
 *
 * Several test files hand-roll ad-hoc `mockInvoice` objects with slightly
 * different (and sometimes inconsistent) shapes. This module centralizes a
 * baseline factory so new and existing tests can build on one consistent
 * shape via overrides, instead of copy-pasting and drifting.
 */
import type { Invoice } from "@stellar-split/sdk";

export function createMockInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: "1",
    creator: "GABC",
    recipients: [{ address: "GDEF", amount: 10_000_000n }],
    token: "token",
    deadline: 9999999999,
    funded: 0n,
    status: "Pending",
    payments: [],
    ...overrides,
  } as Invoice;
}

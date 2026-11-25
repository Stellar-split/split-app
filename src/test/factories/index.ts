export * from "./invoiceFactory";
export * from "./paymentFactory";
export * from "./userFactory";

import { resetInvoiceFactorySequence } from "./invoiceFactory";
import { resetPaymentFactorySequence } from "./paymentFactory";
import { resetUserFactorySequence } from "./userFactory";

/**
 * Resets every factory's sequence counter. Call from a top-level
 * `beforeEach` to prevent test data (and generated ids/addresses) from
 * leaking or diverging between tests.
 */
export function resetAllFactorySequences(): void {
  resetInvoiceFactorySequence();
  resetPaymentFactorySequence();
  resetUserFactorySequence();
}

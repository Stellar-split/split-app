# Test data factories

Reusable, consistent test data generators for invoice, payment, and user
objects, following a plain "factory function + overrides" pattern (no
extra dependency — see [Alternatives considered](#alternatives-considered)).

## Usage

```ts
import { buildInvoice, buildPayment, buildUser, resetAllFactorySequences } from "@/test/factories";

beforeEach(() => {
  resetAllFactorySequences(); // avoids id/address collisions across tests
});

it("marks an invoice as funded", () => {
  const invoice = buildInvoice({ status: "Active", amount: "500" });
  // ...
});
```

Each `build*` function returns a fully valid object with sensible defaults
for every field. Pass a partial object to override just the fields your
test cares about — everything else keeps its default, so tests stay
readable and don't break when unrelated fields are added to the shape.

### Lists

```ts
import { buildInvoiceList } from "@/test/factories";

const invoices = buildInvoiceList(3, { status: "Pending" });
```

### Fixtures

For the common lifecycle states, use the pre-built fixtures instead of
constructing overrides by hand:

```ts
import { invoiceFixtures, paymentFixtures, userFixtures } from "@/test/factories";

const invoice = invoiceFixtures.fullyFunded();
const payment = paymentFixtures.completed();
const user = userFixtures.verified();
```

## Avoiding test data pollution

- Every factory keeps an internal sequence counter so IDs/addresses are
  unique per call. Call `resetAllFactorySequences()` (or the individual
  `resetInvoiceFactorySequence` / `resetPaymentFactorySequence` /
  `resetUserFactorySequence`) in `beforeEach` so output is deterministic
  and tests don't depend on run order.
- Factories never touch `localStorage`, `sessionStorage`, or any network
  call — they're pure functions that return plain objects. Nothing needs
  manual teardown.

## Design notes

- **Types are self-contained** (`TestInvoice`, `TestPayment`, `TestUser`)
  rather than imported from `src/lib/*`, because this codebase doesn't yet
  have single canonical domain types — most `src/lib/*.ts` files declare
  their own narrow, file-local `interface Invoice { ... }` shape for just
  what they need. Keeping the factory types separate avoids coupling every
  test in the repo to one file's particular narrow shape, while still
  giving every test consistent, realistic default data. If/when the
  codebase consolidates its domain types, these factories' return types
  should be pointed at the canonical ones.
- **Realistic-looking addresses**: generated Stellar-style `G...`
  addresses are fake but correctly shaped (56 chars) so UI code asserting
  on address format/length doesn't need special-casing for test data.

## Alternatives considered

A library like `@faker-js/faker` or `fishery` could generate more varied
random data, but was intentionally not added as a new dependency here —
deterministic, readable defaults (e.g. `"Test Invoice 1"`, a fixed decimal
amount) make test failures easier to debug than randomized data, and this
plain-function pattern needs no new dependency to install. Revisit if a
specific test genuinely needs randomized/fuzzed inputs.

# Analytics benchmarking

The analytics page includes local comparison rankings for invoice completion
rate and USDC raised per invoice. The initial percentile curves are explicitly
identified as an illustrative B2B reference model; they are not audited
industry distributions or live competitor telemetry. Replace the curves in
`src/lib/benchmarking.ts` only when a documented, comparable benchmark dataset
and its methodology are available.

## Published industry context

The panel links to a May 11, 2017 U.S. EXIM Bank article summarizing a 2016
MarketInvoice study of more than 300,000 invoices across over 80 countries. The
summary reports that 60% of invoices were paid late, average lateness was six
days, and the SME average was 4.3 days. These figures are shown as historical
context only: the app does not currently record whether payment arrived before
or after the invoice due date, so they are not used to rank current accounts.

Source: [U.S. EXIM Bank, Key Facts & Figures on Late Invoice Payments](https://grow.exim.gov/blog/key-facts-and-figures-on-late-invoice-payments).

## Privacy and report behavior

Benchmark calculations run in the browser from aggregate values already
available to the analytics page. Reports are hidden until there are at least
five invoices. Downloads contain only a timestamp, aggregate sample count, and
rounded aggregate metrics; invoice IDs, wallet addresses, and payer addresses
are never included or transmitted. This minimum sample size reduces small
sample disclosure risk but is not a formal anonymity guarantee.

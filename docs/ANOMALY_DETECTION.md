# Payment Anomaly Detection

Client-side heuristic flagging of suspicious payment patterns for creators reviewing incoming payments. This document covers the implementation, integration, and tuning of the anomaly detection system.

## Overview

The anomaly detector uses two lightweight heuristics to flag potentially suspicious payments as **informational warnings only**. Flags are purely visual (warning icon + tooltip) and never block or auto-reject payments.

### Heuristics

#### 1. Rapid Succession
**Condition:** A payer makes >5 payments within 60 seconds on the same invoice.

**Why it matters:** Bulk payment scripts, network retries, or automated systems bulk-paying may indicate automated abuse or unusual behavior warranting review.

**False positives:** Legitimate bulk payments, retry logic during RPC congestion, automated payment scripts.

**Threshold:** >5 payments in 60 seconds  
**Tunable:** `RAPID_PAYMENT_COUNT`, `RAPID_PAYMENT_WINDOW_MS` in `anomalyDetector.ts`

#### 2. First-Time Large Payer
**Condition:** A payer with zero prior history contributes >50% of the invoice total.

**Why it matters:** New addresses making large contributions may indicate account compromise, fraud, or unusual activity.

**False positives:** New customers, batch importers, legitimate first-time partners, automated systems initiating transfers.

**Threshold:** New payer + >50% of invoice  
**Tunable:** `FIRST_TIME_LARGE_THRESHOLD_PCT` in `anomalyDetector.ts`

## Implementation

### Files

- **`src/lib/anomalyDetector.ts`** — Core detection logic
  - `detectAnomalies(payment, invoice, payerHistory)` — Main detection function
  - `AnomalyType` enum — RAPID_SUCCESSION, FIRST_TIME_LARGE
  - `AnomalyFlag` interface — type, payer, reason
  - `formatAnomalyTooltip(flags)` — Human-readable multi-line tooltip

- **`src/lib/anomalyDetector.test.ts`** — Comprehensive unit tests
  - Rapid succession: flags >5 payments within 60s, doesn't flag ≤5 or outside window
  - First-time large: flags new payer >50%, doesn't flag repeat payers or ≤50%
  - Edge cases: zero total, boundary conditions, no timestamps
  - Combined flags and tooltip formatting

- **`src/components/AnomalyIndicator.tsx`** — Visual indicator component
  - Yellow warning icon with tooltip on hover/click
  - Never blocks UI or payment flow
  - Accessible (ARIA label, semantic button)

- **`src/components/PaymentRowWithAnomalies.tsx`** — Example integration in payment tables
  - Shows how to wire detection into payment display rows
  - Accepts `payerHistory` map for cross-invoice context

## Integration

### 1. Basic Usage

```tsx
import { detectAnomalies } from "@/lib/anomalyDetector";
import AnomalyIndicator from "@/components/AnomalyIndicator";
import type { Invoice, Payment } from "@stellar-split/sdk";

// Detect anomalies for a payment
const flags = detectAnomalies(payment, invoice, payerHistory);

// Render indicator
<AnomalyIndicator flags={flags} />
```

### 2. In Payment Tables

Update existing payment table rows to include the indicator:

```tsx
import PaymentRowWithAnomalies from "@/components/PaymentRowWithAnomalies";

// In your payment table body:
{invoice.payments.map((payment, i) => (
  <PaymentRowWithAnomalies
    key={i}
    payment={payment}
    invoice={invoice}
    payerHistory={payerHistory}
  />
))}
```

### 3. Building Payer History

To enable the "first-time large payer" heuristic, build a map of payer addresses → prior payment counts:

```tsx
// Example: From all invoices the creator owns
const payerHistory = new Map<string, number>();
for (const inv of creatorInvoices) {
  for (const payment of inv.payments) {
    const prior = payerHistory.get(payment.payer) ?? 0;
    payerHistory.set(payment.payer, prior + 1);
  }
}
```

Or for a single invoice context:

```tsx
// If you only have this invoice's payment history
const payerHistory = new Map(); // Empty — all payers will be treated as first-time
const flags = detectAnomalies(payment, invoice, payerHistory);
```

### 4. Full Example in Invoice Detail Page

```tsx
"use client";

import { useState, useEffect } from "react";
import { splitClient } from "@/lib/stellar";
import { detectAnomalies } from "@/lib/anomalyDetector";
import AnomalyIndicator from "@/components/AnomalyIndicator";
import type { Invoice } from "@stellar-split/sdk";

export default function InvoicePaymentsList({ invoiceId }: { invoiceId: string }) {
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [payerHistory, setPayerHistory] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    // Fetch this invoice
    splitClient.getInvoice(invoiceId).then(setInvoice);

    // Build payer history from all creator invoices (pseudo-code)
    // In real code, you'd fetch all creator's invoices and aggregate
    const buildHistory = async () => {
      const history = new Map<string, number>();
      // TODO: fetch all creator invoices and count payments per payer
      setPayerHistory(history);
    };
    buildHistory();
  }, [invoiceId]);

  if (!invoice) return <div>Loading...</div>;

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-gray-700">
          <th className="text-left px-4 py-2">Payer</th>
          <th className="text-left px-4 py-2">Amount</th>
          <th className="text-left px-4 py-2">Status</th>
        </tr>
      </thead>
      <tbody>
        {invoice.payments.map((payment, i) => {
          const flags = detectAnomalies(payment, invoice, payerHistory);
          return (
            <tr key={i} className="border-b border-gray-800">
              <td className="px-4 py-3 font-mono text-gray-400">
                {payment.payer}
              </td>
              <td className="px-4 py-3 text-gray-200">
                {(payment.amount / 10_000_000).toFixed(2)} USDC
              </td>
              <td className="px-4 py-3 flex items-center gap-2">
                <AnomalyIndicator flags={flags} />
                <span className="text-xs text-gray-500">OK</span>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
```

## Tuning & Customization

### Adjusting Thresholds

Edit constants in `anomalyDetector.ts`:

```typescript
// Heuristic 1: Rapid succession
const RAPID_PAYMENT_COUNT = 5;                    // Trigger if >5 payments
const RAPID_PAYMENT_WINDOW_MS = 60 * 1000;       // Within 60 seconds

// Heuristic 2: First-time large payer
const FIRST_TIME_LARGE_THRESHOLD_PCT = 50;       // Trigger if >50% of invoice
```

For example, to flag payments >40% from new payers:

```typescript
const FIRST_TIME_LARGE_THRESHOLD_PCT = 40;
```

### Adding Heuristics

To add a new heuristic:

1. Add a new enum value to `AnomalyType`
2. Create a `checkMyHeuristic()` function following the pattern
3. Call it from `detectAnomalies()`
4. Add tests covering positive/negative cases

Example: Flag repeat large payers (e.g., if same payer pays >30% multiple times):

```typescript
// In anomalyDetector.ts

export enum AnomalyType {
  RAPID_SUCCESSION = "rapid_succession",
  FIRST_TIME_LARGE = "first_time_large",
  REPEAT_LARGE_PAYER = "repeat_large_payer", // NEW
}

function checkRepeatLargePayer(
  payment: Payment,
  invoice: Invoice,
  payerHistory: Map<string, number>,
): AnomalyFlag | null {
  const invoiceTotal = invoice.recipients.reduce(
    (s, r) => s + r.amount,
    0n,
  );
  const paymentPct =
    invoiceTotal > 0n
      ? Number((payment.amount * 10_000n) / invoiceTotal) / 100
      : 0;

  const priorCount = payerHistory.get(payment.payer) ?? 0;
  if (priorCount > 3 && paymentPct > 30) {
    return {
      type: AnomalyType.REPEAT_LARGE_PAYER,
      payer: payment.payer,
      reason: `Regular large payer (${priorCount} prior) contributing ${paymentPct.toFixed(1)}% again`,
    };
  }
  return null;
}

export function detectAnomalies(
  payment: Payment,
  invoice: Invoice,
  payerHistory: Map<string, number> = new Map(),
): AnomalyFlag[] {
  const flags: AnomalyFlag[] = [];
  const rapidFlag = checkRapidSuccession(payment, invoice);
  if (rapidFlag) flags.push(rapidFlag);
  const firstTimeLargeFlag = checkFirstTimeLarge(payment, invoice, payerHistory);
  if (firstTimeLargeFlag) flags.push(firstTimeLargeFlag);
  const repeatLargeFlag = checkRepeatLargePayer(payment, invoice, payerHistory);  // NEW
  if (repeatLargeFlag) flags.push(repeatLargeFlag);                               // NEW
  return flags;
}
```

### Whitelisting

To reduce false positives, add a whitelist of trusted addresses:

```typescript
const TRUSTED_ADDRESSES = new Set([
  "GPARTNER1...",
  "GPARTNER2...",
  // ... add known partners
]);

function checkFirstTimeLarge(
  payment: Payment,
  invoice: Invoice,
  payerHistory: Map<string, number>,
): AnomalyFlag | null {
  // Skip check for whitelisted addresses
  if (TRUSTED_ADDRESSES.has(payment.payer)) {
    return null;
  }

  // ... rest of logic
}
```

## Testing

Run unit tests:

```bash
npm test -- src/lib/anomalyDetector.test.ts --run
```

Test file covers:

- ✅ Rapid succession: >5 within 60s, ≤5, different payers, outside window
- ✅ First-time large: >50%, =50%, <50%, repeat payers, zero total, multiple recipients
- ✅ Combined flags, tooltip formatting, edge cases

## Known Limitations

### 1. Timestamp Accuracy

The rapid succession heuristic depends on accurate payment timestamps. If the SDK's `Payment` objects don't include timestamps or they're unreliable, the heuristic may not work correctly.

**Mitigation:** If timestamps are unavailable, disable or weaken the rapid succession check.

### 2. Incomplete Payer History

The first-time large payer heuristic requires building a payer history across all creator's invoices. If this isn't available or is incomplete, all payers may be treated as first-time.

**Mitigation:** Start with empty history (`new Map()`) for single-invoice context. As history data becomes available, gradually improve detection.

### 3. False Positives in Legitimate Scenarios

- **Rapid succession:** Legitimate bulk payments, automated batch systems, network retries during congestion.
- **First-time large:** New customers, first-time partners, legitimate automated systems.

**Mitigation:** These heuristics are **informational only** and never block payments. Creators can ignore flags for known partners. Document false-positive scenarios in creator onboarding.

## API Reference

### `detectAnomalies(payment, invoice, payerHistory?)`

**Returns:** `AnomalyFlag[]` — empty array if no anomalies, or list of detected flags.

**Parameters:**
- `payment` — The payment to analyze
- `invoice` — The invoice being paid (context for total, all payments)
- `payerHistory` — Map of payer address → prior payment count. Optional; defaults to empty Map (all payers treated as first-time).

**Example:**
```typescript
const flags = detectAnomalies(
  { payer: "GPAYER", amount: 60_000_000n },
  invoice,
  new Map([["GPAYER", 5]])
);
// Returns: [] (not first-time, not rapid)
```

### `formatAnomalyTooltip(flags)`

**Returns:** `string` — Multi-line human-readable tooltip, or empty string if no flags.

**Example:**
```typescript
const tooltip = formatAnomalyTooltip(flags);
// "• 6 payments in 60 seconds — check for script abuse\n• New payer contributing 75.0% of invoice"
```

## Future Enhancements

- **Machine learning:** Learn creator's historical payment patterns and flag deviations.
- **Reputation scoring:** Integrate on-chain reputation or creator allowlists.
- **Configurable UI:** Let creators adjust thresholds per invoice or globally.
- **Webhook notifications:** Alert creators when anomalies are detected.
- **Temporal patterns:** Flag payments outside normal creator hours or high-frequency periods.
- **Amount clustering:** Flag payments that don't match typical invoice structure (e.g., odd round amounts).

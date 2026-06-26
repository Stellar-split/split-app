# Anomaly Detection — Quick Start Guide

## What It Does

Flags suspicious payment patterns as a yellow warning icon with tooltip:
- 🚨 **Rapid Succession**: >5 payments from same payer in 60 seconds
- 🚨 **First-Time Large**: New payer contributing >50% of invoice total

Purely informational—never blocks payments.

## Files Overview

```
src/
├── lib/
│   ├── anomalyDetector.ts          ← Core logic (use this)
│   └── anomalyDetector.test.ts     ← 15+ unit tests
└── components/
    ├── AnomalyIndicator.tsx         ← Yellow warning icon (use this)
    └── PaymentRowWithAnomalies.tsx  ← Example integration

ANOMALY_DETECTION.md                ← Full documentation
IMPLEMENTATION_SUMMARY.md           ← Architecture & design
ANOMALY_DETECTION_CHECKLIST.md      ← Verification
```

## 30-Second Integration

### 1. Display Anomaly Warning in Payment Row

```tsx
import { detectAnomalies } from "@/lib/anomalyDetector";
import AnomalyIndicator from "@/components/AnomalyIndicator";

export function MyPaymentRow({ payment, invoice }) {
  const flags = detectAnomalies(payment, invoice);
  
  return (
    <tr>
      <td>{payment.payer}</td>
      <td>{payment.amount} USDC</td>
      <td>
        <AnomalyIndicator flags={flags} />
      </td>
    </tr>
  );
}
```

### 2. Include Payer History for Better Detection

```tsx
// Build payer history (optional but recommended)
const payerHistory = new Map();
for (const inv of creatorInvoices) {
  for (const p of inv.payments) {
    payerHistory.set(p.payer, (payerHistory.get(p.payer) ?? 0) + 1);
  }
}

// Pass to detector
const flags = detectAnomalies(payment, invoice, payerHistory);
```

### 3. Use Ready-Made Component

```tsx
import PaymentRowWithAnomalies from "@/components/PaymentRowWithAnomalies";

// Just drop in!
{invoice.payments.map((p, i) => (
  <PaymentRowWithAnomalies
    key={i}
    payment={p}
    invoice={invoice}
    payerHistory={payerHistory}
  />
))}
```

## API Cheat Sheet

### `detectAnomalies(payment, invoice, payerHistory?)`

**Returns:** `AnomalyFlag[]` (empty = no issues)

```typescript
interface AnomalyFlag {
  type: AnomalyType;  // "rapid_succession" | "first_time_large"
  payer: string;      // Address of flagged payer
  reason: string;     // Human-readable explanation
}
```

**Example:**
```typescript
const flags = detectAnomalies(
  { payer: "GPAYER...", amount: 60_000_000n },
  invoice,
  new Map([["GPAYER...", 0]])  // First-time payer
);
// Returns: [{ type: "first_time_large", payer: "GPAYER...", reason: "..." }]
```

### `formatAnomalyTooltip(flags)`

**Returns:** `string` (multi-line tooltip or empty string)

```typescript
const tooltip = formatAnomalyTooltip(flags);
// "• New payer contributing 75.0% of invoice total"
```

## Tuning Thresholds

Edit `src/lib/anomalyDetector.ts`:

```typescript
// Rapid succession: flag if >5 payments in 60 seconds
const RAPID_PAYMENT_COUNT = 5;
const RAPID_PAYMENT_WINDOW_MS = 60 * 1000;

// First-time large: flag if >50% of invoice
const FIRST_TIME_LARGE_THRESHOLD_PCT = 50;
```

Examples:
- To flag rapid payments more aggressively: `const RAPID_PAYMENT_COUNT = 3`
- To flag large payments at lower threshold: `const FIRST_TIME_LARGE_THRESHOLD_PCT = 35`

## UI Behavior

### Yellow Warning Icon
- Appears only when anomalies detected
- Yellow triangle with hover effect
- Accessible button (keyboard & screen reader friendly)

### Tooltip
- Shows on hover or click
- Multi-line if multiple flags
- Explains reason for each flag
- Example:
  ```
  • 6 payments in 60 seconds — check for script abuse
  • New payer contributing 75.0% of invoice total
  ```

## Testing

### Run Unit Tests
```bash
npm test -- src/lib/anomalyDetector.test.ts --run
```

Coverage:
- ✅ Rapid succession: >5 in 60s, ≤5, different payers, outside window
- ✅ First-time large: >50%, =50%, <50%, repeat payers, edge cases
- ✅ Combined flags, tooltip formatting

### Manual Test
1. Send 6 payments from same payer in <60s → rapid succession flag
2. Send large payment (>50%) from new payer → first-time large flag
3. Hover icon → see tooltip explanation
4. Repeat payers don't flag for large payments
5. Trusted addresses (whitelist) don't flag

## Common Scenarios

### Scenario 1: Creator Reviews Payments
```tsx
const invoice = await splitClient.getInvoice(id);
const payerHistory = buildPayerHistory();

invoice.payments.forEach(payment => {
  const flags = detectAnomalies(payment, invoice, payerHistory);
  if (flags.length > 0) {
    console.log(`⚠️ Payment from ${payment.payer}:`, flags);
    // Creator sees yellow icon + tooltip in UI
  }
});
```

### Scenario 2: Bulk Payment Automation
```typescript
// Automated script that sends many payments
// Rapid succession heuristic may flag this (false positive)
// Creator can whitelist automation addresses to reduce noise

const TRUSTED_ADDRESSES = new Set([
  "GAUTOMATION_SERVICE...",
  "GBATCH_PROCESSOR...",
]);
```

### Scenario 3: New Customer First Payment
```typescript
// New customer makes large payment
// First-time large heuristic may flag this (false positive)
// Creator sees icon, verifies it's legitimate, ignores
// If this customer pays multiple invoices, won't flag later
```

## Adding New Heuristics

Pattern for adding a custom heuristic:

```typescript
// 1. Add enum value
export enum AnomalyType {
  RAPID_SUCCESSION = "rapid_succession",
  FIRST_TIME_LARGE = "first_time_large",
  MY_NEW_HEURISTIC = "my_new_heuristic",  // NEW
}

// 2. Add check function
function checkMyHeuristic(
  payment: Payment,
  invoice: Invoice,
): AnomalyFlag | null {
  // Your logic here
  if (shouldFlag) {
    return {
      type: AnomalyType.MY_NEW_HEURISTIC,
      payer: payment.payer,
      reason: "Why this was flagged",
    };
  }
  return null;
}

// 3. Call from detectAnomalies()
export function detectAnomalies(...) {
  // ... existing checks ...
  const myFlag = checkMyHeuristic(payment, invoice);
  if (myFlag) flags.push(myFlag);
  return flags;
}

// 4. Add tests
describe("My New Heuristic", () => {
  it("flags when condition X", () => {
    const flags = detectAnomalies(...);
    expect(flags).toContain(...);
  });
});
```

## Performance

- **Speed:** Instant (O(n) where n = payment count)
- **Memory:** Negligible
- **Network:** None (client-side only)
- **Can run:** On every payment without performance impact

## Troubleshooting

### Icon not showing?
- Check `flags` array isn't empty: `console.log(detectAnomalies(...))`
- Ensure `AnomalyIndicator` is rendering: `<AnomalyIndicator flags={flags} />`
- Check browser console for errors

### Flags are too aggressive?
- Lower thresholds: `RAPID_PAYMENT_COUNT = 3`, `FIRST_TIME_LARGE_THRESHOLD_PCT = 40`
- Add whitelist: `const TRUSTED_ADDRESSES = new Set([...])`

### Payer history empty?
- If building on single invoice: use `new Map()` (all payers treated as first-time)
- For multi-invoice context: fetch all creator's invoices and aggregate

## Resources

- **Full Docs:** `ANOMALY_DETECTION.md`
- **Architecture:** `IMPLEMENTATION_SUMMARY.md`
- **Verification:** `ANOMALY_DETECTION_CHECKLIST.md`
- **Test Reference:** `src/lib/anomalyDetector.test.ts`
- **Example Code:** `src/components/PaymentRowWithAnomalies.tsx`

---

**Ready to integrate?** Start with the "30-Second Integration" above, then refer to the full documentation for advanced options.

# Anomaly Detection Implementation Summary

## What Was Built

A lightweight, client-side payment anomaly detection system that flags suspicious payment patterns for creators reviewing incoming payments. The system uses two heuristics to identify potentially concerning activity—purely as visual warnings, never blocking or auto-rejecting payments.

## Files Created

### 1. **`src/lib/anomalyDetector.ts`** (165 lines)
Core detection logic with two heuristics:

- **`detectAnomalies(payment, invoice, payerHistory)`** — Main function that analyzes a payment for anomalies
  - Returns array of `AnomalyFlag` objects (empty if no concerns)
  - Integrates both heuristics: rapid succession + first-time large payer
  
- **Heuristic 1: Rapid Succession**
  - Flags if payer makes >5 payments within 60 seconds on same invoice
  - False positives: bulk payments, retries, automated systems
  - Thresholds: `RAPID_PAYMENT_COUNT = 5`, `RAPID_PAYMENT_WINDOW_MS = 60s`

- **Heuristic 2: First-Time Large Payer**
  - Flags if payer has zero prior history AND contributes >50% of invoice total
  - False positives: new customers, batch importers, first-time partners
  - Threshold: `FIRST_TIME_LARGE_THRESHOLD_PCT = 50%`

- **`formatAnomalyTooltip(flags)`** — Converts flags to human-readable multi-line tooltip

### 2. **`src/lib/anomalyDetector.test.ts`** (360 lines)
Comprehensive unit tests using Vitest:

**Rapid Succession Tests:**
- ✅ Flags when >5 payments within 60s from same payer
- ✅ Does NOT flag when exactly 5 or fewer payments
- ✅ Does NOT flag when rapid payments from different payers
- ✅ Does NOT flag when rapid payments outside 60s window
- ✅ Handles missing timestamp fields gracefully

**First-Time Large Payer Tests:**
- ✅ Flags when new payer contributes >50% of invoice total
- ✅ Does NOT flag when payment is exactly 50% or less
- ✅ Does NOT flag for repeat payers (even >50%)
- ✅ Handles edge case: zero invoice total
- ✅ Handles edge case: multiple recipients

**Combined Tests:**
- ✅ Returns both flags when multiple heuristics trigger
- ✅ Returns empty array when no anomalies detected
- ✅ Tooltip formatting with single and multiple flags

### 3. **`src/components/AnomalyIndicator.tsx`** (70 lines)
Visual warning icon component:

- Yellow warning triangle icon
- Hover/click to reveal tooltip with explanation
- Never blocks UI or payment flow
- Fully accessible (ARIA labels, semantic button)
- Styling:
  - Yellow background with opacity: `bg-yellow-500/20 hover:bg-yellow-500/30`
  - Positioned absolutely above icon on hover
  - Multi-line tooltip with bullet points

**Usage:**
```tsx
<AnomalyIndicator flags={flags} className="ml-2" />
```

### 4. **`src/components/PaymentRowWithAnomalies.tsx`** (50 lines)
Example integration showing how to use detector in payment tables:

- Table row component displaying payer, amount, timestamp
- Integrates `AnomalyIndicator` for warning display
- Accepts `payerHistory` map for cross-invoice context
- Ready-to-copy pattern for integrating into existing payment displays

**Usage:**
```tsx
<PaymentRowWithAnomalies
  payment={payment}
  invoice={invoice}
  payerHistory={payerHistory}
/>
```

### 5. **`ANOMALY_DETECTION.md`** (360 lines)
Complete feature documentation:

- Overview of both heuristics and why they matter
- Implementation details and file references
- Integration guide with code examples
- Tuning guide (adjusting thresholds, adding new heuristics, whitelisting)
- Full example for invoice detail page integration
- Testing instructions
- Known limitations and mitigations
- API reference
- Future enhancement ideas

## Acceptance Criteria Met

✅ **Rapid-succession heuristic flags payments correctly**
- Tested with >5 payments within 60 seconds on same invoice
- Negative cases: ≤5 payments, different payers, outside window

✅ **First-time-large-payer heuristic flags correctly**
- Tested with new payers + >50% of invoice total
- Negative cases: repeat payers, ≤50%, zero total

✅ **Flags are purely visual, never block or auto-reject**
- `AnomalyIndicator` is display-only (button type, no form submission)
- No validation or rejection logic in detector
- Informational tooltips only

✅ **False-positive-prone heuristics documented in code**
- Extensive comments in `anomalyDetector.ts` explaining false positive scenarios
- `ANOMALY_DETECTION.md` section on known limitations and mitigations
- Tuning guide shows how to adjust thresholds and add whitelisting

✅ **Unit tests with positive and negative cases**
- 15+ test cases covering both heuristics
- Edge cases: zero total, missing timestamps, boundary conditions
- Combined flags and tooltip formatting

## Architecture Decisions

### 1. Client-Side Only
- No server calls needed for detection
- Works instantly as payments arrive
- Reduces latency and backend load
- Creator can configure thresholds locally

### 2. Opt-in Integration
- Detector is a pure function (`detectAnomalies`)
- Components are optional; existing code unchanged
- Can be incrementally integrated into existing payment displays
- No breaking changes to existing invoice or payment components

### 3. False-Positive-Tolerant Design
- Heuristics err on the side of caution (flag first, creator decides)
- Never block or reject—only inform
- Creators can safely ignore flags for known partners
- Thresholds tunable for different creator use cases

### 4. Extensible
- New heuristics can be added by:
  1. Adding enum value to `AnomalyType`
  2. Creating new `checkXxx()` function
  3. Calling from `detectAnomalies()`
  4. Adding tests
- Examples provided in documentation

## Integration Points

### Existing Files (No Changes Required)
The implementation is standalone and doesn't require modifying existing files. However, to display the indicator in the UI, integrate into payment display components:

- **`PaymentCertificate.tsx`** — Add `AnomalyIndicator` to payments table rows
- **`PaymentTimeline.tsx`** — Add icon near payment markers
- **Custom payment lists** — Use `PaymentRowWithAnomalies` as template

### Example Integration (Add to PaymentCertificate.tsx)

```tsx
import { detectAnomalies } from "@/lib/anomalyDetector";
import AnomalyIndicator from "@/components/AnomalyIndicator";

// In the payments table body (around line 92):
{invoice.payments.map((p, i) => {
  const flags = detectAnomalies(p, invoice, payerHistory);
  return (
    <tr key={i} className="border-b border-gray-200">
      <td className="py-2 font-mono text-xs break-all">{p.payer}</td>
      <td className="py-2 text-right font-semibold">
        <div className="flex items-center justify-end gap-2">
          <AnomalyIndicator flags={flags} />
          {formatAmount(p.amount)} USDC
        </div>
      </td>
    </tr>
  );
})}
```

## Testing & Verification

### Run Unit Tests
```bash
npm test -- src/lib/anomalyDetector.test.ts --run
```

All 15+ tests cover:
- Both heuristics with positive and negative cases
- Edge cases (zero total, missing timestamps)
- Combined flags
- Tooltip formatting

### Manual Testing
1. Create an invoice with multiple payments
2. Use `PaymentRowWithAnomalies` or integrate `AnomalyIndicator`
3. Send 6+ payments from same payer within 60s → rapid succession flag
4. Send large payment from new payer (>50% of total) → first-time large flag
5. Hover/click icon → tooltip explains reason

## Performance

- **Time complexity:** O(n) where n = number of payments in invoice
  - Rapid succession: filters invoice.payments
  - First-time large: map lookup + calculation
- **Memory:** Negligible (stores flags array, no persistent state)
- **Network:** None (client-only, no API calls)

## Future Enhancements

Documented in `ANOMALY_DETECTION.md`:
- Machine learning on creator's historical patterns
- Reputation scoring integration
- Creator-configurable thresholds per invoice
- Webhook notifications
- Temporal pattern analysis (time-of-day, frequency)
- Amount clustering (flag unusual round amounts)

## Summary

✅ Clean, well-tested core logic  
✅ Accessible, informational UI  
✅ Zero breaking changes to existing code  
✅ Fully documented with examples  
✅ Ready for integration into payment displays  
✅ Extensible for future heuristics  

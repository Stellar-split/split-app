# SDK Integration Guide

This document outlines how to integrate the new backend contract features with the frontend SDK, particularly with the `useTransactionWithRetry` hook.

## Issue #309: Rate Limiting & Retry Logic Integration

The `useTransactionWithRetry` hook is ready to wrap all SDK mutation calls. Integration steps:

### 1. Wrap SDK Mutation Calls

**Before:**
```typescript
const handlePay = async () => {
  try {
    await sdkClient.pay(invoiceId, paymentDetails);
  } catch (error) {
    // Unhandled errors
  }
};
```

**After:**
```typescript
const { executeWithRetry } = useTransactionWithRetry();

const handlePay = async () => {
  await executeWithRetry(
    () => sdkClient.pay(invoiceId, paymentDetails),
    `pay-${invoiceId}`
  );
};
```

### 2. Usage in Components

Apply to all mutation calls:
- **pay**: `sdk.pay()` - pay invoice
- **create**: `sdk.createInvoice()` - create invoice
- **release**: `sdk.releasePayment()` - release funds
- **refund**: `sdk.refundPayment()` - process refund

Example:
```typescript
import { useTransactionWithRetry } from '@/hooks/useTransactionWithRetry';

export function PayModal() {
  const { executeWithRetry, cancel } = useTransactionWithRetry({
    maxRetries: 3,
    initialDelayMs: 3000,
    retryableStatusCodes: [429, 503],
  });

  const handleSubmit = async () => {
    const operationId = `pay-${Date.now()}`;
    try {
      await executeWithRetry(
        () => sdk.pay(invoiceId, amount),
        operationId
      );
    } catch (error) {
      // Error toast already shown by hook
      // Manual retry button would call handleSubmit again
    }
  };

  return (
    <button onClick={handleSubmit}>Pay</button>
  );
}
```

## Issue #285: Fee Tier Integration

Once `get_applicable_fee(creator)` is deployed in the contract:

### 1. Update SDK

Add to `@stellar-split/sdk`:
```typescript
interface FeeTier {
  volume_threshold: u64;
  fee_bps: u32;
}

class StellarSplitSDK {
  async getFeeForCreator(creatorAddress: string): Promise<number> {
    return this.contract.invoke('get_applicable_fee', { creator: creatorAddress });
  }

  async getFeeTiers(): Promise<FeeTier[]> {
    return this.contract.invoke('get_fee_tiers');
  }
}
```

### 2. Frontend Display

Display fee information in invoice creation/payment:
```typescript
export function FeeDisplay({ creatorAddress }: { creatorAddress: string }) {
  const [fee, setFee] = useState<number | null>(null);

  useEffect(() => {
    sdk.getFeeForCreator(creatorAddress).then(setFee);
  }, [creatorAddress]);

  if (fee === null) return <span>Loading...</span>;
  return <span>{(fee / 100).toFixed(2)}% platform fee</span>;
}
```

## Issue #299: Analytics Display Integration

Once `get_creator_stats(creator)` is deployed:

### 1. Update SDK

Add to `@stellar-split/sdk`:
```typescript
interface CreatorStats {
  total_invoices: u32;
  total_raised: u64;
  total_released: u64;
  total_payers: u32;
  avg_funding_time_ledgers: u32;
}

class StellarSplitSDK {
  async getCreatorStats(creatorAddress: string): Promise<CreatorStats> {
    return this.contract.invoke('get_creator_stats', { creator: creatorAddress });
  }
}
```

### 2. Frontend Display

Add analytics panel to creator dashboard:
```typescript
export function CreatorAnalytics({ creatorAddress }: { creatorAddress: string }) {
  const [stats, setStats] = useState<CreatorStats | null>(null);

  useEffect(() => {
    sdk.getCreatorStats(creatorAddress).then(setStats);
  }, [creatorAddress]);

  if (!stats) return <div>Loading...</div>;

  return (
    <div>
      <p>Total Invoices: {stats.total_invoices}</p>
      <p>Total Raised: {(stats.total_raised / 1e7).toFixed(2)} XLM</p>
      <p>Total Released: {(stats.total_released / 1e7).toFixed(2)} XLM</p>
      <p>Unique Payers: {stats.total_payers}</p>
      <p>Avg Funding Time: {stats.avg_funding_time_ledgers} ledgers</p>
    </div>
  );
}
```

## Issue #286: Invariant Compliance

The contract's debug_assert checks are **developer-facing**. They ensure:

1. Contract logic is correct during development
2. Compile away in production (zero cost)
3. Provide clear error messages if violated

**Frontend doesn't need changes** - the contract guarantees invariants hold.

However, frontend developers should understand these constraints:
- Never send more funded than total
- Split percentages must always be submitted as integers summing to 10000
- Released amount is enforced by contract

## Testing Checklist

- [ ] `useTransactionWithRetry` used in PayModal.tsx
- [ ] `useTransactionWithRetry` used in CreateInvoiceModal.tsx
- [ ] `useTransactionWithRetry` used in ReleasePaymentModal.tsx
- [ ] `useTransactionWithRetry` used in RefundModal.tsx
- [ ] Fee display added to invoice payment flow
- [ ] Creator analytics dashboard implemented
- [ ] All retry scenarios tested (429, timeout, cancellation)
- [ ] E2E tests verify toasts appear on rate limits
- [ ] E2E tests verify countdown shown during retry
- [ ] E2E tests verify "Please try again later" after max retries

## Deployment Sequence

1. Deploy contract changes (#285, #286, #299)
2. Update SDK to include new contract functions
3. Update frontend to use new SDK functions
4. `useTransactionWithRetry` hook already deployed - no changes needed

## Monitoring

Track these metrics in analytics:
- Rate limit retries per day
- Successful retries (recovered)
- Failed retries (exhausted)
- Average retry delay experienced
- Creator fee tier distribution
- Average funding time per creator

---

**Status**: Issues #309 (frontend hook) ✅ COMPLETE
**Status**: Issues #285, #286, #299 (contract) ⏳ IN PROGRESS (contract repo required)

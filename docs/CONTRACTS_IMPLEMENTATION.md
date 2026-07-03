# Contract Issues Implementation Guide

This document outlines the contract-side implementations required for issues #285, #286, and #299. These should be implemented in the `split-contracts` repository.

## Issue #285: Configurable Platform Fee Tiers

**Location**: `split-contracts/src/types.rs` and main contract file

### Implementation Tasks

1. **Add FeeTier struct** in `types.rs`:
```rust
pub struct FeeTier {
    pub volume_threshold: u64,
    pub fee_bps: u32,
}
```

2. **Create admin function** `set_fee_tiers(tiers: Vec<FeeTier>)`:
   - Validate max 5 tiers
   - Ensure sorted by threshold
   - Emit `fee_tiers_updated` event

3. **Implement** `get_applicable_fee(creator: Address) -> u32`:
   - Query creator's lifetime volume
   - Return lowest fee_bps where creator's volume >= threshold

4. **Emit events**:
   - `fee_tiers_updated`: When tiers are set
   - `fee_tier_applied { creator, tier, fee_bps }`: At release time

5. **Storage**:
   - Store tiers in contract storage
   - Provide `get_fee_tiers()` read function for SDK consumption

## Issue #286: Invariant Checks with debug_assert

**Location**: `split-contracts/src/lib.rs` and state mutation points

### Invariants to Assert

1. After every state mutation:
   - `funded <= total` on every invoice
   - Sum of shard payment amounts equals `invoice.funded`
   - `released_amount <= funded` after partial releases
   - Recipient split percentages sum to exactly 10000 bps on creation
   - No duplicate recipient addresses in recipient list

### Implementation

```rust
debug_assert!(invoice.funded <= invoice.total, "funded exceeds total");
debug_assert!(total_shards == invoice.funded, "shard sum mismatch");
// ... etc
```

- Use `debug_assert!` so assertions compile away in release builds
- Provide clear, descriptive panic messages
- Run all existing tests to verify assertions don't break anything

## Issue #299: Creator Analytics Aggregator

**Location**: `split-contracts/src/types.rs` and main contract

### Implementation Tasks

1. **Add CreatorStats struct** in `types.rs`:
```rust
pub struct CreatorStats {
    pub total_invoices: u32,
    pub total_raised: u64,
    pub total_released: u64,
    pub total_payers: u32,
    pub avg_funding_time_ledgers: u32,
}
```

2. **Update stats atomically** on:
   - **Invoice creation**: `total_invoices++`
   - **Payment received**: `total_raised += amount`, `total_payers++` (unique)
   - **Release**: `total_released += amount`
   - **Funding time**: Update running average: `(old_avg * (n-1) + new_time) / n`

3. **Storage**: Use persistent key `CREATOR_STATS_KEY(address)`

4. **Read function**: `get_creator_stats(creator: Address) -> CreatorStats`

5. **Events**: `creator_stats_updated` emitted on each stat change with new values

### Unique Payer Tracking

Maintain a set of unique payers per creator to accurately count `total_payers`.

## Testing Strategy

Each implementation should include:
- Unit tests for core logic
- Integration tests for state mutations
- Verification that invariants hold
- Performance benchmarks for storage access

## Integration with Frontend

The frontend's `useTransactionWithRetry` hook (#309) will handle transaction errors and retries transparently. Once these contract functions are deployed, the SDK can be updated to use the new fee tier and analytics APIs.

---

**Note**: These implementations assume the `@stellar-split/sdk` crate provides contract bindings. Consult the SDK for specific invocation patterns.

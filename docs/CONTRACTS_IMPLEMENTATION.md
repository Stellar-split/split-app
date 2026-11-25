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

## Issue #978: Payment Time-Lock Functionality

**Location**: `split-contracts/src/types.rs` and main contract file

### Implementation Tasks

1. **Add TimeLock struct** in `types.rs`:
```rust
pub enum LockStatus {
    Locked,
    Released,
    EarlyReleased,
}

pub struct TimeLock {
    pub release_at: u64,        // ledger timestamp when funds unlock
    pub early_penalty_bps: u32, // penalty applied on early release
    pub status: LockStatus,
}
```

2. **Lock creation**: When a payment/invoice is created with a lock, store `TimeLock` keyed by payment id. Validate `early_penalty_bps <= 10000` and `release_at > current ledger timestamp`.

3. **Lock validation** `assert_unlocked(payment_id)`:
   - Reject access while `status == Locked` and `now < release_at`
   - Allow access once `now >= release_at` (automatic release)

4. **Early access** `release_early(payment_id)`:
   - Only callable by the payment recipient/creator
   - Compute `penalty = amount * early_penalty_bps / 10000`
   - Transfer `amount - penalty` to recipient, penalty to treasury
   - Set `status = EarlyReleased`, emit `payment_early_released { payment_id, penalty }`

5. **Automatic release**: On any access after `release_at`, transition `Locked -> Released` and emit `payment_released { payment_id }`.

6. **Status tracking**: Provide `get_lock_status(payment_id) -> LockStatus` read function.

7. **Analytics**: Track `total_locked`, `total_released`, `total_early_released`, and `total_penalties_collected` per creator; expose `get_lock_analytics(creator) -> LockAnalytics`.

8. **Events**:
   - `payment_locked { payment_id, release_at }`
   - `payment_released { payment_id }`
   - `payment_early_released { payment_id, penalty }`

### Access Control

- Only the payment recipient may trigger early release
- Locked payments must never be released or withdrawn before `release_at` except via `release_early`
- Enforce `debug_assert!(released_amount <= funded)` after every release

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

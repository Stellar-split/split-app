# Dispute Flow Panel and Timeline Implementation

## Overview

This document describes the comprehensive dispute flow implementation for the invoice detail page at `/invoice/[id]`. The implementation enables parties to monitor arbitration, submit evidence via IPFS, view live vote tallies, and allows authorized arbitrators to vote on dispute outcomes.

## Files Created/Modified

### New Files

1. **`src/components/DisputePanel.tsx`** - Main dispute interface component
2. **`src/components/DisputeTimeline.tsx`** - Chronological event timeline (updated)
3. **`src/lib/ipfs.ts`** - IPFS upload utilities
4. **`src/components/__tests__/DisputePanel.test.tsx`** - Comprehensive test suite
5. **`src/components/__tests__/DisputeTimeline.test.tsx`** - Timeline test suite
6. **`src/lib/__tests__/ipfs.test.ts`** - IPFS utilities test suite

### Modified Files

1. **`src/app/invoice/[id]/page.tsx`** - Integrated DisputePanel component

## Features Implemented

### 1. Dispute Metadata Panel (`DisputePanel.tsx`)

The DisputePanel component renders conditionally when `invoice.status === "Disputed"` and displays:

- **Dispute Information**
  - Reason and detailed description
  - Initiator wallet address (truncated)
  - Timestamp of dispute filing
  - List of assigned arbitrators with voting status
  
- **Live Vote Tally**
  - Real-time vote counts (Release vs Refund)
  - Visual progress bars showing vote distribution
  - Vote percentage calculations
  - Number of votes cast vs total arbitrators

- **Resolved Status Badge**
  - Shows outcome when dispute is resolved
  - Color-coded badges (green for Release, orange for Refund)

### 2. Evidence Submission via IPFS

**Evidence Upload Modal:**
- File selector supporting PDF, images, and documents
- 10MB file size limit with validation
- Accepted file types: `.pdf`, `.png`, `.jpg`, `.jpeg`, `.gif`, `.txt`, `.doc`, `.docx`
- Real-time upload to IPFS with CID generation
- Evidence metadata includes: CID, filename, submitter address, timestamp

**IPFS Integration (`src/lib/ipfs.ts`):**
- `uploadToIpfs()` - Uploads file to IPFS gateway
- `getIpfsUrl()` - Generates IPFS gateway URL
- `isValidCid()` - Validates CID format (v0 and v1)
- `mockIpfsUpload()` - Development fallback when gateway unavailable
- `uploadToIpfsWithFallback()` - Automatic fallback to mock for dev/test

**Evidence Display:**
- List of all submitted evidence with metadata
- Clickable "View" links opening IPFS gateway URLs
- Submitter address and submission date for each piece of evidence
- Evidence submission disabled after dispute resolution

### 3. Arbitrator Voting Controls

**Authorization Checks:**
- Verifies connected wallet is in the appointed arbitrators list
- Checks if arbitrator has already voted
- Shows voting interface only to authorized, non-voted arbitrators

**Voting Actions:**
- **"Approve Release"** button - Votes to release funds (vote = 1)
- **"Reject / Refund"** button - Votes to refund (vote = 0)
- Calls `sdk.voteDispute({ invoiceId, arbitrator, vote })` via Web3 SDK
- Displays loading state during transaction submission
- Shows success toast on vote confirmation
- Triggers invoice data refresh after successful vote

**Post-Vote Display:**
- Shows confirmation message to arbitrators who have already voted
- Disables voting controls after vote is cast
- Updates arbitrator list showing who has voted

### 4. Real-Time State Updates

**Integration with `useInvoiceStream`:**
- The invoice detail page already uses `useInvoiceStream(invoiceId)` hook
- Hook polls for invoice updates every 3 seconds
- Automatically detects status changes and new events
- DisputePanel receives updated invoice prop with latest dispute state

**Refresh Mechanism:**
- `onRefresh` callback provided to DisputePanel
- Called after evidence submission and voting actions
- Manually triggers invoice reload to ensure immediate UI update
- Works in conjunction with the streaming subscription for redundancy

**Live Tally Updates:**
- Vote counts update automatically via invoice stream
- Progress bars animate when new votes arrive
- Arbitrator voting status updates in real-time

### 5. Dispute Lifecycle Timeline (`DisputeTimeline.tsx`)

**Event Types Displayed:**
- **DisputeOpened** - Initial dispute filing with reason
- **EvidenceSubmitted** - Evidence uploads with IPFS links
- **VoteCast** - Individual arbitrator votes (Release/Refund)
- **DisputeResolved** - Final outcome with vote tally

**Timeline Features:**
- Chronological ordering of events (earliest to latest)
- Color-coded event markers (red, blue, indigo, green)
- Event-specific icons (⚠️, 📎, ⚖️, ✓)
- Timestamp formatting with locale-aware dates
- Truncated actor addresses with tooltips
- IPFS evidence links with "View" action
- Vote type badges showing Release/Refund choices
- Final tally display on resolution events

**Data Loading:**
- Fetches events via `splitClient.getDisputeEvents(invoiceId)`
- Shows loading skeleton while fetching
- Graceful error handling with empty state fallback
- Sorts events by timestamp on client side

## Technical Implementation Details

### Type Extensions

The implementation extends the SDK `Invoice` type to include dispute data:

```typescript
interface DisputeMetadata {
  reason: string;
  description: string;
  initiator: string;
  timestamp: number;
  arbitrators: string[];
  evidenceLinks: Array<{
    cid: string;
    timestamp: number;
    submitter: string;
    filename: string;
  }>;
}

interface DisputeVoteTally {
  releaseVotes: number;
  refundVotes: number;
  votedArbitrators: string[];
}

interface DisputeStatus extends DisputeMetadata, DisputeVoteTally {
  resolved: boolean;
  outcome?: "Release" | "Refund";
}
```

### SDK Method Assumptions

The implementation assumes the following Web3 SDK methods exist:

```typescript
// Vote on a dispute
sdk.voteDispute({
  invoiceId: string,
  arbitrator: string,
  vote: 0 | 1  // 0 = Refund, 1 = Release
}): Promise<{ txHash: string }>

// Submit evidence
sdk.addDisputeEvidence({
  invoiceId: string,
  submitter: string,
  evidenceCid: string,
  filename: string
}): Promise<{ txHash: string }>

// Fetch dispute events
sdk.getDisputeEvents(invoiceId: string): Promise<DisputeEvent[]>
```

### IPFS Configuration

**Environment Variables:**
- `NEXT_PUBLIC_IPFS_GATEWAY` - IPFS API endpoint (default: `https://api.web3.storage`)
- `NEXT_PUBLIC_IPFS_API_KEY` - Authentication token for IPFS service
- `NODE_ENV` - Determines whether to use mock uploads in development

**Mock Mode:**
- Automatically activated when `NODE_ENV === "development"` or no API key configured
- Generates deterministic CIDs based on file hash
- Useful for local development and testing without IPFS infrastructure

## Testing

### Test Coverage

1. **DisputePanel Tests (`DisputePanel.test.tsx`)**
   - ✅ Conditional rendering based on dispute status
   - ✅ Dispute metadata display (reason, initiator, dates, arbitrators)
   - ✅ Vote tally visualization and calculations
   - ✅ Evidence upload flow with file validation
   - ✅ IPFS CID submission callback
   - ✅ Voting authorization checks
   - ✅ Vote submission with correct parameters
   - ✅ Real-time refresh callbacks
   - ✅ Resolved dispute display
   - ✅ Timeline chronology validation

2. **DisputeTimeline Tests (`DisputeTimeline.test.tsx`)**
   - ✅ Event chronological ordering
   - ✅ Event type rendering (DisputeOpened, EvidenceSubmitted, VoteCast, DisputeResolved)
   - ✅ Actor address display and truncation
   - ✅ Timestamp formatting
   - ✅ IPFS evidence links
   - ✅ Vote type badges
   - ✅ Loading states
   - ✅ Empty states
   - ✅ Error handling
   - ✅ Visual indicators (icons, colors)

3. **IPFS Tests (`ipfs.test.ts`)**
   - ✅ File upload to IPFS gateway
   - ✅ File size validation (10MB limit)
   - ✅ File type validation
   - ✅ CID extraction from response
   - ✅ API key authentication
   - ✅ Error handling (network, API errors)
   - ✅ CID format validation (v0 and v1)
   - ✅ Mock IPFS deterministic CID generation
   - ✅ Gateway URL generation

### Running Tests

```bash
# Run all tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm run test -- --coverage

# Run specific test file
npm run test DisputePanel.test.tsx
```

## Usage Example

### For Invoice Creators/Payers

When viewing a disputed invoice:
1. Navigate to `/invoice/[id]`
2. See the dispute panel with reason and vote tally
3. Click "Submit Evidence" to upload supporting documents
4. View all submitted evidence with IPFS links
5. Monitor vote progress in real-time

### For Arbitrators

When assigned to a dispute:
1. Navigate to disputed invoice
2. Review dispute reason and evidence
3. See "Arbitrator Actions" section
4. Click "Approve Release" or "Reject / Refund"
5. Confirm transaction in wallet
6. See confirmation that vote was recorded

## Integration Checklist

✅ DisputePanel component created with full features
✅ DisputeTimeline updated with event display
✅ IPFS upload utilities implemented
✅ Evidence upload modal with validation
✅ Arbitrator voting controls
✅ Real-time state updates via useInvoiceStream
✅ Comprehensive test suites written
✅ TypeScript types defined
✅ Accessibility attributes (ARIA labels, roles)
✅ Responsive design (mobile-friendly)
✅ Error handling and loading states
✅ Toast notifications for user feedback
✅ Integration with invoice detail page

## Verification Steps

### 1. Linting
```bash
npm run lint
```
Expected: Zero warnings/errors

### 2. TypeScript Compilation
```bash
npx tsc --noEmit
```
Expected: No type errors

### 3. Build
```bash
npm run build
```
Expected: Successful production build

### 4. Manual Testing

**Test Scenario 1: Dispute Panel Display**
- Create an invoice with status "Disputed"
- Navigate to invoice detail page
- Verify dispute panel renders with all metadata
- Verify vote tally displays correctly

**Test Scenario 2: Evidence Upload**
- Click "Submit Evidence" button
- Select a PDF file < 10MB
- Submit and verify IPFS upload
- Check evidence appears in list with View link

**Test Scenario 3: Arbitrator Voting**
- Connect wallet as assigned arbitrator
- Verify voting controls are visible
- Click "Approve Release" or "Reject / Refund"
- Confirm transaction and verify vote recorded
- Check arbitrator shown as "Voted"

**Test Scenario 4: Real-Time Updates**
- Open dispute in two browser windows
- Vote in one window
- Verify vote tally updates in other window within 3 seconds

## Future Enhancements

1. **Evidence Comments** - Allow annotating evidence submissions
2. **Vote Reasoning** - Require arbitrators to provide vote rationale
3. **Evidence Categories** - Tag evidence by type (contract, communication, etc.)
4. **Arbitrator Chat** - Private discussion channel for arbitrators
5. **Dispute Appeal** - Allow parties to appeal resolved disputes
6. **Multi-round Voting** - Support escalation to larger arbitrator panels
7. **Evidence Verification** - Cryptographic signatures for evidence authenticity
8. **Notification System** - Email/push alerts for new evidence and votes

## Dependencies

- `@stellar-split/sdk` - Web3 SDK for Stellar smart contract interactions
- `@stellar/stellar-sdk` - Stellar blockchain utilities
- `next` 14.2.3 - React framework
- `react` 18.3.0 - UI library
- `lucide-react` - Icon library
- `vitest` - Testing framework
- `@testing-library/react` - React testing utilities

## Environment Setup

Required environment variables:

```env
NEXT_PUBLIC_CONTRACT_ID=<stellar_contract_id>
NEXT_PUBLIC_RPC_URL=https://soroban-testnet.stellar.org
NEXT_PUBLIC_IPFS_GATEWAY=https://api.web3.storage
NEXT_PUBLIC_IPFS_API_KEY=<your_web3_storage_api_key>
```

## Troubleshooting

### IPFS Upload Fails
- Verify `NEXT_PUBLIC_IPFS_API_KEY` is set correctly
- Check IPFS gateway URL is accessible
- In development, mock mode will activate automatically

### Votes Not Appearing
- Ensure wallet is connected
- Verify arbitrator address matches assigned list
- Check transaction was confirmed on blockchain
- Wait up to 3 seconds for streaming update

### Evidence Links Not Working
- Verify CID format is valid (QmXXX... or bXXX...)
- Try alternative gateway: `https://gateway.pinata.cloud/ipfs/{cid}`
- Check IPFS file was properly pinned

## License

This implementation follows the project's existing license.

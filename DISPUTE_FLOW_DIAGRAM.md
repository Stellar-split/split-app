# Dispute Flow Visual Diagram

## Component Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                 Invoice Detail Page (/invoice/[id])             │
│                     src/app/invoice/[id]/page.tsx               │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           │ useInvoiceStream(invoiceId)
                           │ polls every 3s
                           ▼
        ┌──────────────────────────────────────────────┐
        │         Live Invoice State                    │
        │  { status, disputeStatus, payments, ... }     │
        └──────────────┬───────────────────────────────┘
                       │
                       │ invoice.status === "Disputed"
                       ▼
    ┌──────────────────────────────────────────────────────────┐
    │                  DisputePanel Component                   │
    │              src/components/DisputePanel.tsx              │
    │                                                            │
    │  ┌────────────────────────────────────────────────────┐  │
    │  │          Dispute Metadata Display                  │  │
    │  │  • Reason, Description                             │  │
    │  │  • Initiator Address                               │  │
    │  │  • Timestamp, Arbitrators Count                    │  │
    │  └────────────────────────────────────────────────────┘  │
    │                                                            │
    │  ┌────────────────────────────────────────────────────┐  │
    │  │          Live Vote Tally (Real-Time)               │  │
    │  │  ✓ Approve Release: ████████░░ 2 votes             │  │
    │  │  ↩️ Reject/Refund:   ████░░░░░░ 1 vote             │  │
    │  │                      (2/3 arbitrators voted)       │  │
    │  └────────────────────────────────────────────────────┘  │
    │                                                            │
    │  ┌────────────────────────────────────────────────────┐  │
    │  │         Evidence List (IPFS Links)                 │  │
    │  │  📎 contract.pdf [View] - Submitted by GPAYER      │  │
    │  │  📎 screenshot.png [View] - Submitted by GPAYER    │  │
    │  │                                                     │  │
    │  │  [+ Submit Evidence] ──────┐                       │  │
    │  └────────────────────────────│───────────────────────┘  │
    │                                │                           │
    │                                ▼                           │
    │  ┌────────────────────────────────────────────────────┐  │
    │  │      Evidence Upload Modal (Conditional)           │  │
    │  │  • File Picker (PDF, images, docs)                 │  │
    │  │  • 10MB limit validation                           │  │
    │  │  • IPFS Upload ──► Returns CID                     │  │
    │  │  • Submit CID to contract                          │  │
    │  └────────────────────────────────────────────────────┘  │
    │                                                            │
    │  ┌────────────────────────────────────────────────────┐  │
    │  │    Arbitrator Voting Controls (Conditional)        │  │
    │  │    (Only shown if: wallet in arbitrators list      │  │
    │  │     AND has not voted yet)                         │  │
    │  │                                                     │  │
    │  │  [✓ Approve Release]  [↩️ Reject/Refund]           │  │
    │  │         │                      │                    │  │
    │  │         └──────────┬───────────┘                    │  │
    │  │                    ▼                                │  │
    │  │         sdk.voteDispute({ invoiceId,               │  │
    │  │                          arbitrator,                │  │
    │  │                          vote: 0|1 })               │  │
    │  │                    │                                │  │
    │  │                    ▼                                │  │
    │  │         onRefresh() ──► Reload invoice data        │  │
    │  └────────────────────────────────────────────────────┘  │
    │                                                            │
    │  ┌────────────────────────────────────────────────────┐  │
    │  │         Assigned Arbitrators List                  │  │
    │  │  GARBITRATOR1...  [✓ Voted]                        │  │
    │  │  GARBITRATOR2...  [✓ Voted]                        │  │
    │  │  GARBITRATOR3...  [Pending]                        │  │
    │  └────────────────────────────────────────────────────┘  │
    └──────────────────────────────────────────────────────────┘
                       │
                       ▼
    ┌──────────────────────────────────────────────────────────┐
    │              DisputeTimeline Component                    │
    │            src/components/DisputeTimeline.tsx             │
    │                                                            │
    │  ┌────────────────────────────────────────────────────┐  │
    │  │    Chronological Event Timeline                    │  │
    │  │                                                     │  │
    │  │  ⚠️ DisputeOpened                                   │  │
    │  │    By GPAYER123 • Nov 14, 10:00 AM                 │  │
    │  │    Reason: Non-delivery                            │  │
    │  │    │                                               │  │
    │  │    │                                               │  │
    │  │  📎 EvidenceSubmitted                               │  │
    │  │    By GPAYER123 • Nov 14, 11:30 AM                 │  │
    │  │    📎 contract.pdf [View]                          │  │
    │  │    │                                               │  │
    │  │    │                                               │  │
    │  │  ⚖️ VoteCast                                        │  │
    │  │    By GARBITRATOR1 • Nov 15, 9:00 AM               │  │
    │  │    [✓ Approve Release]                             │  │
    │  │    │                                               │  │
    │  │    │                                               │  │
    │  │  ⚖️ VoteCast                                        │  │
    │  │    By GARBITRATOR2 • Nov 15, 2:30 PM               │  │
    │  │    [✓ Approve Release]                             │  │
    │  │    │                                               │  │
    │  │    │                                               │  │
    │  │  ⚖️ VoteCast                                        │  │
    │  │    By GARBITRATOR3 • Nov 15, 4:00 PM               │  │
    │  │    [↩️ Reject/Refund]                               │  │
    │  │    │                                               │  │
    │  │    │                                               │  │
    │  │  ✓ DisputeResolved                                 │  │
    │  │    By GCONTRACT • Nov 15, 4:01 PM                  │  │
    │  │    Final Outcome: [✓ Released]                     │  │
    │  │    2 release · 1 refund                            │  │
    │  └────────────────────────────────────────────────────┘  │
    └──────────────────────────────────────────────────────────┘
```

## Data Flow Diagram

```
┌─────────────────────┐
│   User Actions      │
└──────────┬──────────┘
           │
           ▼
┌──────────────────────────────────────────────────────┐
│                 DisputePanel                          │
│                                                       │
│  [Submit Evidence]         [Vote: Approve/Reject]    │
│         │                           │                 │
│         ▼                           ▼                 │
│  ┌──────────────┐          ┌──────────────┐          │
│  │ File Upload  │          │ Vote Action  │          │
│  └──────┬───────┘          └──────┬───────┘          │
└─────────┼──────────────────────────┼──────────────────┘
          │                          │
          ▼                          ▼
┌─────────────────────┐    ┌─────────────────────┐
│   IPFS Gateway      │    │   Web3 SDK          │
│   (web3.storage)    │    │   (Stellar)         │
│                     │    │                     │
│  uploadToIpfs()     │    │  voteDispute()      │
│       │             │    │       │             │
│       ▼             │    │       ▼             │
│  Returns CID        │    │  Returns txHash     │
└───────┬─────────────┘    └─────────┬───────────┘
        │                            │
        ▼                            │
┌─────────────────────┐              │
│   Web3 SDK          │              │
│  addDisputeEvidence()│              │
│       │             │              │
│       ▼             │              │
│  Returns txHash     │              │
└───────┬─────────────┘              │
        │                            │
        └────────────┬───────────────┘
                     │
                     ▼
        ┌────────────────────────┐
        │  Stellar Smart         │
        │  Contract              │
        │  (Invoice Contract)    │
        │                        │
        │  • Updates dispute     │
        │    status              │
        │  • Stores evidence     │
        │    CID reference       │
        │  • Records votes       │
        │  • Resolves when       │
        │    threshold reached   │
        └────────┬───────────────┘
                 │
                 │ Soroban Events Emitted
                 ▼
        ┌────────────────────────┐
        │  useInvoiceStream      │
        │  Hook (Polling)        │
        │                        │
        │  • Polls every 3s      │
        │  • Fetches latest      │
        │    invoice state       │
        │  • Detects status      │
        │    changes             │
        └────────┬───────────────┘
                 │
                 │ Updated Invoice Object
                 ▼
        ┌────────────────────────┐
        │  React State Update    │
        │  (DisputePanel)        │
        │                        │
        │  • Vote tally updates  │
        │  • Evidence list       │
        │    refreshes           │
        │  • Arbitrator status   │
        │    updates             │
        │  • UI re-renders       │
        └────────────────────────┘
```

## User Journey Flows

### Flow 1: Payer Submits Evidence

```
Payer navigates to disputed invoice
        ↓
Views DisputePanel with current dispute state
        ↓
Clicks "Submit Evidence" button
        ↓
Modal opens with file picker
        ↓
Selects PDF file (< 10MB)
        ↓
File validated (type, size)
        ↓
Clicks "Submit Evidence"
        ↓
File uploaded to IPFS → CID returned
        ↓
CID submitted to contract via SDK
        ↓
Transaction signed and confirmed
        ↓
Success toast shown
        ↓
Modal closes, invoice refreshes
        ↓
New evidence appears in list with [View] link
        ↓
Other parties see evidence in real-time
```

### Flow 2: Arbitrator Casts Vote

```
Arbitrator navigates to disputed invoice
        ↓
Views DisputePanel with dispute details
        ↓
Reviews evidence (clicks IPFS links)
        ↓
Sees "Arbitrator Actions" section
        ↓
Decides outcome: Release or Refund
        ↓
Clicks "✓ Approve Release" (or "↩️ Reject/Refund")
        ↓
Transaction initiated via SDK
        ↓
Wallet prompts for signature
        ↓
Arbitrator confirms transaction
        ↓
Vote submitted to smart contract
        ↓
Transaction confirmed on Stellar
        ↓
Success toast: "Vote 'Release' submitted successfully"
        ↓
Invoice data refreshed
        ↓
Vote tally updates (2 → 3 votes)
        ↓
Progress bar animates
        ↓
Arbitrator shown as "Voted" in list
        ↓
Voting buttons hidden, confirmation shown
        ↓
Other arbitrators see updated tally in real-time
        ↓
(If threshold reached) Contract resolves dispute
        ↓
DisputePanel shows resolved badge
        ↓
DisputeTimeline adds "DisputeResolved" event
```

### Flow 3: Real-Time Monitoring

```
Party A viewing disputed invoice
        ↓
useInvoiceStream polling every 3s
        ↓
Party B submits evidence from another device
        ↓
Contract state updated
        ↓
Next poll (within 3s) fetches updated invoice
        ↓
Party A's UI automatically updates
        ↓
New evidence appears without page reload
        ↓
Party C (arbitrator) votes
        ↓
Contract records vote
        ↓
Next poll fetches updated vote tally
        ↓
Party A and B see vote count increase
        ↓
Progress bars animate to new values
        ↓
All parties synchronized within 3 seconds
```

## IPFS Integration Flow

```
┌──────────────────────┐
│  Evidence File       │
│  (PDF, image, doc)   │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────────────────────┐
│  uploadToIpfs(file)                  │
│  src/lib/ipfs.ts                     │
│                                      │
│  1. Validate file size (< 10MB)     │
│  2. Validate file type (whitelist)  │
│  3. Create FormData with file       │
│  4. POST to IPFS gateway            │
│     (with API key if configured)    │
│  5. Parse response for CID          │
└──────────┬───────────────────────────┘
           │
           ▼
┌──────────────────────────────────────┐
│  IPFS Gateway Response               │
│  { cid: "QmXXX...", size: 12345 }   │
└──────────┬───────────────────────────┘
           │
           │ CID: QmYwAPJzv5CZs...
           ▼
┌──────────────────────────────────────┐
│  sdk.addDisputeEvidence()            │
│  {                                   │
│    invoiceId: "invoice-123",         │
│    submitter: "GPAYER123",           │
│    evidenceCid: "QmXXX...",          │
│    filename: "contract.pdf"          │
│  }                                   │
└──────────┬───────────────────────────┘
           │
           ▼
┌──────────────────────────────────────┐
│  Smart Contract Storage              │
│  disputeEvidence[invoiceId].push({   │
│    cid: "QmXXX...",                  │
│    submitter: "GPAYER123",           │
│    timestamp: 1700000000,            │
│    filename: "contract.pdf"          │
│  })                                  │
└──────────┬───────────────────────────┘
           │
           │ Event: EvidenceSubmitted
           ▼
┌──────────────────────────────────────┐
│  DisputeTimeline Component           │
│  Fetches and displays:               │
│                                      │
│  📎 EvidenceSubmitted                │
│     By GPAYER123 • Nov 14, 11:30     │
│     📎 contract.pdf [View] ←─────────┼─ Links to:
│                                      │  https://ipfs.io/ipfs/QmXXX...
└──────────────────────────────────────┘
```

## State Management

```
┌─────────────────────────────────────────────────────────┐
│              Invoice State (from SDK)                    │
│  {                                                       │
│    id: "invoice-123",                                    │
│    status: "Disputed",                                   │
│    disputeStatus: {                                      │
│      reason: "Non-delivery",                             │
│      description: "...",                                 │
│      initiator: "GPAYER123",                             │
│      timestamp: 1700000000,                              │
│      arbitrators: ["GARB1", "GARB2", "GARB3"],          │
│      evidenceLinks: [                                    │
│        {                                                 │
│          cid: "QmXXX...",                                │
│          submitter: "GPAYER123",                         │
│          timestamp: 1700010000,                          │
│          filename: "contract.pdf"                        │
│        }                                                 │
│      ],                                                  │
│      releaseVotes: 2,                                    │
│      refundVotes: 1,                                     │
│      votedArbitrators: ["GARB1", "GARB2"],              │
│      resolved: false,                                    │
│      outcome: null                                       │
│    }                                                     │
│  }                                                       │
└─────────────────────────────────────────────────────────┘
           │
           │ Passed as prop
           ▼
┌─────────────────────────────────────────────────────────┐
│           DisputePanel Local State                       │
│  {                                                       │
│    showEvidenceModal: boolean,                           │
│    uploading: boolean,                                   │
│    uploadError: string | null,                           │
│    voting: boolean,                                      │
│    voteError: string | null                              │
│  }                                                       │
└─────────────────────────────────────────────────────────┘
           │
           │ Derived values
           ▼
┌─────────────────────────────────────────────────────────┐
│           Computed Properties                            │
│  • isArbitrator = arbitrators.includes(publicKey)        │
│  • hasVoted = votedArbitrators.includes(publicKey)       │
│  • totalVotes = releaseVotes + refundVotes               │
│  • releasePercent = (releaseVotes / totalVotes) * 100    │
│  • refundPercent = (refundVotes / totalVotes) * 100      │
└─────────────────────────────────────────────────────────┘
```

## Component Interaction Diagram

```
                    Invoice Detail Page
                            │
         ┌──────────────────┼──────────────────┐
         │                  │                  │
         ▼                  ▼                  ▼
   DisputePanel    DisputeTimeline    Other Components
         │                  │
         │                  │
         ├─────────┐        │
         │         │        │
         ▼         ▼        ▼
  EvidenceModal  Voting   Event List
                Controls
         │         │        │
         └────┬────┴────────┘
              │
              ▼
         IPFS + SDK
              │
              ▼
      Stellar Contract
              │
              ▼
      useInvoiceStream
              │
              ▼
        UI Updates
```

This completes the visual representation of the dispute flow architecture and data flows!

# GraphQL API Design

> Status: design only. This workspace does not have a GraphQL runtime installed, so this SDL is not currently served or executable. Implementing it requires an approved GraphQL server dependency.

## Endpoint and transport

The proposed endpoint is `POST /api/graphql`. Queries and mutations use JSON request/response bodies. Subscriptions use GraphQL over Server-Sent Events (SSE), allowing the same HTTP route to stream `InvoiceUpdate` events. Authenticate with a signed StellarSplit bearer API key. Apply the existing API-key scope policy: read scope for queries and subscriptions, write scope for mutations.

## Schema

```graphql
scalar BigInt
scalar DateTime

type Query {
  invoice(id: ID!): Invoice
  invoices(
    publicKey: String!
    first: Int = 20
    after: String
    search: String
  ): InvoiceConnection!
}

type Mutation {
  "Refresh on-chain state and publish an update; does not submit a transaction."
  refreshInvoice(id: ID!): Invoice!
}

type Subscription {
  invoiceUpdated(id: ID!): InvoiceUpdate!
}

type InvoiceConnection {
  nodes: [Invoice!]!
  pageInfo: PageInfo!
}

type PageInfo {
  endCursor: String
  hasNextPage: Boolean!
}

type InvoiceUpdate {
  invoice: Invoice!
  reason: InvoiceUpdateReason!
  updatedAt: DateTime!
}

enum InvoiceUpdateReason {
  REFRESHED
  PAYMENT_CONFIRMED
}

type Invoice {
  id: ID!
  status: String!
  creator: String!
  funded: BigInt!
  deadline: DateTime!
  recipients: [Recipient!]!
  payments(first: Int = 10, after: String): PaymentConnection!
}

type Recipient {
  address: String!
  amount: BigInt!
}

type PaymentConnection {
  nodes: [Payment!]!
  pageInfo: PageInfo!
}

type Payment {
  payer: String!
  amount: BigInt!
  timestamp: DateTime
}
```

Invoice and payment `BigInt` values should serialize as decimal strings to avoid precision loss. Invoice IDs and cursors must be validated as positive safe integers; `first` is limited to 1-50. Stellar public keys must be validated before any RPC scan.

## Operation examples

```graphql
query AccountInvoices($publicKey: String!, $after: String) {
  invoices(publicKey: $publicKey, first: 20, after: $after) {
    nodes { id status funded deadline }
    pageInfo { endCursor hasNextPage }
  }
}
```

```graphql
mutation Refresh($id: ID!) {
  refreshInvoice(id: $id) { id status funded }
}
```

```graphql
subscription InvoiceChanges($id: ID!) {
  invoiceUpdated(id: $id) {
    reason
    updatedAt
    invoice { id status funded }
  }
}
```

## Resolver boundaries

- `Query.invoice` reads through the existing `splitClient.getInvoice` path and returns `null` for a missing ID.
- `Query.invoices` delegates to `fetchInvoicesForAddress`, preserving the existing cursor scan and ownership semantics.
- `Invoice.payments` slices the already-loaded invoice payment list, avoiding an additional chain read.
- `Mutation.refreshInvoice` performs a fresh chain read, invalidates the invoice cache, and publishes an update event. It never signs or submits a blockchain transaction.
- `Subscription.invoiceUpdated` filters events by invoice ID and removes its listener when the client disconnects.
- The payment-confirmed flow should publish `PAYMENT_CONFIRMED` only after verifying the transaction on-chain; webhook-supplied invoice/payment payloads alone are not authoritative.

## Caching and query optimization

- Reuse the existing process-local blockchain TTL cache for invoice reads, with a short invoice TTL and explicit invalidation in `refreshInvoice`.
- Create a request-scoped DataLoader for invoice IDs to coalesce duplicate field lookups and preserve request-level authorization context.
- Use the SDK's already-loaded invoice object for nested recipient/payment fields instead of fetching those fields independently.
- Bound `first` to 50, cap GraphQL document size and depth, and enforce a maximum query complexity score before resolver execution. Reject over-budget queries with a structured GraphQL error.
- Do not persist-cache responses containing authorization-sensitive data. Any shared cache must include the normalized API-key identity and query variables in its key.
- Process-local cache and pub/sub do not cross serverless instances. Production deployments requiring cross-instance freshness need shared cache and pub/sub infrastructure; SSE connections must be hosted on an adapter that supports long-lived streams.

## Response and errors

Use standard GraphQL `data` and `errors` fields. Include stable error extensions such as `code` (`BAD_USER_INPUT`, `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `RATE_LIMITED`, `UPSTREAM_ERROR`) and a request ID. Avoid returning raw SDK, RPC, or credential details to clients.

## Enabling implementation

After approving a GraphQL runtime dependency, implement the SDL with an executable schema, add the `/api/graphql` route with POST and SSE handling, wire query/mutation/subscription resolvers to the existing invoice services, add scope enforcement and request complexity limits, then publish this schema in the interactive API documentation. Do not expose blockchain-writing mutations unless the client supplies a wallet-signed transaction that is independently validated before submission.
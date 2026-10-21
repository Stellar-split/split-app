# StellarSplit REST API

The versioned REST API is rooted at `/api/v1`. Version 1 provides authenticated invoice and payment-history reads. Invoice creation, funding, release, and refund are Stellar contract operations and must be prepared and signed by the user's wallet through the StellarSplit SDK; the REST server never holds or impersonates wallet keys.

The interactive reference is available at `/api-docs`, with its machine-readable OpenAPI 3.1 contract at `/openapi.json`.

## Authentication

Send a signed StellarSplit API key as a bearer token. Keys can be created in the app's API key settings.

```http
Authorization: Bearer sk_read_<id>.<signature>
```

Both read- and write-scoped keys can access v1 read endpoints. Missing or invalid keys receive `401 UNAUTHORIZED`. In production, set `API_KEY_SIGNING_SECRET` to a high-entropy secret; API authentication returns `503 CONFIGURATION_ERROR` rather than accepting keys when it is unset.

## Endpoints

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/v1/invoices` | List invoices created by or addressed to a Stellar account |
| `GET` | `/api/v1/invoices/{id}` | Get one invoice by its contract ID |
| `GET` | `/api/v1/invoices/{id}/history` | Get paginated payments for an invoice |

### List invoices

```http
GET /api/v1/invoices?publicKey=G...&limit=20
```

`publicKey` is required and must be a Stellar public key. Optional parameters are `cursor` (exclusive invoice-ID cursor), `limit` (1-50, default 20), and `q` (prefix search on title or memo, at most 100 characters). The response contains `data.invoices` and `data.nextCursor`; pass the returned cursor to fetch the next page.

### Get an invoice

```http
GET /api/v1/invoices/25
```

Invoice IDs must be positive decimal integers. Missing invoices return `404 NOT_FOUND`.

### Get payment history

```http
GET /api/v1/invoices/25/history?cursor=0&limit=10
```

`cursor` is a zero-based payment offset (default 0). `limit` is 1-50 (default 10). The response contains `data.payments` and `data.nextCursor`, which is `null` when the history is exhausted.

## Responses

Successful responses use a shared envelope. SDK `bigint` values, including funded and payment amounts, are serialized as base-10 strings to preserve precision.

```json
{
  "data": { "invoices": [], "nextCursor": null },
  "meta": { "apiVersion": "v1", "requestId": "1b18a217-d138-4ea2-a44a-1ec09e289a53" }
}
```

Errors include a stable code, message, optional validation details, and request ID:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "One or more query parameters are invalid.",
    "details": { "fieldErrors": { "publicKey": ["Must be a valid Stellar public key"] }, "formErrors": [] },
    "requestId": "1b18a217-d138-4ea2-a44a-1ec09e289a53"
  },
  "meta": { "apiVersion": "v1", "requestId": "1b18a217-d138-4ea2-a44a-1ec09e289a53" }
}
```

Error codes: `VALIDATION_ERROR` (400), `UNAUTHORIZED` (401), `NOT_FOUND` (404), `RATE_LIMITED` (429), `UPSTREAM_ERROR` (502), and `CONFIGURATION_ERROR` (503).

## Rate limiting

The default limit is 120 requests per API key per 60-second window. Responses include `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `X-RateLimit-Reset`. A `429` also includes `Retry-After` in seconds. Counters are currently in-memory and process-local; multi-instance deployments need a shared rate-limit store (for example Redis) for a global quota.

## Versioning

The major API version is in the URL (`/api/v1`). Breaking changes require a new path such as `/api/v2`; compatible additions may be made within v1. The response includes `meta.apiVersion` and the `X-API-Version` header.

## Example

```bash
curl 'https://your-stellarsplit-host/api/v1/invoices?publicKey=G...&limit=20' \
  -H 'Authorization: Bearer sk_read_<id>.<signature>' \
  -H 'Accept: application/json'
```
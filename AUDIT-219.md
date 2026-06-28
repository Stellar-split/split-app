# Audit: Issue #219 API Key Scoped Permissions

## Result

Issue #219 is implemented, including the security gap found during the first audit.

## What Is Fixed

- API key creation now includes a permission scope selector defaulting to `read` in `src/app/settings/api-keys/page.tsx`.
- Generated keys store a `scope: "read" | "write"` field and the key list displays the scope with a badge.
- Existing keys without a `scope` field migrate to `write` for backward-compatible display behavior, and the settings page shows a one-time review banner.
- Mutating API routes under `src/app/api` require write scope through `requireWriteScope`.
- New API keys are minted by `POST /api/api-keys` and signed server-side.
- Write-route authorization now verifies the API key signature instead of trusting the `sk_write_` prefix, so forged keys like `sk_write_anything` are rejected.
- Unit tests cover migration behavior, read-only rejection, write-key allowance, and forged write-key rejection.

## Files Reviewed / Updated

- `src/app/settings/api-keys/page.tsx`
- `src/app/api/api-keys/route.ts`
- `src/app/api/test-webhook/route.ts`
- `src/app/api/send-confirmation/route.ts`
- `src/lib/apiKeys.ts`
- `src/lib/apiKeyAuth.ts`
- `src/lib/signedApiKeys.ts`
- `src/__tests__/apiKeys.test.ts`
- `.env.example`

## Remaining Notes

- Deployments should set a stable `API_KEY_SIGNING_SECRET`. If this secret changes, previously generated signed keys will stop verifying.
- Legacy pre-signed keys are still migrated to `write` in the local settings UI, but unsigned legacy tokens are no longer accepted by protected server routes because the server cannot authenticate browser-local historical keys safely.

## Verification

- `npm install` completed and restored the local Jest package.
- `npm test -- --runTestsByPath src/__tests__/apiKeys.test.ts --runInBand` could not complete because Next's native SWC package fails to load locally: `next-swc.win32-x64-msvc.node is not a valid Win32 application`.
- `npm rebuild @next/swc-win32-x64-msvc` completed, but the SWC loader error persisted.
- `npx tsc --noEmit` could not complete because of an existing unrelated type declaration issue for `html2canvas` in `src/components/AchievementCard.tsx`.

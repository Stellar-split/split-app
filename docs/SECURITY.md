# Wallet & Key Security Practices

This app never takes custody of user private keys. Signing is delegated to
an external wallet (Freighter browser extension, or WalletConnect) — see
`src/lib/freighter.ts` and `src/lib/stores/walletStore.ts`. Only the public
account address is ever held in application state.

The practices below (implemented in `src/lib/walletSecurity.ts`) harden the
surfaces that remain under this app's control.

## Never log keys

- `installSecretRedactingLogger()` wraps `console.*` so any string matching
  a Stellar secret-seed shape (`S` + 55 base32 chars), or any object field
  named like `secret`/`privateKey`/`seed`, is replaced with
  `[REDACTED_SECRET]` before being printed.
- Call this once at startup, as early as possible (e.g. from
  `instrumentation-client.ts`).

## Secure random generation

- `secureRandomBytes()` / `secureRandomToken()` use
  `crypto.getRandomValues` (browser) or Node's `crypto.randomFillSync`
  (server) — never `Math.random()` — for anything security-sensitive
  (tokens, nonces, ids used in auth flows).

## Secure key/session deletion

- `secureWipe()` zeroes a `Uint8Array` buffer once a sensitive value is no
  longer needed, so it doesn't linger in memory via a closure reference.
- `useWalletStore.setDisconnected()` clears the address/balance from
  application state immediately on disconnect.

## Session timeouts

- `startWalletSessionTimeout()` starts an idle timer (default 15 minutes)
  that disconnects the wallet after a period of user inactivity, reset on
  mouse/keyboard/touch/scroll activity. Wire it up wherever a wallet
  connection is established:

  ```ts
  const handle = startWalletSessionTimeout(() => useWalletStore.getState().setDisconnected());
  // handle.stop() on unmount / explicit disconnect
  ```

## User-facing security warnings

- Never ask users to paste or type their private key/secret seed into this
  app. All signing happens in the external wallet's own UI.
- Warn users in the connect-wallet flow that this app will never request
  their secret key, and that anyone asking for it elsewhere is phishing.

## Reporting

If you discover a security issue, please report it privately rather than
opening a public GitHub issue. See `CONTRIBUTING.md` for contact details.

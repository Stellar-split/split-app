# Contributing to split-app

Thank you for your interest in contributing to StellarSplit! This repo is part of the [Drips Wave Program](https://drips.network/wave) — a monthly open-source bounty program run by the Stellar Development Foundation.

## Before You Start

**Do not begin coding until you have been assigned to an issue by a maintainer.**

1. Browse [open issues](../../issues) and find one labelled `good first issue` or matching your skill level.
2. Comment on the issue: "I'd like to work on this."
3. Wait for a maintainer to assign you. Only then should you fork and start coding.

## Workflow

### 1. Fork & Clone

```bash
git clone https://github.com/<your-username>/split-app.git
cd split-app
npm install
```

### 2. Set Up Environment

```bash
cp .env.example .env.local
# Fill in your testnet contract ID and RPC URL
```

### 3. Create a Branch

```
fix/issue-NUMBER-short-description
feat/issue-NUMBER-short-description
```

```bash
git checkout -b fix/issue-42-short-description
```

### 4. Make Your Changes

- Write clean, well-typed TypeScript and React.
- Run `npm run build` — must succeed with no errors.
- Run `npm run lint` — no TypeScript errors.
- Ensure all interactive elements have ARIA labels.

### 5. Commit

Use conventional commits:

```
fix: correct wallet disconnect state (#42)
feat: add invoice search to dashboard (#7)
```

### 6. Open a Pull Request

- Title: concise, under 70 characters.
- Description: what changed, why, and how you tested it.
- Reference the issue: `Closes #42`

## Code Standards

- All components must have a JSDoc comment describing their purpose.
- Use Tailwind utility classes — do not add custom CSS unless necessary.
- Keep components small and focused (single responsibility).
- All interactive elements must be keyboard-accessible.

## Debugging State with Redux DevTools

StellarSplit uses [Zustand](https://github.com/pmndrs/zustand) for client-side state. Three stores are available:

| Store | Location | DevTools name |
|---|---|---|
| Wallet | `src/lib/stores/walletStore.ts` | `WalletStore` |
| Invoice | `src/lib/stores/invoiceStore.ts` | `InvoiceStore` |
| UI | `src/lib/stores/uiStore.ts` | `UIStore` |

### Setting up the extension

1. Install the [Redux DevTools browser extension](https://github.com/reduxjs/redux-devtools#browser-extension).
2. Run the dev server: `npm run dev`.
3. Open DevTools → **Redux** tab.

The three stores appear by name. You can:
- **Inspect** current state and individual action payloads.
- **Time-travel** by clicking any action in the log to jump to that state snapshot.
- **Replay** a sequence of actions to reproduce a bug.

### DevTools is development-only

The middleware is tree-shaken out in production (`NODE_ENV !== 'development'`). No DevTools overhead ships to users.

### Named actions

Each `set` call in the stores uses a named action (e.g. `"wallet/setConnected"`). When adding new state mutations, keep this convention so the DevTools log stays readable.

## Questions?

Open a [Discussion](../../discussions) or ask in the issue thread.

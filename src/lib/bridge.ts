/**
 * Cross-chain bridge helpers for StellarSplit.
 *
 * Supports Ethereum Mainnet (via MetaMask) and Solana Mainnet (via Phantom).
 * Bridge fee estimation, wallet connection, payment submission and status
 * polling are all handled here so components stay thin.
 *
 * NOTE: In production these fee numbers come from a real bridge SDK (e.g.
 * Wormhole Connect or Squid Router). Here they are deterministic mocks so
 * the UI can be built and tested without live RPC access.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type SupportedChain = "ethereum" | "solana";

export interface ChainMeta {
  id: SupportedChain;
  label: string;
  currency: string;
  /** Wallet provider name shown in UI */
  walletName: string;
  /** Estimated bridge time displayed to user */
  estimatedTime: string;
}

export interface FeeEstimate {
  /** Chain-native bridge fee (human-readable, e.g. "0.002 ETH") */
  bridgeFee: string;
  /** Fee as a fraction of the invoice amount (0–1) */
  bridgeFeeRatio: number;
  /** USDC portion of the fee, rounded up to the nearest micro-USDC. */
  estimatedUsdcFee: string;
  /** Amount that actually arrives on Stellar side, in USDC */
  netAmount: string;
  /** Estimated settlement time */
  estimatedTime: string;
}

export interface BridgePaymentRequest {
  chain: SupportedChain;
  /** Sender address on the source chain */
  fromAddress: string;
  /** Stellar invoice ID */
  invoiceId: string;
  /** Amount to send in USDC (human-readable) */
  amount: string;
  /** Stellar destination (the StellarSplit contract or escrow) */
  stellarDestination: string;
}

export interface BridgePaymentResult {
  /** Transaction hash on the source chain */
  sourceTxHash: string;
  /** VAA / relay ID used to track the bridge relay */
  bridgeId: string;
}

export type BridgeStatus =
  | "pending"        // waiting for source-chain confirmation
  | "in_transit"     // bridge relay in progress
  | "relaying"       // Stellar-side relay transaction being submitted
  | "confirmed"      // Stellar-side relay confirmed
  | "failed";        // bridge failed

export interface BridgeStatusResult {
  status: BridgeStatus;
  /** Human-readable description */
  message: string;
  /** Stellar-side transaction hash, present when status === "confirmed" */
  stellarTxHash?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const SUPPORTED_CHAINS: ChainMeta[] = [
  {
    id: "ethereum",
    label: "Ethereum Mainnet",
    currency: "ETH",
    walletName: "MetaMask",
    estimatedTime: "~10 min",
  },
  {
    id: "solana",
    label: "Solana Mainnet",
    currency: "SOL",
    walletName: "Phantom",
    estimatedTime: "~2 min",
  },
];

/** Fee ratios per chain (fraction of the USDC amount). */
const BRIDGE_FEE_RATIOS: Record<SupportedChain, number> = {
  ethereum: 0.003, // 0.3 %
  solana: 0.001,   // 0.1 %
};

const BRIDGE_FEE_BPS: Record<SupportedChain, bigint> = {
  ethereum: 30n,
  solana: 10n,
};

/** Fixed gas/relay fee in the source-chain native token. */
const NATIVE_FEES: Record<SupportedChain, string> = {
  ethereum: "0.002 ETH",
  solana: "0.000005 SOL",
};

// ─── Fee estimation ───────────────────────────────────────────────────────────

/**
 * Estimate bridge fees for a given chain and USDC amount.
 *
 * @param chain   - Source chain
 * @param amount  - USDC amount the user wants to send (human-readable)
 */
export function estimateBridgeFee(
  chain: SupportedChain,
  amount: string
): FeeEstimate {
  const meta = SUPPORTED_CHAINS.find((c) => c.id === chain);
  if (!meta) throw new Error(`Unsupported chain: ${chain}`);
  const amountMicros = parseUsdcMicros(amount);
  const feeMicros = (amountMicros * BRIDGE_FEE_BPS[chain] + 9_999n) / 10_000n;
  const netMicros = amountMicros > feeMicros ? amountMicros - feeMicros : 0n;
  const ratio = BRIDGE_FEE_RATIOS[chain];

  return {
    bridgeFee: `${NATIVE_FEES[chain]} + ${formatUsdcMicros(feeMicros)} USDC`,
    bridgeFeeRatio: ratio,
    estimatedUsdcFee: formatUsdcMicros(feeMicros),
    netAmount: formatUsdcMicros(netMicros),
    estimatedTime: meta.estimatedTime,
  };
}

export interface BridgeRoute {
  chain: SupportedChain;
  estimate: FeeEstimate;
}

export interface BridgeRoutePlan {
  selected: BridgeRoute;
  fallbackRoutes: BridgeRoute[];
  /** Savings versus the Ethereum route, based on USDC fees only. */
  savingsVsEthereum: string;
  savingsPercent: number;
  /** Extra USDC cost if a manual override is more expensive than the cheapest route. */
  costAboveCheapest: string;
}

/** Rank routes by USDC fee, then by settlement time for equal-cost routes. */
export function optimizeBridgeRoute(
  amount: string,
  options: {
    preferredChain?: SupportedChain;
    unavailableChains?: SupportedChain[];
  } = {}
): BridgeRoutePlan | null {
  const unavailable = new Set(options.unavailableChains ?? []);
  const routes = SUPPORTED_CHAINS
    .filter((chain) => !unavailable.has(chain.id))
    .map((chain) => ({ chain: chain.id, estimate: estimateBridgeFee(chain.id, amount) }))
    .sort((left, right) => {
      const feeDifference =
        parseUsdcMicros(left.estimate.estimatedUsdcFee) -
        parseUsdcMicros(right.estimate.estimatedUsdcFee);
      if (feeDifference !== 0n) return feeDifference < 0n ? -1 : 1;
      return parseEstimatedSeconds(left.estimate.estimatedTime) - parseEstimatedSeconds(right.estimate.estimatedTime);
    });

  if (routes.length === 0) return null;

  const selected = routes.find((route) => route.chain === options.preferredChain) ?? routes[0];
  const ethereumRoute = routes.find((route) => route.chain === "ethereum");
  const cheapestFee = parseUsdcMicros(routes[0].estimate.estimatedUsdcFee);
  const selectedFee = parseUsdcMicros(selected.estimate.estimatedUsdcFee);
  const ethereumFee = ethereumRoute ? parseUsdcMicros(ethereumRoute.estimate.estimatedUsdcFee) : selectedFee;
  const savingsMicros = ethereumFee > selectedFee ? ethereumFee - selectedFee : 0n;
  const savingsPercent = ethereumFee > 0n ? Number((savingsMicros * 10_000n) / ethereumFee) / 100 : 0;

  return {
    selected,
    fallbackRoutes: routes.filter((route) => route.chain !== selected.chain),
    savingsVsEthereum: formatUsdcMicros(savingsMicros),
    savingsPercent,
    costAboveCheapest: formatUsdcMicros(selectedFee > cheapestFee ? selectedFee - cheapestFee : 0n),
  };
}

function parseUsdcMicros(amount: string): bigint {
  const match = amount.trim().match(/^(\d+)(?:\.(\d{0,6}))?$/);
  if (!match) return 0n;
  return BigInt(match[1]) * 1_000_000n + BigInt((match[2] ?? "").padEnd(6, "0") || "0");
}

function formatUsdcMicros(amount: bigint): string {
  const whole = amount / 1_000_000n;
  const fraction = (amount % 1_000_000n).toString().padStart(6, "0");
  return `${whole}.${fraction}`;
}

function parseEstimatedSeconds(estimatedTime: string): number {
  const match = estimatedTime.match(/~(\d+)\s*(min|s)/);
  if (!match) return Number.POSITIVE_INFINITY;
  return Number(match[1]) * (match[2] === "min" ? 60 : 1);
}

// ─── Wallet helpers ───────────────────────────────────────────────────────────

/** Ethereum / MetaMask -------------------------------------------------------*/

/** Type-safe accessor for window.ethereum (EIP-1193). */
function getEthereum(): { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> } | null {
  if (typeof window === "undefined") return null;
  return (window as unknown as { ethereum?: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> } }).ethereum ?? null;
}

/**
 * Connect MetaMask and return the user's Ethereum address.
 * Throws if MetaMask is not installed.
 */
export async function connectMetaMask(): Promise<string> {
  const eth = getEthereum();
  if (!eth) throw new Error("MetaMask is not installed. Please install it from metamask.io.");

  const accounts = (await eth.request({
    method: "eth_requestAccounts",
  })) as string[];

  if (!accounts || accounts.length === 0) {
    throw new Error("No accounts returned from MetaMask.");
  }
  return accounts[0];
}

/** Solana / Phantom ----------------------------------------------------------*/

interface PhantomProvider {
  isPhantom?: boolean;
  connect: () => Promise<{ publicKey: { toString(): string } }>;
  disconnect: () => Promise<void>;
  signTransaction: (tx: unknown) => Promise<unknown>;
}

function getPhantom(): PhantomProvider | null {
  if (typeof window === "undefined") return null;
  const provider = (window as unknown as { solana?: PhantomProvider }).solana;
  return provider?.isPhantom ? provider : null;
}

/**
 * Connect Phantom and return the user's Solana public key.
 * Throws if Phantom is not installed.
 */
export async function connectPhantom(): Promise<string> {
  const phantom = getPhantom();
  if (!phantom) throw new Error("Phantom is not installed. Please install it from phantom.app.");

  const resp = await phantom.connect();
  return resp.publicKey.toString();
}

/**
 * Connect the appropriate wallet for a given chain.
 *
 * @returns Connected wallet address on the source chain.
 */
export async function connectWalletForChain(chain: SupportedChain): Promise<string> {
  if (chain === "ethereum") return connectMetaMask();
  if (chain === "solana") return connectPhantom();
  throw new Error(`Unsupported chain: ${chain}`);
}

// ─── Bridge payment ───────────────────────────────────────────────────────────

/**
 * Build and submit a cross-chain bridge payment.
 *
 * In production this calls a bridge SDK (Wormhole, Squid, etc.).
 * Here we produce a deterministic mock result so the UI flow works end-to-end
 * without live RPC access.
 */
export async function buildBridgePayment(
  req: BridgePaymentRequest
): Promise<BridgePaymentResult> {
  if (typeof window === "undefined") throw new Error("Browser only");

  // Validate inputs
  if (!req.fromAddress) throw new Error("Wallet not connected.");
  if (!req.amount || parseFloat(req.amount) <= 0) throw new Error("Invalid amount.");
  if (!req.stellarDestination) throw new Error("Stellar destination address required.");

  // Simulate network latency
  await delay(800);

  // Build a deterministic mock transaction hash based on inputs
  const seed = `${req.chain}:${req.fromAddress}:${req.invoiceId}:${req.amount}:${Date.now()}`;
  const sourceTxHash = "0x" + hashString(seed).toString(16).padStart(64, "0");
  const bridgeId = "bridge_" + hashString(seed + "relay").toString(16).slice(0, 24);

  return { sourceTxHash, bridgeId };
}

// ─── Status polling ───────────────────────────────────────────────────────────

/** Status progression sequence used by the mock poller. */
const STATUS_SEQUENCE: Array<{ status: BridgeStatus; message: string }> = [
  { status: "pending",    message: "Waiting for source-chain confirmation…" },
  { status: "in_transit", message: "Transaction confirmed. Bridge relay in progress…" },
  { status: "relaying",   message: "Relaying to Stellar network…" },
  { status: "confirmed",  message: "Payment confirmed on Stellar! ✓" },
];

/**
 * Poll bridge status until confirmed or failed.
 *
 * Calls `onUpdate` on every status change.
 * Resolves when status reaches "confirmed" or "failed".
 *
 * @param bridgeId   - Bridge relay ID from buildBridgePayment
 * @param onUpdate   - Callback for each status update
 * @param intervalMs - Polling interval in milliseconds (default 3 000)
 */
export async function pollBridgeStatus(
  bridgeId: string,
  onUpdate: (result: BridgeStatusResult) => void,
  intervalMs = 3_000
): Promise<BridgeStatusResult> {
  // Derive a mock Stellar tx hash from the bridge ID
  const stellarTxHash = hashString(bridgeId + "stellar").toString(16).padStart(64, "0");

  for (const step of STATUS_SEQUENCE) {
    await delay(intervalMs);
    const result: BridgeStatusResult = {
      ...step,
      ...(step.status === "confirmed" ? { stellarTxHash } : {}),
    };
    onUpdate(result);
    if (step.status === "confirmed" || step.status === "failed") {
      return result;
    }
  }

  // Should not reach here, but satisfy TS
  const final: BridgeStatusResult = {
    status: "confirmed",
    message: "Payment confirmed on Stellar! ✓",
    stellarTxHash,
  };
  onUpdate(final);
  return final;
}

// ─── Internal utilities ───────────────────────────────────────────────────────

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Simple deterministic hash (djb2) — for mock tx hashes only. */
function hashString(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
    hash = hash >>> 0; // keep unsigned 32-bit
  }
  return hash;
}

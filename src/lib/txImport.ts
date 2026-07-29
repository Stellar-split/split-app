/**
 * Import an existing on-chain Stellar transaction and turn its payment
 * operations into invoice recipient lines, for retroactively recording
 * ad-hoc payments as StellarSplit invoices.
 */

export interface RecipientLine {
  address: string;
  amount: string;
  asset: string;
}

export interface IgnoredOperation {
  type: string;
  count: number;
}

export interface ImportedTxData {
  txHash: string;
  recipients: RecipientLine[];
  memo: string | null;
  ignoredOperations: IgnoredOperation[];
  createdAt: string;
}

export class TxImportError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "TxImportError";
  }
}

interface RawOperationRecord {
  type: string;
  from?: string;
  to?: string;
  amount?: string;
  asset_type?: string;
  asset_code?: string;
}

function assetLabel(op: RawOperationRecord): string {
  if (op.asset_type === "native") return "XLM";
  return op.asset_code ?? "unknown";
}

/**
 * Map raw Horizon operation records for a transaction into recipient lines,
 * ignoring anything that isn't a payment or path payment.
 */
export function parseTransactionOperations(
  operations: RawOperationRecord[]
): { recipients: RecipientLine[]; ignoredOperations: IgnoredOperation[] } {
  const recipients: RecipientLine[] = [];
  const ignoredCounts = new Map<string, number>();

  for (const op of operations) {
    if (
      op.type === "payment" ||
      op.type === "path_payment_strict_send" ||
      op.type === "path_payment_strict_receive"
    ) {
      if (!op.to || !op.amount) {
        ignoredCounts.set(op.type, (ignoredCounts.get(op.type) ?? 0) + 1);
        continue;
      }
      recipients.push({
        address: op.to,
        amount: op.amount,
        asset: assetLabel(op),
      });
    } else {
      ignoredCounts.set(op.type, (ignoredCounts.get(op.type) ?? 0) + 1);
    }
  }

  return {
    recipients,
    ignoredOperations: [...ignoredCounts.entries()].map(([type, count]) => ({ type, count })),
  };
}

function horizonUrlFor(network: "mainnet" | "testnet"): string {
  return network === "mainnet"
    ? "https://horizon.stellar.org"
    : "https://horizon-testnet.stellar.org";
}

function currentNetwork(): "mainnet" | "testnet" {
  return process.env.NEXT_PUBLIC_STELLAR_NETWORK === "mainnet" ? "mainnet" : "testnet";
}

async function transactionExistsOn(
  network: "mainnet" | "testnet",
  hash: string
): Promise<boolean> {
  try {
    const res = await fetch(`${horizonUrlFor(network)}/transactions/${hash}`);
    return res.ok;
  } catch {
    return false;
  }
}

const HASH_RE = /^[0-9a-fA-F]{64}$/;

/**
 * Fetch a transaction from Horizon and its operations, returning invoice
 * import data. Throws TxImportError with an HTTP-style status for the
 * invalid-hash, not-found, and wrong-network cases so the API route can
 * map them to sensible responses.
 */
export async function fetchImportedTransaction(hash: string): Promise<ImportedTxData> {
  const trimmed = hash.trim();
  if (!HASH_RE.test(trimmed)) {
    throw new TxImportError("That doesn't look like a valid transaction hash (expected 64 hex characters).", 400);
  }

  const network = currentNetwork();
  const { Horizon } = await import("@stellar/stellar-sdk");
  const server = new Horizon.Server(horizonUrlFor(network));

  let tx;
  try {
    tx = await server.transactions().transaction(trimmed).call();
  } catch (err) {
    const notFound =
      (err as { response?: { status?: number } })?.response?.status === 404;
    if (notFound) {
      const otherNetwork = network === "mainnet" ? "testnet" : "mainnet";
      const existsElsewhere = await transactionExistsOn(otherNetwork, trimmed);
      if (existsElsewhere) {
        throw new TxImportError(
          `This transaction exists on ${otherNetwork}, but this app is currently configured for ${network}. Switch networks and try again.`,
          409
        );
      }
      throw new TxImportError("No transaction found for that hash.", 404);
    }
    throw new TxImportError(
      `Failed to fetch transaction: ${err instanceof Error ? err.message : String(err)}`,
      502
    );
  }

  const opsPage = await server.operations().forTransaction(trimmed).call();
  const { recipients, ignoredOperations } = parseTransactionOperations(
    opsPage.records as unknown as RawOperationRecord[]
  );

  if (recipients.length === 0) {
    throw new TxImportError(
      "This transaction has no payment operations that can be imported as invoice recipients.",
      422
    );
  }

  const memo = tx.memo_type && tx.memo_type !== "none" ? tx.memo ?? null : null;

  return {
    txHash: trimmed,
    recipients,
    memo,
    ignoredOperations,
    createdAt: tx.created_at,
  };
}

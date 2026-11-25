"use client";

import { useCallback, useRef, useState } from "react";
import { signTransaction, NETWORK_PASSPHRASE } from "@/lib/freighter";
import { signWithLedger, isLedgerError } from "@/lib/ledger";
import { classifyError } from "@/lib/errors";
import { useToast } from "@/contexts/ToastContext";
import { useWalletContext } from "@/contexts/WalletContext";

const HORIZON_URL =
  process.env.NEXT_PUBLIC_HORIZON_URL ??
  (process.env.NEXT_PUBLIC_STELLAR_NETWORK === "mainnet"
    ? "https://horizon.stellar.org"
    : "https://horizon-testnet.stellar.org");

/** Poll interval and ceiling for Horizon confirmation. */
const POLL_INTERVAL_MS = 400;
const POLL_TIMEOUT_MS = 30_000;

export type TransactionStatus = "idle" | "signing" | "pending" | "success" | "error";

export interface SubmitOptions {
  /** Message shown on a confirmed transaction. */
  successMessage?: string;
  /** Overrides the derived error message on failure. */
  errorMessage?: string;
}

export interface SubmitResult {
  txHash: string;
}

/**
 * Freighter returns a rejection when the user declines the signature prompt.
 * The wording differs across Freighter versions, so match on the common shapes
 * rather than a single string.
 */
function isUserRejection(error: unknown): boolean {
  const text = error instanceof Error ? error.message : String(error);
  return /user (declined|rejected|denied)|request(ed)? (was )?rejected|denied by (the )?user|user cancell?ed/i.test(
    text
  );
}

/**
 * Ledger reports a declined signature with its own status codes rather than
 * the Freighter wording, so check both shapes.
 */
function isLedgerRejection(error: unknown): boolean {
  if (!isLedgerError(error)) return false;
  return error.code === "user_rejected" || error.code === "denied";
}

/**
 * Sign a transaction with the connected wallet, submit it to Horizon, and
 * surface the outcome as a toast.
 *
 * The returned `submit` resolves with the transaction hash on confirmation and
 * rejects on rejection/failure — callers that need to branch can still catch,
 * but the user-facing toast is already handled here.
 */
export function useStellarTransaction() {
  const toast = useToast();
  const { address, walletType } = useWalletContext();
  const [status, setStatus] = useState<TransactionStatus>("idle");
  const [txHash, setTxHash] = useState<string | null>(null);
  // Guards against a double-submit from an impatient second click.
  const inFlight = useRef(false);

  const submit = useCallback(
    async (unsignedXdr: string, options: SubmitOptions = {}): Promise<SubmitResult> => {
      if (inFlight.current) {
        throw new Error("A transaction is already in progress.");
      }
      inFlight.current = true;
      setStatus("signing");
      setTxHash(null);

      try {
        let signedXdr: string;
        try {
          if (walletType === "ledger") {
            // signWithLedger displays the transaction on the device and waits
            // for the user to confirm before returning the signed envelope.
            signedXdr = await signWithLedger(unsignedXdr, NETWORK_PASSPHRASE);
          } else {
            signedXdr = await signTransaction(unsignedXdr);
          }
        } catch (err) {
          if (isUserRejection(err) || isLedgerRejection(err)) {
            toast.error("Transaction rejected in your wallet.");
            setStatus("error");
            throw err;
          }
          if (isLedgerError(err)) {
            // Connection/transport failures get a Ledger-specific message.
            toast.error(err.message);
            setStatus("error");
            throw err;
          }
          throw err;
        }

        setStatus("pending");

        const { Horizon, TransactionBuilder } = await import("@stellar/stellar-sdk");
        const server = new Horizon.Server(HORIZON_URL);
        const tx = TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE);

        const submitted = await server.submitTransaction(tx);
        const hash = submitted.hash;

        const confirmed = await pollForConfirmation(server, hash);
        if (!confirmed) {
          throw new Error("Transaction did not confirm before timing out.");
        }

        setTxHash(hash);
        setStatus("success");
        toast.success(options.successMessage ?? "Transaction confirmed.");
        return { txHash: hash };
      } catch (err) {
        setStatus("error");
        // A user rejection or Ledger transport error already produced its own
        // toast above.
        if (!isUserRejection(err) && !isLedgerError(err)) {
          toast.error(options.errorMessage ?? describeFailure(err));
        }
        throw err;
      } finally {
        inFlight.current = false;
      }
    },
    [toast, walletType]
  );

  const reset = useCallback(() => {
    setStatus("idle");
    setTxHash(null);
  }, []);

  return { submit, reset, status, txHash, isSubmitting: status === "signing" || status === "pending" };
}

/**
 * Poll Horizon until the transaction appears as successful.
 *
 * Horizon 404s until the transaction is included in a ledger, so a miss is not
 * an error — only an explicit `successful: false` or the timeout is.
 */
async function pollForConfirmation(
  server: { transactions: () => { transaction: (hash: string) => { call: () => Promise<{ successful?: boolean }> } } },
  hash: string
): Promise<boolean> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;

  while (Date.now() < deadline) {
    try {
      const record = await server.transactions().transaction(hash).call();
      if (record.successful === false) {
        throw new Error("Transaction failed on-chain.");
      }
      if (record.successful) return true;
    } catch (err) {
      if (err instanceof Error && err.message === "Transaction failed on-chain.") {
        throw err;
      }
      // Not yet visible on Horizon — keep polling.
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  return false;
}

/** Turn a Horizon or SDK error into something a user can act on. */
function describeFailure(error: unknown): string {
  const horizonResult = (error as { response?: { data?: { extras?: { result_codes?: { transaction?: string } } } } })
    ?.response?.data?.extras?.result_codes?.transaction;

  if (horizonResult) {
    return `Transaction failed: ${horizonResult}`;
  }

  const errorMsg = (error as any)?.message || String(error) || 'Unknown error';
  const classified = classifyError(error);

  const messages: Record<string, string> = {
    network: 'Network connection failed. Please check your internet and try again.',
    timeout: 'Request timed out. Please try again.',
    validation: 'Invalid transaction data. Please check and try again.',
    contract: 'Contract execution failed. Please try again.',
    wallet_not_connected: 'Wallet not connected. Please connect a wallet first.',
    invoice_not_found: 'Invoice not found.',
    rpc_error: 'RPC error occurred. Please try again.',
    rpc_timeout: 'RPC request timed out. Please try again.',
    unknown: errorMsg,
  };

  return messages[classified] || errorMsg;
}

export default useStellarTransaction;

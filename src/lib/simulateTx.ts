/**
 * Transaction simulation utilities for Stellar.
 * Wraps the Stellar RPC's simulateTransaction endpoint.
 */

import { RPC_URL } from "./stellar";

export interface LedgerEffect {
  accountId: string;
  balanceChange: {
    assetCode: string;
    change: string; // amount as string
  };
}

export interface SimulationResult {
  success: boolean;
  fee: number;
  effects: LedgerEffect[];
  authEntries?: string[];
  error?: string;
  estimatedGas?: number;
}

export async function simulateTransaction(transactionXdr: string): Promise<SimulationResult> {
  try {
    const response = await fetch(RPC_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "simulateTransaction",
        params: {
          transaction: transactionXdr,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    if (data.error) {
      return {
        success: false,
        fee: 0,
        effects: [],
        error: data.error.message || "Simulation failed",
      };
    }

    const result = data.result;
    if (!result) {
      return {
        success: false,
        fee: 0,
        effects: [],
        error: "No simulation result returned",
      };
    }

    const isSuccess = result.transactionResult?.resultCode === "txSUCCESS" || !!result.results;
    const fee = parseInt(result.latestLedgerBumpSeqNum || "0", 10) || 0;
    const estimatedGas = result.cost?.cpuInstructions || result.cost?.memoryBytes || 0;

    const effects: LedgerEffect[] = [];
    if (result.results?.[0]?.effects) {
      result.results[0].effects.forEach(
        (effect: {
          type?: string;
          account?: string;
          balance?: string;
          asset?: { code?: string };
        }) => {
          if (effect.account && (effect.type === "account_created" || effect.type === "account_debited" || effect.type === "account_credited")) {
            effects.push({
              accountId: effect.account,
              balanceChange: {
                assetCode: effect.asset?.code || "XLM",
                change: effect.balance || "0",
              },
            });
          }
        }
      );
    }

    const authEntries: string[] = [];
    if (result.sorobanResourceFee || result.auth) {
      if (Array.isArray(result.auth)) {
        result.auth.forEach((auth: { rootInvocation?: { function?: { contractId?: string; name?: string } } }) => {
          if (auth.rootInvocation?.function) {
            const { contractId, name } = auth.rootInvocation.function;
            authEntries.push(`Contract ${contractId}: ${name || "invoke"}`);
          }
        });
      }
    }

    return {
      success: isSuccess,
      fee,
      effects,
      authEntries: authEntries.length > 0 ? authEntries : undefined,
      estimatedGas,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown simulation error";
    return {
      success: false,
      fee: 0,
      effects: [],
      error: errorMessage,
    };
  }
}

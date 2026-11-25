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
      return {
        success: false,
        fee: 0,
        effects: [],
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
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
    if (!isSuccess) {
      return {
        success: false,
        fee: 0,
        effects: [],
        error: `Transaction simulation failed: ${result.transactionResult?.resultCode ?? "unknown"}`,
      };
    }

    const fee = parseInt(result.latestLedgerBumpSeqNum || "0", 10) || 0;
    const estimatedGas = result.cost?.cpuInstructions || result.cost?.memoryBytes || 0;

    const effects: LedgerEffect[] = [];
    for (const entry of result.results ?? []) {
      for (const effect of entry.effects ?? []) {
        if (!effect.account) continue;
        effects.push({
          accountId: effect.account,
          balanceChange: {
            assetCode: effect.asset?.code || "XLM",
            change: effect.balance || "0",
          },
        });
      }
    }

    const authEntries: string[] = [];
    if (Array.isArray(result.auth)) {
      result.auth.forEach((auth: { rootInvocation?: { function?: { contractId?: string; name?: string } } }) => {
        if (auth.rootInvocation?.function) {
          const { contractId, name } = auth.rootInvocation.function;
          authEntries.push(`Contract ${contractId}: ${name || "invoke"}`);
        }
      });
    }

    return {
      success: true,
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

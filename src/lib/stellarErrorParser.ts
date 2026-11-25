import {
  AppError,
  AppErrorCode,
  createAppError,
  RecoverySuggestion,
} from './appError';

export type ErrorActionType = 'bump-fee' | 'refresh-seq' | 'fund-destination' | 'manual';

export interface ParsedStellarError {
  code: string;
  title: string;
  explanation: string;
  suggestedAction: string;
  actionType: ErrorActionType;
}

/**
 * Maps a Stellar/Horizon result code to the AppError taxonomy code.
 */
const STELLAR_TO_APP_ERROR_CODE: Record<string, AppErrorCode> = {
  tx_insufficient_fee: 'STELLAR_INSUFFICIENT_FEE',
  tx_bad_seq: 'STELLAR_BAD_SEQUENCE',
  op_no_destination: 'STELLAR_NO_DESTINATION',
  op_underfunded: 'STELLAR_UNDERFUNDED',
  tx_failed: 'STELLAR_TX_FAILED',
  op_no_trust: 'STELLAR_NO_TRUSTLINE',
};

/**
 * Whether a given Stellar result code is worth retrying (possibly after a
 * recovery action such as bumping the fee or refreshing the sequence).
 */
const STELLAR_RETRYABLE: Record<string, boolean> = {
  tx_insufficient_fee: true,
  tx_bad_seq: true,
  op_no_destination: false,
  op_underfunded: false,
  tx_failed: false,
  op_no_trust: false,
};

/**
 * Recovery suggestions keyed by Stellar result code, expressed in the
 * AppError taxonomy so they can be surfaced consistently across the app.
 */
const STELLAR_RECOVERY: Record<string, RecoverySuggestion[]> = {
  tx_insufficient_fee: [
    {
      label: 'Increase transaction fee',
      description: 'Bump the fee to match current network conditions.',
      actionType: 'bump-fee',
    },
  ],
  tx_bad_seq: [
    {
      label: 'Refresh sequence number',
      description: 'Reload the account sequence from the network and retry.',
      actionType: 'refresh-seq',
    },
  ],
  op_no_destination: [
    {
      label: 'Fund destination account',
      description: 'Send at least 1 XLM to the destination to activate it.',
      actionType: 'fund-destination',
    },
  ],
  op_underfunded: [
    {
      label: 'Add funds',
      description: 'Top up the source account balance and try again.',
      actionType: 'manual',
    },
  ],
  tx_failed: [
    {
      label: 'Review transaction details',
      description: 'Check the detailed error and verify account requirements.',
      actionType: 'manual',
    },
  ],
  op_no_trust: [
    {
      label: 'Create trustline',
      description: 'Establish a trustline for the asset before retrying.',
      actionType: 'manual',
    },
  ],
};

const ERROR_MAPPING: Record<string, ParsedStellarError> = {
  tx_insufficient_fee: {
    code: 'tx_insufficient_fee',
    title: 'Insufficient Transaction Fee',
    explanation: 'The transaction fee is too low for current network conditions. Network fees fluctuate based on demand.',
    suggestedAction: 'Increase the transaction fee using the fee bump slider. Check the median network fee and increase yours accordingly.',
    actionType: 'bump-fee',
  },
  tx_bad_seq: {
    code: 'tx_bad_seq',
    title: 'Invalid Sequence Number',
    explanation: 'The transaction sequence number is outdated or invalid. This can happen if another transaction from this account was recently submitted.',
    suggestedAction: 'Refresh the sequence number from the blockchain and rebuild the transaction.',
    actionType: 'refresh-seq',
  },
  op_no_destination: {
    code: 'op_no_destination',
    title: 'Destination Account Not Found',
    explanation: 'The recipient account does not exist on the Stellar network. New accounts must be funded first.',
    suggestedAction: 'Fund the destination account with at least 1 XLM (or use Friendbot on testnet), then retry this payment.',
    actionType: 'fund-destination',
  },
  op_underfunded: {
    code: 'op_underfunded',
    title: 'Insufficient Balance',
    explanation: 'The source account does not have enough balance to cover the payment and transaction fees.',
    suggestedAction: 'Add more funds to your account and try again.',
    actionType: 'manual',
  },
  tx_failed: {
    code: 'tx_failed',
    title: 'Transaction Failed',
    explanation: 'An operation in the transaction failed. This could be due to various reasons including trustline issues.',
    suggestedAction: 'Check the detailed error message and verify all account requirements are met.',
    actionType: 'manual',
  },
  op_no_trust: {
    code: 'op_no_trust',
    title: 'Missing Trustline',
    explanation: 'The account does not have a trustline for the asset being transferred.',
    suggestedAction: 'Establish a trustline for this asset first, then retry.',
    actionType: 'manual',
  },
  ledger_not_connected: {
    code: 'ledger_not_connected',
    title: 'Ledger Device Not Connected',
    explanation: 'No Ledger hardware wallet was detected. The device may be unplugged, or the browser may not have permission to access it.',
    suggestedAction: 'Connect your Ledger device via USB, unlock it, and make sure the Stellar app is installed. Then retry the connection.',
    actionType: 'manual',
  },
  ledger_locked: {
    code: 'ledger_locked',
    title: 'Ledger Device Locked',
    explanation: 'The Ledger device is locked and cannot sign transactions until it is unlocked.',
    suggestedAction: 'Unlock your Ledger device with your PIN, open the Stellar app, and retry.',
    actionType: 'manual',
  },
  ledger_app_not_open: {
    code: 'ledger_app_not_open',
    title: 'Stellar App Not Open on Ledger',
    explanation: 'The Ledger device is connected but the Stellar app is not currently open.',
    suggestedAction: 'Open the Stellar app on your Ledger device and retry the operation.',
    actionType: 'manual',
  },
  ledger_denied: {
    code: 'ledger_denied',
    title: 'Transaction Rejected on Ledger',
    explanation: 'The transaction was rejected on the Ledger device. Signing was cancelled or the transaction details were not approved.',
    suggestedAction: 'Review the transaction details on your Ledger device and approve the signing request, then retry.',
    actionType: 'manual',
  },
};

export function parseStellarError(errorCode: string, rawError?: any): ParsedStellarError {
  const normalizedCode = errorCode.toLowerCase().trim();

  // Check direct mapping
  if (ERROR_MAPPING[normalizedCode]) {
    return ERROR_MAPPING[normalizedCode];
  }

  // Try to extract result_code from Horizon error response
  const resultCode = rawError?.response?.data?.result_code || rawError?.result_code;
  if (resultCode && ERROR_MAPPING[resultCode]) {
    return ERROR_MAPPING[resultCode];
  }

  // Check for partial matches (e.g., "tx_insufficient_fee" in larger error string)
  for (const [key, value] of Object.entries(ERROR_MAPPING)) {
    if (normalizedCode.includes(key) || (typeof rawError === 'string' && rawError.includes(key))) {
      return value;
    }
  }

  // Fallback for unknown errors
  return {
    code: 'unknown_error',
    title: 'Transaction Error',
    explanation: `The transaction failed with error: ${errorCode}`,
    suggestedAction: 'Review the error details and contact support if the issue persists.',
    actionType: 'manual',
  };
}

export function isBumpFeeError(error: any): boolean {
  const parsed = parseStellarError(error?.message || error?.code || String(error), error);
  return parsed.actionType === 'bump-fee';
}

export function isSequenceError(error: any): boolean {
  const parsed = parseStellarError(error?.message || error?.code || String(error), error);
  return parsed.actionType === 'refresh-seq';
}

export function isFundingError(error: any): boolean {
  const parsed = parseStellarError(error?.message || error?.code || String(error), error);
  return parsed.actionType === 'fund-destination';
}

/**
 * Extracts a normalized Stellar result code from a variety of error shapes:
 * plain strings, Horizon HTTP error responses, and RPC error objects.
 */
export function extractStellarResultCode(error: unknown): string | undefined {
  if (error == null) return undefined;

  if (typeof error === 'string') {
    const trimmed = error.trim();
    return trimmed.length > 0 ? trimmed.toLowerCase() : undefined;
  }

  if (typeof error !== 'object') {
    return String(error).toLowerCase();
  }

  const anyError = error as any;

  // Horizon HTTP response shape: { response: { data: { result_code, extras: { result_codes } } } }
  const data = anyError.response?.data ?? anyError.data;
  if (data) {
    if (typeof data.result_code === 'string') {
      return data.result_code.toLowerCase();
    }
    const resultCodes = data.extras?.result_codes;
    if (resultCodes) {
      const candidates: unknown[] = [
        ...(Array.isArray(resultCodes.transaction) ? resultCodes.transaction : [resultCodes.transaction]),
        ...(Array.isArray(resultCodes.operations) ? resultCodes.operations : [resultCodes.operations]),
      ];
      for (const candidate of candidates) {
        if (typeof candidate === 'string' && candidate.length > 0) {
          return candidate.toLowerCase();
        }
      }
    }
  }

  // RPC / generic error object shapes
  if (typeof anyError.result_code === 'string') {
    return anyError.result_code.toLowerCase();
  }
  if (typeof anyError.code === 'string') {
    return anyError.code.toLowerCase();
  }
  if (typeof anyError.message === 'string') {
    return anyError.message.toLowerCase();
  }

  return undefined;
}

/**
 * Normalizes any Stellar/Horizon/RPC error into the AppError taxonomy.
 * Known result codes map to specific AppError codes with retryable flags and
 * recovery suggestions; unknown codes fall back to a generic AppError.
 */
export function toAppError(error: unknown): AppError {
  const resultCode = extractStellarResultCode(error);

  if (resultCode) {
    // Direct or partial match against known Stellar result codes.
    let matchedKey: string | undefined;
    if (STELLAR_TO_APP_ERROR_CODE[resultCode]) {
      matchedKey = resultCode;
    } else {
      matchedKey = Object.keys(STELLAR_TO_APP_ERROR_CODE).find((key) =>
        resultCode.includes(key),
      );
    }

    if (matchedKey) {
      const parsed = ERROR_MAPPING[matchedKey];
      return createAppError({
        code: STELLAR_TO_APP_ERROR_CODE[matchedKey],
        title: parsed.title,
        message: parsed.explanation,
        retryable: STELLAR_RETRYABLE[matchedKey] ?? false,
        recovery: STELLAR_RECOVERY[matchedKey] ?? [],
        cause: error,
        context: { stellarResultCode: matchedKey },
      });
    }
  }

  // Fallback for unknown errors.
  return createAppError({
    code: 'UNKNOWN_ERROR',
    title: 'Transaction Error',
    message: resultCode
      ? `The transaction failed with error: ${resultCode}`
      : 'An unexpected error occurred while processing the transaction.',
    retryable: false,
    recovery: [
      {
        label: 'Review error details',
        description: 'Review the error details and contact support if the issue persists.',
        actionType: 'manual',
      },
    ],
    cause: error,
    context: resultCode ? { stellarResultCode: resultCode } : undefined,
  });
}

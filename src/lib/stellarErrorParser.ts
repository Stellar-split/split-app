export type ErrorActionType = 'bump-fee' | 'refresh-seq' | 'fund-destination' | 'manual';

export interface ParsedStellarError {
  code: string;
  title: string;
  explanation: string;
  suggestedAction: string;
  actionType: ErrorActionType;
}

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
